import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Selecciona la key correcta:
 * - En Expo Go o __DEV__: usa siempre la DEV (sin Application restrictions).
 * - En build nativa (dev client / release): usa la de plataforma.
 */
export function getGooglePlacesKey(): string {
  const dev = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_DEV;
  const android = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
  const ios = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS;

  const isExpoGo = Constants.appOwnership === 'expo'; // Expo Go
  if (isExpoGo || __DEV__) {
    if (dev) return dev;
  }

  if (Platform.OS === 'ios' && ios) return ios;
  if (Platform.OS === 'android' && android) return android;

  // fallback final
  if (dev) return dev;
  throw new Error('Google Places API key not configured');
}
