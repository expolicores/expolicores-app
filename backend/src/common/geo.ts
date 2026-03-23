// src/common/geo.ts
/**
 * Utilidades geográficas y validación de cobertura + precio de envío.
 * - La COBERTURA se calcula siempre contra la TIENDA (STORE_LAT/LNG + DELIVERY_RADIUS_KM).
 * - El PRECIO se calcula vía config/shipping.computeShippingPrice(),
 *   que soporta el modo clásico y la Tarifa Urbana V2 (plaza) por feature-flag.
 */

import { computeShippingPrice, haversineKm as haversineKmFromShipping } from '../config/shipping';

// ========================= Helpers locales =========================

function numEnv(name: string, def?: number): number {
  const raw = process.env[name];
  const n = raw != null ? Number(raw) : Number.NaN;
  if (Number.isFinite(n)) return n;
  if (def !== undefined) return def;
  throw new Error(`Env inválida o faltante: ${name}`);
}

// ========================= Parámetros de cobertura =========================

const STORE_LAT = numEnv('STORE_LAT');     // obligatorio
const STORE_LNG = numEnv('STORE_LNG');     // obligatorio
const DELIVERY_RADIUS_KM = numEnv('DELIVERY_RADIUS_KM', 12);

// ========================= Haversine =========================

/**
 * Distancia Haversine en kilómetros.
 * Conservamos esta export para compatibilidad, pero internamente
 * también re-exportamos la de config/shipping.
 */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  // Usamos la implementación única para evitar divergencias
  return haversineKmFromShipping(a, b);
}

/**
 * (Compatibilidad) Cálculo clásico de precio por km.
 * Ya NO se usa en validateGeo cuando está activa la Tarifa Urbana V2,
 * pero lo dejamos exportado por si otros módulos aún lo consumen.
 */
export function shippingForKm(km: number, base: number, perKm: number, min: number) {
  return Math.max(min, Math.round(base + km * perKm));
}

// ========================= /geo/validate =========================

export type ValidateGeoInput = {
  lat: number;
  lng: number;
  normalizedAddress?: any;
};

export type ValidateGeoResponse = {
  inCoverage: boolean;
  distanceKm: number;    // distancia a la TIENDA (para cobertura / tracking)
  shippingCost: number;  // COP (según computeShippingPrice y feature flag)
  reason?: string;
  meta?: {
    pricingMode: 'URBAN_V2' | 'CLASSIC';
    dPlazaKm?: number;
    dStoreKm?: number;
  };
};

/**
 * Regla de negocio:
 * - Cobertura: distancia a TIENDA <= DELIVERY_RADIUS_KM.
 * - Precio: lo determina computeShippingPrice(destLat/destLng).
 */
export function validateGeo(input: ValidateGeoInput): ValidateGeoResponse {
  const { lat, lng } = input;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('lat/lng inválidos');
  }

  const dStoreKm = haversineKm({ lat: STORE_LAT, lng: STORE_LNG }, { lat, lng });
  const inCoverage = dStoreKm <= DELIVERY_RADIUS_KM;

  // Precio (puede basarse en PLAZA con Tarifa Urbana V2 o en TIENDA con clásica)
  const price = computeShippingPrice({ destLat: lat, destLng: lng });

  const resp: ValidateGeoResponse = {
    inCoverage,
    distanceKm: dStoreKm,
    shippingCost: price.shippingCost,
    meta: {
      pricingMode: price.pricingMode,
      dPlazaKm: price.dPlazaKm,
      dStoreKm: price.dStoreKm ?? dStoreKm,
    },
  };

  if (!inCoverage) {
    resp.reason = `Fuera de cobertura: ${dStoreKm.toFixed(2)} km > radio ${DELIVERY_RADIUS_KM} km`;
  }

  return resp;
}
