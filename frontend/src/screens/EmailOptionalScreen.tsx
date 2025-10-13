// frontend/src/screens/EmailOptionalScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { requestOtp, verifyOtp, api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailOptional'>;

/**
 * Usos:
 *  - Enrolar correo (opcional) justo después del OTP (modo por defecto)
 *  - Login por correo (mode='loginByEmail'): envía OTP al celular asociado al correo
 */
export default function EmailOptionalScreen({ route, navigation }: Props) {
  const { phone, email, mode } = route.params || {};
  const { refreshMe, deferEmailPrompt } = useAuth();

  const [emailInput, setEmailInput] = useState<string>(email || '');
  const [showTerms, setShowTerms] = useState(false);
  const [t1, setT1] = useState(false);
  const [t2, setT2] = useState(false);
  const [loading, setLoading] = useState(false);

  // 'continue' => guardar correo; 'skip' => aplazar correo
  const [nextAction, setNextAction] = useState<'continue' | 'skip'>('continue');

  const openTerms = (action: 'continue' | 'skip') => {
    setNextAction(action);
    setShowTerms(true);
  };

  const finalize = async () => {
    setShowTerms(false);
    try {
      setLoading(true);

      if (nextAction === 'continue') {
        const normalizedEmail = emailInput.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          Alert.alert('Aviso', 'Por favor ingresa un correo válido.');
          return;
        }
        // Opción 1 (Auth): endpoint dedicado para enrolar correo
        await api.post('/auth/enroll-email', { email: normalizedEmail });
        await refreshMe();
        await deferEmailPrompt(false);
        Alert.alert('Listo', 'Te enviamos un enlace para verificar tu correo.');
      } else {
        // Aplazar correo para evitar loop en el Gate
        await deferEmailPrompt(true);
      }

      // Volvemos a Home; el PostAuthGate decide (Name/Email/Catalog)
      navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        (nextAction === 'continue'
          ? 'No pudimos guardar tu correo ahora. Podrás añadirlo en tu perfil.'
          : 'No pudimos completar la acción. Intenta de nuevo.');
      Alert.alert('Aviso', String(msg));
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'loginByEmail') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <StatusBar barStyle="dark-content" />
        <View style={{ padding: 24 }}>
          <LoginByEmailView navigation={navigation} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ padding: 24, flex: 1 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 16 }}>
          Agrega tu correo (opcional)
        </Text>

        <TextInput
          keyboardType="email-address"
          autoCapitalize="none"
          value={emailInput}
          onChangeText={setEmailInput}
          placeholder="tucorreo@dominio.com"
          style={{
            fontSize: 20,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            marginBottom: 24,
          }}
        />

        {/* Continuar (guardar correo) */}
        <TouchableOpacity
          onPress={() => openTerms('continue')}
          style={{
            backgroundColor: '#10B981',
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            opacity: loading ? 0.6 : 1,
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: '700' }}>
              Continuar
            </Text>
          )}
        </TouchableOpacity>

        {/* Colocar luego (aplaza correo; igual pide aceptar TyC) */}
        <TouchableOpacity
          onPress={() => openTerms('skip')}
          style={{ padding: 12, opacity: loading ? 0.6 : 1 }}
          disabled={loading}
        >
          <Text style={{ textAlign: 'center', color: '#2563EB' }}>Colocar luego</Text>
        </TouchableOpacity>

        {/* Modal de Términos y Condiciones */}
        <Modal visible={showTerms} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View
              style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                maxHeight: '70%',
              }}
            >
              <ScrollView style={{ padding: 16 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 12 }}>
                  Términos y condiciones
                </Text>
                <Text style={{ color: '#4B5563', marginBottom: 12 }}>
                  Al registrarte aceptas nuestros términos y la política de tratamiento de datos...
                </Text>

                <TouchableOpacity onPress={() => setT1(!t1)} style={{ paddingVertical: 8 }}>
                  <Text>{t1 ? '[x]' : '[ ]'} Acepto los términos y condiciones.</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setT2(!t2)} style={{ paddingVertical: 8 }}>
                  <Text>{t2 ? '[x]' : '[ ]'} Autorizo el tratamiento de datos personales.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={!(t1 && t2) || loading}
                  onPress={finalize}
                  style={{
                    backgroundColor: t1 && t2 && !loading ? '#10B981' : '#9CA3AF',
                    padding: 14,
                    borderRadius: 12,
                    marginTop: 12,
                    marginBottom: 24,
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16 }}>
                    Aceptar
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

/* ===== Login por correo: envía OTP al celular asociado al correo ===== */

function LoginByEmailView({ navigation }: { navigation: Props['navigation'] }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [cooldown, setCooldown] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Reenvío controlado por cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const onSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await requestOtp({ email, intent: 'login' });
      setSent(true);
      setDevOtp((res as any)?.devOtp);
      setCooldown(60);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'No pudimos enviar el código. Verifica tu correo o intenta con tu celular.';
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0 || !sent) return;
    await onSend();
  };

  const onVerify = async () => {
    const c = (code || devOtp || '').trim();
    if (c.length < 6) return;
    setLoading(true);
    try {
      await verifyOtp({ email, code: c });
      // Volvemos a Home para que el PostAuthGate decida (Name/Email/Catalog)
      navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Código inválido o expirado.';
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  const mergedCode = devOtp ? devOtp : code;

  if (!sent) {
    return (
      <View>
        <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 16 }}>
          Ingresa tu correo
        </Text>
        <TextInput
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          placeholder="tucorreo@dominio.com"
          style={{
            fontSize: 20,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            marginBottom: 24,
          }}
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={loading || !email.trim()}
          style={{
            backgroundColor: loading || !email.trim() ? '#9CA3AF' : '#10B981',
            padding: 16,
            borderRadius: 16,
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: '700' }}>
            Continuar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Validación de seguridad</Text>
      <Text style={{ color: '#4B5563', marginBottom: 12 }}>
        Te enviamos un código de 6 dígitos al celular asociado a tu correo.
      </Text>

      <TextInput
        keyboardType="number-pad"
        maxLength={6}
        value={mergedCode}
        onChangeText={setCode}
        placeholder={devOtp ? devOtp : '______'}
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
        disabled={(mergedCode || '').length < 6 || loading}
        onPress={onVerify}
        style={{
          backgroundColor: (mergedCode || '').length < 6 || loading ? '#9CA3AF' : '#10B981',
          padding: 16,
          borderRadius: 16,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: '700' }}>
          Verificar
        </Text>
      </TouchableOpacity>

      <TouchableOpacity disabled={cooldown > 0 || loading} onPress={onResend} style={{ padding: 8 }}>
        <Text style={{ textAlign: 'center', color: cooldown > 0 ? '#9CA3AF' : '#2563EB' }}>
          Reenviar código {cooldown > 0 ? `(${cooldown}s)` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
