import React from 'react';
import { View, Text, TextInput, Button, Switch, Alert } from 'react-native';
import { useForm } from 'react-hook-form';
import { createAddress } from '../lib/api.addresses';

type Form = {
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string;
  isDefault?: boolean;

  // 👇👇👇 ===================== SOLO PARA PRUEBAS — ELIMINAR ANTES DE PRODUCCIÓN =====================
  lat?: number | null;
  lng?: number | null;
  // ================================================================================================ 👆👆👆
};

// helper para parsear número (acepta coma/punto)
const numOrNull = (v: string | undefined) => {
  if (!v) return null;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function AddressFormScreen({ navigation }: any) {
  const { register, setValue, handleSubmit, watch } = useForm<Form>({
    defaultValues: { isDefault: true },
  });

  React.useEffect(() => {
    register('label');
    register('recipient');
    register('phone');
    register('line1');
    register('line2');
    register('isDefault');

    // 👇 campos DEV (lat/lng)
    register('lat');
    register('lng');
  }, [register]);

  // 👇👇👇 ===================== SOLO PARA PRUEBAS — ELIMINAR ANTES DE PRODUCCIÓN =====================
  // Guardamos como string para permitir coma/punto y luego convertimos en onSubmit
  const [latText, setLatText] = React.useState('');
  const [lngText, setLngText] = React.useState('');
  // ================================================================================================ 👆👆👆

  const onSubmit = async (data: Form) => {
    // Validaciones mínimas
    if (!data.label || !data.recipient || !data.phone || !data.line1) {
      Alert.alert('Campos requeridos', 'Completa etiqueta, destinatario, teléfono y dirección.');
      return;
    }

    // 👇 convertir lat/lng (DEV)
    const lat = numOrNull(latText);
    const lng = numOrNull(lngText);

    // Para probar cobertura en checkout, exigimos coords en DEV
    if (lat == null || lng == null) {
      Alert.alert('Coordenadas faltantes', 'Ingresa latitud y longitud para validar cobertura.');
      return;
    }

    const payload: Form = {
      ...data,
      line2: data.line2 || undefined,
      lat,
      lng,
    };

    try {
      await createAddress(payload as any);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.code ?? 'No se pudo guardar la dirección.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text>Etiqueta</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('label', t)}
        placeholder="Casa / Hotel / Trabajo"
      />

      <Text>Destinatario</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('recipient', t)}
        placeholder="A nombre de"
      />

      <Text>Teléfono</Text>
      <TextInput
        keyboardType="phone-pad"
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('phone', t)}
        placeholder="310..."
      />

      <Text>Dirección</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('line1', t)}
        placeholder="Cra/Cll # No"
      />
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('line2', t)}
        placeholder="Apto/Habitación (opcional)"
      />

      {/* 👇👇👇 ===================== SOLO PARA PRUEBAS — ELIMINAR ANTES DE PRODUCCIÓN ===================== */}
      <Text>Latitud (DEV)</Text>
      <TextInput
        keyboardType="decimal-pad"
        inputMode="decimal"
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        value={latText}
        onChangeText={(t) => setLatText(t)}
        placeholder="5.6369"
      />

      <Text>Longitud (DEV)</Text>
      <TextInput
        keyboardType="decimal-pad"
        inputMode="decimal"
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        value={lngText}
        onChangeText={(t) => setLngText(t)}
        placeholder="-73.5280"
      />
      {/* ================================================================================================ 👆👆👆 */}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
        <Switch value={!!watch('isDefault')} onValueChange={(v) => setValue('isDefault', v)} />
        <Text>Predeterminada</Text>
      </View>

      <Button title="Guardar" onPress={handleSubmit(onSubmit)} />
    </View>
  );
}
