import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';

// lectura de .env
const ENV_FLAGS = {
  RESTAURANTS: (process.env.EXPO_PUBLIC_FEATURE_RESTAURANTS || 'false') === 'true',
  B2B: true, // lo dejamos encendido; gating por rol
};

// opcional: remoto (para encender sin publicar)
async function fetchRemoteFlags() {
  try {
    const base = Constants.expoConfig?.extra?.apiBase || process.env.EXPO_PUBLIC_API_BASE_URL;
    const r = await fetch(`${base}/config/flags`);
    if (!r.ok) throw new Error('flags fetch error');
    return await r.json(); // { RESTAURANTS: boolean, B2B: boolean, ... }
  } catch {
    return {};
  }
}

export function useFeatureFlags() {
  const { data } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: fetchRemoteFlags,
    // no bloquea: usa env primero
    staleTime: 5 * 60 * 1000,
  });

  return {
    RESTAURANTS: data?.RESTAURANTS ?? ENV_FLAGS.RESTAURANTS,
    B2B: data?.B2B ?? ENV_FLAGS.B2B,
  };
}
