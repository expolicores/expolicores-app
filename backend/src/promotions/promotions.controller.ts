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
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Si ya tienes DTOs separados, mantenlos.
// Si no, puedes usar los tipos del service.
import { IsOptional, IsString, IsBoolean, IsNumber, IsArray, IsIn, IsISO8601, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// --------- DTOs mínimos (opcional si ya existen en tu repo) ---------
class ProductLinkDto {
  @IsString() productId!: string;
  @IsOptional() @IsNumber() minQty?: number;
}

class CreatePromotionDto {
  @IsString() name!: string;
  @IsIn(['PRICE_OVERRIDE','PERCENT_OFF','X_FOR_Y','GIFT_WITH_PURCHASE'])
  type!: 'PRICE_OVERRIDE'|'PERCENT_OFF'|'X_FOR_Y'|'GIFT_WITH_PURCHASE';

  @IsOptional() @IsIn(['ANY','B2C','B2B']) audience?: 'ANY'|'B2C'|'B2B';
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() stacking?: boolean;
  @IsOptional() @IsNumber() priority?: number;

  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;

  @IsOptional() benefits?: any;
  @IsOptional() conditions?: any;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductLinkDto)
  products?: ProductLinkDto[];
}

class UpdatePromotionDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(['PRICE_OVERRIDE','PERCENT_OFF','X_FOR_Y','GIFT_WITH_PURCHASE'])
  type?: 'PRICE_OVERRIDE'|'PERCENT_OFF'|'X_FOR_Y'|'GIFT_WITH_PURCHASE';

  @IsOptional() @IsIn(['ANY','B2C','B2B']) audience?: 'ANY'|'B2C'|'B2B';
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() stacking?: boolean;
  @IsOptional() @IsNumber() priority?: number;

  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @IsISO8601() endsAt?: string;

  @IsOptional() benefits?: any;
  @IsOptional() conditions?: any;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductLinkDto)
  products?: ProductLinkDto[];
}
// -------------------------------------------------------------------

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
   * Más adelante se puede enganchar el compilador→R2 aquí.
   */
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.service.publish(id);
  }
}
