//create-Promotion.dto.ts
// prettier-ignore
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min,
  IsArray, ValidateNested, IsNumber
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PromotionType {
  PRICE_OVERRIDE = 'PRICE_OVERRIDE',
  PERCENT_OFF = 'PERCENT_OFF',
}
export enum PromotionAudience {
  ANY = 'ANY',
  B2C = 'B2C',
  B2B = 'B2B',
}

class PromotionProductInput {
  @IsString() productId!: string;
  @IsOptional() @IsInt() @Min(1) minQty?: number;
}

class BenefitsInput {
  // Para PRICE_OVERRIDE
  @IsOptional() @IsNumber() @Min(0) price?: number;
  // Para PERCENT_OFF (0–100)
  @IsOptional() @IsNumber() @Min(0.0001) percent?: number;
}

export class CreatePromotionDto {
  @IsString() name!: string;
  @IsEnum(PromotionType) type!: PromotionType;
  @IsEnum(PromotionAudience) @IsOptional() audience?: PromotionAudience = PromotionAudience.ANY;

  @IsBoolean() @IsOptional() active?: boolean = true;
  @IsBoolean() @IsOptional() stacking?: boolean = false;
  @IsInt() @Min(0) @IsOptional() priority?: number = 100;

  @IsDateString() startsAt!: string; // ISO
  @IsDateString() endsAt!: string; // ISO

  // productos target
  // prettier-ignore
  @IsArray() @ValidateNested({ each: true }) @Type(() => PromotionProductInput)
  @IsOptional()
  products?: PromotionProductInput[];

  // payload de beneficios
  @ValidateNested()
  @Type(() => BenefitsInput)
  @IsOptional()
  benefits?: BenefitsInput;

  // condiciones libres (si las usas más adelante)
  @IsOptional()
  conditions?: any;
}
