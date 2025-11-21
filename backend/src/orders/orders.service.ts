// backend/src/orders/orders.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './create-order.dto';
import { UpdateOrderDto } from './update-order.dto';
import {
  OrderStatus,
  Role,
  PaymentMethod as PaymentMethodEnum,
} from '@prisma/client';
import shippingConfig from '../config/shipping';
import { ConfigType } from '@nestjs/config';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { validateGeo } from '../common/geo';
import { PushService } from '../notifications/push.service';
import { LiveActivitiesService } from '../live-activities/live-activities.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(shippingConfig.KEY)
    private readonly shipping: ConfigType<typeof shippingConfig>,
    private readonly whatsapp: WhatsAppService,
    private readonly push: PushService,
    private readonly liveActivities: LiveActivitiesService,
  ) {}

  private readonly orderInclude = {
    items: { include: { product: true } },
    user: {
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
      },
    },
  } as const;

  async create(userId: number, dto: CreateOrderDto, role: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, phone: true },
    });
    if (!user) throw new NotFoundException('USER_NOT_FOUND');

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

    const hasGeo =
      typeof address.lat === 'number' && typeof address.lng === 'number';

    // ===== Método de pago =====
    const paymentMethod: PaymentMethodEnum =
      (dto.paymentMethod as PaymentMethodEnum) ?? PaymentMethodEnum.CASH;

    // Solo negocios (B2B) o ADMIN pueden usar crédito
    if (
      paymentMethod === PaymentMethodEnum.CREDIT &&
      role !== Role.B2B &&
      role !== Role.ADMIN
    ) {
      throw new BadRequestException('PAYMENT_METHOD_CREDIT_NOT_ALLOWED');
    }

    // ===== Productos y subtotal =====
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('EMPTY_CART');
    }

    const ids = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        price: true,
        b2bPrice: true,
        stock: true,
      },
    });
    if (products.length !== ids.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        missing,
        message: 'PRODUCT_NOT_FOUND',
      });
    }

    const byId = new Map(products.map((p) => [p.id, p]));
    const usesB2B = user.role === Role.B2B || user.role === Role.ADMIN;
    let subtotal = 0;
    for (const it of dto.items) {
      const p = byId.get(it.productId)!;
      if (p.stock < it.quantity) {
        throw new ConflictException(`OUT_OF_STOCK:${p.id}`);
      }
      const unitPrice = usesB2B ? p.b2bPrice : p.price;
      subtotal += unitPrice * it.quantity;
    }

    // ===== Envío (misma lógica de /geo/validate) =====
    let shipping = this.shipping.min;
    if (hasGeo) {
      const geo = validateGeo({
        lat: address.lat as number,
        lng: address.lng as number,
      });
      if (!geo.inCoverage) {
        throw new BadRequestException('COVERAGE_OUT_OF_RANGE');
      }
      shipping = geo.shippingCost;
    }

    const total = subtotal + shipping;

    // ===== Crear orden + descontar stock =====
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          total,
          status: OrderStatus.RECIBIDO,
          paymentMethod, // guardamos forma de pago
          notes: dto.notes?.trim() || null, // ⬅️ GUARDAR NOTAS DEL CLIENTE
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
        if (res.count !== 1) {
          throw new ConflictException(`OUT_OF_STOCK:${it.productId}`);
        }
      }

      return order;
    });

    // 🔔 Notificar a todos los ADMIN que llegó un nuevo pedido (no bloquea el flujo)
    this.notifyAdminsNewOrder(created).catch((e) => {
      this.logger.warn(
        `notifyAdminsNewOrder failed for order ${
          created.id
        }: ${(e as Error).message}`,
      );
    });

    // ===== PUSH: Pedido creado al cliente (no bloquea) =====
    try {
      await this.push.sendToUser(String(userId), {
        title: 'Pedido creado',
        body: `#${created.id} recibido. Te avisaremos los cambios.`,
        data: { type: 'ORDER_CREATED', orderId: created.id },
        priority: 'high',
        sound: 'default',
      });
    } catch (e) {
      this.logger.warn(
        `push ORDER_CREATED failed for user ${userId}: ${
          (e as Error).message
        }`,
      );
    }

    // Live Activities: el frontend iOS inicia la Activity y llama /live-activities/register.
    // Aquí NO enviamos update aún; lo haremos cuando cambie el estado.

    // ===== WhatsApp confirmación =====
    const toPhone = this.normalizeCoPhone(
      user.phone ?? created.user?.phone ?? '',
    );
    const addressLabel = address.label ?? 'Dirección';
    const addressLine = [address.line1, address.neighborhood, address.city]
      .filter(Boolean)
      .join(', ');
    const waItems = created.items.map((i) => {
      const linePrice = usesB2B ? i.product.b2bPrice : i.product.price;
      return { name: i.product.name, quantity: i.quantity, price: linePrice };
    });

    const notesFromPayload = [dto.notes, address.notes];
    if (!hasGeo) {
      notesFromPayload.push(
        'Atención: validar cobertura, dirección sin coordenadas',
      );
    }
    const notes =
      notesFromPayload
        .map((n) => (n ?? '').trim())
        .filter((n) => n.length > 0)
        .join(' | ') || undefined;

    const waRes = await this.whatsapp.sendOrderConfirmation({
      toPhone,
      orderId: created.id,
      subtotal,
      shipping,
      total: created.total,
      // enviamos el método real, por defecto CASH
      paymentMethod,
      items: waItems,
      addressLabel,
      addressLine,
      notes,
      tenant: 'Expolicores Villa de Leyva',
    });

    await this.prisma.notificationLog.upsert({
      where: {
        orderId_type: { orderId: created.id, type: 'ORDER_CREATED' },
      },
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

    // Totales explícitos para OrderSuccessScreen
    return { ...created, subtotal, shipping, total, address };
  }

  private async calcTotal(
    items: { productId: number; quantity: number }[],
    useB2B: boolean,
  ) {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, price: true, b2bPrice: true },
    });
    const priceMap = new Map(
      products.map((p) => [p.id, useB2B ? p.b2bPrice : p.price]),
    );
    return items.reduce(
      (sum, i) => sum + (priceMap.get(i.productId) ?? 0) * i.quantity,
      0,
    );
  }

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
    const where = user.role === Role.ADMIN ? { id } : { id, userId: user.id };
    const order = await this.prisma.order.findFirst({
      where,
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude,
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async findOneForUser(id: number, user: { id: number; role: Role }) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, user: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (user.role !== Role.ADMIN && order.userId !== user.id) {
      throw new ForbiddenException('You cannot access this order');
    }
    return order;
  }

  async update(id: number, dto: UpdateOrderDto) {
    const { items, ...rest } = dto;
    const existing = await this.prisma.order.findUnique({
      where: { id },
      select: { user: { select: { role: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const usesB2B =
      existing.user?.role === Role.B2B || existing.user?.role === Role.ADMIN;

    let totalUpdate: number | undefined;
    if (items) {
      await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
      totalUpdate = await this.calcTotal(items, usesB2B);
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

  async updateStatus(id: number, status: OrderStatus) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: this.orderInclude,
    });

    // ===== Expo Push por estado (no bloquea) =====
    try {
      const msg = this.messageForStatus(status, order.id);
      if (msg) {
        await this.push.sendToUser(String(order.userId), {
          title: msg.title,
          body: msg.body,
          data: { type: 'ORDER_STATUS', orderId: order.id, status },
          priority: 'high',
          sound: 'default',
        });
      }
    } catch (e) {
      this.logger.warn(
        `push STATUS_${status} failed for user ${
          order.userId
        }: ${(e as Error).message}`,
      );
    }

    // ===== Live Activities (APNs) — no bloquea =====
    try {
      // Update con el nuevo estado; el service ignora si no hay LA registrada
      await this.liveActivities.update(order.id, {
        orderId: order.id,
        status, // RECIBIDO | EN_CAMINO | ENTREGADO | CANCELADO
      });

      if (status === 'ENTREGADO' || status === 'CANCELADO') {
        await this.liveActivities.end(order.id, status);
      }
    } catch (e) {
      this.logger.warn(
        `liveActivity STATUS_${status} failed for order ${
          order.id
        }: ${(e as Error).message}`,
      );
    }

    // ===== WhatsApp por estado (como estaba) =====
    if (
      status === 'EN_CAMINO' ||
      status === 'ENTREGADO' ||
      status === 'CANCELADO'
    ) {
      const toPhone = this.normalizeCoPhone(order.user?.phone ?? '');
      const res = await this.whatsapp.sendStatusUpdate({
        toPhone,
        orderId: order.id,
        newStatus: status as 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO',
        tenant: 'Expolicores Villa de Leyva',
      });

      await this.prisma.notificationLog.upsert({
        where: {
          orderId_type: { orderId: order.id, type: `STATUS_${status}` },
        },
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

  /**
   * Notifica a TODOS los ADMIN cuando se crea una nueva orden.
   * Incluye:
   * - ID del pedido
   * - nombre del cliente (si existe)
   * - total aproximado en COP
   */
  private async notifyAdminsNewOrder(order: {
    id: number;
    total: number | bigint | string;
    user?: { name?: string | null; email?: string | null; phone?: string | null };
  }) {
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true },
    });

    if (!admins.length) return;

    const customerName =
      order.user?.name?.trim() ||
      order.user?.email ||
      order.user?.phone ||
      'Cliente';

    const totalNumber =
      typeof order.total === 'number'
        ? order.total
        : Number(order.total) || 0;

    const totalFormatted = totalNumber.toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    });

    await Promise.all(
      admins.map((admin) =>
        this.push
          .sendToUser(String(admin.id), {
            title: `Nuevo pedido #${order.id}`,
            body: `${customerName} · ${totalFormatted}`,
            data: {
              type: 'NEW_ORDER_ADMIN',
              orderId: order.id,
            },
            priority: 'high',
            sound: 'default',
          })
          .catch((e) => {
            this.logger.warn(
              `push NEW_ORDER_ADMIN failed for admin ${
                admin.id
              }: ${(e as Error).message}`,
            );
          }),
      ),
    );
  }

  // E.164 CO básica (+57) para Twilio WhatsApp
  private normalizeCoPhone(input: string): string {
    const digits = (input || '').replace(/\D/g, '');
    if (!digits) return '+57';
    if (digits.startsWith('57')) return `+${digits}`;
    if (digits.length === 10) return `+57${digits}`;
    if (digits.startsWith('0') && digits.length === 11) {
      return `+57${digits.slice(1)}`;
    }
    if (input?.startsWith('+')) return input;
    return `+57${digits}`;
  }

  private messageForStatus(
    status: OrderStatus,
    orderId: number,
  ): { title: string; body: string } | null {
    switch (status) {
      case 'EN_CAMINO':
        return { title: 'En camino', body: `#${orderId} ya va en camino.` };
      case 'ENTREGADO':
        return {
          title: 'Entregado',
          body: `#${orderId} ha sido entregado. ¡Gracias!`,
        };
      case 'CANCELADO':
        return {
          title: 'Pedido cancelado',
          body: `#${orderId} fue cancelado.`,
        };
      default:
        return null; // RECIBIDO u otros no generan push extra
    }
  }
}
