// frontend/src/screens/EmailOptionalScreen.tsx
import React, { useState, useEffect } from 'react';
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
import { requestOtp, verifyOtp, api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ENV } from '../config/env';
import AuthFlowBackButton from '../components/AuthFlowBackButton';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailOptional'>;

/**
 * Usos:
 * - Enrolar correo (opcional) justo después del OTP (modo por defecto)
 * - Login por correo (mode='loginByEmail'): envía OTP al celular asociado al correo
 */
export default function EmailOptionalScreen({ route, navigation }: Props) {
  const { phone, email, mode } = route.params || {};
  const { refreshMe, deferEmailPrompt, signOut } = useAuth();

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

        // Endpoint dedicado para enrolar correo
        await api.post('/auth/enroll-email', { email: normalizedEmail });
        await refreshMe();
        await deferEmailPrompt(false);

        Alert.alert(
          'Listo',
          'Te enviamos un enlace para verificar tu correo.',
        );
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

  // En modo loginByEmail, usamos la vista separada ↓ (no aplica lo de términos iniciales)
  if (mode === 'loginByEmail') {
    return <LoginByEmailView navigation={navigation} />;
  }

  const linkStyle = {
    color: '#2563EB',
    textDecorationLine: 'underline' as const,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, padding: 24 }}>
        {/* Botón Volver con lógica que NO permite llegar al feed sin TyC */}
        <AuthFlowBackButton
          onBack={() => {
            const state = navigation.getState?.();
            const routes = state?.routes ?? [];
            const canPop =
              navigation.canGoBack() && (routes.length ?? 0) > 1;

            if (canPop) {
              // Vemos a qué ruta iría el goBack
              const prevRoute = routes[routes.length - 2];

              // Si la ruta anterior es Dashboard/Home, NO queremos ir allá,
              // porque eso deja al usuario en el feed sin aceptar términos.
              if (
                prevRoute?.name === 'Dashboard' ||
                prevRoute?.name === 'Home'
              ) {
                Alert.alert(
                  'Salir del registro',
                  'Si vuelves ahora, se cerrará tu sesión y deberás iniciar de nuevo.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Salir',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          // No marcamos deferEmailPrompt aquí: queremos que
                          // se le vuelva a mostrar el flujo completo cuando
                          // vuelva a registrarse.
                          await signOut();
                        } catch {
                          // swallow
                        }
                      },
                    },
                  ],
                );
              } else {
                // Es seguro volver a pasos anteriores del flujo (OTP, Name, etc.)
                navigation.goBack();
              }
              return;
            }

            // Si no hay nada atrás en el stack, tratamos Volver como cancelar registro.
            Alert.alert(
              'Salir del registro',
              'Si vuelves ahora, se cerrará tu sesión y deberás iniciar de nuevo.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Salir',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await signOut();
                    } catch {
                      // swallow
                    }
                  },
                },
              ],
            );
          }}
        />

        <Text style={{ fontSize: 24, fontWeight: '800', marginBottom: 8 }}>
          Agrega tu correo (opcional)
        </Text>
        <Text style={{ color: '#6B7280', marginBottom: 16 }}>
          Podrás usarlo para recuperar tu cuenta y recibir novedades relevantes.
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

        {/* Colocar luego (aplaza correo; igual pide TyC) */}
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
                  onPress={() => {
                    setShowTerms(false);
                    navigation.navigate('Legal' as never);
                  }}
                >
                  términos y condiciones
                </Text>{' '}
                y la{' '}
                <Text
                  style={linkStyle}
                  onPress={() => {
                    setShowTerms(false);
                    navigation.navigate('Legal' as never);
                  }}
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
                    onPress={() => {
                      setShowTerms(false);
                      navigation.navigate('Legal' as never);
                    }}
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
                    onPress={() => {
                      setShowTerms(false);
                      navigation.navigate('Legal' as never);
                    }}
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

/* ===== Login por correo: envía OTP al celular asociado al correo ===== */

function LoginByEmailView({
  navigation,
}: {
  navigation: Props['navigation'];
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  // Reenvío controlado por cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(
      () => setCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
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
        'No pudimos enviar el código.\nVerifica tu correo o intenta con tu celular.';
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
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' as never }],
      });
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

  const mergedCode = devOtp ?? code;

  if (!sent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <StatusBar barStyle="dark-content" />
        <View style={{ flex: 1, padding: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', marginBottom: 8 }}>
            Ingresa tu correo
          </Text>
          <Text style={{ color: '#6B7280', marginBottom: 16 }}>
            Te enviaremos un código de verificación al celular asociado a tu
            correo.
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
            onPress={onSend}
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', marginBottom: 8 }}>
          Validación de seguridad
        </Text>
        <Text style={{ color: '#6B7280', marginBottom: 16 }}>
          Te enviamos un código de 6 dígitos al celular asociado a tu correo.
        </Text>

        <TextInput
          value={mergedCode}
          onChangeText={(t) => {
            setCode(t.replace(/\D/g, '').slice(0, 6));
            setDevOtp(undefined);
          }}
          maxLength={6}
          keyboardType="number-pad"
          placeholder="- - - - - -"
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
          onPress={onVerify}
          disabled={loading || (mergedCode || '').length < 6}
          style={{
            backgroundColor:
              loading || (mergedCode || '').length < 6
                ? '#d1d5db'
                : '#10B981',
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
              Verificar
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          disabled={cooldown > 0 || loading}
          onPress={onResend}
          style={{ padding: 8, marginTop: 8 }}
        >
          <Text
            style={{
              textAlign: 'center',
              color: cooldown > 0 ? '#9CA3AF' : '#2563EB',
            }}
          >
            Reenviar código {cooldown > 0 ? `(${cooldown}s)` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
