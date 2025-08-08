import { IsNotEmpty, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class OrderItemDto {
  @ApiProperty({ example: 1, description: 'ID del producto' })
  @IsNotEmpty()
  @IsNumber()
  productId: number;

  @ApiProperty({ example: 3, description: 'Cantidad del producto en la orden' })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 2, description: 'ID del usuario que realiza la orden' })
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @ApiProperty({
    type: [OrderItemDto],
    description: 'Listado de productos en la orden',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ example: 9000, description: 'Total de la orden en pesos' })
  @IsNotEmpty()
  @IsNumber()
  total: number;
}
