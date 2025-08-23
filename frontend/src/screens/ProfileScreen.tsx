import React, { useContext } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';

export default function ProfileScreen() {
  const navigation = useNavigation<any>(); // <- necesario
  const { user, logout, refreshMe, loading } = useContext(AuthContext);

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
            title={loading ? 'Actualizando...' : 'Actualizar perfil'}
            onPress={refreshMe}
          />

          <View style={{ height: 8 }} />

          <Button
            title="Mis direcciones"
            onPress={() => navigation.navigate('Direcciones' as never)}
          />

          <View style={{ height: 8 }} />

          <Button
            title="Cerrar sesión"
            color="#c0392b"
            onPress={logout}
          />
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
