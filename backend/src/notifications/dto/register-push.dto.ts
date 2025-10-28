// backend/src/notifications/dto/register-push.dto.ts
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterPushDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}
