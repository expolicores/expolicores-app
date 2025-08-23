import React, { useContext } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthContext } from '../context/AuthContext';

const schema = z.object({
  name: z.string().min(2, 'Tu nombre'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  phone: z.string().min(7, 'Teléfono inválido'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const { register: registerUser, loading } = useContext(AuthContext);
  const { register, setValue, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    register('name'); register('email'); register('password'); register('phone');
  }, [register]);

  const onSubmit = async (data: FormData) => { await registerUser(data); };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>

      <TextInput placeholder="Nombre" style={styles.input} onChangeText={(t) => setValue('name', t)} />
      {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}

      <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address"
        style={styles.input} onChangeText={(t) => setValue('email', t)} />
      {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}

      <TextInput placeholder="Contraseña" secureTextEntry style={styles.input}
        onChangeText={(t) => setValue('password', t)} />
      {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}

      <TextInput placeholder="Teléfono" keyboardType="phone-pad" style={styles.input}
        onChangeText={(t) => setValue('phone', t)} />
      {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}

      <Button title={loading ? 'Cargando...' : 'Registrarme'} onPress={handleSubmit(onSubmit)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 8 },
  error: { color: 'tomato', marginBottom: 8 },
});