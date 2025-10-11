import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Button, Switch, Alert } from 'react-native';
import { useForm } from 'react-hook-form';
import { createAddress, updateAddress } from '../lib/api.addresses';
import type { Address } from '../types/address';

type Form = {
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string;
  isDefault?: boolean;
  lat?: number | null;
  lng?: number | null;
};

const numOrNull = (v: string | undefined) => {
  if (!v) return null;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export default function AddressFormScreen({ navigation, route }: any) {
  const address: Address | null = route?.params?.address ?? null;

  const initialValues = useMemo<Form>(() => ({
    label: address?.label ?? '',
    recipient: address?.recipient ?? '',
    phone: address?.phone ?? '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    isDefault: address?.isDefault ?? true,
    lat: address?.lat ?? null,
    lng: address?.lng ?? null,
  }), [address]);

  const {
    register,
    setValue,
    handleSubmit,
    watch,
    reset,
  } = useForm<Form>({
    defaultValues: initialValues,
    mode: 'onChange',
  });

  const [latText, setLatText] = useState(address?.lat != null ? String(address.lat) : '');
  const [lngText, setLngText] = useState(address?.lng != null ? String(address.lng) : '');

  useEffect(() => {
    register('label');
    register('recipient');
    register('phone');
    register('line1');
    register('line2');
    register('isDefault');
    register('lat');
    register('lng');
  }, [register]);

  useEffect(() => {
    reset(initialValues, { keepDirty: false });
    setLatText(initialValues.lat != null ? String(initialValues.lat) : '');
    setLngText(initialValues.lng != null ? String(initialValues.lng) : '');
  }, [initialValues, reset]);

  const onSubmit = async (data: Form) => {
    if (!data.label || !data.recipient || !data.phone || !data.line1) {
      Alert.alert('Campos requeridos', 'Completa etiqueta, destinatario, telefono y direccion.');
      return;
    }

    const lat = numOrNull(latText);
    const lng = numOrNull(lngText);

    if (lat == null || lng == null) {
      Alert.alert('Coordenadas faltantes', 'Ingresa latitud y longitud para validar cobertura.');
      return;
    }

    const payload: Address = {
      ...data,
      line2: data.line2 || undefined,
      lat,
      lng,
    } as Address;

    try {
      if (address?.id) {
        await updateAddress(address.id, payload);
      } else {
        await createAddress(payload);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.code ?? 'No se pudo guardar la direccion.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text>Etiqueta</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('label', t)}
        value={watch('label')}
        placeholder="Casa / Hotel / Trabajo"
      />

      <Text>Destinatario</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('recipient', t)}
        value={watch('recipient')}
        placeholder="A nombre de"
      />

      <Text>Telefono</Text>
      <TextInput
        keyboardType="phone-pad"
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('phone', t)}
        value={watch('phone')}
        placeholder="310..."
      />

      <Text>Direccion</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('line1', t)}
        value={watch('line1')}
        placeholder="Cra/Cll # No"
      />
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
        onChangeText={(t) => setValue('line2', t)}
        value={watch('line2') ?? ''}
        placeholder="Apto/Habitacion (opcional)"
      />

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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
        <Switch value={!!watch('isDefault')} onValueChange={(v) => setValue('isDefault', v)} />
        <Text>Predeterminada</Text>
      </View>

      <Button title="Guardar" onPress={handleSubmit(onSubmit)} />
    </View>
  );
}
