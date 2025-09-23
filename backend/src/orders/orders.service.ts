// src/orders/orders.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './create-order.dto';
import { UpdateOrderDto } from './update-order.dto';
import { OrderStatus, Role } from '@prisma/client';

// Utilidades de envío/distancia y configuración (.env)
import { haversineKm, shippingForKm } from '../common/geo';
import { SHIPPING_CFG, assertShippingEnv } from '../config/shipping';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // Qué incluimos siempre al devolver una orden
  private readonly orderInclude = {
    items: { include: { product: true } },
    user: { select: { id: true, email: true, name: true, role: true } },
  } as const;

  // ===== US09: Crear orden (transacción + validaciones + envío) =====
  async create(userId: number, dto: CreateOrderDto) {
    assertShippingEnv();

    // 1) Dirección del usuario (y pertenencia)
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
      select: {
        id: true,
        label: true,
        line1: true,
        city: true,
        lat: true,
        lng: true,
      },
    });
    if (!address) throw new NotFoundException('ADDRESS_NOT_FOUND');
    if (address.lat == null || address.lng == null) {
      throw new BadRequestException('ADDRESS_MISSING_GEO');
    }

    // 2) Cobertura (tienda -> cliente)
    const km = haversineKm(
      { lat: SHIPPING_CFG.store.lat, lng: SHIPPING_CFG.store.lng },
      { lat: address.lat, lng: address.lng },
    );
    if (km > SHIPPING_CFG.radiusKm) {
      throw new BadRequestException('COVERAGE_OUT_OF_RANGE');
    }

    // 3) Items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('EMPTY_CART');
    }
    const ids = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, price: true, stock: true },
    });
    if (products.length !== ids.length) {
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }

    // 4) Validar stock + subtotal
    const byId = new Map(products.map((p) => [p.id, p]));
    let subtotal = 0;
    for (const it of dto.items) {
      const p = byId.get(it.productId)!;
      if (p.stock < it.quantity)
        throw new ConflictException(`OUT_OF_STOCK:${p.id}`);
      subtotal += p.price * it.quantity;
    }

    // 5) Envío y total
    const shipping = shippingForKm(
      km,
      SHIPPING_CFG.base,
      SHIPPING_CFG.perKm,
      SHIPPING_CFG.min,
    );
    const total = subtotal + shipping;

    // 6) Transacción: create order + items + decrementos condicionales
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          total,
          status: OrderStatus.RECIBIDO,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
        include: this.orderInclude,
      });

      for (const it of dto.items) {
        const res = await tx.product.updateMany({
          where: { id: it.productId, stock: { gte: it.quantity } },
          data: { stock: { decrement: it.quantity } },
        });
        if (res.count !== 1)
          throw new ConflictException(`OUT_OF_STOCK:${it.productId}`);
      }

      return order;
    });

    // 7) Respuesta enriquecida para FE
    return {
      ...created,
      subtotal,
      shipping,
      total, // redundante pero útil en FE
      address, // referencia de entrega (no se persiste en Order en este MVP)
    };
  }

  // ===== Utilidad heredada: usada en update() si reemplazas items =====
  private async calcTotal(items: { productId: number; quantity: number }[]) {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, price: true },
    });
    const priceMap = new Map(products.map((p) => [p.id, p.price]));
    return items.reduce(
      (sum, i) => sum + (priceMap.get(i.productId) ?? 0) * i.quantity,
      0,
    );
  }

  // ===== Admin / Consultas =====
  async findAll() {
    return this.prisma.order.findMany({
      orderBy: { id: 'desc' },
      include: this.orderInclude,
    });
  }

  async findMine(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      include: this.orderInclude,
    });
  }

  async findOneAs(id: number, user: { id: number; role: Role }) {
    const where = user.role === 'ADMIN' ? { id } : { id, userId: user.id };
    const order = await this.prisma.order.findFirst({
      where,
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // (Compat) Ver por id sin verificar dueño/admin
  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
    return order;
  }

  // Actualizar (ADMIN). Reemplaza items si vienen y recalcula total.
  async update(id: number, dto: UpdateOrderDto) {
    const { items, ...rest } = dto;

    let totalUpdate: number | undefined;
    if (items) {
      await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
      totalUpdate = await this.calcTotal(items);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        ...rest,
        ...(totalUpdate !== undefined ? { total: totalUpdate } : {}),
        items: items
          ? {
              create: items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
              })),
            }
          : undefined,
      },
      include: this.orderInclude,
    });

    return updated;
  }

  // Cambiar estado (solo ADMIN)
  async updateStatus(id: number, status: OrderStatus) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: this.orderInclude,
    });
    return order;
  }

  // Eliminar (solo ADMIN)
  async remove(id: number) {
    await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
    await this.prisma.order.delete({ where: { id } });
    return { id };
  }
}
