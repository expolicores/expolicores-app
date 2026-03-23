// frontend/src/context/NotificationsContext.tsx
// =============================================
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { api } from '../lib/api';
import {
  requestPushPermissions,
  addNotificationListeners,
} from '../lib/notifications';

export type NotificationsState = {
  status: 'unknown' | 'granted' | 'denied';
  token?: string;
  /** Pide permisos (si faltan) y registra/actualiza el token en backend. Devuelve true si hay permiso. */
  ensurePermission: () => Promise<boolean>;
};

const Ctx = createContext<NotificationsState | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [status, setStatus] = useState<NotificationsState['status']>('unknown');
  const [token, setToken] = useState<string | undefined>();

  // Guards para evitar registros duplicados/race conditions
  const registeringRef = useRef(false);
  const lastRegisteredRef = useRef<string | undefined>(undefined);

  // Suscriptores a eventos de notificaciones (foreground / responses)
  useEffect(() => {
    const unsubscribe = addNotificationListeners();
    return unsubscribe;
  }, []);

  const registerTokenInBackend = useCallback(
    async (expoToken: string) => {
      if (!expoToken) return;

      // Idempotencia básica (no reintentar si ya registramos ese token)
      if (lastRegisteredRef.current === expoToken) return;
      if (registeringRef.current) return;

      registeringRef.current = true;
      try {
        // Preferido: endpoint dedicado
        await api.post('/notifications/push/register', {
          token: expoToken,
          platform: Platform.OS, // 'ios' | 'android'
        });
        lastRegisteredRef.current = expoToken;
        console.log('[push] Token registrado en backend');
      } catch (err) {
        console.warn('[push] Falló /notifications/push/register, intento fallback /users/me', err);
        try {
          // Fallback tolerante (si el backend lo soporta)
          await api.patch('/users/me', { pushToken: expoToken });
          lastRegisteredRef.current = expoToken;
          console.log('[push] Token guardado en perfil (fallback)');
        } catch (err2) {
          console.warn('[push] No se pudo persistir el token en backend:', err2);
        }
      } finally {
        registeringRef.current = false;
      }
    },
    [],
  );

  const ensurePermission = useCallback(async () => {
    const res = await requestPushPermissions();

    if (!res.granted) {
      setStatus('denied');
      return false;
    }

    setStatus('granted');

    // Guarda en estado y registra si es nuevo
    if (res.token && res.token !== token) {
      setToken(res.token);
      registerTokenInBackend(res.token);
    } else if (res.token && token && res.token !== lastRegisteredRef.current) {
      // Si el token cambió respecto al último registrado, vuelve a registrar
      registerTokenInBackend(res.token);
    }

    return true;
  }, [registerTokenInBackend, token]);

  const value = useMemo(
    () => ({ status, token, ensurePermission }),
    [status, token, ensurePermission],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
