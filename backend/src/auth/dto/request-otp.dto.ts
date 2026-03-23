// backend/src/auth/dto/request-otp.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class RequestOtpDto {
  @ApiPropertyOptional({
    description:
      'Teléfono del usuario. Se normaliza a E.164 en el servicio (+57…). Puede venir con o sin +57, con espacios o guiones.',
    example: '+57 305 323 3975',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;

  @ApiPropertyOptional({
    description:
      'Correo del usuario. Si se envía, el backend buscará el teléfono verificado asociado a este correo.',
    example: 'usuario@dominio.com',
  })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @ApiPropertyOptional({
    description:
      "Canal preferido de envío del OTP. El backend decide en función de los flags (FEATURE_WHATSAPP_NOTIFICATIONS / FEATURE_SMS_OTP).",
    enum: ['whatsapp', 'sms'],
    example: 'whatsapp',
  })
  @IsOptional()
  @IsIn(['whatsapp', 'sms'])
  channel?: 'whatsapp' | 'sms';

  @ApiPropertyOptional({
    description:
      'Intención del flujo (solo informativo/telemetría de momento).',
    enum: ['login', 'register'],
    example: 'login',
  })
  @IsOptional()
  @IsIn(['login', 'register'])
  intent?: 'login' | 'register';

  // (Opcional) Campo para tolerar códigos cortos en entornos de QA, si lo necesitas.
  // No lo usamos aquí, pero lo mantengo como referencia.
  // @IsOptional()
  // @IsString()
  // @Length(4, 6)
  // devCode?: string;
}
