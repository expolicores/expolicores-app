// frontend/src/screens/EmailOptionalScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { requestOtp, api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ENV } from '../config/env';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailOptional'>;

/**
 * Usos:
 * - Enrolar correo (opcional) justo después del OTP (modo por defecto)
 * - Login por correo (mode='loginByEmail'):
 *    * El correo se usa SOLO como identificador.
 *    * El backend envía OTP por SMS al celular asociado.
 *    * Siempre se ingresa el código en OtpCodeScreen.
 */
export default function EmailOptionalScreen({ route, navigation }: Props) {
  const { phone, email, mode } = route.params || {};
  const { refreshMe, deferEmailPrompt } = useAuth();

  // Gate por feature flag: si el feature está OFF y no es flujo loginByEmail, salir.
  useEffect(() => {
    if (!ENV.FEATURE_EMAIL_VERIFY && mode !== 'loginByEmail') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' as never }],
      });
    }
  }, [mode, navigation]);

  if (!ENV.FEATURE_EMAIL_VERIFY && mode !== 'loginByEmail') {
    // Evita parpadeos mientras navegamos fuera
    return null;
  }

  const [emailInput, setEmailInput] = useState(email || '');
  const [showTerms, setShowTerms] = useState(false);
  const [t1, setT1] = useState(false);
  const [t2, setT2] = useState(false);
  const [loading, setLoading] = useState(false);
  // 'continue' => guardar correo; 'skip' => aplazar correo
  const [nextAction, setNextAction] = useState<'continue' | 'skip'>('continue');

  // bandera para reabrir el modal cuando volvamos de Legal
  const reopenTermsRef = useRef(false);

  // cuando esta pantalla reciba foco otra vez, si venimos de Legal, reabrimos el modal
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (reopenTermsRef.current) {
        setShowTerms(true);
        reopenTermsRef.current = false;
      }
    });
    return unsubscribe;
  }, [navigation]);

  const openTerms = (action: 'continue' | 'skip') => {
    setNextAction(action);
    setT1(false);
    setT2(false);
    setShowTerms(true);
  };

  const canAccept = t1 && t2 && !loading;

  const finalize = async () => {
    if (!canAccept) return;
    setShowTerms(false);

    try {
      setLoading(true);
      if (nextAction === 'continue') {
        const normalizedEmail = emailInput.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          Alert.alert('Aviso', 'Por favor ingresa un correo válido.');
          return;
        }

        // Guardar correo como identificador (no se envía enlace de verificación)
        await api.post('/auth/enroll-email', { email: normalizedEmail });
        await refreshMe();
        await deferEmailPrompt(false);
      } else {
        // Aplazar correo para evitar loop en el Gate
        await deferEmailPrompt(true);
      }

      // Navegamos directo al Dashboard (ya no rebotamos por el Gate)
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' as never }],
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        (nextAction === 'continue'
          ? 'No pudimos guardar tu correo ahora.\nPodrás añadirlo en tu perfil.'
          : 'No pudimos completar la acción.\nIntenta de nuevo.');
      Alert.alert('Aviso', String(msg));
    } finally {
      setLoading(false);
    }
  };

  // Modo login por correo: vista separada
  if (mode === 'loginByEmail') {
    return <LoginByEmailView navigation={navigation} />;
  }

  const linkStyle = {
    color: '#2563EB',
    textDecorationLine: 'underline' as const,
  };

  const goToLegalFromModal = () => {
    // cerramos el modal, marcamos que al volver hay que reabrirlo, y navegamos a Legal
    reopenTermsRef.current = true;
    setShowTerms(false);
    navigation.navigate('Legal');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', marginBottom: 8 }}>
          Agrega tu correo (opcional)
        </Text>
        <Text style={{ color: '#6B7280', marginBottom: 16 }}>
          Podrás usarlo como identificador de tu cuenta y para recibir
          comunicaciones relevantes.
        </Text>

        <TextInput
          value={emailInput}
          onChangeText={setEmailInput}
          placeholder="tucorreo@ejemplo.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={{
            fontSize: 16,
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color="#ffffff" />
              <Text
                style={{
                  color: '#ffffff',
                  fontWeight: '700',
                  marginLeft: 8,
                }}
              >
                Guardando...
              </Text>
            </View>
          ) : (
            <Text
              style={{
                color: '#ffffff',
                textAlign: 'center',
                fontSize: 16,
                fontWeight: '700',
              }}
            >
              Continuar
            </Text>
          )}
        </TouchableOpacity>

        {/* Colocar luego (aplaza correo; igual pide aceptar TyC) */}
        <TouchableOpacity
          onPress={() => openTerms('skip')}
          style={{
            padding: 12,
            opacity: loading ? 0.6 : 1,
          }}
          disabled={loading}
        >
          <Text
            style={{
              textAlign: 'center',
              color: '#111827',
              fontSize: 16,
              fontWeight: '600',
            }}
          >
            Colocar luego
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Términos y Condiciones */}
      <Modal
        visible={showTerms}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTerms(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 24,
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              maxHeight: '80%',
              padding: 16,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                marginBottom: 8,
                color: '#111827',
              }}
            >
              Términos y condiciones
            </Text>

            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              <Text style={{ color: '#374151', marginBottom: 12 }}>
                Al registrarte aceptas nuestros{' '}
                <Text
                  style={linkStyle}
                  onPress={goToLegalFromModal}
                >
                  términos y condiciones
                </Text>{' '}
                y la{' '}
                <Text
                  style={linkStyle}
                  onPress={goToLegalFromModal}
                >
                  política de tratamiento de datos personales
                </Text>
                , incluyendo el uso de tu celular para enviarte códigos de
                verificación, gestionar tus pedidos y enviarte notificaciones
                sobre el estado de tus órdenes.
              </Text>

              {/* Check 1 */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  marginTop: 4,
                  marginBottom: 4,
                }}
              >
                <TouchableOpacity
                  onPress={() => setT1(!t1)}
                  style={{ marginRight: 8, paddingVertical: 4 }}
                >
                  <Text style={{ color: '#111827' }}>
                    {t1 ? '[x]' : '[ ]'}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: '#111827', flex: 1 }}>
                  Acepto los{' '}
                  <Text
                    style={linkStyle}
                    onPress={goToLegalFromModal}
                  >
                    términos y condiciones
                  </Text>
                  .
                </Text>
              </View>

              {/* Check 2 */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  marginTop: 4,
                }}
              >
                <TouchableOpacity
                  onPress={() => setT2(!t2)}
                  style={{ marginRight: 8, paddingVertical: 4 }}
                >
                  <Text style={{ color: '#111827' }}>
                    {t2 ? '[x]' : '[ ]'}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: '#111827', flex: 1 }}>
                  Autorizo el{' '}
                  <Text
                    style={linkStyle}
                    onPress={goToLegalFromModal}
                  >
                    tratamiento de datos personales
                  </Text>
                  .
                </Text>
              </View>
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginTop: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowTerms(false)}
                style={{ paddingVertical: 8, paddingHorizontal: 12 }}
              >
                <Text style={{ color: '#374151' }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={finalize}
                disabled={!canAccept}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  backgroundColor: canAccept ? '#10B981' : '#d1d5db',
                  marginLeft: 8,
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontWeight: '700',
                  }}
                >
                  Aceptar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ===== Login por correo: email como identificador → OTP por SMS → OtpCodeScreen ===== */

function LoginByEmailView({
  navigation,
}: {
  navigation: Props['navigation'];
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const onContinue = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    // Validación básica de formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      Alert.alert('Aviso', 'Por favor ingresa un correo válido.');
      return;
    }

    setLoading(true);
    try {
      // IMPORTANTE:
      // - El correo solo se usa como IDENTIFICADOR.
      // - El OTP se envía SIEMPRE por SMS al celular asociado en backend.
      const res = await requestOtp({
        email: normalizedEmail,
        intent: 'login',
        channel: 'sms',
      } as any);

      const cooldown =
        res?.throttled && typeof res?.remainingSeconds === 'number'
          ? res.remainingSeconds
          : typeof res?.cooldownSeconds === 'number'
          ? res.cooldownSeconds
          : 60;

      const expires =
        typeof res?.expiresInSeconds === 'number'
          ? res.expiresInSeconds
          : 600;

      // Navegamos SIEMPRE a OtpCodeScreen (puerta única para ingresar el código)
      navigation.navigate(
        'OtpCode',
        {
          email: normalizedEmail,
          intent: 'login',
          phone: undefined,
          phoneMasked: res?.phoneMasked,
          devOtp: __DEV__ ? res?.devOtp : undefined,
          cooldownSeconds: cooldown,
          expiresInSeconds: expires,
        } as any
      );
    } catch (e: any) {
      const msg =
        e?.message ||
        (typeof e?.details?.message === 'string'
          ? e.details.message
          : 'No pudimos enviar el código.\nVerifica tu correo o intenta con tu celular.');
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', marginBottom: 8 }}>
          Ingresa tu correo
        </Text>
        <Text style={{ color: '#6B7280', marginBottom: 16 }}>
          Usaremos el correo asociado a tu cuenta para validar tu identidad y
          enviarte un código por SMS al celular registrado.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="tucorreo@ejemplo.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={{
            fontSize: 16,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            marginBottom: 24,
          }}
        />

        <TouchableOpacity
          onPress={onContinue}
          disabled={loading || !email.trim()}
          style={{
            backgroundColor:
              loading || !email.trim() ? '#d1d5db' : '#10B981',
            padding: 16,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text
              style={{
                color: '#ffffff',
                fontWeight: '700',
                fontSize: 16,
              }}
            >
              Continuar
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
