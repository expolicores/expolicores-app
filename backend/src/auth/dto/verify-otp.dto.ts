import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  emailEnroll?: string;
}
