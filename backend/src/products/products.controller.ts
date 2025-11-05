import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { QueryProductsDto } from './query-products.dto';

type Audience = 'B2C' | 'B2B';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // -------------------------------------------------------------------
  // PÚBLICOS
  // -------------------------------------------------------------------

  // Catálogo con búsqueda + filtros + orden + paginación (total en header)
  @Get()
  async listPublic(
    @Query() query: QueryProductsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { total, items } = await this.productsService.findPublicWithQuery(query);
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  // Categorías (DEBE ir antes de ":id")
  @Get('categories')
  categories() {
    return this.productsService.listCategories();
  }

  /**
   * Batch de precios/stock para hidratar el feed en un solo viaje:
   * GET /products/prices?ids=1,5,1009&audience=B2C
   * Devuelve: [{ id, price, b2bPrice, stock }]
   */
  @Get('prices')
  async getPricesBatch(
    @Query('ids') idsParam?: string,
    @Query('audience') audience?: Audience,
  ) {
    if (!idsParam || !idsParam.trim()) {
      throw new BadRequestException('ids es requerido (comma-separated)');
    }
    const ids = idsParam
      .split(',')
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n));

    if (!ids.length) {
      throw new BadRequestException('ids inválidos');
    }

    // Obtén datos básicos (rápidos) para esos IDs
    const basics = await this.productsService.findPublicBasicsByIds(ids);
    // audience es informativo para el front; devolvemos ambos precios para consistencia
    // (el front decide si usar price o b2bPrice según rol/vista)
    // Si quieres filtrar campos, lo puedes hacer aquí.
    return basics.map((p) => ({
      id: p.id,
      price: p.price,
      b2bPrice: p.b2bPrice ?? p.price,
      stock: p.stock ?? null,
    }));
  }

  // -------------------------------------------------------------------
  // ADMIN ONLY
  // -------------------------------------------------------------------

  // Alias que usan pantallas Admin para ver listas de precio (B2C/B2B)
  // Devuelve array y X-Total-Count en header
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('pricelist/b2c')
  async getPriceListB2C(@Res({ passthrough: true }) res: Response) {
    const { total, items } = await this.productsService.getPriceList('B2C');
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('pricelist/b2b')
  async getPriceListB2B(@Res({ passthrough: true }) res: Response) {
    const { total, items } = await this.productsService.getPriceList('B2B');
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  findAllAdmin() {
    return this.productsService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  updatePartial(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }

  // -------------------------------------------------------------------
  // PÚBLICO: Detalle por id (al final para no chocar con rutas estáticas)
  // -------------------------------------------------------------------
  @Get(':id')
  findOnePublic(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }
}
