import {
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

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // --------- PÚBLICOS ---------
  // Catálogo con búsqueda + filtros + orden + paginación (devuelve array; total en header)
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

  // --------- ADMIN ONLY ---------
  // Nota: ruta estática 'admin' ANTES de ':id' para que no la capture el parámetro
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

  // --------- PÚBLICO: Detalle por id (al final para no chocar con rutas estáticas) ---------
  @Get(':id')
  findOnePublic(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }
}
