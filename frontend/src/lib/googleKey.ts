// lib/googleKey.ts
/**
 * Devuelve la API key de Google Places / Maps Web Service.
 *
 * Usamos una única key "web-service" (sin restricciones de aplicación,
 * solo restringida por API en la consola de Google).
 *
 * Asegúrate de tener en tu .env:
 *   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=tu_key_aquí
 */
export function getGooglePlacesKey(): string {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    throw new Error('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY no está configurada');
  }

  return key;
}
