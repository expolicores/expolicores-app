// frontend/App.tsx
import React, { useEffect } from 'react';
import {
  AppState,
  Platform,
  StatusBar,
  LogBox,
  NativeModules,
  type AppStateStatus,
} from 'react-native';
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

// 🔔 Expo Notifications (handler + canal Android)
import * as Notifications from 'expo-notifications';

// Handler global (foreground): mostrar alerta en app
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import AppNavigator from './src/navigation/AppNavigator';

// Mantiene react-query en sync con el foco de la app
function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === 'active');
}

// QueryClient global
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: 0 },
  },
});

// Helpers de versión iOS
function iosVersion(): number {
  if (Platform.OS !== 'ios') return 0;
  const v =
    typeof Platform.Version === 'string'
      ? parseFloat(Platform.Version)
      : (Platform.Version as number);
  return isNaN(v) ? 0 : v;
}
function supportsStart(): boolean {
  // ActivityKit start local desde iOS 16.1
  return Platform.OS === 'ios' && iosVersion() >= 16.1;
}
function supportsPushUpdates(): boolean {
  // APNs liveactivity updates desde iOS 16.2
  return Platform.OS === 'ios' && iosVersion() >= 16.2;
}

// Runtime derivado si no hay expo-updates
function deriveRuntime() {
  const cfg: any = Constants.expoConfig ?? {};
  if (typeof cfg.runtimeVersion === 'string' && cfg.runtimeVersion.length) {
    return cfg.runtimeVersion;
  }
  if (cfg.sdkVersion) return `exposdk:${cfg.sdkVersion}`;
  return undefined;
}

export default function App() {
  // Silenciar warnings ruidosos
  LogBox.ignoreLogs([
    '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
    '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
  ]);

  // 🔔 Crear canal Android "orders" al boot (heads-up)
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('orders', {
        name: 'Pedidos',
        importance: Notifications.AndroidImportance.HIGH, // heads-up
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#0EA5E9',
        bypassDnd: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: undefined, // define un .wav/.mp3 en res/raw si quieres sonido custom
      }).catch((e) => {
        // No bloquear la app si falla; log para diagnóstico
        if (__DEV__) console.log('[NOTIFS] channel error', e);
      });
    }
  }, []);

  // 🔎 Verificación de build/entorno + probe nativo (una sola vez)
  useEffect(() => {
    const rawProvider = (process.env.EXPO_PUBLIC_LA_PROVIDER ?? 'none') as string;
    const provider = rawProvider.trim().toLowerCase();

    // ===== ENTORNO (vars públicas) =====
    if (__DEV__) {
      console.log('[ENVCHK]', {
        profile: process.env.EAS_BUILD_PROFILE,
        api: process.env.EXPO_PUBLIC_API_BASE_URL,
        debugHttp: process.env.EXPO_PUBLIC_DEBUG_HTTP,
        sdk: (Constants.expoConfig as any)?.sdkVersion, // del app.config
        appId:
          (Constants.expoConfig as any)?.android?.package ??
          (Constants.expoConfig as any)?.ios?.bundleIdentifier ??
          Constants.applicationId,
        providerRaw: rawProvider,
        providerNorm: provider,
      });
    }

    // ===== BINARIO (instalado) =====
    if (__DEV__) {
      console.log('[BUILD]', {
        nativeBuildVersion: Constants.nativeBuildVersion, // puede ser undefined en Dev Client
        applicationId: (Constants.expoConfig as any)?.android?.package,
      });
    }

    // ===== RUNTIME =====
    (async () => {
      try {
        const Updates: any = await import('expo-updates');
        if (__DEV__) {
          console.log('[RUNTIME]', {
            runtime: Updates.runtimeVersion ?? deriveRuntime(),
            updateId: Updates.updateId ?? null,
            channel: Updates.manifest?.channel ?? null,
          });
        }
      } catch {
        if (__DEV__) {
          console.log('[RUNTIME]', {
            runtime: deriveRuntime(),
            note: 'expo-updates not installed',
          });
        }
      }
    })();

    // ===== PROBE de módulos nativos / New Architecture =====
    // @ts-ignore - flag global de RN para Turbo/Fabric
    const isTurbo = !!global.__turboModuleProxy;
    if (__DEV__) {
      console.log(
        '[LA][probe] OS',
        Platform.OS,
        'turbo?',
        isTurbo,
        'iOSVersion?',
        iosVersion(),
      );
      console.log(
        '[LA][probe] supportsStart?',
        supportsStart(),
        'supportsPush?',
        supportsPushUpdates(),
      );

      const nativeKeys = Object.keys(NativeModules).filter((k) =>
        /nitro|activity|kingstinct|live|widget/i.test(k),
      );
      console.log('[LA][probe] native modules:', nativeKeys);
      // @ts-ignore acceso dinámico
      console.log(
        '[LA][probe] NitroActivityKit =',
        typeof (NativeModules as any)?.NitroActivityKit,
      );
    }

    // Probe directo al provider expo-live-activity (solo si está activo)
    (async () => {
      if (provider !== 'expo') return;
      try {
        const mod: any = await import('expo-live-activity');
        if (__DEV__) {
          console.log('[LA][probe expo-live-activity] fns =', {
            startLiveActivity: typeof mod?.startLiveActivity,
            updateLiveActivity: typeof mod?.updateLiveActivity,
            stopLiveActivity: typeof mod?.stopLiveActivity,
          });
        }
      } catch (e) {
        if (__DEV__) {
          console.log('[LA][probe expo-live-activity] import error =', String(e));
        }
      }
    })();

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
        <QueryClientProvider client={queryClient}>
          {/* Mantener orden: Auth → Notifications → Cart */}
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
