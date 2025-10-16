// frontend/src/screens/PostAuthGate.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function PostAuthGate({ navigation }: any) {
  const { user, emailDeferred, refreshMe } = useAuth();

  useEffect(() => {
    (async () => {
      // Asegura perfil fresco
      const me = user ?? (await refreshMe());
      const name = (me?.name ?? '').trim();
      const hasName = name.length >= 2 && !/^usuario$/i.test(name) && !/^cliente$/i.test(name);
      const hasEmail = !!(me?.email ?? '').trim();

      if (!hasName) {
        navigation.reset({ index: 0, routes: [{ name: 'Name' as never }] });
        return;
      }

      if (!hasEmail && !emailDeferred) {
        navigation.reset({ index: 0, routes: [{ name: 'EmailOptional' as never }] });
        return;
      }

      // Todo OK → Home
      navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
