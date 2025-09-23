// src/orders/dto/create-order.dto.ts
import {
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderItemDto {
  @ApiProperty({ example: 10, description: 'ID del producto' })
  @IsInt()
  @IsPositive()
  productId: number;

  @ApiProperty({ example: 2, description: 'Cantidad del producto' })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 123, description: 'ID de la dirección de entrega' })
  @IsInt()
  @IsPositive()
  addressId: number;

  @ApiProperty({
    type: [CreateOrderItemDto],
    description: 'Listado de productos del carrito',
    example: [
      { productId: 10, quantity: 2 },
      { productId: 22, quantity: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({
    example: 'Recepción en portería. Llamar al llegar.',
    description: 'Notas opcionales para la entrega',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: 'COD',
    enum: ['COD'],
    description: 'Método de pago. MVP: solo contraentrega',
  })
  @IsOptional()
  @IsIn(['COD'])
  paymentMethod?: 'COD';
}
