// backend/src/users/update-user-role.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: Role,
    enumName: 'Role',
    description: 'Nuevo rol del usuario.',
    examples: ['CLIENTE', 'NEGOCIO', 'ADMIN'],
  })
  @IsEnum(Role, {
    message: 'role debe ser uno de: ADMIN, CLIENTE, NEGOCIO',
  })
  role!: Role;
}
