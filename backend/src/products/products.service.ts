import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';
import { QueryProductsDto, SortOption, TagOption } from './query-products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- CRUD (admin) ----------
  async create(data: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        ...data,
        b2bPrice: data.b2bPrice ?? data.price,
      },
    });
  }

  findAll() {
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

  async getPriceList(audience: 'B2C' | 'B2B') {
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      audience === 'B2B' ? { updatedAt: 'desc' } : { name: 'asc' };

    const select = {
      id: true,
      name: true,
      price: true,
      b2bPrice: true,
      imageUrl: true,
      category: true,
      stock: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.ProductSelect;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count(),
      this.prisma.product.findMany({
        select,
        orderBy,
      }),
    ]);

    return {
      total,
      items: items.map((item) => ({
        ...item,
        b2bPrice: item.b2bPrice ?? item.price,
      })),
    };
  }

  // ---------- Catálogo publico ----------
  async listPublic() {
    const items = await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        b2bPrice: true,
        imageUrl: true,
        category: true,
        stock: true,
        description: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => ({
      ...item,
      b2bPrice: item.b2bPrice ?? item.price,
    }));
  }

  async listCategories() {
    const rows = await this.prisma.product.findMany({
      distinct: ['category'],
      where: { category: { not: null } },
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category as string);
  }

  async findPublicBasicsByIds(ids: number[]) {
    if (!ids.length) return [];

    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        price: true,
        b2bPrice: true,
        stock: true,
      },
    });

    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is (typeof rows)[number] => !!row)
      .map((row) => ({
        ...row,
        b2bPrice: row.b2bPrice ?? row.price,
      }));
  }

  // ---------- Búsqueda + filtros + orden + paginación ----------
  private resolveOrderBy(sort: SortOption | undefined): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case 'price_asc':
        return { price: 'asc' };
      case 'price_desc':
        return { price: 'desc' };
      case 'name_asc':
        return { name: 'asc' };
      case 'name_desc':
        return { name: 'desc' };
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }

  private applyTagFilter(where: Prisma.ProductWhereInput, tag?: TagOption) {
    if (!tag) return;

    const addAnd = (clause: Prisma.ProductWhereInput) => {
      if (!where.AND) {
        where.AND = clause;
      } else if (Array.isArray(where.AND)) {
        where.AND.push(clause);
      } else {
        where.AND = [where.AND, clause];
      }
    };

    const addOr = (...clauses: Prisma.ProductWhereInput[]) => {
      const existing = where.OR;
      const buffer = Array.isArray(existing)
        ? existing.slice()
        : existing
        ? [existing]
        : [];
      buffer.push(...clauses);
      where.OR = buffer;
    };

    switch (tag) {
      case 'low_price':
        addAnd({ price: { lte: 16_000 } });
        break;
      case 'oferta':
        addOr(
          { name: { contains: 'oferta', mode: 'insensitive' } },
          { description: { contains: 'oferta', mode: 'insensitive' } },
          { name: { contains: 'promo', mode: 'insensitive' } },
          { description: { contains: 'promo', mode: 'insensitive' } },
          { name: { contains: 'descuento', mode: 'insensitive' } },
          { description: { contains: 'descuento', mode: 'insensitive' } },
        );
        break;
      case 'pack':
        addOr(
          { name: { contains: 'pack', mode: 'insensitive' } },
          { name: { contains: 'combo', mode: 'insensitive' } },
          { description: { contains: 'pack', mode: 'insensitive' } },
          { description: { contains: 'combo', mode: 'insensitive' } },
        );
        break;
    }
  }

  async findPublicWithQuery(query: QueryProductsDto) {
    const qRaw = (query.q ?? '').trim();
    const category = (query.category ?? '').trim();
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;
    const sort = (query.sort as SortOption) ?? 'newest';

    const where: Prisma.ProductWhereInput = {};

    if (qRaw) {
      where.OR = [
        { name: { contains: qRaw, mode: 'insensitive' } },
        { description: { contains: qRaw, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = { equals: category };
    }

    this.applyTagFilter(where, query.tag);

    const orderBy = this.resolveOrderBy(sort);

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          price: true,
          b2bPrice: true,
          imageUrl: true,
          category: true,
          stock: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      total,
      items: items.map((item) => ({
        ...item,
        b2bPrice: item.b2bPrice ?? item.price,
      })),
    };
  }
}
