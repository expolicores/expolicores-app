// backend/src/geo/types/validate-geo.response.ts
export type GeoReason = 'OK' | 'OUT_OF_RADIUS' | 'FEATURE_DISABLED' | 'INVALID_COORDS';

export interface ValidateGeoResponse {
  inCoverage: boolean;
  distanceKm: number;          // redondeado a 0.1
  shippingCost: number;        // usando SHIPPING_* del config
  normalizedAddress?: NormalizedAddress; // si llega o si la resolvemos server-side
  reason: GeoReason;
}

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
