import { IsEmail, IsIn, IsOptional, IsPhoneNumber, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsOptional()
  @IsString()
  // Si tu normalizador requiere E.164 puedes usar IsPhoneNumber('CO')
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['sms', 'whatsapp'])
  channel?: 'sms' | 'whatsapp';

  @IsOptional()
  @IsIn(['login', 'register'])
  intent?: 'login' | 'register';
}
