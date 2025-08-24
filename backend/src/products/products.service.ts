import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- CRUD (admin) -----
  async create(data: CreateProductDto) {
    return this.prisma.product.create({ data });
  }

  findAll() {
    // Lista completa (admin), incluye todos los campos del modelo
    return this.prisma.product.findMany();
  }

  findOne(id: number) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  update(id: number, data: UpdateProductDto) {
    return this.prisma.product.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.product.delete({ where: { id } });
  }

  // ----- Públicos (catálogo) -----
  async listPublic() {
    // Shape público para catálogo: id, name, price, imageUrl, category
    return this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listCategories() {
    // Devuelve categorías únicas (sin null) ordenadas asc
    const rows = await this.prisma.product.findMany({
      distinct: ['category'],
      where: { category: { not: null } },
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category as string);
  }
}
