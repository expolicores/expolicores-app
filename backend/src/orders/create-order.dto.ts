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

// Métodos de pago soportados en el API
// CASH      → Efectivo
// TRANSFER  → Transferencia
// CARD      → Tarjeta
// CREDIT    → Crédito (solo negocios / B2B / ADMIN)
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'CREDIT';

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
    example: 'CASH',
    enum: ['CASH', 'TRANSFER', 'CARD', 'CREDIT'],
    description:
      'Método de pago: CASH=Efectivo, TRANSFER=Transferencia, CARD=Tarjeta, CREDIT=Crédito (solo negocios). Si no se envía, se asume CASH en el servicio.',
  })
  @IsOptional()
  @IsIn(['CASH', 'TRANSFER', 'CARD', 'CREDIT'])
  paymentMethod?: PaymentMethod;
}
