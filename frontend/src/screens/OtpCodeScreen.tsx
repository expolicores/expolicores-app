// frontend/src/screens/OtpCodeScreen.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
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

type Props = NativeStackScreenProps<RootStackParamList, 'OtpCode'>;

export default function OtpCodeScreen({ route, navigation }: Props) {
  const { verifyOtp } = useAuth(); // usa el contexto

  const {
    phone,
    email,
    intent = 'login',
    devOtp,
    cooldownSeconds = 60,
    expiresInSeconds = 600,
    phoneMasked,
  } = route.params || {};

  const isDev = __DEV__;
  const [code, setCode] = useState<string>(isDev && devOtp ? devOtp : '');
  const [cooldown, setCooldown] = useState<number>(cooldownSeconds);
  const [loading, setLoading] = useState<boolean>(false);

  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef(false);

  const destinationText = useMemo(() => {
    if (phoneMasked) return `Enviado a ${phoneMasked}`;
    if (phone) return `Enviado a ${phone}`;
    if (email) return `Enviado al celular asociado a ${email}`;
    return 'Ingresa el codigo recibido';
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

  // Autorrellenar SOLO en dev -- NO auto-verificar
  useEffect(() => {
    if (isDev && devOtp && devOtp.length === 6) setCode(devOtp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devOtp, isDev]);

  const onVerify = async () => {
    if (code.length !== 6 || loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const me = await verifyOtp(
        email ? { email, code } : { phone, code }
      );

      if (!me) throw new Error('No se pudo obtener el usuario');

      const normalizedName = (me.name ?? '').trim();
      const isDefaultName = normalizedName.toLowerCase() === 'cliente';
      const hasName = normalizedName.length >= 2 && !isDefaultName;
      const normalizedEmail = (me.email ?? '').trim();
      const hasEmail = normalizedEmail.length > 0;

      if (intent === 'register' || !hasName) {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'Name' as never,
              params: { phone, email } as never,
            },
          ],
        });
        return;
      }

      if (!hasEmail) {
        navigation.reset({
          index: 0,
          routes: [{
            name: 'EmailOptional' as never,
            params: {
              phone,
              email,
              name: normalizedName || undefined,
              fromOtp: true,
            } as never,
          }],
        });
        return;
      }

      // Ruta feliz: a Home/Catalog/Market (elige la que uses)
      navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
    } catch (e: any) {
      const msg =
        e?.message ||
        (typeof e?.details?.message === 'string' ? e.details.message : null) ||
        'codigo invalido o expirado.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const onResend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    try {
      const res: any = await requestOtp({ phone, email, intent });

      if (isDev && res?.devOtp?.length === 6) setCode(res.devOtp);

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
        'No pudimos reenviar el codigo. Intenta de nuevo.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
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
          <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
            Ingresa el codigo de 6 digitos
          </Text>

          <Text style={{ color: '#6B7280', marginBottom: 4 }}>{destinationText}</Text>
          <Text style={{ color: '#9CA3AF', marginBottom: 16 }}>
            El codigo expira en {Math.ceil(expiresInSeconds / 60)} min.
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
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                  Verificando...
                </Text>
              </>
            ) : (
              <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: '700' }}>
                Verificar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            disabled={cooldown > 0 || loading}
            onPress={onResend}
            style={{ padding: 12 }}
          >
            <Text style={{ textAlign: 'center', color: cooldown > 0 ? '#9CA3AF' : '#2563EB' }}>
              {cooldown > 0 ? `Reenviar codigo (${cooldown}s)` : 'Reenviar codigo'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}



