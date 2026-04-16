import { IsEmail, IsOptional } from 'class-validator';

export class EnrollEmailDto {
  @IsOptional() @IsEmail() email?: string;        // compat
  @IsOptional() @IsEmail() emailEnroll?: string;  // compat

  get normalized(): string {
    return (this.email ?? this.emailEnroll ?? '').trim().toLowerCase();
  }
}
