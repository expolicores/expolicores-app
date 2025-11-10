// frontend/App.tsx
import React, { useEffect } from 'react';
import { AppState, NativeModules, Platform, StatusBar } from 'react-native';
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
  // 🔎 Verificación de build/entorno + probe del bridge nativo de ActivityKit (una sola vez)
  useEffect(() => {
    // Usa expo-application para obtener versión/build nativos en Dev Client
    console.log('[BUILD] nativeApplicationVersion =', Application.nativeApplicationVersion); // p.ej. "1.0.0"
    console.log('[BUILD] nativeBuildVersion =', Application.nativeBuildVersion); // p.ej. "1", "2", ...
    console.log('[BUILD] applicationId =', Application.applicationId); // p.ej. "com.expolicores.app.dev"

    // Datos de runtime del proyecto (SDK, etc.)
    console.log('[BUILD] expo SDK =', Constants.expoConfig?.sdkVersion);
    // En Dev Client appOwnership puede ser null; solo para referencia
    console.log('[BUILD] appOwnership =', (Constants as any)?.appOwnership ?? null);
    console.log('[BUILD] executionEnvironment =', (Constants as any)?.executionEnvironment ?? null);

    // Probe de módulos nativos: confirma que el bridge Turbo está activo y que existe NitroActivityKit
    // @ts-ignore
    console.log('[LA][probe] iOS?', Platform.OS, 'turbo?', !!global.__turboModuleProxy);
    console.log(
      '[LA][probe] keys:',
      Object.keys(NativeModules).filter((k) => /nitro|activity|kingstinct/i.test(k))
    );
    console.log(
      '[LA][probe] NitroActivityKit =',
      typeof (NativeModules as any).NitroActivityKit
    );

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
