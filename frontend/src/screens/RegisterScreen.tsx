import React, { useContext, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthContext } from '../context/AuthContext';

// --- Validación ---
const phoneSchema = z
  .string()
  .trim()
  .refine((v) => {
    const d = v.replace(/\D/g, '');
    // Acepta 10 dígitos locales (300xxxxxxx) o E.164 +57XXXXXXXXXX
    return d.length === 10 || /^\+57\d{10}$/.test(v);
  }, 'Ingresa un celular válido de 10 dígitos (CO) o en formato +57XXXXXXXXXX');

const schema = z.object({
  name: z.string().min(2, 'Tu nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  phone: phoneSchema,
});

type FormData = z.infer<typeof schema>;

// --- Normalización a E.164 CO (+57) ---
function normalizeCoPhone(v: string) {
  const d = (v || '').replace(/\D/g, '');
  if (d.startsWith('57') && d.length === 12) return `+${d}`;
  if (d.length === 10) return `+57${d}`;
  if (v?.startsWith('+')) return v;
  return `+57${d}`;
}

export default function RegisterScreen() {
  const { register: registerUser, loading } = useContext(AuthContext);

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    register('name');
    register('email');
    register('password');
    register('phone');
  }, [register]);

  const onSubmit = async (data: FormData) => {
    // Normaliza el teléfono antes de enviar al backend
    const payload = { ...data, phone: normalizeCoPhone(data.phone) };
    await registerUser(payload);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>

      <TextInput
        placeholder="Nombre"
        style={styles.input}
        onChangeText={(t) => setValue('name', t, { shouldValidate: true })}
        autoCapitalize="words"
      />
      {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
        onChangeText={(t) => setValue('email', t, { shouldValidate: true })}
      />
      {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}

      <TextInput
        placeholder="Contraseña"
        secureTextEntry
        style={styles.input}
        onChangeText={(t) => setValue('password', t, { shouldValidate: true })}
      />
      {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}

      <TextInput
        placeholder="Teléfono (WhatsApp)"
        keyboardType="phone-pad"
        style={styles.input}
        onChangeText={(t) => setValue('phone', t, { shouldValidate: true })}
      />
      {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}
      <Text style={styles.hint}>
        Formato recomendado: 10 dígitos (p. ej. 3001234567). El sistema lo enviará a WhatsApp con +57 automáticamente.
      </Text>

      <Button title={loading ? 'Cargando…' : 'Registrarme'} onPress={handleSubmit(onSubmit)} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: '#fff' },
  error: { color: '#ef4444', marginBottom: 8 },
  hint: { color: '#6b7280', fontSize: 12, marginBottom: 12 },
});
