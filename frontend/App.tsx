// frontend/App.tsx
import React, { useEffect } from 'react';
import {
  AppState,
  NativeModules,
  Platform,
  StatusBar,
  LogBox,
} from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import AppNavigator from './src/navigation/AppNavigator';

/** Mantiene react-query en sync con el foco de la app (foreground/background) */
function onAppStateChange(status: string) {
  focusManager.setFocused(status === 'active');
}

/** Crea un QueryClient único para toda la app */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // 30s
      gcTime: 5 * 60 * 1000, // 5 min
      refetchOnReconnect: true,
      refetchOnWindowFocus: true, // usa focusManager (AppState)
    },
    mutations: { retry: 0 },
  },
});

export default function App() {
  // Silenciar warnings ruidosos de NativeEventEmitter (la causa real se corrige en bus.ts)
  LogBox.ignoreLogs([
    '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
    '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
  ]);

  // 🔎 Verificación de build/entorno + probe del bridge nativo de ActivityKit (una sola vez)
  useEffect(() => {
    // ===== ENTORNO (lo que llega al bundle de JS) =====
    console.log('[ENVCHK]', {
      profile: process.env.EAS_BUILD_PROFILE, // debe ser "development" en Dev Client
      api: process.env.EXPO_PUBLIC_API_BASE_URL,
      debugHttp: process.env.EXPO_PUBLIC_DEBUG_HTTP,
      sdk: Constants.expoConfig?.sdkVersion, // debe ser "54.0.0"
      appId: Constants.applicationId, // com.expolicores.app.dev en dev
    });

    // ===== BINARIO (lo que está instalado en el dispositivo) =====
    console.log('[BUILD] nativeApplicationVersion =', Application.nativeApplicationVersion); // "1.0.0"
    console.log('[BUILD] nativeBuildVersion =', Application.nativeBuildVersion); // ej: "3"
    console.log('[BUILD] applicationId =', Application.applicationId); // "com.expolicores.app.dev"
    console.log('[LA][provider]', process.env.EXPO_PUBLIC_LA_PROVIDER);

    // Info adicional del runtime
    // En Dev Client appOwnership puede ser null
    // executionEnvironment puede aparecer como "bare" en Dev Client
    // @ts-expect-error - props internas no tipadas
    console.log('[BUILD] appOwnership =', Constants?.appOwnership ?? null);
    // @ts-expect-error - props internas no tipadas
    console.log('[BUILD] executionEnvironment =', Constants?.executionEnvironment ?? null);

    // ===== PROBE de módulos nativos / New Architecture =====
    // @ts-ignore - flag global de RN para Turbo/Fabric
    const isTurbo = !!global.__turboModuleProxy;
    console.log('[LA][probe] iOS?', Platform.OS, 'turbo?', isTurbo);

    const nativeKeys = Object.keys(NativeModules).filter((k) =>
      /nitro|activity|kingstinct/i.test(k),
    );
    console.log('[LA][probe] keys:', nativeKeys);
    // @ts-ignore - acceso dinámico
    console.log('[LA][probe] NitroActivityKit =', typeof NativeModules?.NitroActivityKit);

    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  // Estado de conectividad → onlineManager (React Query)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online =
        Boolean(state.isConnected) && Boolean(state.isInternetReachable !== false);
      onlineManager.setOnline(online);
    });
    return () => unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'} />
        {/* Provider necesario para usar useQuery / useMutation */}
        <QueryClientProvider client={queryClient}>
          {/* Mantener orden: Auth → Notifications (usa token de auth si registra push) → Cart */}
          <AuthProvider>
            <NotificationsProvider>
              <CartProvider>
                <AppNavigator />
              </CartProvider>
            </NotificationsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
