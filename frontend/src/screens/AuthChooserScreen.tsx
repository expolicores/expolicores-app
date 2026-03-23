// frontend/src/screens/AuthChooserScreen.tsx
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { ENV } from '../config/env';
import { Linking } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthChooser'>;

export default function AuthChooserScreen({ navigation }: Props) {
  const { lastPhone } = useAuth();

  const goPhone = () => {
    // OTP-first (canal por defecto configurado en backend)
    navigation.navigate('PhoneEntry', { intent: 'login' });
  };

  const goEmail = () => {
    // Login por correo (envía OTP al celular verificado asociado)
    navigation.navigate('EmailOptional', { mode: 'loginByEmail' });
  };

  const openWhatsAppSupport = () => {
    if (!ENV.WABA_NUMBER) return;
    const waNum = ENV.WABA_NUMBER.replace('+', '');
    Linking.openURL(`https://wa.me/${waNum}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        {/* Header / Branding */}
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 32, fontWeight: '800', color: '#111827' }}>
            Bienvenido a Expolicores
          </Text>
          <Text style={{ marginTop: 8, fontSize: 16, color: '#6B7280' }}>
            Inicia rápido. Te enviaremos un código de verificación a tu celular.
          </Text>
        </View>

        {/* CTA principal */}
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity
            testID="btn-continue-phone"
            onPress={goPhone}
            style={{
              backgroundColor: '#10B981',
              borderRadius: 16,
              paddingVertical: 16,
              paddingHorizontal: 14,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="call-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
              Continuar con tu celular
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-continue-email"
            onPress={goEmail}
            style={{
              backgroundColor: '#E5E7EB',
              borderRadius: 16,
              paddingVertical: 16,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="mail-outline" size={20} color="#111827" style={{ marginRight: 8 }} />
            <Text style={{ color: '#111827', fontSize: 18, fontWeight: '700' }}>
              Continuar con tu correo
            </Text>
          </TouchableOpacity>

          {/* Hint: recordar último teléfono usado (si existe) */}
          {lastPhone ? (
            <Text
              style={{ marginTop: 10, textAlign: 'center', color: '#6B7280', fontSize: 13 }}
              accessibilityLabel={`Último número usado ${lastPhone}`}
            >
              Último número usado:{' '}
              <Text style={{ fontWeight: '700', color: '#374151' }}>{lastPhone}</Text>
            </Text>
          ) : null}

          {/* Ayuda por WhatsApp al número WABA (si está configurado) */}
          {ENV.WABA_NUMBER ? (
            <TouchableOpacity
              onPress={openWhatsAppSupport}
              style={{ paddingVertical: 10, alignSelf: 'center' }}
            >
              <Text style={{ color: '#059669', fontWeight: '600' }}>
                ¿Necesitas ayuda? Escríbenos por WhatsApp
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginTop: 2 }}>
                {ENV.WABA_NUMBER}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Footer / términos */}
        <View style={{ marginBottom: 4 }}>
          <Text style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>
            Al continuar aceptas nuestros{' '}
            <Text
              style={{ color: '#2563EB', textDecorationLine: 'underline' }}
              onPress={() => navigation.navigate('Legal')}
            >
              términos y la política de datos
            </Text>
            .
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
