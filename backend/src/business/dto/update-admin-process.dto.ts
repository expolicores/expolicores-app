import { IsEnum } from 'class-validator';
import { AdminProcessStatus } from '@prisma/client';

export class UpdateAdminProcessDto {
  @IsEnum(AdminProcessStatus)
  status: AdminProcessStatus; // PENDING | IN_PROGRESS | ATTENDED
}
