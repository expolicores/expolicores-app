// frontend/src/screens/ProfileScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Me } from '../types/auth';
import { getBottomQuickActionsPadding } from '../components/BottomQuickActionsBar';
import { FEATURES } from '../lib/flags';
import { businessApply } from '../lib/api';
import { openStoreListing } from '../lib/rateUs';

// --------- Validación ---------
const phoneSchema = z
  .string()
  .trim()
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, '');
      return digits.length === 10 || /^\+57\d{10}$/.test(v);
    },
    {
      message:
        'Ingresa un celular valido (10 digitos) o en formato +57XXXXXXXXXX',
    },
  );

const schema = z.object({
  name: z
    .string()
    .min(2, 'Tu nombre debe tener al menos 2 caracteres'),
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

// Tipos de apoyo
type Role = 'ADMIN' | 'B2C' | 'B2B';
type BusinessVerificationStatus = 'NONE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type AdminProcessStatus = 'PENDING' | 'IN_PROGRESS' | 'ATTENDED';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user: ctxUser, refreshMe, signOut, booting } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPadding = getBottomQuickActionsPadding(insets.bottom);

  const {
    data: me,
    isFetching,
    refetch,
  } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/auth/me')).data,
    enabled: !ctxUser,
    staleTime: 60_000,
  });

  const user = (ctxUser ?? me) ?? null;

  const role = (user as any)?.role as Role | undefined;
  const businessVerificationStatus =
    (user as any)?.businessVerificationStatus as BusinessVerificationStatus | undefined;
  const adminProcessStatus =
    (user as any)?.adminProcessStatus as AdminProcessStatus | undefined;

  const initialValues = useMemo(
    () => ({
      name: user?.name ?? '',
      phone: user?.phone ?? '',
    }),
    [user?.name, user?.phone],
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
        { keepDirty: false, keepIsValid: true },
      );
      setValue('name', user.name ?? '', {
        shouldDirty: false,
        shouldValidate: false,
      });
      setValue('phone', user.phone ?? '', {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [user, reset, setValue]);

  // Actualización de perfil
  const { mutate: updateMe, isLoading: isSaving } = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        phone: normalizeCoPhone(values.phone),
      };
      const res = await api.patch('/users/me', payload);
      return res.data as Me;
    },
    onSuccess: async (updated) => {
      reset(
        {
          name: updated?.name ?? '',
          phone: updated?.phone ?? '',
        },
        { keepDirty: false, keepIsValid: true },
      );
      queryClient.setQueryData(['me'], updated);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await refreshMe();
      Alert.alert(
        'Perfil actualizado',
        'Tu informacion se guardo correctamente.',
      );
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo actualizar el perfil.';
      Alert.alert('Error', String(msg));
    },
  });

  const onSubmit = (values: FormValues) => updateMe(values);
  const saveDisabled = isSaving || !isValid || !isDirty;

  // B2B
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
      Alert.alert(
        'Solicitud enviada',
        'Revisaremos tu solicitud de negocio.',
      );
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo enviar la solicitud.';
      Alert.alert('Error', String(msg));
    },
  });

  const canShowB2BButton =
    FEATURES.B2B &&
    role !== 'B2B' &&
    businessVerificationStatus !== 'SUBMITTED' &&
    businessVerificationStatus !== 'APPROVED';

  // ===== Feedback de usuario (nuevo) =====
  const [feedbackText, setFeedbackText] = useState('');
  const feedbackMutation = useMutation({
    mutationFn: async (message: string) => {
      return (await api.post('/users/me/feedback', { message })).data;
    },
    onSuccess: () => {
      setFeedbackText('');
      Alert.alert(
        '¡Gracias!',
        'Tu comentario se envió correctamente. Esto nos ayuda a mejorar.',
      );
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo enviar tu comentario.';
      Alert.alert('Error', String(msg));
    },
  });

  const handleSendFeedback = () => {
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      Alert.alert(
        'Comentario vacío',
        'Escribe algo sobre tu experiencia antes de enviar.',
      );
      return;
    }
    feedbackMutation.mutate(trimmed);
  };

  // Estados de carga
  if (booting || (!user && isFetching)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="small" color="#0E8A3A" />
          <Text style={styles.muted}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={styles.title}>Mi perfil</Text>
          <Text style={styles.muted}>No autenticado</Text>
          <Pressable
            style={[styles.secondaryButton, styles.secondaryButtonBlue, { marginTop: 16 }]}
            onPress={() => refetch()}
          >
            <Text style={styles.secondaryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const adminBadgeColor =
    adminProcessStatus === 'PENDING'
      ? '#ef4444'
      : adminProcessStatus === 'IN_PROGRESS'
      ? '#f59e0b'
      : '#10b981';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      >
        <Text style={styles.title}>Mi perfil</Text>

        {/* Banners B2B */}
        {FEATURES.B2B && businessVerificationStatus === 'SUBMITTED' && (
          <View style={[styles.banner, { borderColor: '#f59e0b' }]}>
            <Text style={styles.bannerTitle}>Solicitud B2B en revisión</Text>
            <Text style={styles.bannerText}>
              Te contactaremos por WhatsApp o teléfono para completar el proceso.
            </Text>
            {!!adminProcessStatus && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: adminBadgeColor },
                ]}
              >
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

        {FEATURES.B2B &&
          role === 'B2B' &&
          businessVerificationStatus === 'APPROVED' && (
            <View style={[styles.banner, { borderColor: '#10b981' }]}>
              <Text style={styles.bannerTitle}>
                Cuenta de negocio activa
              </Text>
              <Text style={styles.bannerText}>
                Ya puedes comprar en Bodega Virtual con tus condiciones B2B.
              </Text>
            </View>
          )}

        {FEATURES.B2B &&
          businessVerificationStatus === 'REJECTED' && (
            <View style={[styles.banner, { borderColor: '#ef4444' }]}>
              <Text style={styles.bannerTitle}>Solicitud rechazada</Text>
              <Text style={styles.bannerText}>
                Si crees que es un error, contáctanos para revisar tu caso.
              </Text>
            </View>
          )}

        {/* Datos básicos */}
        <Text style={styles.label}>Email</Text>
        <View style={styles.readonly}>
          <Text style={styles.readonlyText}>{user.email ?? '-'}</Text>
        </View>

        <Text style={styles.label}>Nombre</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[
                styles.input,
                errors.name && styles.inputError,
              ]}
              placeholder="Tu nombre"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        {errors.name && (
          <Text style={styles.error}>{errors.name.message}</Text>
        )}

        <Text style={styles.label}>Telefono (WhatsApp)</Text>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[
                styles.input,
                errors.phone && styles.inputError,
              ]}
              placeholder="3001234567"
              keyboardType="phone-pad"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        {errors.phone && (
          <Text style={styles.error}>{errors.phone.message}</Text>
        )}
        <Text style={styles.hint}>
          Recomendado: 10 digitos (por ejemplo 3001234567). Se normaliza a +57
          automaticamente.
        </Text>

        {/* Guardar cambios */}
        <Pressable
          style={[
            styles.saveButton,
            saveDisabled ? styles.saveButtonDisabled : styles.saveButtonEnabled,
            { marginTop: 16 },
          ]}
          disabled={saveDisabled}
          onPress={handleSubmit(onSubmit)}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Text>
          )}
        </Pressable>

        {/* Botón Soy negocio */}
        {canShowB2BButton && (
          <Pressable
            style={[
              styles.secondaryButton,
              styles.secondaryButtonBlack,
              { marginTop: 16 },
            ]}
            onPress={() => setOpenB2BModal(true)}
          >
            <Text style={styles.secondaryButtonText}>Soy negocio</Text>
          </Pressable>
        )}

        {/* Mis direcciones */}
        <Pressable
          style={[
            styles.secondaryButton,
            styles.secondaryButtonBlue,
            { marginTop: 24 },
          ]}
          onPress={() => navigation.navigate('Addresses' as never)}
        >
          <Text style={styles.secondaryButtonText}>Mis direcciones</Text>
        </Pressable>

        {/* Privacidad y cuenta */}
        <Pressable
          style={[
            styles.secondaryButton,
            styles.secondaryButtonBlack,
            { marginTop: 12 },
          ]}
          onPress={() => navigation.navigate('PrivacyAccount' as never)}
        >
          <Text style={styles.secondaryButtonText}>
            Privacidad y cuenta
          </Text>
        </Pressable>

        {/* Califícanos en la tienda */}
        <Pressable
          style={[
            styles.secondaryButton,
            styles.secondaryButtonBlack,
            { marginTop: 12 },
          ]}
          onPress={openStoreListing}
        >
          <Text style={styles.secondaryButtonText}>
            Califícanos en la tienda
          </Text>
        </Pressable>

        {/* 👇 NUEVO: comentarios dentro de la app */}
        <Text style={[styles.label, { marginTop: 20 }]}>
          Comentarios sobre el servicio / la app (opcional)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              minHeight: 80,
              textAlignVertical: 'top',
              backgroundColor: '#ffffff',
            },
          ]}
          multiline
          placeholder="Cuéntanos qué te gusta, qué mejorarías, temas de precios, tiempos de entrega..."
          value={feedbackText}
          onChangeText={setFeedbackText}
        />
        <Text style={styles.hint}>
          Estos comentarios llegan directamente al equipo de Expolicores Villa
          de Leyva.
        </Text>

        <Pressable
          style={[
            styles.secondaryButton,
            feedbackMutation.isLoading
              ? styles.saveButtonDisabled
              : styles.saveButtonEnabled,
            { marginTop: 8 },
          ]}
          disabled={feedbackMutation.isLoading}
          onPress={handleSendFeedback}
        >
          {feedbackMutation.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Enviar comentario</Text>
          )}
        </Pressable>

        {/* Cerrar sesión */}
        <Pressable
          style={[
            styles.secondaryButton,
            styles.secondaryButtonRed,
            { marginTop: 24 },
          ]}
          onPress={async () => {
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error?.message ?? 'No se pudo cerrar sesion',
              );
            }
          }}
        >
          <Text style={styles.secondaryButtonText}>Cerrar sesion</Text>
        </Pressable>

        {/* Modal B2B */}
        <ModalB2B
          visible={openB2BModal}
          onClose={() => setOpenB2BModal(false)}
          onApply={applyB2B}
          loading={isApplyingB2B}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Modal separado para mantener el componente limpio */
function ModalB2B({
  visible,
  onClose,
  onApply,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
  loading: boolean;
}) {
  if (!visible) return null;

  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Condiciones B2B</Text>
        <Text style={styles.modalText}>
          Los precios y beneficios B2B aplican solo tras verificación manual
          (RUT y datos fiscales). Podemos contactarte por WhatsApp o teléfono
          para validar información.
        </Text>

        <View style={styles.modalActions}>
          <Pressable onPress={onClose}>
            <Text style={styles.modalCancel}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={onApply} disabled={loading}>
            <Text style={styles.modalAccept}>
              {loading ? 'Enviando…' : 'Aceptar y solicitar'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    color: '#111',
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '600',
    color: '#111',
  },
  readonly: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  readonlyText: {
    color: '#111',
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    color: '#111',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  error: {
    marginTop: 4,
    color: '#ef4444',
  },
  hint: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 12,
  },
  muted: {
    color: '#6b7280',
  },
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
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonBlue: {
    backgroundColor: '#1D4ED8',
  },
  secondaryButtonBlack: {
    backgroundColor: '#111827',
  },
  secondaryButtonRed: {
    backgroundColor: '#c0392b',
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bannerTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerText: {
    fontSize: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111',
  },
  modalText: {
    color: '#374151',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  modalCancel: {
    color: '#111',
  },
  modalAccept: {
    color: '#0ea5e9',
    fontWeight: '700',
  },
});
