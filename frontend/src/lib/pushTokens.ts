// src/lib/pushTokens.ts
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const KEY_LAST_EXPO_TOKEN = 'lastExpoPushToken';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function jitter(ms: number) { return ms + Math.floor(Math.random() * 300); }

async function fetchExpoTokenWithRetry(maxAttempts = 4) {
  let attempt = 0;
  let lastErr: any = null;
  const delays = [1500, 3000, 6000]; // ~1.5s, 3s, 6s (puedes ajustar)

  while (attempt < maxAttempts) {
    try {
      const tokenResp = await Notifications.getExpoPushTokenAsync(); // usa tu projectId si lo tienes
      if (!tokenResp?.data) throw new Error('no-token');
      return tokenResp.data as string;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e);
      // Errores típicos de Expo infra: 503 / SERVICE_UNAVAILABLE / "no healthy upstream"
      const transient =
        /503|SERVICE_UNAVAILABLE|no healthy upstream/i.test(msg) ||
        /temporarily unavailable|isTransient/i.test(msg) ||
        e?.code === 'SERVICE_UNAVAILABLE';

      if (!transient || attempt >= delays.length) break;
      await sleep(jitter(delays[attempt]));
      attempt++;
    }
  }
  throw lastErr ?? new Error('unknown-expo-push-error');
}

export async function ensureExpoPushTokenResilient(log: (ev: string, p?: any) => any) {
  try {
    // 1) permisos (no bloqueantes)
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) {
        await log('NOTIFS/DENIED');
        return null; // usuario negó → no insistimos
      }
    }

    // 2) buscar token cacheado (para evitar registrar de nuevo)
    const cached = await AsyncStorage.getItem(KEY_LAST_EXPO_TOKEN);

    // 3) intentar obtener token con backoff
    const token = await fetchExpoTokenWithRetry();

    if (token && token !== cached) {
      await api.post('/notifications/push/register', { token, platform: 'expo' });
      await AsyncStorage.setItem(KEY_LAST_EXPO_TOKEN, token);
      await log('NOTIFS/REGISTER_OK', { tokenSuffix: token.slice(-6) });
    } else {
      await log('NOTIFS/SKIP_SAME_TOKEN', { tokenSuffix: token?.slice(-6) });
    }
    return token;
  } catch (e: any) {
    // 4) plan B: schedule retry en foreground
    await log('NOTIFS/REGISTER_ERR', { message: String(e?.message || e) });
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'active') {
        try {
          const token = await fetchExpoTokenWithRetry(2);
          if (token) {
            const cached = await AsyncStorage.getItem(KEY_LAST_EXPO_TOKEN);
            if (token !== cached) {
              await api.post('/notifications/push/register', { token, platform: 'expo' });
              await AsyncStorage.setItem(KEY_LAST_EXPO_TOKEN, token);
            }
            await log('NOTIFS/RETRY_FOREGROUND_OK', { tokenSuffix: token.slice(-6) });
          }
        } catch {
          /* último intento fallido, silenciar */
        } finally {
          sub.remove();
        }
      }
    });
    // también puedes setTimeout para otro intento en 20–30s
    return null;
  }
}
