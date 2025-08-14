import { IsOptional, IsString, MinLength /*, IsPhoneNumber, IsEmail */ } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nombre actualizado' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+573001112233' })
  @IsOptional()
  @IsString() // opcional: @IsPhoneNumber('CO')
  phone?: string;

  @ApiPropertyOptional({ example: 'NuevoPass123' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
