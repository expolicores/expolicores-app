// 2) context/NotificationsContext.tsx
// ==============================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { requestPushPermissions, addNotificationListeners } from '../lib/notifications';
import { Platform } from 'react-native';
import { api } from '../lib/api';

export type NotificationsState = {
  status: 'unknown' | 'granted' | 'denied';
  token?: string;
  ensurePermission: () => Promise<boolean>;
};

const Ctx = createContext<NotificationsState | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<NotificationsState['status']>('unknown');
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
    const unsubscribe = addNotificationListeners();
    return unsubscribe;
  }, []);

  const ensurePermission = useCallback(async () => {
    const res = await requestPushPermissions();
    if (!res.granted) {
      setStatus('denied');
      return false;
    }
    setStatus('granted');
    if (res.token && res.token !== token) {
      setToken(res.token);
      // Intentar registrar en backend (tolerante a fallos)
      try {
        // Preferencia 1: endpoint dedicado (si existe)
        await api.post('/notifications/push/register', { token: res.token, platform: Platform.OS });
      } catch {
        try {
          // Fallback: guardar en perfil del usuario si el backend lo soporta
          await api.patch('/users/me', { pushToken: res.token });
        } catch {}
      }
    }
    return true;
  }, [token]);

  const value = useMemo(() => ({ status, token, ensurePermission }), [status, token, ensurePermission]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
