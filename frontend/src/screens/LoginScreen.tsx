import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '../context/AuthContext';

const schema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Minimo 6 caracteres'),
});

type Form = z.infer<typeof schema>;

export default function LoginScreen() {
  const route = useRoute<any>();
  const message = route.params?.message as string | undefined;
  const { signIn } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: Form) => {
    await signIn(values.email, values.password);
  };

  const disabled = isSubmitting;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      {message ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{message}</Text>
        </View>
      ) : null}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="correo@dominio.com"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            selectionColor="#111"
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Contrasena"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            style={styles.input}
            selectionColor="#111"
          />
        )}
      />

      <Pressable
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={disabled}
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Entrando...' : 'Entrar'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 20, textAlign: 'center', color: '#111' },
  notice: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  noticeText: { color: '#1D4ED8', textAlign: 'center', fontWeight: '600' },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    color: '#111',
  },
  button: {
    marginTop: 4,
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
