import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @IsString() label: string;
  @IsString() recipient: string;
  @IsString() phone: string;
  @IsString() line1: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
