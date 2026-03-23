import { IsEnum } from 'class-validator';
import { BusinessVerificationStatus } from '@prisma/client';

export class UpdateVerificationDto {
  @IsEnum(BusinessVerificationStatus)
  status: BusinessVerificationStatus; // APPROVED | REJECTED
}
