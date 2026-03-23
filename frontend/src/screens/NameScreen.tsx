// frontend/src/screens/NameScreen.tsx
import React, { useRef, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { updateMe } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AuthFlowBackButton from '../components/AuthFlowBackButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Name'>;

// Normaliza nombre: quita espacios extra y caracteres no permitidos
function sanitizeName(raw: string) {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{M}\s'.-]/gu, '')
    .trim();
}

/**
 * Pide y persiste el nombre del usuario tras verificar OTP.
 * Requiere que el JWT ya este configurado (setAuthToken se hace en verify-otp).
 */
export default function NameScreen({ route, navigation }: Props) {
  const { refreshMe, emailDeferred, isAuthenticated, signOut } = useAuth();

  // Params que pueden venir desde OtpCodeScreen / flujo de registro
  const { phone, email } = route.params || {};

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  const trimmed = sanitizeName(name);
  const canSave = trimmed.length >= 2 && !loading;

  const onSave = async () => {
    if (!canSave || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await updateMe({ name: trimmed });

      const updated = await refreshMe?.();
      const emailValue = (updated?.email ?? '').trim();

      if (!emailValue && !emailDeferred) {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'EmailOptional' as never,
              // Pasamos phone/email por si la pantalla los quiere usar en algo
              params: { phone, email } as never,
            },
          ],
        });
        return;
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' as never }],
      });
    } catch (e: any) {
      const msg =
        e?.message ||
        (typeof e?.details?.message === 'string' ? e.details.message : null) ||
        'No pudimos guardar tu nombre. Verifica tu conexion e intenta de nuevo.';
      const extra =
        e?.status === 401 ? '\n\nVuelve a iniciar sesion para continuar.' : '';
      Alert.alert('Error', msg + extra);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Botón atrás:
  // - Si estás autenticado: hacemos signOut() → AppNavigator monta el stack
  //   no autenticado y cae en AuthChooser (initialRouteName).
  // - Si NO estás autenticado: podemos resetear directo a AuthChooser
  //   porque estamos en el stack de auth.
  const onBack = useCallback(() => {
    if (isAuthenticated) {
      // Esto lleva al usuario a AuthChooserScreen a través del AppNavigator
      signOut().catch(() => undefined);
      return;
    }

    // Rama "no autenticado": AuthChooser sí existe en este stack
    navigation.reset({
      index: 0,
      routes: [{ name: 'AuthChooser' as never }],
    });
  }, [isAuthenticated, signOut, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <View style={{ flex: 1, padding: 24 }}>
          {/* Botón de volver: ahora realmente lleva a la pantalla de bienvenida */}
          <AuthFlowBackButton onBack={onBack} />

          <Text style={{ fontSize: 32, fontWeight: '800', marginBottom: 8 }}>
            Como te llamas?
          </Text>
          <Text style={{ color: '#6B7280', marginBottom: 16 }}>
            Ingresa tu nombre completo para personalizar tu experiencia.
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={onSave}
            placeholder="Nombre y apellido"
            autoCapitalize="words"
            autoCorrect
            returnKeyType="done"
            maxLength={80}
            autoFocus
            style={{
              height: 56,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              paddingHorizontal: 16,
              fontSize: 18,
              marginBottom: 16,
            }}
          />

          <TouchableOpacity
            disabled={!canSave}
            onPress={onSave}
            style={{
              backgroundColor: canSave ? '#10B981' : '#A7F3D0',
              height: 56,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: 16,
                    marginLeft: 8,
                  }}
                >
                  Guardando...
                </Text>
              </>
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                Guardar y continuar
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
