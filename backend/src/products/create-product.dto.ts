import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Cerveza Águila', description: 'Nombre del producto' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Cerveza rubia nacional', description: 'Descripción del producto' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ example: 3500, description: 'Precio unitario en pesos' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 3200,
    description: 'Precio unitario para negocios (B2B). Si no se envía, se utilizará el precio al detal.',
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  b2bPrice?: number;

  @ApiProperty({ example: 20, description: 'Cantidad disponible en stock' })
  @IsNotEmpty()
  @IsNumber()
  stock: number;
}
