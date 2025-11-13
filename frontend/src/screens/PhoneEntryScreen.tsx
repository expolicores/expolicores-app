// frontend/src/screens/PhoneEntryScreen.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { normalizePhoneCo } from '../lib/phone';
import { requestOtp, type RequestOtpResp } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ENV } from '../config/env';
import AuthFlowBackButton from '../components/AuthFlowBackButton';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneEntry'>;

function maskPhoneE164(p?: string | null) {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  if (digits.length < 4) return p;
  const last4 = digits.slice(-4);
  return `+57*****${last4}`;
}

export default function PhoneEntryScreen({ route, navigation }: Props) {
  const { intent = 'login' } = route.params || {};
  const { lastPhone, setLastPhone } = useAuth();

  const [raw, setRaw] = useState<string>(lastPhone ?? '');
  const [loading, setLoading] = useState(false);
  const [throttledMsg, setThrottledMsg] = useState<string | null>(null);
  const sentRef = useRef(false);

  // Normaliza al vuelo (acepta 3xx, 03xx, 57xxx, +57xxx)
  const phone = useMemo(() => normalizePhoneCo(raw), [raw]);
  const disabled = !phone || loading;

  const onContinueWithPhone = async (channel: 'whatsapp' | 'sms' = 'whatsapp') => {
    if (!phone) return;
    if (sentRef.current || loading) return;

    // En beta solo usamos SMS; si SMS no está habilitado, mostramos mensaje genérico.
    if (channel === 'sms' && !ENV.FEATURE_SMS) {
      Alert.alert(
        'No disponible',
        'El envio por SMS no esta habilitado en este entorno. Por favor, intenta mas tarde.',
      );
      return;
    }

    setLoading(true);
    setThrottledMsg(null);

    try {
      // Llamada al backend (canal explicito segun boton)
      const res: RequestOtpResp = await requestOtp({
        phone,
        channel,
        intent, // 'login' | 'register'
      });

      // Cooldown/expiracion desde el server (fallbacks seguros)
      const cooldown =
        res?.throttled && typeof res?.remainingSeconds === 'number'
          ? res.remainingSeconds
          : typeof res?.cooldownSeconds === 'number'
          ? res.cooldownSeconds
          : 60;

      const expires =
        typeof res?.expiresInSeconds === 'number' ? res.expiresInSeconds : 600;

      if (res?.throttled) {
        setThrottledMsg(`Espera ${cooldown}s antes de solicitar un nuevo codigo.`);
      }

      // Guardamos para sugerir en futuras aperturas
      setLastPhone?.(phone);
      sentRef.current = true;

      // Navega a pantalla OTP con params
      navigation.navigate('OtpCode', {
        phone,
        phoneMasked: res?.phoneMasked ?? maskPhoneE164(phone),
        cooldownSeconds: cooldown,
        expiresInSeconds: expires,
        // Autorrellenar SOLO en dev
        devOtp: __DEV__ ? res?.devOtp : undefined,
        intent,
      });
    } catch (e: any) {
      sentRef.current = false;

      // Mensajes de error mas claros para casos comunes
      const known =
        e?.message === 'SMS_DELIVERY_FAILED'
          ? 'No pudimos enviar el SMS. Verifica tu numero o intenta mas tarde.'
          : e?.message === 'WABA_RESTRICTED'
          ? 'WhatsApp temporalmente restringido. Usa SMS por favor.'
          : channel === 'sms' &&
            [
              'Canal SMS deshabilitado',
              'SMS feature disabled (FEATURE_SMS_OTP=false)',
              'SMS feature disabled',
              'No SMS sender configured. Configure TWILIO_MS_SID_SMS/TWILIO_MESSAGING_SERVICE_SID_SMS or TWILIO_SMS_FROM',
            ].includes(e?.message)
          ? 'El envio por SMS no esta disponible en este momento.'
          : channel === 'sms' && e?.message === 'Request failed with status code 400'
          ? 'No pudimos enviar el SMS. Intenta de nuevo mas tarde.'
          : null;

      const msg =
        known ||
        e?.message ||
        (typeof e?.details?.message === 'string' ? e.details.message : null) ||
        'No pudimos enviar el codigo. Intenta de nuevo.';

      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const onBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'AuthChooser' as never }],
    });
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ padding: 24 }}>
        <AuthFlowBackButton onPress={onBack} />
        <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
          Ingresa tu numero de celular
        </Text>
        <Text style={{ color: '#6B7280', marginBottom: 16 }}>
          Te enviaremos un codigo de 6 digitos para continuar.
        </Text>

        <TextInput
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoCapitalize="none"
          autoCorrect={false}
          value={raw}
          onChangeText={setRaw}
          placeholder="311 502 6310"
          returnKeyType="done"
          style={{
            fontSize: 22,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            marginBottom: 24,
          }}
        />

        {/*
          Boton verde: WhatsApp (DESHABILITADO TEMPORALMENTE)
          Cuando WABA/Twilio este listo, descomentar este bloque.

        <TouchableOpacity
          disabled={disabled}
          onPress={() => onContinueWithPhone('whatsapp')}
          style={{
            backgroundColor: '#10B981',
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            opacity: disabled ? 0.6 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Recibir codigo por WhatsApp"
          testID="btn-wa-otp"
        >
          <Ionicons name="logo-whatsapp" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text
            style={{
              color: '#fff',
              textAlign: 'center',
              fontSize: 16,
              fontWeight: '700',
            }}
          >
            Recibir codigo por WhatsApp
          </Text>
        </TouchableOpacity>
        */}

        {/* Boton blanco: SMS */}
        <TouchableOpacity
          disabled={disabled}
          onPress={() => onContinueWithPhone('sms')}
          style={{
            backgroundColor: '#ffffff',
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            opacity: disabled ? 0.6 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Recibir código por SMS"
          testID="btn-sms-otp"
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={20}
            color="#111827"
            style={{ marginRight: 8 }}
          />
          <Text
            style={{
              color: '#111827',
              textAlign: 'center',
              fontSize: 16,
              fontWeight: '700',
            }}
          >
            Recibir código por SMS
          </Text>
        </TouchableOpacity>

        {throttledMsg ? (
          <Text style={{ color: '#EF4444', marginTop: 12 }}>{throttledMsg}</Text>
        ) : null}

        {phone ? (
          <Text style={{ color: '#6B7280', marginTop: 12 }}>
            Enviaremos el codigo a{' '}
            <Text style={{ color: '#111827', fontWeight: '700' }}>
              {maskPhoneE164(phone)}
            </Text>
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
