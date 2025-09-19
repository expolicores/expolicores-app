import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { api, setAuthToken, authHeaderSetter } from '../lib/api';

type AuthCtx = {
  booting: boolean;
  isAuthenticated: boolean;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const TOKEN_KEY = 'expolicores_token';

export const AuthContext = createContext<AuthCtx>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  // Inicializa setter para header Authorization
  authHeaderSetter();

  // Carga token almacenado y valida sesión
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          setToken(saved);
          setAuthToken(saved);
          await api.get('/auth/me').catch(() => signOut());
        }
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Interceptor 401 → logout
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      async (err) => {
        if (err?.response?.status === 401) await signOut();
        return Promise.reject(err);
      },
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const payload = {
        email: String(email ?? '').trim().toLowerCase(),
        password: String(password ?? ''),
      };
      const { data } = await api.post('/auth/login', payload);

      // Acepta access_token | accessToken | token
      const token =
        (data && (data.access_token ?? data.accessToken ?? data.token)) as
          | string
          | undefined;

      if (!token) {
        console.log('[LOGIN] response sin token', data);
        throw new Error('Respuesta de login inválida (sin access_token)');
      }

      // Persistencia (si falla no bloquea el login)
      try {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      } catch (err) {
        console.warn('[SecureStore] setItem error', err);
      }

      setAuthToken(token);
      setToken(token);
    } catch (e: any) {
      console.log('LOGIN ERROR →', {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
        baseURL: api.defaults.baseURL,
      });
      const serverMsg = e?.response?.data?.message;
      const msg = serverMsg
        ? Array.isArray(serverMsg)
          ? serverMsg.join('\n')
          : String(serverMsg)
        : e?.message ?? 'No se pudo iniciar sesión';
      Alert.alert('Error', msg);
      throw e;
    }
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setAuthToken(null);
  };

  const value = useMemo<AuthCtx>(
    () => ({
      booting,
      isAuthenticated: !!token,
      token,
      signIn,
      signOut,
    }),
    [booting, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
