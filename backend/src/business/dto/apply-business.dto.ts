import { IsOptional, IsString } from 'class-validator';

export class ApplyBusinessDto {
  @IsOptional()
  @IsString()
  note?: string; // por ahora no pedimos RUT aquí
}
