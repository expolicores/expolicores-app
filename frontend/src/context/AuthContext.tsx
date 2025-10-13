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

import {
  api,
  setAuthToken,
  getMe as apiGetMe,
  requestOtp as apiRequestOtp,
  verifyOtpApi,
  loginWithPassword as apiLoginWithPassword,
  type RequestOtpBody,
  type RequestOtpResp,
} from '../lib/api';

import type { Me } from '../types/auth';

/** ============================ Tipos del contexto ============================ */
type OtpChannel = 'sms' | 'whatsapp';

type AuthCtx = {
  booting: boolean;
  isAuthenticated: boolean;
  token: string | null;
  user: Me | null;

  refreshMe: () => Promise<Me | null>;

  // Legado (mientras migramos todo a OTP-first)
  signIn: (email: string, password: string) => Promise<void>;

  // OTP-first
  requestOtpByPhone: (
    phone: string,
    channel?: OtpChannel,
    intent?: 'login' | 'register'
  ) => Promise<Pick<RequestOtpResp, 'devOtp' | 'phoneMasked' | 'throttled'>>;

  requestOtpByEmail: (
    email: string
  ) => Promise<Pick<RequestOtpResp, 'devOtp' | 'phoneMasked' | 'throttled'>>;

  verifyOtp: (args: {
    phone?: string;
    email?: string;
    code: string;
    name?: string;
    emailEnroll?: string;
  }) => Promise<Me | null>;

  lastPhone: string | null;
  setLastPhone: (p: string | null) => Promise<void>;

  // ➕ Nuevo: aplazar captura de email (para evitar loop)
  emailDeferred: boolean;
  deferEmailPrompt: (defer?: boolean) => Promise<void>;

  signOut: () => Promise<void>;
};

/** ============================ Constantes de storage ============================ */
const TOKEN_KEY = 'expolicores_token';
const LAST_PHONE_KEY = 'expolicores_last_phone';
const emailDeferKey = (userId?: number | null) =>
  `expolicores_email_deferred_${userId ?? 'anon'}`;

/** ============================ Contexto ============================ */
const AuthContext = createContext<AuthCtx>({} as any);
export const useAuth = () => useContext(AuthContext);

/** ============================ Provider ============================ */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [lastPhone, setLastPhoneState] = useState<string | null>(null);

  // ➕ Nuevo: estado de aplazamiento de email, por usuario
  const [emailDeferred, setEmailDeferred] = useState<boolean>(false);

  // Evita paralelizar /auth/me o logout múltiples
  const inflightRef = useRef(false);
  const loggingOutRef = useRef(false);

  /** ---------- Helpers de aplazamiento email ---------- */
  const loadEmailDeferredFor = useCallback(async (u?: Me | null) => {
    try {
      const raw = await SecureStore.getItemAsync(emailDeferKey(u?.id));
      setEmailDeferred(raw === '1');
    } catch {
      setEmailDeferred(false);
    }
  }, []);

  const deferEmailPrompt = useCallback(
    async (defer: boolean = true) => {
      setEmailDeferred(defer);
      try {
        await SecureStore.setItemAsync(emailDeferKey(user?.id), defer ? '1' : '0');
      } catch {
        // noop
      }
    },
    [user?.id]
  );

  /** ---------- Perfil ---------- */
  const refreshMe = useCallback(async (): Promise<Me | null> => {
    if (inflightRef.current) return user ?? null;
    inflightRef.current = true;
    try {
      const data = (await apiGetMe()) as Me;
      setUser(data);
      await loadEmailDeferredFor(data);
      return data;
    } catch {
      setUser(null);
      setEmailDeferred(false);
      return null;
    } finally {
      inflightRef.current = false;
    }
  }, [loadEmailDeferredFor, user]);

  /** ---------- Boot: hidratar token y perfil ---------- */
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedPhone] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(LAST_PHONE_KEY),
        ]);

        if (savedToken) {
          // 👇 Asegura header antes de pedir /auth/me
          setAuthToken(savedToken);
          setToken(savedToken);
          await refreshMe();
        }
        if (savedPhone) setLastPhoneState(savedPhone);
      } finally {
        setBooting(false);
      }
    })();
  }, [refreshMe]);

  /** ---------- Reaplicar auth header cuando cambie el token ---------- */
  useEffect(() => {
    setAuthToken(token || undefined);
  }, [token]);

  /** ---------- Interceptor 401 global → logout limpio ---------- */
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      async (error) => {
        const status = error?.response?.status ?? 0;
        if (status === 401 && token && !loggingOutRef.current) {
          try {
            loggingOutRef.current = true;
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            setToken(null);
            setUser(null);
            setEmailDeferred(false);
            setAuthToken(undefined);
          } finally {
            loggingOutRef.current = false;
          }
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [token]);

  /** ---------- Helpers de persistencia ---------- */
  const persistToken = useCallback(async (tok: string) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, tok);
    } catch (err) {
      console.warn('[SecureStore] setItem error', err);
    }
    setToken(tok);
  }, []);

  const setLastPhone = useCallback(async (p: string | null) => {
    try {
      if (p) {
        await SecureStore.setItemAsync(LAST_PHONE_KEY, p);
      } else {
        await SecureStore.deleteItemAsync(LAST_PHONE_KEY);
      }
      setLastPhoneState(p);
    } catch (err) {
      console.warn('[SecureStore] last phone error', err);
    }
  }, []);

  /** ---------- Login legado ---------- */
  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { access_token } = await apiLoginWithPassword(
          String(email ?? '').trim().toLowerCase(),
          String(password ?? '')
        );
        if (!access_token) throw new Error('Respuesta de login inválida (sin access_token)');
        await persistToken(access_token);
        await refreshMe();
      } catch (e: any) {
        const msg =
          e?.message ||
          (typeof e?.details?.message === 'string' ? e.details.message : 'No se pudo iniciar sesión');
        Alert.alert('Error', msg);
        throw e;
      }
    },
    [persistToken, refreshMe]
  );

  /** ---------- OTP-first ---------- */
  const requestOtpCore = useCallback(
    async (body: RequestOtpBody): Promise<Pick<RequestOtpResp, 'devOtp' | 'phoneMasked' | 'throttled'>> => {
      try {
        const res = await apiRequestOtp(body);
        if ((body as any).phone) await setLastPhone((body as any).phone);
        return {
          devOtp: res.devOtp,
          phoneMasked: res.phoneMasked,
          throttled: res.throttled,
        };
      } catch (e: any) {
        const msg =
          e?.message ||
          (typeof e?.details?.message === 'string' ? e.details.message : null) ||
          'No pudimos enviar el código. Intenta de nuevo.';
        Alert.alert('Error', msg);
        throw e;
      }
    },
    [setLastPhone]
  );

  const requestOtpByPhone: AuthCtx['requestOtpByPhone'] = useCallback(
    async (phone, channel = 'whatsapp', intent = 'login') => {
      return requestOtpCore({ phone, channel, intent } as any);
    },
    [requestOtpCore]
  );

  const requestOtpByEmail: AuthCtx['requestOtpByEmail'] = useCallback(
    async (email) => {
      return requestOtpCore({ email, intent: 'login' } as any);
    },
    [requestOtpCore]
  );

  const verifyOtp: AuthCtx['verifyOtp'] = useCallback(
    async (args) => {
      try {
        const { access_token, user: partial } = await verifyOtpApi(args);
        if (!access_token) throw new Error('Respuesta inválida (sin access_token)');
        await persistToken(access_token);

        if (partial) {
          setUser(partial as Me);
          await loadEmailDeferredFor(partial as Me);
          return partial as Me;
        } else {
          const me = await refreshMe();
          return me;
        }
      } catch (e: any) {
        const msg =
          e?.message ||
          (typeof e?.details?.message === 'string' ? e.details.message : null) ||
          'Código inválido o expirado.';
        Alert.alert('Error', msg);
        throw e;
      }
    },
    [persistToken, refreshMe, loadEmailDeferredFor]
  );

  /** ---------- Logout ---------- */
  const signOut = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } finally {
      setToken(null);
      setUser(null);
      setEmailDeferred(false);
      setAuthToken(undefined);
    }
  }, []);

  /** ---------- Value ---------- */
  const value = useMemo<AuthCtx>(
    () => ({
      booting,
      isAuthenticated: !!token,
      token,
      user,

      refreshMe,

      signIn,

      requestOtpByPhone,
      requestOtpByEmail,
      verifyOtp,

      lastPhone,
      setLastPhone,

      emailDeferred,
      deferEmailPrompt,

      signOut,
    }),
    [
      booting,
      token,
      user,
      refreshMe,
      signIn,
      requestOtpByPhone,
      requestOtpByEmail,
      verifyOtp,
      lastPhone,
      setLastPhone,
      emailDeferred,
      deferEmailPrompt,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
