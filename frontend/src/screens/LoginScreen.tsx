import React, { useContext } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthContext } from '../context/AuthContext';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen({ navigation }: any) {
  const { login, loading } = useContext(AuthContext);
  const { register, setValue, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    register('email');
    register('password');
  }, [register]);

  const onSubmit = async (data: FormData) => { await login(data); };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión</Text>
      <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address"
        style={styles.input} onChangeText={(t) => setValue('email', t)} />
      {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}

      <TextInput placeholder="Contraseña" secureTextEntry style={styles.input}
        onChangeText={(t) => setValue('password', t)} />
      {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}

      <Button title={loading ? 'Cargando...' : 'Entrar'} onPress={handleSubmit(onSubmit)} />

      <View style={{ height: 16 }} />
      <Button title="Crear cuenta" onPress={() => navigation.navigate('Registro')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 8 },
  error: { color: 'tomato', marginBottom: 8 },
});