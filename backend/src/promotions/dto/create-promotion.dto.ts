import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

enum PromotionType {
  PRICE_OVERRIDE = 'PRICE_OVERRIDE',
  PERCENT_OFF = 'PERCENT_OFF',
}

enum PromotionAudience {
  ANY = 'ANY',
  B2C = 'B2C',
  B2B = 'B2B',
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

  // productos target de la promo
  products?: Array<{ productId: string; minQty?: number }>; // validación en controller

  // beneficios/condiciones específicas
  // PRICE_OVERRIDE => { price: number }
  // PERCENT_OFF => { percent: number [1..99] }
  benefits?: any;
  conditions?: any;
}
