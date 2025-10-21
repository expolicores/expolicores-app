// src/screens/ProfileScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

// === Nuevos helpers B2B ===
import { FEATURES } from '../lib/flags';
import { businessApply } from '../lib/api';

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

// Tipos de apoyo (no obligamos a cambiar tu tipo Me)
type Role = 'ADMIN' | 'B2C' | 'B2B';
type BusinessVerificationStatus = 'NONE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type AdminProcessStatus = 'PENDING' | 'IN_PROGRESS' | 'ATTENDED';

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

  // Extrae campos B2B de forma segura (sin forzar tu tipo Me)
  const role = (user as any)?.role as Role | undefined;
  const businessVerificationStatus = (user as any)?.businessVerificationStatus as BusinessVerificationStatus | undefined;
  const adminProcessStatus = (user as any)?.adminProcessStatus as AdminProcessStatus | undefined;

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

  // Solicitud B2B (“Soy negocio”)
  const [openB2BModal, setOpenB2BModal] = useState(false);
  const { mutate: applyB2B, isLoading: isApplyingB2B } = useMutation({
    mutationFn: async () => {
      const res = await businessApply();
      return res;
    },
    onSuccess: async () => {
      setOpenB2BModal(false);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await refreshMe();
      Alert.alert('Solicitud enviada', 'Revisaremos tu solicitud de negocio.');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.message || 'No se pudo enviar la solicitud.';
      Alert.alert('Error', String(msg));
    },
  });

  const onSubmit = (values: FormValues) => updateMe(values);
  const saveDisabled = isSaving || !isValid || !isDirty;

  // Lógica para mostrar botón “Soy negocio”
  const canShowB2BButton =
    FEATURES.B2B &&
    role !== 'B2B' &&
    businessVerificationStatus !== 'SUBMITTED' &&
    businessVerificationStatus !== 'APPROVED';

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

  // Helpers de UI para estados B2B
  const adminBadgeColor =
    adminProcessStatus === 'PENDING'
      ? '#ef4444'
      : adminProcessStatus === 'IN_PROGRESS'
      ? '#f59e0b'
      : '#10b981';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi perfil</Text>

      {/* Banners B2B */}
      {FEATURES.B2B && businessVerificationStatus === 'SUBMITTED' && (
        <View style={[styles.banner, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
          <Text style={[styles.bannerTitle, { color: '#1D4ED8' }]}>Solicitud B2B en revisión</Text>
          <Text style={[styles.bannerText, { color: '#1E3A8A' }]}>
            Te contactaremos por WhatsApp o teléfono para completar el proceso.
          </Text>
          {!!adminProcessStatus && (
            <View style={[styles.badge, { backgroundColor: adminBadgeColor }]}>
              <Text style={styles.badgeText}>
                {adminProcessStatus === 'PENDING'
                  ? 'Pendiente'
                  : adminProcessStatus === 'IN_PROGRESS'
                  ? 'En proceso'
                  : 'Atendida'}
              </Text>
            </View>
          )}
        </View>
      )}

      {FEATURES.B2B && role === 'B2B' && businessVerificationStatus === 'APPROVED' && (
        <View style={[styles.banner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
          <Text style={[styles.bannerTitle, { color: '#065F46' }]}>Cuenta de negocio activa</Text>
          <Text style={[styles.bannerText, { color: '#065F46' }]}>
            Ya puedes comprar en Bodega Virtual con tus condiciones B2B.
          </Text>
        </View>
      )}

      {FEATURES.B2B && businessVerificationStatus === 'REJECTED' && (
        <View style={[styles.banner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
          <Text style={[styles.bannerTitle, { color: '#991B1B' }]}>Solicitud rechazada</Text>
          <Text style={[styles.bannerText, { color: '#991B1B' }]}>
            Si crees que es un error, contáctanos para revisar tu caso.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Email</Text>
      <View style={styles.readonly}>
        <Text style={styles.readonlyText}>{user.email ?? '-'}</Text>
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

      {/* Botón Soy negocio (solo si aplica) */}
      {canShowB2BButton && (
        <>
          <View style={{ height: 16 }} />
          <Pressable
            style={[styles.secondaryButton, styles.secondaryButtonBlack]}
            onPress={() => setOpenB2BModal(true)}
          >
            <Text style={styles.secondaryButtonText}>Soy negocio</Text>
          </Pressable>

          <Modal
            visible={openB2BModal}
            transparent
            animationType="fade"
            onRequestClose={() => setOpenB2BModal(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Condiciones B2B</Text>
                <Text style={styles.modalText}>
                  Los precios y beneficios B2B aplican solo tras verificación manual (RUT y datos
                  fiscales). Podemos contactarte por WhatsApp o teléfono para validar información.
                </Text>
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setOpenB2BModal(false)}>
                    <Text style={styles.modalCancel}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={() => applyB2B()} disabled={isApplyingB2B}>
                    <Text style={styles.modalAccept}>
                      {isApplyingB2B ? 'Enviando…' : 'Aceptar y solicitar'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}

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
  saveButtonEnabled: { backgroundColor: '#0E8A3A' },
  saveButtonDisabled: { backgroundColor: '#d1d5db' },
  saveButtonText: { color: '#fff', fontWeight: '700' },

  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonBlue: { backgroundColor: '#1D4ED8' },
  secondaryButtonBlack: { backgroundColor: '#111827' },
  secondaryButtonRed: { backgroundColor: '#c0392b' },
  secondaryButtonText: { color: '#fff', fontWeight: '700' },

  // Banners
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bannerTitle: { fontWeight: '700', marginBottom: 4 },
  bannerText: { fontSize: 12 },

  // Badge
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#111' },
  modalText: { color: '#374151', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  modalCancel: { color: '#111' },
  modalAccept: { color: '#0ea5e9', fontWeight: '700' },
});
