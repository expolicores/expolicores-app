// backend/src/promotions/promotions.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

/**
 * Controlador ADMIN
 * Rutas protegidas sólo para ADMIN bajo /admin/promotions
 */
@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Post()
  create(@Body() dto: CreatePromotionDto) {
    return this.service.create(dto);
  }

  // prettier-ignore
  @Get()
  findAll(
    @Query('active') active?: string,
    @Query('type') type?: string,
    @Query('audience') audience?: string,
  ) {
    return this.service.findAll({ active, type, audience });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.softDelete(id);
  }

  /**
   * Publicación (hook actual).
   * En esta fase sólo marca publish; el front consumirá overlays remotos.
   * Más adelante se puede enganchar el compilador->R2 aquí.
   */
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }
}

/**
 * Controlador PÚBLICO/AUTENTICADO
 * Rutas accesibles para usuarios logueados (B2C/B2B/ADMIN) bajo /promotions
 * NO requiere rol ADMIN.
 */
@Controller('promotions')
@UseGuards(JwtAuthGuard)
export class PublicPromotionsController {
  constructor(private readonly service: PromotionsService) {}

  /**
   * Devuelve hasta 3 overlays vigentes para la audiencia indicada.
   * Ej: GET /promotions/overlays?audience=B2C
   *
   * Formato:
   * [
   *   { id, name, productId, price?, imageUrl?, bannerKey? }
   * ]
   */
  @Get('overlays')
  async getOverlays(
    @Query('audience') audience: 'B2C' | 'B2B' = 'B2C',
  ) {
    const a: 'B2C' | 'B2B' = audience === 'B2B' ? 'B2B' : 'B2C';
    return this.service.getOverlayByAudience(a);
  }
}
