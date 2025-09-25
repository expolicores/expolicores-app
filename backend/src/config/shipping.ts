// src/config/shipping.ts
import { registerAs } from '@nestjs/config';

function num(v: string | undefined, fallback?: number): number {
  const n = Number(v);
  if (Number.isNaN(n)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Valor numérico inválido para env: ${v}`);
  }
  return n;
}

export default registerAs('shipping', () => {
  const storeLat = num(process.env.STORE_LAT);  // sin fallback: obligatorio
  const storeLng = num(process.env.STORE_LNG);  // sin fallback: obligatorio

  const cfg = {
    store: { lat: storeLat, lng: storeLng },
    radiusKm: num(process.env.DELIVERY_RADIUS_KM, 12),
    base:     num(process.env.SHIPPING_BASE, 2000),
    perKm:    num(process.env.SHIPPING_PER_KM, 400),
    min:      num(process.env.SHIPPING_MIN, 5000),
  };

  return cfg;
});
