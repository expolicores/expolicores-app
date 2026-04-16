import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  b2bPrice: true,
  stock: true,
  category: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(userId: number) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { select: PRODUCT_SELECT } },
    });
    return favorites.map((fav) => fav.product);
  }

  async add(userId: number, productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: PRODUCT_SELECT,
    });
    if (!product) {
      throw new NotFoundException('PRODUCT_NOT_FOUND');
    }

    try {
      await this.prisma.favorite.create({
        data: { userId, productId },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
      // Ignore duplicate favorite attempts
    }

    return product;
  }

  async remove(userId: number, productId: number) {
    await this.prisma.favorite.deleteMany({
      where: { userId, productId },
    });
  }
}
