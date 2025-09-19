import React, { useContext } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AuthContext } from '../context/AuthContext'; // compat con versión anterior

type Me = { name: string; email: string; phone: string; role: string };

// Nota: si ya tienes un hook useAuth(), puedes importarlo y usarlo aquí.
// import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();

  // Compatibilidad con ambos contextos (viejo: logout/refreshMe/user; nuevo: signOut/token)
  const ctx: any = useContext(AuthContext) ?? {};
  const signOut: () => Promise<void> | void = ctx.signOut ?? ctx.logout ?? (() => {});
  const loading: boolean = ctx.loading ?? false;
  const ctxUser: Me | undefined = ctx.user;

  // Si no viene user desde el contexto, lo consultamos a /auth/me (requiere token ya puesto en api)
  const { data: me, isFetching, refetch } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: async () => (await api.get<Me>('/auth/me')).data,
    enabled: !ctxUser, // solo si no vino del contexto
    staleTime: 60_000,
  });

  const user: Me | undefined = ctxUser ?? me;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi perfil</Text>

      {user ? (
        <>
          <Text>Nombre: {user.name}</Text>
          <Text>Email: {user.email}</Text>
          <Text>Teléfono: {user.phone}</Text>
          <Text>Rol: {user.role}</Text>

          <View style={{ height: 16 }} />

          <Button
            title={loading || isFetching ? 'Actualizando...' : 'Actualizar perfil'}
            onPress={() => (ctx.refreshMe ? ctx.refreshMe() : refetch())}
          />

          <View style={{ height: 8 }} />

          {/* Ajusta el nombre de la ruta si en tu navigator es "Direcciones" */}
          <Button title="Mis direcciones" onPress={() => navigation.navigate('Addresses')} />

          <View style={{ height: 8 }} />

          <Button title="Cerrar sesión" color="#c0392b" onPress={() => Promise.resolve(signOut())} />
        </>
      ) : (
        <Text>No autenticado</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 20 },
});
