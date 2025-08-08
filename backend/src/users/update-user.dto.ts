import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: 'nuevo@email.com' })
  email?: string;

  @ApiPropertyOptional({ example: 'nuevo123' })
  password?: string;

  @ApiPropertyOptional({ example: 'Nombre actualizado' })
  name?: string;
}
