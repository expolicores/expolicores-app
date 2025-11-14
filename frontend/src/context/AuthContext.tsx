// frontend/src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

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

/* ============================ Tipos del contexto ============================ */
type OtpChannel = 'sms' | 'whatsapp';

// Extiende Me para permitir token embebido en user (sin romper lo demás)
type MeWithToken = Me & { token?: string };

type AuthCtx = {
  /** true hasta que terminamos de rehidratar token/usuario */
  isReady: boolean;

  booting: boolean; // compat: alias de !isReady === booting
  isAuthenticated: boolean;
  token: string | null;

  /** user incluye token (prop opcional) para pantallas que lo lean ahí */
  user: MeWithToken | null; // alias legacy + token opcional
  me: Me | null;
  isLoadingMe: boolean;

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

  // Aplazar captura de email (para evitar loop post-OTP)
  emailDeferred: boolean;
  deferEmailPrompt: (defer?: boolean) => Promise<void>;

  signOut: () => Promise<void>;
};

/* ============================ Storage keys ============================ */
const TOKEN_KEY = 'expolicores_token';
const LAST_PHONE_KEY = 'expolicores_last_phone';
const emailDeferKey = (userId?: number | null) =>
  `expolicores_email_deferred_${userId ?? 'anon'}`;

/* ============================ Query Client (único) ============================ */
const qc = new QueryClient();

/* ============================ Contexto ============================ */
const Ctx = createContext<AuthCtx | undefined>(undefined);
export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/* ============================ Hook interno: estado auth ============================ */
function useAuthState() {
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [lastPhone, setLastPhoneState] = useState<string | null>(null);
  const [emailDeferred, setEmailDeferred] = useState<boolean>(false);

  const loggingOutRef = useRef(false);
  const queryClient = useQueryClient();

  // ---- Cargar token/lastPhone al iniciar y poblar header + user
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedPhone] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(LAST_PHONE_KEY),
        ]);

        if (savedToken) {
          setAuthToken(savedToken);
          setToken(savedToken);
          console.log('JWT (rehidratado) 👉', savedToken);
          // Opcionalmente validar token y poblar user
          try {
            const me = await apiGetMe();
            queryClient.setQueryData(['me'], me);
            // embebe token en user para pantallas que lo lean ahí
            queryClient.setQueryData(
              ['user-with-token'],
              { ...me, token: savedToken } as MeWithToken
            );
          } catch (err) {
            // token inválido: limpiar
            setAuthToken(undefined);
            setToken(null);
            await SecureStore.deleteItemAsync(TOKEN_KEY);
          }
        }
        if (savedPhone) setLastPhoneState(savedPhone);
      } finally {
        setBooting(false);
      }
    })();
  }, [queryClient]);

  // ---- Reaplicar Authorization cuando cambie token
  useEffect(() => {
    setAuthToken(token || undefined);
    if (token) {
      const me = queryClient.getQueryData(['me']) as Me | undefined;
      if (me) {
        queryClient.setQueryData(
          ['user-with-token'],
          { ...me, token } as MeWithToken
        );
      }
    } else {
      queryClient.removeQueries({ queryKey: ['user-with-token'] });
    }
  }, [token, queryClient]);

  // ---- /auth/me con React Query (habilitado solo si hay token)
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: apiGetMe,
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 min sin refetch
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    onSuccess: (me) => {
      // mantiene user con token actualizado
      queryClient.setQueryData(
        ['user-with-token'],
        { ...me, token: token ?? undefined } as MeWithToken
      );
    },
  });

  // ---- Cargar flag de deferEmail para este usuario cuando cambie me
  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(
          emailDeferKey(meQuery.data?.id)
        );
        setEmailDeferred(raw === '1');
      } catch {
        setEmailDeferred(false);
      }
    })();
  }, [meQuery.data?.id]);

  // ---- Interceptor 401 global → logout limpio
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
            setAuthToken(undefined);
            setEmailDeferred(false);
            queryClient.removeQueries({ queryKey: ['me'] });
            queryClient.removeQueries({ queryKey: ['user-with-token'] });
          } finally {
            loggingOutRef.current = false;
          }
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [token, queryClient]);

  // ---- Helpers de persistencia
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
      if (p) await SecureStore.setItemAsync(LAST_PHONE_KEY, p);
      else await SecureStore.deleteItemAsync(LAST_PHONE_KEY);
      setLastPhoneState(p);
    } catch (err) {
      console.warn('[SecureStore] last phone error', err);
    }
  }, []);

  // ---- API público del contexto

  const refreshMe = useCallback(async (): Promise<Me | null> => {
    if (!token) {
      queryClient.removeQueries({ queryKey: ['me'] });
      queryClient.removeQueries({ queryKey: ['user-with-token'] });
      return null;
    }
    const data = await queryClient.fetchQuery<Me>({
      queryKey: ['me'],
      queryFn: apiGetMe,
    });
    // actualiza user con token
    if (data) {
      queryClient.setQueryData(
        ['user-with-token'],
        { ...data, token } as MeWithToken
      );
    }
    return data ?? null;
  }, [queryClient, token]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { access_token } = await apiLoginWithPassword(
          String(email ?? '').trim().toLowerCase(),
          String(password ?? '')
        );
        if (!access_token) {
          throw new Error('Respuesta de login inválida (sin access_token)');
        }
        await persistToken(access_token);
        console.log('JWT (password) 👉', access_token);
        const me = await refreshMe();
        if (me) {
          queryClient.setQueryData(
            ['user-with-token'],
            { ...me, token: access_token } as MeWithToken
          );
        }
      } catch (e: any) {
        const msg =
          e?.message ||
          (typeof e?.details?.message === 'string'
            ? e.details.message
            : 'No se pudo iniciar sesión');
        Alert.alert('Error', msg);
        throw e;
      }
    },
    [persistToken, refreshMe, queryClient]
  );

  const requestOtpCore = useCallback(
    async (
      body: RequestOtpBody
    ): Promise<Pick<RequestOtpResp, 'devOtp' | 'phoneMasked' | 'throttled'>> => {
      try {
        const res = await apiRequestOtp(body);
        if ((body as any).phone) {
          await setLastPhone((body as any).phone);
        }
        return {
          devOtp: res.devOtp,
          phoneMasked: res.phoneMasked,
          throttled: res.throttled,
        };
      } catch (e: any) {
        const msg =
          e?.message ||
          (typeof e?.details?.message === 'string'
            ? e.details.message
            : null) ||
          'No pudimos enviar el código. Intenta de nuevo.';
        Alert.alert('Error', msg);
        throw e;
      }
    },
    [setLastPhone]
  );

  const requestOtpByPhone = useCallback<AuthCtx['requestOtpByPhone']>(
    async (phone, channel = 'sms', intent = 'login') => {
      // Flujo normal: phone como identificador + canal explícito (sms/whatsapp)
      return requestOtpCore({ phone, channel, intent } as any);
    },
    [requestOtpCore]
  );

  const requestOtpByEmail = useCallback<AuthCtx['requestOtpByEmail']>(
    async (email) => {
      // IMPORTANTE:
      // - El correo solo se usa como IDENTIFICADOR.
      // - El OTP se envía SIEMPRE por SMS al celular asociado en backend.
      const normalizedEmail = String(email ?? '').trim().toLowerCase();
      return requestOtpCore({
        email: normalizedEmail,
        channel: 'sms',
        intent: 'login',
      } as any);
    },
    [requestOtpCore]
  );

  const verifyOtp = useCallback<AuthCtx['verifyOtp']>(
    async (args) => {
      try {
        const { access_token, user } = await verifyOtpApi(args);
        if (!access_token) {
          throw new Error('Respuesta inválida (sin access_token)');
        }

        // Persistimos y exponemos el JWT
        await persistToken(access_token);
        console.log('JWT (OTP) 👉', access_token);

        if (user) {
          // Poblamos caches
          queryClient.setQueryData(['me'], user as Me);
          queryClient.setQueryData(
            ['user-with-token'],
            { ...(user as Me), token: access_token } as MeWithToken
          );

          console.log('Usuario (me) actualizado 👉', {
            id: (user as Me).id,
            role: (user as Me).role,
            businessVerificationStatus: (user as any)?.businessVerificationStatus,
          });

          // Cargar defer flag para este usuario
          try {
            const raw = await SecureStore.getItemAsync(
              emailDeferKey((user as Me).id)
            );
            setEmailDeferred(raw === '1');
          } catch {
            setEmailDeferred(false);
          }
          return user as Me;
        } else {
          const me = await refreshMe();
          if (me) {
            queryClient.setQueryData(
              ['user-with-token'],
              { ...me, token: access_token } as MeWithToken
            );
          }
          return me;
        }
      } catch (e: any) {
        const msg =
          e?.message ||
          (typeof e?.details?.message === 'string'
            ? e.details.message
            : null) ||
          'Código inválido o expirado.';
        Alert.alert('Error', msg);
        throw e;
      }
    },
    [persistToken, refreshMe, queryClient]
  );

  const deferEmailPrompt = useCallback(
    async (defer: boolean = true) => {
      setEmailDeferred(defer);
      try {
        const userId = (queryClient.getQueryData(['me']) as Me | undefined)?.id;
        await SecureStore.setItemAsync(
          emailDeferKey(userId),
          defer ? '1' : '0'
        );
      } catch {
        // noop
      }
    },
    [queryClient]
  );

  const signOut = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } finally {
      setToken(null);
      setAuthToken(undefined);
      setEmailDeferred(false);
      queryClient.removeQueries({ queryKey: ['me'] });
      queryClient.removeQueries({ queryKey: ['user-with-token'] });
    }
  }, [queryClient]);

  // Selección de datos expuestos
  const currentMe = (meQuery.data as Me) ?? null;
  const userWithToken =
    (queryClient.getQueryData(['user-with-token']) as MeWithToken | undefined) ??
    (currentMe ? { ...currentMe, token: token ?? undefined } : null);

  const value: AuthCtx = useMemo(
    () => ({
      isReady: !booting,
      booting,
      isAuthenticated: !!token,
      token,
      user: userWithToken,
      me: currentMe,
      isLoadingMe: !!token && (meQuery.isLoading || meQuery.isFetching),

      refreshMe,

      // legado
      signIn,

      // otp
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
      userWithToken,
      currentMe,
      meQuery.isLoading,
      meQuery.isFetching,
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

  return value;
}

/* ============================ Provider ============================ */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value = useAuthState();

  return (
    <QueryClientProvider client={qc}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </QueryClientProvider>
  );
};
