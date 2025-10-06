// src/screens/ProfileScreen.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Me } from '../types/auth';

// --------- Validación ---------
const phoneSchema = z
  .string()
  .trim()
  .refine(
    (v) => {
      const d = v.replace(/\D/g, '');
      return d.length === 10 || /^\+57\d{10}$/.test(v);
    },
    { message: 'Ingresa un celular válido (10 dígitos) o en formato +57XXXXXXXXXX' }
  );

const schema = z.object({
  name: z.string().min(2, 'Tu nombre debe tener al menos 2 caracteres'),
  phone: phoneSchema,
});

type FormValues = z.infer<typeof schema>;

// Normaliza a +57XXXXXXXXXX
function normalizeCoPhone(v: string) {
  const d = (v || '').replace(/\D/g, '');
  if (v?.startsWith('+')) return v;
  if (d.startsWith('57') && d.length === 12) return `+${d}`;
  if (d.length === 10) return `+57${d}`;
  return v;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();

  // 👇 Del contexto (evita el error de hooks: solo usamos el hook dentro del componente)
  const { user: ctxUser, refreshMe, signOut, booting } = useAuth();

  // Si no hubiese user aún, traemos /auth/me (habilitado solo si ctxUser es null)
  const {
    data: me,
    isFetching,
    refetch,
  } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: async () => (await api.get<Me>('/auth/me')).data,
    enabled: !ctxUser,
    staleTime: 60_000,
  });

  const user = ctxUser ?? me ?? null;

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '' },
  });

  // Rellena el formulario al recibir perfil
  useEffect(() => {
    if (user) {
      reset({ name: user.name ?? '', phone: user.phone ?? '' });
    }
  }, [user, reset]);

  // Actualización de perfil
  const { mutate: updateMe, isLoading: isSaving } = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, phone: normalizeCoPhone(values.phone) };
      // Ajusta la ruta si tu backend expone /users/:id en lugar de /users/me
      const res = await api.patch<Me>('/users/me', payload);
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      await refreshMe();
      Alert.alert('Perfil actualizado', 'Tu información se guardó correctamente.');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo actualizar el perfil.';
      Alert.alert('Error', String(msg));
    },
  });

  const onSubmit = (values: FormValues) => updateMe(values);

  // Estados de carga
  if (booting || (!user && isFetching)) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando perfil…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.title}>Mi perfil</Text>
        <Text style={styles.muted}>No autenticado</Text>
        <View style={{ height: 12 }} />
        <Button title="Reintentar" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi perfil</Text>

      {/* Email solo lectura */}
      <Text style={styles.label}>Email</Text>
      <View style={styles.readonly}>
        <Text>{user.email}</Text>
      </View>

      {/* Nombre */}
      <Text style={styles.label}>Nombre</Text>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Tu nombre"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            autoCapitalize="words"
          />
        )}
      />
      {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}

      {/* Teléfono */}
      <Text style={styles.label}>Teléfono (WhatsApp)</Text>
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[styles.input, errors.phone && styles.inputError]}
            placeholder="3001234567 o +573001234567"
            keyboardType="phone-pad"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}
      <Text style={styles.hint}>
        Recomendado: 10 dígitos (p. ej. 3001234567). Se normaliza a +57 automáticamente.
      </Text>

      <View style={{ height: 16 }} />

      <Button
        title={isSaving ? 'Guardando…' : isFetching ? 'Actualizando…' : 'Guardar cambios'}
        onPress={handleSubmit(onSubmit)}
        disabled={isSaving || (!isDirty && !isFetching)}
      />

      <View style={{ height: 16 }} />

      <Button title="Mis direcciones" onPress={() => navigation.navigate('Addresses')} />

      <View style={{ height: 8 }} />

      <Button
        title="Cerrar sesión"
        color="#c0392b"
        onPress={async () => {
          try {
            await signOut();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'No se pudo cerrar sesión');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 32, backgroundColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16, color: '#111' },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '600', color: '#111' },
  readonly: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  inputError: { borderColor: '#ef4444' },
  error: { marginTop: 4, color: '#ef4444' },
  hint: { marginTop: 6, color: '#6b7280', fontSize: 12 },
  muted: { color: '#6b7280' },
});
