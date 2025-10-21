// frontend/src/screens/PostAuthGate.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function PostAuthGate({ navigation }: any) {
  const { refreshMe, emailDeferred } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const decide = async () => {
      try {
        const me = await refreshMe();
        if (cancelled) return;

        const name = (me?.name ?? '').trim();
        const hasName =
          name.length >= 2 && !/^usuario$/i.test(name) && !/^cliente$/i.test(name);
        const hasEmail = !!(me?.email ?? '').trim();

        if (!hasName) {
          navigation.reset({ index: 0, routes: [{ name: 'Name' as never }] });
          return;
        }

        if (!hasEmail && !emailDeferred) {
          navigation.reset({ index: 0, routes: [{ name: 'EmailOptional' as never }] });
          return;
        }

        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' as never }] });
      } catch {
        if (!cancelled) {
          navigation.reset({ index: 0, routes: [{ name: 'Name' as never }] });
        }
      }
    };

    decide();

    return () => {
      cancelled = true;
    };
  }, [emailDeferred, refreshMe, navigation]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
