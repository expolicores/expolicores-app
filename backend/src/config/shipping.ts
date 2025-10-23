// src/config/shipping.ts
import { registerAs } from '@nestjs/config';

/**
 * Config + helpers de cálculo de envío.
 * - Mantiene compatibilidad con la config previa (store/radius/base/perKm/min).
 * - Añade Tarifa Urbana V2 por plaza (feature-flag) sin afectar cobertura.
 */

function num(v: string | undefined, fallback?: number): number {
  const n = v != null ? Number(v) : Number.NaN;
  if (Number.isFinite(n)) return n;
  if (fallback !== undefined) return fallback;
  throw new Error(`Valor numérico inválido para env: ${v}`);
}
function bool(v: string | undefined, fallback = false): boolean {
  if (v == null) return fallback;
  return v === 'true' || v === '1';
}

// --- Haversine util ---
function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ===================== CONFIG (default export) =====================

export default registerAs('shipping', () => {
  // Tienda (cobertura y fallback clásico)
  const storeLat = num(process.env.STORE_LAT); // obligatorio
  const storeLng = num(process.env.STORE_LNG); // obligatorio

  // Clásico
  const radiusKm = num(process.env.DELIVERY_RADIUS_KM, 12);
  const base = num(process.env.SHIPPING_BASE, 2000);
  const perKm = num(process.env.SHIPPING_PER_KM, 400);
  const min = num(process.env.SHIPPING_MIN, 5000);

  // Urbana V2 (por plaza)
  const featureUrbanV2 = bool(process.env.FEATURE_TARIFF_URBAN_V2, false);
  const plazaLat = num(process.env.PLAZA_LAT, 5.6337096);
  const plazaLng = num(process.env.PLAZA_LNG, -73.5235176);
  const urbanRadiusKm = num(process.env.URBAN_RADIUS_KM, 1);
  const urbanFlatCop = num(process.env.URBAN_FLAT_COP, 5000);
  const urbanPerKmOutsideCop = num(process.env.URBAN_PER_KM_OUTSIDE_COP, 1000);

  return {
    // Compatibilidad previa
    store: { lat: storeLat, lng: storeLng },
    radiusKm,
    base,
    perKm,
    min,

    // Nueva tarifa urbana V2
    featureUrbanV2,
    plaza: { lat: plazaLat, lng: plazaLng },
    urbanRadiusKm,
    urbanFlatCop,
    urbanPerKmOutsideCop,
  };
});

// ===================== CÁLCULO DE PRECIO =====================

export type ShippingPriceInput = {
  destLat: number;
  destLng: number;
};

export type ShippingPriceOutput = {
  shippingCost: number;                  // COP
  pricingMode: 'URBAN_V2' | 'CLASSIC';
  dPlazaKm?: number;                     // útil para depurar V2
  dStoreKm?: number;                     // útil para depurar clásico
};

/**
 * Calcula el precio de envío leyendo las envs directamente.
 * - La COBERTURA NO se decide aquí (se sigue validando con la tienda en otro módulo).
 */
export function computeShippingPrice(
  input: ShippingPriceInput
): ShippingPriceOutput {
  const FEATURE_TARIFF_URBAN_V2 = bool(process.env.FEATURE_TARIFF_URBAN_V2, false);

  // Leer parámetros (con los mismos defaults que la config)
  const PLAZA_LAT = num(process.env.PLAZA_LAT, 5.6337096);
  const PLAZA_LNG = num(process.env.PLAZA_LNG, -73.5235176);
  const URBAN_RADIUS_KM = num(process.env.URBAN_RADIUS_KM, 1);
  const URBAN_FLAT_COP = num(process.env.URBAN_FLAT_COP, 5000);
  const URBAN_PER_KM_OUTSIDE_COP = num(process.env.URBAN_PER_KM_OUTSIDE_COP, 1000);

  const STORE_LAT = num(process.env.STORE_LAT);
  const STORE_LNG = num(process.env.STORE_LNG);
  const SHIPPING_MIN = num(process.env.SHIPPING_MIN, 5000);
  const SHIPPING_BASE = num(process.env.SHIPPING_BASE, 2000);
  const SHIPPING_PER_KM = num(process.env.SHIPPING_PER_KM, 400);

  const { destLat, destLng } = input;

  if (FEATURE_TARIFF_URBAN_V2) {
    const dPlazaKm = haversineKm(
      { lat: PLAZA_LAT, lng: PLAZA_LNG },
      { lat: destLat, lng: destLng }
    );
    let cost = URBAN_FLAT_COP;
    if (dPlazaKm > URBAN_RADIUS_KM) {
      const extraKm = dPlazaKm - URBAN_RADIUS_KM;
      cost = URBAN_FLAT_COP + URBAN_PER_KM_OUTSIDE_COP * extraKm;
    }
    return {
      shippingCost: Math.round(cost),
      pricingMode: 'URBAN_V2',
      dPlazaKm,
    };
  }

  // Clásico (fallback)
  const dStoreKm = haversineKm(
    { lat: STORE_LAT, lng: STORE_LNG },
    { lat: destLat, lng: destLng }
  );
  const base = SHIPPING_BASE + SHIPPING_PER_KM * dStoreKm;
  const cost = Math.max(SHIPPING_MIN, base);
  return {
    shippingCost: Math.round(cost),
    pricingMode: 'CLASSIC',
    dStoreKm,
  };
}
