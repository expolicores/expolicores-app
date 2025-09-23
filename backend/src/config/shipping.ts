// src/config/shipping.ts
export const SHIPPING_CFG = {
  store: {
    lat: Number(process.env.STORE_LAT),
    lng: Number(process.env.STORE_LNG),
  },
  radiusKm: Number(process.env.DELIVERY_RADIUS_KM ?? 12),
  base: Number(process.env.SHIPPING_BASE ?? 2000),
  perKm: Number(process.env.SHIPPING_PER_KM ?? 400),
  min: Number(process.env.SHIPPING_MIN ?? 5000),
};

// Validación mínima (fail-fast en arranque o al primer uso)
export function assertShippingEnv() {
  const { lat, lng } = SHIPPING_CFG.store;
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error('ENV STORE_LAT/STORE_LNG inválidas o faltantes');
  }
}
