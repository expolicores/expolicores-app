import { IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

export class NormalizedAddressDto {
  @IsOptional() @IsString() placeId?: string;
  @IsOptional() @IsString() formattedAddress?: string;

  // Agregamos lat/lng opcionales para poder leerlos en el controller
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;

  @IsOptional() @IsString() route?: string;
  @IsOptional() @IsString() streetNumber?: string;
  @IsOptional() @IsString() sublocality?: string; // barrio/vereda
  @IsOptional() @IsString() locality?: string;    // municipio/ciudad
  @IsOptional() @IsString() adminArea?: string;   // depto
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() plusCode?: string;
  @IsOptional() @IsString() referenceNote?: string;
}

export class ValidateGeoDto {
  @IsOptional()
  @IsString()
  placeId?: string;

  // Si no mandan placeId (server-side geocode), exigimos coords
  @ValidateIf((o) => o.placeId == null)
  @IsNumber()
  lat!: number;

  @ValidateIf((o) => o.placeId == null)
  @IsNumber()
  lng!: number;

  @IsOptional()
  normalizedAddress?: NormalizedAddressDto;
}
