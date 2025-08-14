import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() name: string;

  @IsEmail() email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString() phone: string; // si quieres, luego validamos formato E.164
}
