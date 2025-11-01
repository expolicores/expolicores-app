// src/promotions/promotions.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateOrUpdateDto = {
  name?: string;
  type?: 'PRICE_OVERRIDE' | 'PERCENT_OFF';
  audience?: 'ANY' | 'B2C' | 'B2B';
  active?: boolean;
  stacking?: boolean;
  priority?: number;
  startsAt?: string; // ISO
  endsAt?: string;   // ISO
  products?: Array<{ productId: string; minQty?: number }>;
  benefits?: any;    // { price } | { percent }
  conditions?: any;  // { minQty?, minSpend?, categoryIds? ... }
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
    } else if (type === 'PERCENT_OFF') {
      const p = benefits?.percent;
      if (typeof p !== 'number' || p <= 0 || p >= 100) {
        throw new BadRequestException('PERCENT_OFF requiere benefits.percent en (0,100)');
      }
    } else {
      throw new BadRequestException('Tipo de promoción no soportado');
    }
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
            productId: p.productId,
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
            productId: p.productId,
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
   * Devuelve hasta 3 overlays vigentes para la audiencia indicada.
   * Formato: [{ id, name, productId, price?, imageUrl?, bannerKey? }]
   */
  async getOverlayByAudience(audience: Audience) {
    const now = new Date();

    const promos = await this.prisma.promotion.findMany({
      where: {
        // NOTA: si tu schema tuviera deletedAt, puedes filtrarlo aquí.
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        OR: [{ audience }, { audience: 'ANY' as any }],
        products: { some: {} },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 3,
      // seleccionamos solo lo necesario y el primer productId
      select: {
        id: true,
        name: true,
        audience: true,
        benefitsJson: true,
        conditionsJson: true,
        createdAt: true,
        priority: true,
        products: {
          select: { productId: true },
          take: 1,
        },
      },
    });

    return promos.map((p) => {
      const first = p.products?.[0];
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
