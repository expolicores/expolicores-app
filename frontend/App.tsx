// frontend/App.tsx
import React, { useEffect } from 'react';
import { AppState, Platform, StatusBar } from 'react-native';
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
import AppNavigator from './src/navigation/AppNavigator';

/** Mantiene react-query en sync con el foco de la app (foreground/background) */
function onAppStateChange(status: string) {
  focusManager.setFocused(status === 'active');
}

/** QueryClient configurado para móvil */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // 30s
      cacheTime: 5 * 60 * 1000, // 5min
      refetchOnReconnect: true,
      refetchOnWindowFocus: true, // respeta focusManager (AppState)
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function App() {
  // Foco de la app → focusManager (React Query)
  useEffect(() => {
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
          <AuthProvider>
            <CartProvider>
              <AppNavigator />
            </CartProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
