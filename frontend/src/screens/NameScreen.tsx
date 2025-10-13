// frontend/src/screens/NameScreen.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativestakScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { updateMe } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Props = NativestakScreenProps<RootStackParamList, 'Name'>;

// Normaliza nombre: quita espacios extra y caracteres no permitidos
function sanitizeName(raw: string) {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{M}\s'.-]/gu, '') // letras + acentos + espacio/apostrofo/punto/guion
    .trim();
}

/**
 * Pide y persiste el nombre del usuario tras verificar OTP.
 * Requiere que el JWT ya esta configurado (setAuthToken se hace en verify-otp).
 */
export default function NameScreen({ route, navigation }: Props) {
  const { phone, email } = route.params || {};
  const { refreshMe } = useAuth(); // si existe, Refresca el contexto

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
      await updateMe({ name: trimmed }); // PATCH /users/me

      // Refresca perfil en contexto si el AuthContext lo expone
      if (typeof refreshMe === 'function') {
        await refreshMe();
      }

      // Continua a email opcional
      navigation.replace('EmailOptional', {
        phone,
        email,
        name: trimmed,
        fromOtp: true,
      });
    } catch (e: any) {
      const msg =
        e?.message ||
        (typeof e?.details?.message === 'string' ? e.details.message : null) ||
        'No pudimos guardar tu nombre. Verifica tu conexion o vuelve a intentarlo.';
      // Hint comun si faltara el token por alguna razon
      const extra =
        e?.status === 401 ? '\n\nVuelve a iniciar sesion para continuar.' : '';
      Alert.alert('Error', msg + extra);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <View style={{ flex: 1, padding: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
            Como te llamas?
          </Text>
          <Text style={{ color: '#6B7280', marginBottom: 16 }}>
            Ingresa tu nombre completo para personalizar tu experiencia.
          </Text>

          <TextInput
            value={name}
            onChangeText={(t) => setName(t)}
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
              fontSize: 16,
              marginBottom: 16,
            }}
          />

          <TouchableOpacity
            disabled={!canSave}
            onPress={onSave}
            style={{
              backgroundColor: canSave ? '#10B981' : '#A7F3D0',
              height: 52,
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
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
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







