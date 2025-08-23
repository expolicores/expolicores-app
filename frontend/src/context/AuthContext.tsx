import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { api, setAuthToken, authHeaderSetter } from '../lib/api';
import type { User, LoginPayload, RegisterPayload, AuthTokenResponse } from '../types/auth';

interface AuthContextType {
  initializing: boolean;
  loading: boolean;
  user: User | null;
  token: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({} as any);

const TOKEN_KEY = 'expolicores.token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // Configura cómo se aplica el header Authorization globalmente
  useEffect(() => { authHeaderSetter((t) => {
    if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
    else delete api.defaults.headers.common.Authorization;
  }); }, []);

  const loadFromStorage = useCallback(async () => {
    try {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (saved) {
        setToken(saved);
        setAuthToken(saved);
        await refreshMeInternal(saved);
      }
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  const refreshMeInternal = useCallback(async (_token?: string) => {
    try {
      if (!_token && !token) return;
      setLoading(true);
      const { data } = await api.get<User>('/users/me');
      setUser(data);
    } catch (e: any) {
      // Token inválido/expirado
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null); setUser(null); setAuthToken(null);
    } finally { setLoading(false); }
  }, [token]);

  const login = useCallback(async (payload: LoginPayload) => {
    setLoading(true);
    try {
      const { data } = await api.post<AuthTokenResponse>('/auth/login', payload);
      const t = data.token;
      setToken(t); setAuthToken(t);
      await SecureStore.setItemAsync(TOKEN_KEY, t);
      await refreshMeInternal(t);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo iniciar sesión');
      throw e;
    } finally { setLoading(false); }
  }, [refreshMeInternal]);

  const register = useCallback(async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      const { data } = await api.post<AuthTokenResponse>('/auth/register', payload);
      const t = data.token;
      setToken(t); setAuthToken(t);
      await SecureStore.setItemAsync(TOKEN_KEY, t);
      await refreshMeInternal(t);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo registrar');
      throw e;
    } finally { setLoading(false); }
  }, [refreshMeInternal]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null); setUser(null); setAuthToken(null);
    } finally { setLoading(false); }
  }, []);

  const refreshMe = useCallback(async () => refreshMeInternal(), [refreshMeInternal]);

  const value = useMemo(() => ({ initializing, loading, user, token, login, register, logout, refreshMe }), [initializing, loading, user, token, login, register, logout, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}