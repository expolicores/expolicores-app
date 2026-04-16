export type GeoReason = 'OK' | 'OUT_OF_RADIUS' | 'FEATURE_DISABLED' | 'INVALID_COORDS';

export interface NormalizedAddress {
  placeId?: string;
  formattedAddress?: string;
  lat?: number;
  lng?: number;
  route?: string;
  streetNumber?: string;
  sublocality?: string;
  locality?: string;
  adminArea?: string;
  postalCode?: string;
  country?: string;
  plusCode?: string;
  referenceNote?: string;
}

export interface GeoValidateRequest {
  placeId?: string;
  lat?: number;
  lng?: number;
  normalizedAddress?: NormalizedAddress;
}

export interface GeoValidateResponse {
  inCoverage: boolean;
  distanceKm: number;
  shippingCost: number;
  normalizedAddress?: NormalizedAddress;
  reason: GeoReason;
}
