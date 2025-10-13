// backend/src/users/update-user.dto.ts
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  // IsPhoneNumber, // si lo quieres estricto para CO
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nombre actualizado' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+573001112233' })
  @IsOptional()
  @IsString()
  // @IsPhoneNumber('CO') // <- actívalo si quieres validar E.164 CO
  phone?: string;

  @ApiPropertyOptional({ example: 'nuevo@mail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'opcional@mail.com',
    description:
      'Alias aceptado para enrolar correo desde front. El servicio debe mapearlo a `email` si se usa.',
  })
  @IsOptional()
  @IsEmail()
  emailEnroll?: string;

  @ApiPropertyOptional({ example: 'NuevoPass123', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
