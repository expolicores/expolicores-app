// src/screens/ProfileScreen.tsx
import React, { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Me } from '../types/auth';

// --------- Validacion ---------
const phoneSchema = z
  .string()
  .trim()
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, '');
      return digits.length === 10 || /^\+57\d{10}$/.test(v);
    },
    { message: 'Ingresa un celular valido (10 digitos) o en formato +57XXXXXXXXXX' }
  );

const schema = z.object({
  name: z.string().min(2, 'Tu nombre debe tener al menos 2 caracteres'),
  phone: phoneSchema,
});

type FormValues = z.infer<typeof schema>;

// Normaliza a +57XXXXXXXXXX
function normalizeCoPhone(v: string) {
  const digits = (v || '').replace(/\D/g, '');
  if (v?.startsWith('+')) return v;
  if (digits.startsWith('57') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+57${digits}`;
  return v;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user: ctxUser, refreshMe, signOut, booting } = useAuth();

  // Si no hubiese user aun, traemos /auth/me (habilitado solo si ctxUser es null)
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

  const initialValues = useMemo(
    () => ({
      name: user?.name ?? '',
      phone: user?.phone ?? '',
    }),
    [user?.name, user?.phone]
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  // Rellena el formulario al recibir perfil
  useEffect(() => {
    if (user) {
      reset(
        {
          name: user.name ?? '',
          phone: user.phone ?? '',
        },
        { keepDirty: false, keepIsValid: true }
      );
      setValue('name', user.name ?? '', { shouldDirty: false, shouldValidate: false });
      setValue('phone', user.phone ?? '', { shouldDirty: false, shouldValidate: false });
    }
  }, [user, reset, setValue]);

  // Actualizacion de perfil
  const { mutate: updateMe, isLoading: isSaving } = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, phone: normalizeCoPhone(values.phone) };
      const res = await api.patch<Me>('/users/me', payload);
      return res.data;
    },
    onSuccess: async (updated) => {
      reset(
        {
          name: updated?.name ?? '',
          phone: updated?.phone ?? '',
        },
        { keepDirty: false, keepIsValid: true }
      );
      queryClient.setQueryData(['me'], updated);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await refreshMe();
      Alert.alert('Perfil actualizado', 'Tu informacion se guardo correctamente.');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.message || 'No se pudo actualizar el perfil.';
      Alert.alert('Error', String(msg));
    },
  });

  const onSubmit = (values: FormValues) => updateMe(values);
  const saveDisabled = isSaving || !isValid || !isDirty;

  // Estados de carga
  if (booting || (!user && isFetching)) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando perfil...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.title}>Mi perfil</Text>
        <Text style={styles.muted}>No autenticado</Text>
        <View style={{ height: 12 }} />
        <Pressable style={[styles.secondaryButton, styles.secondaryButtonBlue]} onPress={() => refetch()}>
          <Text style={styles.secondaryButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi perfil</Text>

      <Text style={styles.label}>Email</Text>
      <View style={styles.readonly}>
        <Text style={styles.readonlyText}>{user.email}</Text>
      </View>

      <Text style={styles.label}>Nombre</Text>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => {
          return (
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Tu nombre"
              placeholderTextColor="#9ca3af"
              selectionColor="#111"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              autoCapitalize="words"
            />
          );
        }}
      />
      {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}

      <Text style={styles.label}>Telefono (WhatsApp)</Text>
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => {
          return (
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="3001234567 o +573001234567"
              placeholderTextColor="#9ca3af"
              selectionColor="#111"
              keyboardType="phone-pad"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          );
        }}
      />
      {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}
      <Text style={styles.hint}>
        Recomendado: 10 digitos (por ejemplo 3001234567). Se normaliza a +57 automaticamente.
      </Text>

      <View style={{ height: 16 }} />

      <Pressable
        onPress={handleSubmit(onSubmit)}
        disabled={saveDisabled}
        style={[
          styles.saveButton,
          saveDisabled ? styles.saveButtonDisabled : styles.saveButtonEnabled,
        ]}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </Text>
      </Pressable>

      <View style={{ height: 16 }} />

      <Pressable
        style={[styles.secondaryButton, styles.secondaryButtonBlue]}
        onPress={() => navigation.navigate('Addresses')}
      >
        <Text style={styles.secondaryButtonText}>Mis direcciones</Text>
      </Pressable>

      <View style={{ height: 8 }} />

      <Pressable
        style={[styles.secondaryButton, styles.secondaryButtonRed]}
        onPress={async () => {
          try {
            await signOut();
          } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'No se pudo cerrar sesion');
          }
        }}
      >
        <Text style={styles.secondaryButtonText}>Cerrar sesion</Text>
      </Pressable>
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
    backgroundColor: '#f3f4f6',
  },
  readonlyText: { color: '#111' },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    color: '#111',
  },
  inputError: { borderColor: '#ef4444' },
  error: { marginTop: 4, color: '#ef4444' },
  hint: { marginTop: 6, color: '#6b7280', fontSize: 12 },
  muted: { color: '#6b7280' },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonEnabled: {
    backgroundColor: '#0E8A3A',
  },
  saveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonBlue: {
    backgroundColor: '#1D4ED8',
  },
  secondaryButtonRed: {
    backgroundColor: '#c0392b',
  },
  secondaryButtonText: { color: '#fff', fontWeight: '700' },
});
