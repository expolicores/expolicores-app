import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './create-order.dto';
import { UpdateOrderDto } from './update-order.dto';
import { OrderStatus, Role } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // Qué incluimos siempre al devolver una orden
  private readonly orderInclude = {
    items: { include: { product: true } },
    user: { select: { id: true, email: true, name: true, role: true } },
  } as const;

  // Calcula total con los precios actuales en DB
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

  // Crear orden como USUARIO autenticado (controller pasa userId)
  async create(userId: number, dto: CreateOrderDto) {
    const total = await this.calcTotal(dto.items);

    return this.prisma.order.create({
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
  }

  // Listar TODAS (ADMIN)
  async findAll() {
    return this.prisma.order.findMany({
      orderBy: { id: 'desc' },
      include: this.orderInclude,
    });
  }

  // Listar MIS órdenes (usuario autenticado)
  async findMine(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      include: this.orderInclude,
    });
  }

  // Ver una orden como dueño o ADMIN
  async findOneAs(id: number, user: { id: number; role: Role }) {
    const where = user.role === 'ADMIN' ? { id } : { id, userId: user.id };
    const order = await this.prisma.order.findFirst({
      where,
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // (Compat) Ver por id sin verificar dueño/admin (si tu controller actual lo usa)
  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
    return order;
  }

  // Actualizar (normalmente ADMIN). Reemplaza items si vienen y recalcula total.
  async update(id: number, dto: UpdateOrderDto) {
    const { items, ...rest } = dto;

    // Reemplazar items si llegan nuevos
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
