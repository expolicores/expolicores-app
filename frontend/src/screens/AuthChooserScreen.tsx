// frontend/src/screens/AuthChooserScreen.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthChooser'>;

export default function AuthChooserScreen({ navigation }: Props) {
  const { lastPhone } = useAuth();

  const goPhone = () => {
    navigation.navigate('PhoneEntry', { intent: 'login' });
  };

  const goEmail = () => {
    navigation.navigate('EmailOptional', { mode: 'loginByEmail' });
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
            Inicia rapido. Te enviaremos un codigo de verificacion.
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

          {/* Hint: recordar ultimo telefono usado (si existe) */}
          {lastPhone ? (
            <Text
              style={{ marginTop: 10, textAlign: 'center', color: '#6B7280', fontSize: 13 }}
              accessibilityLabel={`Ultimo numero usado ${lastPhone}`}
            >
              Ultimo numero usado: <Text style={{ fontWeight: '700', color: '#374151' }}>{lastPhone}</Text>
            </Text>
          ) : null}
        </View>

        {/* Footer / terminos */}
        <View style={{ marginBottom: 4 }}>
          <Text style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>
            Al continuar aceptas nuestros terminos y la politica de datos.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}





