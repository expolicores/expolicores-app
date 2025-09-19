import React from 'react';
import { AppState, Platform } from 'react-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AuthProvider } from './src/context/AuthContext'; // 👈 named import
import AppNavigator from './src/navigation/AppNavigator';  // 👈 default import

// Mantiene react-query en sync con el foco de la app
function onAppStateChange(status: string) {
  focusManager.setFocused(status === 'active');
}
AppState.addEventListener('change', onAppStateChange);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
