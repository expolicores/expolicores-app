// src/orders/orders.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './create-order.dto';
import { UpdateOrderDto } from './update-order.dto';
import { OrderStatus, Role } from '@prisma/client';
import { haversineKm, shippingForKm } from '../common/geo';
import shippingConfig from '../config/shipping';
import { ConfigType } from '@nestjs/config';
import { WhatsAppService } from '../notifications/whatsapp.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(shippingConfig.KEY)
    private readonly shipping: ConfigType<typeof shippingConfig>,
    private readonly whatsapp: WhatsAppService,
  ) {}

  private readonly orderInclude = {
    items: { include: { product: true } },
    user: { select: { id: true, email: true, name: true, role: true, phone: true } },
  } as const;

  async create(userId: number, dto: CreateOrderDto) {
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
      select: {
        id: true,
        label: true,
        line1: true,
        neighborhood: true,
        city: true,
        lat: true,
        lng: true,
        notes: true,
      },
    });
    if (!address) throw new NotFoundException('ADDRESS_NOT_FOUND');
    if (address.lat == null || address.lng == null) throw new BadRequestException('ADDRESS_MISSING_GEO');

    const km = haversineKm(
      { lat: this.shipping.store.lat, lng: this.shipping.store.lng },
      { lat: address.lat, lng: address.lng },
    );
    if (km > this.shipping.radiusKm) throw new BadRequestException('COVERAGE_OUT_OF_RANGE');

    if (!dto.items || dto.items.length === 0) throw new BadRequestException('EMPTY_CART');

    const ids = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, price: true, stock: true },
    });
    if (products.length !== ids.length) throw new NotFoundException('PRODUCT_NOT_FOUND');

    const byId = new Map(products.map((p) => [p.id, p]));
    let subtotal = 0;
    for (const it of dto.items) {
      const p = byId.get(it.productId)!;
      if (p.stock < it.quantity) throw new ConflictException(`OUT_OF_STOCK:${p.id}`);
      subtotal += p.price * it.quantity;
    }

    const shipping = shippingForKm(km, this.shipping.base, this.shipping.perKm, this.shipping.min);
    const total = subtotal + shipping;

    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          total,
          status: OrderStatus.RECIBIDO,
          items: { create: dto.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
        },
        include: this.orderInclude,
      });

      for (const it of dto.items) {
        const res = await tx.product.updateMany({
          where: { id: it.productId, stock: { gte: it.quantity } },
          data: { stock: { decrement: it.quantity } },
        });
        if (res.count !== 1) throw new ConflictException(`OUT_OF_STOCK:${it.productId}`);
      }

      return order;
    });

    // --- WhatsApp confirmación (US10) ---
    const toPhone = this.normalizeCoPhone(created.user?.phone ?? '');
    const addressLabel = address.label ?? 'Dirección';
    const addressLine = [address.line1, address.neighborhood, address.city].filter(Boolean).join(', ');
    const waItems = created.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      price: i.product.price,
    }));
    const notes = dto.notes ?? address.notes ?? undefined;

    const waRes = await this.whatsapp.sendOrderConfirmation({
      toPhone,
      orderId: created.id,
      subtotal,
      shipping,
      total: created.total,
      paymentMethod: dto.paymentMethod ?? 'COD',
      items: waItems,
      addressLabel,
      addressLine,
      notes,
      tenant: 'Expolicores Villa de Leyva',
    });

    // Log idempotente de confirmación (ORDER_CREATED)
    await this.prisma.notificationLog.upsert({
      where: { orderId_type: { orderId: created.id, type: 'ORDER_CREATED' } },
      update: {
        sid: (waRes as any).sid ?? null,
        ok: (waRes as any).ok,
        error: (waRes as any).ok ? null : 'send failed',
        to: toPhone,
      },
      create: {
        orderId: created.id,
        channel: 'WHATSAPP',
        type: 'ORDER_CREATED',
        sid: (waRes as any).sid ?? null,
        ok: (waRes as any).ok,
        error: (waRes as any).ok ? null : 'send failed',
        to: toPhone,
      },
    });

    return { ...created, subtotal, shipping, total, address };
  }

  private async calcTotal(items: { productId: number; quantity: number }[]) {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, price: true },
    });
    const priceMap = new Map(products.map((p) => [p.id, p.price]));
    return items.reduce((sum, i) => sum + (priceMap.get(i.productId) ?? 0) * i.quantity, 0);
  }

  async findAll() {
    return this.prisma.order.findMany({ orderBy: { id: 'desc' }, include: this.orderInclude });
  }

  async findMine(userId: number) {
    return this.prisma.order.findMany({ where: { userId }, orderBy: { id: 'desc' }, include: this.orderInclude });
  }

  async findOneAs(id: number, user: { id: number; role: Role }) {
    const where = user.role === 'ADMIN' ? { id } : { id, userId: user.id };
    const order = await this.prisma.order.findFirst({ where, include: this.orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: this.orderInclude });
    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
    return order;
  }

  async findOneForUser(id: number, user: { id: number; role: Role }) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, user: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    // owner o admin
    if (user.role !== Role.ADMIN && order.userId !== user.id) {
      throw new ForbiddenException('You cannot access this order');
    }
    return order;
  }

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
          ? { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) }
          : undefined,
      },
      include: this.orderInclude,
    });
    return updated;
  }

  // --- Cambio de estado + WhatsApp corto + log por estado (US12) ---
  async updateStatus(id: number, status: OrderStatus) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: this.orderInclude,
    });

    // Solo notificamos los estados de la HU
    if (status === 'EN_CAMINO' || status === 'ENTREGADO' || status === 'CANCELADO') {
      const toPhone = this.normalizeCoPhone(order.user?.phone ?? '');
      const res = await this.whatsapp.sendStatusUpdate({
        toPhone,
        orderId: order.id,
        newStatus: status as 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO',
        tenant: 'Expolicores Villa de Leyva',
      });

      // Log por estado idempotente (STATUS_EN_CAMINO | STATUS_ENTREGADO | STATUS_CANCELADO)
      await this.prisma.notificationLog.upsert({
        where: { orderId_type: { orderId: order.id, type: `STATUS_${status}` } },
        update: {
          sid: (res as any).sid ?? null,
          ok: (res as any).ok,
          error: (res as any).ok ? null : 'send failed',
          to: toPhone,
        },
        create: {
          orderId: order.id,
          channel: 'WHATSAPP',
          type: `STATUS_${status}`,
          sid: (res as any).sid ?? null,
          ok: (res as any).ok,
          error: (res as any).ok ? null : 'send failed',
          to: toPhone,
        },
      });
    }

    return order;
  }

  async remove(id: number) {
    await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
    await this.prisma.order.delete({ where: { id } });
    return { id };
  }

  // E.164 CO básica (+57) para compatibilidad con Twilio WhatsApp
  private normalizeCoPhone(input: string): string {
    const digits = (input || '').replace(/\D/g, '');
    if (!digits) return '+57';
    if (digits.startsWith('57')) return `+${digits}`;
    if (digits.length === 10) return `+57${digits}`;
    if (digits.startsWith('0') && digits.length === 11) return `+57${digits.slice(1)}`;
    if (input?.startsWith('+')) return input;
    return `+57${digits}`;
  }
}
