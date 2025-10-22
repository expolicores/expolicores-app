// frontend/src/screens/AddressFormScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Switch,
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useForm } from 'react-hook-form';
import type { Address } from '../types/address';
import { createAddress, updateAddress } from '../lib/api.addresses';
import { getGooglePlacesKey } from '../lib/googleKey';
import { useDebounce } from '../lib/useDebounce';
import { validateGeo } from '../lib/api.geo';
import type { NormalizedAddress } from '../types/geo';

type Form = {
  label: string;
  recipient: string;
  phone: string;
  line1: string;      // formattedAddress o texto manual (fallback)
  line2?: string;
  isDefault?: boolean;
  lat?: number | null;
  lng?: number | null;
};

type Suggestion = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

const FEATURE_GEOCODING = process.env.EXPO_PUBLIC_FEATURE_GEOCODING === 'true';

// --- helpers ---
function newSessionToken() {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
const numOrNull = (v: string | undefined) => {
  if (!v) return null;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Mapa Google -> NormalizedAddress
function mapAddressComponents(components: any[]): Partial<NormalizedAddress> {
  const get = (type: string) => {
    const c = components?.find((x: any) => x.types?.includes(type));
    return c?.long_name ?? '';
  };
  const locality = get('locality') || get('administrative_area_level_2');
  return {
    route: get('route') || undefined,
    streetNumber: get('street_number') || undefined,
    sublocality: get('sublocality') || get('sublocality_level_1') || undefined,
    locality: locality || undefined,
    adminArea: get('administrative_area_level_1') || undefined,
    postalCode: get('postal_code') || undefined,
    country: get('country') || undefined,
  };
}

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

  const { register, setValue, handleSubmit, watch, reset } = useForm<Form>({
    defaultValues: initialValues,
    mode: 'onChange',
  });

  const GOOGLE_KEY = getGooglePlacesKey();

  const [latText, setLatText] = useState(address?.lat != null ? String(address.lat) : '');
  const [lngText, setLngText] = useState(address?.lng != null ? String(address.lng) : '');

  // --- Autocomplete state ---
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 350); // respuesta más ágil
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const lastQueryRef = useRef<string>('');

  // --- Cobertura ---
  const [coverage, setCoverage] = useState<{ inCoverage: boolean; distanceKm: number; shippingCost: number } | null>(null);
  const [checkingCoverage, setCheckingCoverage] = useState(false);

  // --- Guard para evitar doble Details ---
  const runningDetailsRef = useRef<string | null>(null);

  // Iniciar sesión al primer tecleo
  useEffect(() => {
    if (!FEATURE_GEOCODING) return;
    if (query.length === 1 && !sessionRef.current) {
      sessionRef.current = newSessionToken();
      setTimeout(() => { sessionRef.current = null; }, 3 * 60 * 1000);
    }
  }, [query]);

  // Autocomplete fetch con cancelación
  useEffect(() => {
    if (!FEATURE_GEOCODING) return;
    const q = debouncedQuery.trim();
    if (!q || q.length < 3) {
      setSuggestions([]);
      setAutoError(null);
      return;
    }
    if (q === lastQueryRef.current) return;

    const controller = new AbortController();
    (async () => {
      try {
        setLoadingAuto(true);
        setAutoError(null);
        lastQueryRef.current = q;

        const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
        url.searchParams.set('input', q);
        url.searchParams.set('key', GOOGLE_KEY);
        url.searchParams.set('components', 'country:CO');
        url.searchParams.set('types', 'address');
        url.searchParams.set('location', `${5.6369},${-73.5280}`);
        url.searchParams.set('radius', '30000');
        if (!sessionRef.current) sessionRef.current = newSessionToken();
        url.searchParams.set('sessiontoken', sessionRef.current);

        const res = await fetch(url.toString(), { signal: controller.signal });
        const json = await res.json();

        if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
          throw new Error(json.error_message || json.status);
        }
        setSuggestions(json.predictions ?? []);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setAutoError(err?.message || 'No se pudo autocompletar');
        setSuggestions([]);
      } finally {
        setLoadingAuto(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedQuery, GOOGLE_KEY]);

  // Register fields
  useEffect(() => {
    register('label'); register('recipient'); register('phone');
    register('line1'); register('line2');
    register('isDefault'); register('lat'); register('lng');
  }, [register]);

  // Reset al editar existente
  useEffect(() => {
    reset(initialValues, { keepDirty: false });
    setLatText(initialValues.lat != null ? String(initialValues.lat) : '');
    setLngText(initialValues.lng != null ? String(initialValues.lng) : '');
  }, [initialValues, reset]);

  const handlePickSuggestion = async (s: Suggestion) => {
    if (runningDetailsRef.current === s.place_id) return;
    runningDetailsRef.current = s.place_id;

    try {
      Keyboard.dismiss(); // cierra teclado al elegir
      setDetailsLoading(true);
      const placeId = s.place_id;

      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('fields', 'address_component,geometry,formatted_address,place_id,plus_code');
      url.searchParams.set('key', GOOGLE_KEY);
      if (!sessionRef.current) sessionRef.current = newSessionToken();
      url.searchParams.set('sessiontoken', sessionRef.current);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.status !== 'OK') throw new Error(json.error_message || json.status);

      const { geometry, formatted_address, address_components, plus_code } = json.result;
      const lat = geometry?.location?.lat;
      const lng = geometry?.location?.lng;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        throw new Error('Coordenadas no disponibles para esta dirección');
      }

      // Guardar en form + inputs visibles
      setValue('line1', formatted_address || s.description);
      setLatText(String(lat));
      setLngText(String(lng));
      setValue('lat', lat);
      setValue('lng', lng);

      // Normalización para backend
      const norm: NormalizedAddress = {
        placeId,
        formattedAddress: formatted_address,
        lat, lng,
        ...mapAddressComponents(address_components || []),
        plusCode: plus_code?.global_code || plus_code?.compound_code,
      };

      // Validar cobertura
      try {
        setCheckingCoverage(true);
        const resp = await validateGeo({ lat, lng, normalizedAddress: norm });
        setCoverage({ inCoverage: resp.inCoverage, distanceKm: resp.distanceKm, shippingCost: resp.shippingCost });
      } finally {
        setCheckingCoverage(false);
      }

      // Fin de sesión de Places
      sessionRef.current = null;
      setSuggestions([]);
      setQuery(formatted_address || s.description);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        Alert.alert('Error', err?.message ?? 'No se pudo obtener detalles del lugar.');
      }
    } finally {
      runningDetailsRef.current = null;
      setDetailsLoading(false);
    }
  };

  const onSubmit = async (data: Form) => {
    if (!data.label || !data.recipient || !data.phone || !data.line1) {
      Alert.alert('Campos requeridos', 'Completa etiqueta, destinatario, teléfono y dirección.');
      return;
    }

    const lat = numOrNull(latText);
    const lng = numOrNull(lngText);

    if (FEATURE_GEOCODING) {
      if (lat == null || lng == null) {
        Alert.alert('Selecciona una dirección', 'Elige una sugerencia para capturar lat/lng.');
        return;
      }
      if (coverage && !coverage.inCoverage) {
        Alert.alert('Fuera de cobertura', 'Cambia la dirección para continuar.');
        return;
      }
    }

    const payload: Address = {
      ...data,
      line2: data.line2 || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    } as Address;

    try {
      if (address?.id) {
        await updateAddress(address.id, payload);
      } else {
        await createAddress(payload);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.code ?? 'No se pudo guardar la dirección.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1, padding: 16 }}>
          <Text>Etiqueta</Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
            onChangeText={(t) => setValue('label', t)}
            value={watch('label')}
            placeholder="Casa / Hotel / Trabajo"
            returnKeyType="next"
          />

          <Text>Destinatario</Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
            onChangeText={(t) => setValue('recipient', t)}
            value={watch('recipient')}
            placeholder="A nombre de"
            returnKeyType="next"
          />

          {/* DIRECCIÓN PRIMERO */}
          <Text>Dirección</Text>
          {FEATURE_GEOCODING ? (
            <>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
                onChangeText={(t) => {
                  setQuery(t);
                  setValue('line1', t);
                  // Si el usuario edita, limpiamos coords & cobertura
                  setLatText('');
                  setLngText('');
                  setValue('lat', null);
                  setValue('lng', null);
                  setCoverage(null);
                }}
                value={query}
                placeholder="Escribe tu dirección (CO)..."
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                // no hacemos blur aquí (queremos ver sugerencias mientras escribe)
              />

              {loadingAuto && <ActivityIndicator style={{ marginVertical: 6 }} />}

              {autoError ? (
                <Text style={{ color: 'tomato' }}>
                  {autoError} — usando modo manual (puedes escribir la dirección completa).
                </Text>
              ) : null}

              <View style={{ maxHeight: 280, marginBottom: 8, zIndex: 10 }}>
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => item.place_id}
                  keyboardShouldPersistTaps="always"
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handlePickSuggestion(item)}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#eee',
                        backgroundColor: 'white',
                      }}
                    >
                      <Text style={{ fontWeight: '600' }}>
                        {item.structured_formatting?.main_text ?? item.description}
                      </Text>
                      <Text style={{ color: '#666' }}>
                        {item.structured_formatting?.secondary_text ?? ''}
                      </Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    debouncedQuery && !loadingAuto ? (
                      <Text style={{ color: '#888', paddingVertical: 6 }}>Sin resultados</Text>
                    ) : null
                  }
                  style={{
                    borderWidth: suggestions.length ? 1 : 0,
                    borderColor: '#eee',
                    borderRadius: 8,
                    backgroundColor: 'white',
                    shadowColor: '#000',
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: suggestions.length ? 2 : 0,
                  }}
                />
              </View>

              {/* Badge de cobertura */}
              <View
                style={{
                  padding: 10, borderRadius: 8, marginTop: 8,
                  backgroundColor: coverage?.inCoverage ? '#e6ffed' : '#ffecec',
                  borderWidth: 1, borderColor: coverage?.inCoverage ? '#34c759' : '#ff3b30',
                }}
              >
                {checkingCoverage ? (
                  <Text>Validando cobertura…</Text>
                ) : coverage ? (
                  <Text>
                    {coverage.inCoverage
                      ? `Dentro de cobertura · ${coverage.distanceKm.toFixed(1)} km · Envío estimado ${coverage.shippingCost.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`
                      : `Fuera de cobertura · ${coverage.distanceKm.toFixed(1)} km`}
                  </Text>
                ) : (
                  <Text>Selecciona una sugerencia para validar cobertura</Text>
                )}
              </View>
            </>
          ) : (
            <>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
                onChangeText={(t) => setValue('line1', t)}
                value={watch('line1')}
                placeholder="Cra/Cll # No"
                returnKeyType="next"
              />
            </>
          )}

          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 8 }}
            onChangeText={(t) => setValue('line2', t)}
            value={watch('line2') ?? ''}
            placeholder="Apto/Habitación (opcional)"
            returnKeyType="next"
          />

          {/* Teléfono después de Dirección */}
          <Text>Teléfono</Text>
          <TextInput
            keyboardType="phone-pad"
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}
            onChangeText={(t) => setValue('phone', t)}
            value={watch('phone')}
            placeholder="310..."
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />

          {/* Lat/Lng */}
          <Text>Latitud {FEATURE_GEOCODING ? '(auto)' : '(DEV)'}</Text>
          <TextInput
            editable={!FEATURE_GEOCODING}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 8,
              padding: 10,
              backgroundColor: FEATURE_GEOCODING ? '#fafafa' : 'white',
            }}
            value={latText}
            onChangeText={(t) => setLatText(t)}
            placeholder="5.6369"
          />

          <Text>Longitud {FEATURE_GEOCODING ? '(auto)' : '(DEV)'}</Text>
          <TextInput
            editable={!FEATURE_GEOCODING}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 8,
              padding: 10,
              backgroundColor: FEATURE_GEOCODING ? '#fafafa' : 'white',
            }}
            value={lngText}
            onChangeText={(t) => setLngText(t)}
            placeholder="-73.5280"
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
            <Switch value={!!watch('isDefault')} onValueChange={(v) => setValue('isDefault', v)} />
            <Text>Predeterminada</Text>
          </View>

          <Button
            title={detailsLoading ? 'Validando...' : 'Guardar'}
            onPress={handleSubmit(onSubmit)}
            disabled={detailsLoading}
          />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
