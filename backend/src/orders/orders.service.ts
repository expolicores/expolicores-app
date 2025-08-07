import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './create-order.dto';
import { UpdateOrderDto } from './update-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOrderDto) {
    const { items, ...orderData } = data;

    return this.prisma.order.create({
      data: {
        ...orderData,
        items: {
          create: items.map((item) => ({
            product: {
              connect: { id: item.productId },
            },
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
      },
    });
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
    return order;
  }

  async update(id: number, data: UpdateOrderDto) {
    const { items, ...orderData } = data;

    // Si vienen nuevos ítems, primero los borramos
    if (items) {
      await this.prisma.orderItem.deleteMany({
        where: { orderId: id },
      });
    }

    // Actualizamos la orden
    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        ...orderData,
        items: items
          ? {
              create: items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
              })),
            }
          : undefined,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
      },
    });

    return updatedOrder;
  }

  async remove(id: number) {
    // Primero elimina los ítems relacionados
    await this.prisma.orderItem.deleteMany({
      where: { orderId: id },
    });

    // Luego elimina la orden
    return this.prisma.order.delete({
      where: { id },
    });
  }
}
