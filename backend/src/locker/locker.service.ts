// backend/src/locker/locker.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class LockerService {
  constructor(private readonly prisma: PrismaService) {}

  private assertB2BOrAdmin(role: Role) {
    if (role !== Role.B2B && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'El casillero está disponible solo para negocios (B2B).',
      );
    }
  }

  // =========== B2B: casillero propio ===========

  async getMyLocker(userId: number, role: Role) {
    this.assertB2BOrAdmin(role);

    const items = await this.prisma.lockerItem.findMany({
      where: { userId },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Devolvemos solo los productos (similar a favoritos)
    return items.map((it) => it.product);
  }

  async addToLocker(userId: number, role: Role, productId: number) {
    this.assertB2BOrAdmin(role);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    await this.prisma.lockerItem.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      create: {
        userId,
        productId,
      },
      update: {
        updatedAt: new Date(),
      },
    });

    return { ok: true };
  }

  async removeFromLocker(userId: number, role: Role, productId: number) {
    this.assertB2BOrAdmin(role);

    await this.prisma.lockerItem
      .delete({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      })
      .catch(() => undefined); // idempotente

    return { ok: true };
  }

  // =========== ADMIN: vista agregada ===========

  async adminSummary() {
    const items = await this.prisma.lockerItem.findMany({
      include: {
        user: true,
        product: true,
      },
    });

    const byUser = new Map<
      number,
      {
        userId: number;
        userName: string;
        userEmail: string | null;
        role: Role;
        count: number;
        estimatedTotalB2BValue: number;
      }
    >();

    for (const it of items) {
      const u = it.user;
      const p = it.product;
      const existing = byUser.get(u.id) ?? {
        userId: u.id,
        userName: u.name ?? 'Negocio',
        userEmail: u.email ?? null,
        role: u.role,
        count: 0,
        estimatedTotalB2BValue: 0,
      };

      existing.count += 1;
      existing.estimatedTotalB2BValue += p.b2bPrice ?? 0;

      byUser.set(u.id, existing);
    }

    return Array.from(byUser.values()).sort(
      (a, b) => b.estimatedTotalB2BValue - a.estimatedTotalB2BValue,
    );
  }

  async adminGetLockerByUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const items = await this.prisma.lockerItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      user,
      products: items.map((it) => it.product),
    };
  }
}
