// frontend/src/screens/OtpCodeScreen.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ENV } from '../config/env';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking } from 'react-native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { requestOtp } from '../lib/api';
import AuthFlowBackButton from '../components/AuthFlowBackButton';

type Props = NativeStackScreenProps<RootStackParamList, 'OtpCode'>;

export default function OtpCodeScreen({ route, navigation }: Props) {
  const { verifyOtp } = useAuth(); // usa el contexto

  const {
    phone,
    email,
    intent = 'login',
    // devOtp, // ya no usamos devOtp en el cliente
    cooldownSeconds = 60,
    expiresInSeconds = 600,
    phoneMasked,
  } = route.params || {};

  const [code, setCode] = useState<string>(''); // siempre empieza vacío
  const [cooldown, setCooldown] = useState<number>(cooldownSeconds);
  const [loading, setLoading] = useState<boolean>(false);

  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef(false);

  const destinationText = useMemo(() => {
    if (phoneMasked) return `Enviado a ${phoneMasked}`;
    if (phone) return `Enviado a ${phone}`;
    if (email) return `Enviado al celular asociado a ${email}`;
    return 'Ingresa el código recibido';
  }, [phone, email, phoneMasked]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const onVerify = async () => {
    if (code.length !== 6 || loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const me = await verifyOtp(email ? { email, code } : { phone, code });

      if (!me) throw new Error('No se pudo obtener el usuario');

      const normalizedName = (me.name ?? '').trim();
      const isDefaultName = normalizedName.toLowerCase() === 'cliente';
      const hasName = normalizedName.length >= 2 && !isDefaultName;
      const normalizedEmail = (me.email ?? '').trim();
      const hasEmail = normalizedEmail.length > 0;

      if (intent === 'register' || !hasName) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Name' as never, params: { phone, email } as never }],
        });
        return;
      }

      if (!hasEmail) {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'EmailOptional' as never,
              params: {
                phone,
                email,
                name: normalizedName || undefined,
                fromOtp: true,
              } as never,
            },
          ],
        });
        return;
      }

      // Ruta feliz
      navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
    } catch (e: any) {
      const msg =
        e?.message ||
        (typeof e?.details?.message === 'string' ? e.details.message : null) ||
        'Código inválido o expirado.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const onResend = async () => {
    if (cooldown > 0 || loading) return;

    if (!ENV.FEATURE_SMS) {
      Alert.alert(
        'No disponible',
        'El envío por SMS no está habilitado en este entorno.'
      );
      return;
    }

    setLoading(true);
    try {
      const res: any = await requestOtp({
        phone,
        email,
        intent,
        channel: 'sms',
      });

      // ya NO autollenamos el código con res.devOtp

      if (res?.throttled && typeof res?.remainingSeconds === 'number') {
        setCooldown(res.remainingSeconds);
      } else if (typeof res?.cooldownSeconds === 'number') {
        setCooldown(res.cooldownSeconds);
      } else {
        setCooldown(60);
      }
    } catch (e: any) {
      const msg =
        e?.message ||
        (typeof e?.details?.message === 'string' ? e.details.message : null) ||
        'No pudimos reenviar el código. Intenta de nuevo.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const onOpenWhatsAppSupport = () => {
    if (!ENV.WABA_NUMBER) return;
    const waNum = ENV.WABA_NUMBER.replace('+', '');
    Linking.openURL(`https://wa.me/${waNum}`);
  };

  const disabled = code.length !== 6 || loading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <View style={{ padding: 24, flex: 1 }}>
          {/* Botón genérico de volver */}
          <AuthFlowBackButton />

          <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
            Ingresa el código de 6 dígitos
          </Text>

          <Text style={{ color: '#6B7280', marginBottom: 4 }}>{destinationText}</Text>
          <Text style={{ color: '#9CA3AF', marginBottom: 16 }}>
            El código expira en {Math.ceil(expiresInSeconds / 60)} min.
          </Text>

          <TextInput
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="- - - - - -"
            autoFocus
            style={{
              fontSize: 32,
              letterSpacing: 12,
              textAlign: 'center',
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              marginBottom: 24,
            }}
          />

          <TouchableOpacity
            disabled={disabled}
            onPress={onVerify}
            style={{
              backgroundColor: disabled ? '#A7F3D0' : '#10B981',
              padding: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: '700',
                    marginLeft: 8,
                  }}
                >
                  Verificando...
                </Text>
              </>
            ) : (
              <Text
                style={{
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: 16,
                  fontWeight: '700',
                }}
              >
                Verificar
              </Text>
            )}
          </TouchableOpacity>

          {/* Reenviar por SMS (único canal activo para OTP) */}
          <TouchableOpacity
            disabled={cooldown > 0 || loading}
            onPress={onResend}
            style={{ padding: 12 }}
          >
            <Text
              style={{
                textAlign: 'center',
                color: cooldown > 0 ? '#9CA3AF' : '#2563EB',
              }}
            >
              {cooldown > 0
                ? `Reenviar código por SMS (${cooldown}s)`
                : 'Reenviar código por SMS'}
            </Text>
          </TouchableOpacity>

          {/* Acción: abrir WhatsApp al WABA de soporte */}
          {ENV.WABA_NUMBER ? (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={onOpenWhatsAppSupport}
                style={{ paddingVertical: 8 }}
              >
                <Text style={{ color: '#059669', fontWeight: '600' }}>
                  ¿No te llegó? Escríbenos por WhatsApp
                </Text>
              </TouchableOpacity>
              <Text
                style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}
              >
                Te atenderemos en {ENV.WABA_NUMBER}
              </Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
