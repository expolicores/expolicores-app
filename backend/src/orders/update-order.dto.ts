import { IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class UpdateOrderItemDto {
  @ApiPropertyOptional({ example: 1, description: 'ID del producto actualizado' })
  @IsNumber()
  productId: number;

  @ApiPropertyOptional({ example: 2, description: 'Cantidad actualizada del producto' })
  @IsNumber()
  quantity: number;
}

export class UpdateOrderDto {
  @ApiPropertyOptional({ example: 3, description: 'Nuevo ID del usuario que hace la orden' })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({ example: 12000, description: 'Nuevo total de la orden' })
  @IsOptional()
  @IsNumber()
  total?: number;

  @ApiPropertyOptional({
    type: [UpdateOrderItemDto],
    description: 'Lista de ítems actualizados de la orden',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items?: UpdateOrderItemDto[];
}
