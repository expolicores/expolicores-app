// src/promotions/promotions.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type PromotionType =
  | 'PRICE_OVERRIDE'
  | 'PERCENT_OFF'
  | 'X_FOR_Y'
  | 'GIFT_WITH_PURCHASE';

type CreateOrUpdateDto = {
  name?: string;
  type?: PromotionType;
  audience?: 'ANY' | 'B2C' | 'B2B';
  active?: boolean;
  stacking?: boolean;
  priority?: number;
  startsAt?: string; // ISO
  endsAt?: string;   // ISO
  products?: Array<{ productId: string; minQty?: number }>;
  /**
   * Formatos esperados por tipo:
   * - PRICE_OVERRIDE       => { price: number }
   * - PERCENT_OFF          => { percent: number }
   * - X_FOR_Y              => { x: number, y: number, bundleId: string, components?: Array<{ productId: string, qty: number }> }
   * - GIFT_WITH_PURCHASE   => { bundleId: string, triggerProductId: string, giftProductId: string, triggerQty?: number, components?: Array<{ productId: string, qty: number }> }
   */
  benefits?: any;
  conditions?: any;  // { minQty?, minSpend?, categoryIds?, metadata?: { bannerKey?, imageUrl? } ... }
};

type Audience = 'B2C' | 'B2B';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------
  // Helpers
  // ---------------------------
  private validatePayload(dto: CreateOrUpdateDto) {
    if (!dto.type) return; // update parcial puede no cambiar type/benefits
    const { type, benefits } = dto;

    if (type === 'PRICE_OVERRIDE') {
      if (!benefits || typeof benefits.price !== 'number' || benefits.price < 0) {
        throw new BadRequestException('PRICE_OVERRIDE requiere benefits.price >= 0');
      }
      return;
    }

    if (type === 'PERCENT_OFF') {
      const p = benefits?.percent;
      if (typeof p !== 'number' || p <= 0 || p >= 100) {
        throw new BadRequestException('PERCENT_OFF requiere benefits.percent en (0,100)');
      }
      return;
    }

    if (type === 'X_FOR_Y') {
      const x = benefits?.x;
      const y = benefits?.y;
      const bundleId = benefits?.bundleId;
      if (!Number.isInteger(x) || x <= 0) throw new BadRequestException('X_FOR_Y requiere benefits.x entero > 0');
      if (!Number.isInteger(y) || y <= 0) throw new BadRequestException('X_FOR_Y requiere benefits.y entero > 0');
      if (!bundleId || typeof bundleId !== 'string') throw new BadRequestException('X_FOR_Y requiere benefits.bundleId');
      return;
    }

    if (type === 'GIFT_WITH_PURCHASE') {
      const { bundleId, triggerProductId, giftProductId } = benefits ?? {};
      if (!bundleId || typeof bundleId !== 'string') throw new BadRequestException('GWP requiere benefits.bundleId');
      if (!triggerProductId || !giftProductId) {
        throw new BadRequestException('GWP requiere triggerProductId y giftProductId');
      }
      return;
    }

    throw new BadRequestException('Tipo de promoción no soportado');
  }

  /** Normaliza/arma components para BundleMap si no llegan explícitos en benefits.components */
  private buildComponentsForBundle(
    type: PromotionType | undefined,
    dto: CreateOrUpdateDto,
  ): Array<{ productId: string; qty: number }> {
    const benefits = dto.benefits ?? {};
    const explicit = Array.isArray(benefits.components) ? benefits.components : undefined;

    if (explicit?.length) {
      return explicit
        .map((c: any) => ({ productId: String(c.productId), qty: Number(c.qty) }))
        .filter(c => !!c.productId && Number.isFinite(c.qty) && c.qty > 0);
    }

    // Inferencias mínimas por tipo:
    if (type === 'X_FOR_Y') {
      const target = (dto.products ?? [])[0]?.productId;
      const x = Number(benefits.x);
      if (target && Number.isFinite(x) && x > 0) {
        return [{ productId: String(target), qty: x }];
      }
    }

    if (type === 'GIFT_WITH_PURCHASE') {
      const trigger = benefits.triggerProductId
        ? String(benefits.triggerProductId)
        : (dto.products ?? [])[0]?.productId;
      const gift = benefits.giftProductId
        ? String(benefits.giftProductId)
        : (dto.products ?? [])[1]?.productId;
      const triggerQty = Number(benefits.triggerQty ?? 1);
      const comps: Array<{ productId: string; qty: number }> = [];
      if (trigger && Number.isFinite(triggerQty) && triggerQty > 0) {
        comps.push({ productId: String(trigger), qty: triggerQty });
      }
      if (gift) comps.push({ productId: String(gift), qty: 1 });
      if (comps.length) return comps;
    }

    // Fallback: usa products con minQty (o 1)
    const fromProducts = (dto.products ?? [])
      .map(p => ({ productId: String(p.productId), qty: Number(p.minQty ?? 1) }))
      .filter(c => !!c.productId && Number.isFinite(c.qty) && c.qty > 0);

    return fromProducts;
  }

  /** Crea/actualiza el registro de BundleMap cuando el tipo es combo (X_FOR_Y / GWP) */
  private async upsertBundleMapIfNeeded(type: PromotionType | undefined, dto: CreateOrUpdateDto) {
    if (type !== 'X_FOR_Y' && type !== 'GIFT_WITH_PURCHASE') return;

    const benefits = dto.benefits ?? {};
    const bundleId = benefits.bundleId;
    if (!bundleId || typeof bundleId !== 'string') {
      throw new BadRequestException('bundleId requerido para combos (X_FOR_Y, GWP)');
    }

    const components = this.buildComponentsForBundle(type, dto);
    if (!components?.length) {
      throw new BadRequestException('No se pudieron determinar componentes para BundleMap');
    }

    await this.prisma.bundleMap.upsert({
      where: { bundleId },
      update: { components: components as any, active: true },
      create: { bundleId, components: components as any, active: true },
    });
  }

  // ---------------------------
  // CRUD (ADMIN)
  // ---------------------------
  async create(dto: CreateOrUpdateDto) {
    // validaciones básicas
    if (!dto.name) throw new BadRequestException('name es requerido');
    if (!dto.startsAt || !dto.endsAt) {
      throw new BadRequestException('startsAt y endsAt son requeridos (ISO)');
    }
    this.validatePayload(dto);

    // Si es combo, registra/actualiza BundleMap
    await this.upsertBundleMapIfNeeded(dto.type, dto);

    const { products = [], ...rest } = dto;

    return this.prisma.promotion.create({
      data: {
        name: rest.name!,
        type: rest.type as any,
        audience: (rest.audience ?? 'ANY') as any,
        active: rest.active ?? true,
        stacking: rest.stacking ?? false,
        priority: rest.priority ?? 100,
        startsAt: new Date(rest.startsAt!),
        endsAt: new Date(rest.endsAt!),
        benefitsJson: rest.benefits ?? undefined,
        conditionsJson: rest.conditions ?? undefined,
        products: {
          create: products.map((p) => ({
            productId: String(p.productId),
            minQty: p.minQty ?? null,
          })),
        },
      },
      include: { products: true },
    });
  }

  async findAll(query: { active?: string; type?: string; audience?: string } = {}) {
    const { active, type, audience } = query;
    return this.prisma.promotion.findMany({
      where: {
        active: typeof active === 'undefined' ? undefined : active === 'true',
        type: (type as any) ?? undefined,
        audience: (audience as any) ?? undefined,
      },
      orderBy: [{ priority: 'asc' }, { startsAt: 'asc' }],
      include: { products: true },
    });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!promo) throw new NotFoundException('Promotion not found');
    return promo;
  }

  async update(id: string, dto: CreateOrUpdateDto) {
    // Validar payload si cambia type/benefits
    if (dto.type || dto.benefits) this.validatePayload(dto);

    // Si es combo y llega info (type/benefits/products), asegurar BundleMap
    if (dto.type || dto.benefits || dto.products) {
      const current = await this.prisma.promotion.findUnique({ where: { id } });
      const type: PromotionType | undefined = (dto.type ?? (current?.type as any)) as PromotionType | undefined;
      const merged: CreateOrUpdateDto = {
        ...dto,
        type,
        benefits: dto.benefits ?? (current?.benefitsJson as any),
        products: dto.products ?? undefined,
      };
      await this.upsertBundleMapIfNeeded(type, merged);
    }

    const { products, ...rest } = dto;

    // Actualiza campos base
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        name: rest.name ?? undefined,
        type: (rest.type as any) ?? undefined,
        audience: (rest.audience as any) ?? undefined,
        active: typeof rest.active === 'boolean' ? rest.active : undefined,
        stacking: typeof rest.stacking === 'boolean' ? rest.stacking : undefined,
        priority: typeof rest.priority === 'number' ? rest.priority : undefined,
        startsAt: rest.startsAt ? new Date(rest.startsAt) : undefined,
        endsAt: rest.endsAt ? new Date(rest.endsAt) : undefined,
        benefitsJson: rest.benefits ?? undefined,
        conditionsJson: rest.conditions ?? undefined,
      },
    });

    // Si vienen productos, reemplaza relaciones
    if (Array.isArray(products)) {
      await this.prisma.promotionProduct.deleteMany({ where: { promotionId: id } });
      if (products.length) {
        await this.prisma.promotionProduct.createMany({
          data: products.map((p) => ({
            promotionId: id,
            productId: String(p.productId),
            minQty: p.minQty ?? null,
          })),
        });
      }
    }

    return this.findOne(id);
  }

  async softDelete(id: string) {
    // Soft delete simple: active=false
    return this.prisma.promotion.update({
      where: { id },
      data: { active: false },
    });
  }

  /**
   * Publicación del feed (hook).
   * Por ahora, devolvemos un resumen de vigentes como feedback rápido al admin.
   * La compilación a R2 queda fuera de esta fase.
   */
  async publish(id?: string) {
    if (id) await this.findOne(id); // valida existencia

    const now = new Date();
    const activeNow = await this.prisma.promotion.count({
      where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
    });

    return { message: 'Publish triggered', activeNow };
  }

  // ---------------------------
  // OVERLAY REMOTO (público/autenticado)
  // ---------------------------
  /**
   * Devuelve overlays vigentes para la audiencia indicada.
   * Formato: [{ id, name, productId, price?, imageUrl?, bannerKey? }]
   * Si `limit` es un número > 0, limita resultados. Si no, devuelve todos.
   */
  async getOverlayByAudience(audience: Audience, limit?: number) {
    const now = new Date();

    const promos = await this.prisma.promotion.findMany({
      where: {
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        OR: [{ audience }, { audience: 'ANY' as any }],
        // (evitamos usar relation filter products: { some: {} } por compatibilidad)
      },
      include: { products: { select: { productId: true }, take: 1 } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });

    return promos
      .filter((p: any) => Array.isArray(p.products) && p.products.length > 0)
      .map((p: any) => {
        const first = p.products[0];
        const productId = String(first?.productId ?? '');

        const benefits = (p as any).benefitsJson ?? {};
        const conditions = ((p as any).conditionsJson ?? {}) as any;
        const meta = conditions?.metadata ?? {};

        const price =
          typeof benefits.price === 'number' ? Number(benefits.price) : undefined;

        return {
          id: p.id,
          name: p.name,
          productId,                                // string (numérica o slug, según tu modelo)
          price,                                    // PRICE_OVERRIDE; si es % no se fuerza aquí
          imageUrl: meta.imageUrl ?? meta.img ?? undefined,
          bannerKey: meta.bannerKey ?? undefined,
        };
      });
  }
}
