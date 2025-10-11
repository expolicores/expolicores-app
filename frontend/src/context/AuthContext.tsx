// frontend/src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { api, setAuthToken } from '../lib/api';
import type { Me } from '../types/auth';

type AuthCtx = {
  booting: boolean;
  isAuthenticated: boolean;
  token: string | null;
  user: Me | null;                 // Perfil con rol
  refreshMe: () => Promise<void>;  // Forzar refetch de /auth/me
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const TOKEN_KEY = 'expolicores_token';
const AuthContext = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);

  // Evita paralelizar /auth/me
  const inflightRef = useRef(false);
  // Evita llamar signOut varias veces ante múltiples 401
  const loggingOutRef = useRef(false);

  /** Trae el perfil actual del backend (si falla, deja user en null). */
  const refreshMe = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      // Si tu cliente ya normaliza anti-cache, no hace falta enviar headers aquí.
      const r = await api.get<Me>('/auth/me', {
        headers: {
          // minúsculas por compat con Axios v1
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          expires: '0',
        },
      });
      setUser(r.data);
    } catch {
      setUser(null);
    } finally {
      inflightRef.current = false;
    }
  }, []);

  // Hidrata token guardado y levanta el perfil al arrancar la app
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          setToken(saved);           // setAuthToken se aplica en el efecto de abajo
          await refreshMe();         // Perfil fresco (rol incluido)
        }
      } finally {
        setBooting(false);
      }
    })();
  }, [refreshMe]);

  // Asegura que SIEMPRE que cambie el token, se refleje en el cliente HTTP
  useEffect(() => {
    setAuthToken(token || undefined);
  }, [token]);

  // Interceptor 401 → logout limpio (con guard para no repetir)
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      async (err) => {
        if (err?.response?.status === 401 && token && !loggingOutRef.current) {
          try {
            loggingOutRef.current = true;
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            setToken(null);
            setUser(null);
            setAuthToken(undefined);
          } finally {
            loggingOutRef.current = false;
          }
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [token]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const payload = {
        email: String(email ?? '').trim().toLowerCase(),
        password: String(password ?? ''),
      };
      const { data } = await api.post('/auth/login', payload);

      // Acepta access_token | accessToken | token
      const tok =
        (data && (data.access_token ?? data.accessToken ?? data.token)) as string | undefined;

      if (!tok) {
        console.log('[LOGIN] response sin token', data);
        throw new Error('Respuesta de login inválida (sin access_token)');
      }

      try {
        await SecureStore.setItemAsync(TOKEN_KEY, tok);
      } catch (err) {
        console.warn('[SecureStore] setItem error', err);
      }

      setToken(tok);   // setAuthToken se aplica por el efecto [token]
      await refreshMe();
    } catch (e: any) {
      console.log('LOGIN ERROR →', {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
        baseURL: (api.defaults as any).baseURL,
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
  }, [refreshMe]);

  const signOut = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } finally {
      setToken(null);
      setUser(null);
      setAuthToken(undefined);
    }
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      booting,
      isAuthenticated: !!token,
      token,
      user,
      refreshMe,
      signIn,
      signOut,
    }),
    [booting, token, user, refreshMe, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
