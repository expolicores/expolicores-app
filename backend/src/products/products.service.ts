import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';
import { QueryProductsDto, SortOption } from './query-products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- CRUD (admin) ----------
  async create(data: CreateProductDto) {
    return this.prisma.product.create({ data });
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

  // ---------- Catálogo (público) ----------
  async listPublic() {
    return this.prisma.product.findMany({
      select: { id: true, name: true, price: true, imageUrl: true, category: true },
      orderBy: { createdAt: 'desc' },
    });
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

  // ---------- Nuevo: búsqueda + filtros + orden + paginación ----------
  private orderBySql(sort: SortOption | undefined) {
    switch (sort) {
      case 'price_asc':
        return Prisma.sql`"price" ASC`;
      case 'price_desc':
        return Prisma.sql`"price" DESC`;
      case 'name_asc':
        return Prisma.sql`unaccent(lower("name")) ASC`;
      case 'name_desc':
        return Prisma.sql`unaccent(lower("name")) DESC`;
      case 'newest':
      default:
        return Prisma.sql`"createdAt" DESC`;
    }
  }

  /**
   * Requiere: CREATE EXTENSION IF NOT EXISTS unaccent;
   */
  async findPublicWithQuery(query: QueryProductsDto) {
    const qRaw = (query.q ?? '').trim();
    const category = (query.category ?? '').trim();
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)));
    const offset = (page - 1) * limit;
    const sort = (query.sort as SortOption) ?? 'newest';

    const conds: Prisma.Sql[] = [];

    if (qRaw) {
      const like = `%${qRaw}%`;
      conds.push(
        Prisma.sql`(unaccent(lower("name")) LIKE unaccent(lower(${like}))
                 OR unaccent(lower("description")) LIKE unaccent(lower(${like})))`,
      );
    }
    if (category) {
      conds.push(Prisma.sql`"category" = ${category}`);
    }
    // conds.push(Prisma.sql`"stock" > 0`); // opcional

    // ⚠️ En tu versión, el separador de Prisma.join debe ser string, no Prisma.sql
    const where =
      conds.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}`
        : Prisma.empty;

    const orderBy = this.orderBySql(sort);

    const items = await this.prisma.$queryRaw<
      { id: number; name: string; price: number; imageUrl: string | null; category: string | null }[]
    >(Prisma.sql`
      SELECT "id","name","price","imageUrl","category"
      FROM "Product"
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset};
    `);

    const totalRow = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "Product" ${where};`,
    );
    const total = Number(totalRow[0]?.count ?? 0);

    return { total, items };
  }
}
