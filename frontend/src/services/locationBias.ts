// frontend/src/services/locationBias.ts
export type LatLng = { lat: number; lng: number };

/** Hoy no pide permisos: devuelve null para usar bias de tienda. */
export async function getUserBiasOrNull(): Promise<LatLng | null> {
  return null;
}

/** Versión futura con permisos (cuando los actives):
import * as Location from 'expo-location';

export async function getUserBiasOrNull(): Promise<LatLng | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: coords.latitude, lng: coords.longitude };
}
*/
