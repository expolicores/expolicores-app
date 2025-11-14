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
  Pressable,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { useForm } from 'react-hook-form';
import type { Address } from '../types/address';
import { createAddress, updateAddress } from '../lib/api.addresses';
import { STORE, DEFAULT_RADIUS_M } from '../config/geo';
import { getGooglePlacesKey } from '../lib/googleKey';
import { useDebounce } from '../lib/useDebounce';
import { validateGeo } from '../lib/api.geo';
import { rankVillaLeyvaFirst } from '../lib/placesRank';
import { getUserBiasOrNull } from '../services/locationBias';
import type { NormalizedAddress } from '../types/geo';

type Form = {
  label: string;
  recipient: string;
  phone: string;
  line1: string;      // formattedAddress o texto manual (fallback)
  line2?: string;     // se construye con detalles adicionales + apt/habitación
  isDefault?: boolean;
  lat?: number | null;
  lng?: number | null;

  // NUEVOS en UI (no existen en backend; se consolidan en line2 al guardar)
  additionalDetails?: string; // "Junto al Hotel Puente Piedra"
  aptRoom?: string;          // Apto/Habitación (antes line2 directo)
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

// ===== helpers =====
function newSessionToken() {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
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
    // line2 existente la separamos en 2 por si venía con texto
    additionalDetails: '',
    aptRoom: '',
    isDefault: address?.isDefault ?? true,
    lat: address?.lat ?? null,
    lng: address?.lng ?? null,
  }), [address]);

  const { register, setValue, handleSubmit, watch, reset } = useForm<Form>({
    defaultValues: initialValues,
    mode: 'onChange',
  });

  const GOOGLE_KEY = getGooglePlacesKey();

  // --- Bias (sesgo) ---
  const [bias, setBias] = useState<{ lat: number; lng: number } | null>(null); // null = tienda
  useEffect(() => {
    // preparado para permisos futuros; hoy siempre null (usa tienda)
    getUserBiasOrNull().then(setBias).catch(() => setBias(null));
  }, []);

  // --- Autocomplete state ---
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 350);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const lastQueryRef = useRef<string>('');
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(false);
  const [autocompleteEnabled, setAutocompleteEnabled] = useState(false);

  // Abort de autocomplete en curso (para botón X y limpiezas)
  const autoAbortRef = useRef<AbortController | null>(null);

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

  // ===== helper para construir URL segun tipo =====
  const buildAutocompleteUrl = (q: string, type: 'address' | 'establishment') => {
    const center = bias ?? STORE;
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', q);
    url.searchParams.set('key', GOOGLE_KEY);
    url.searchParams.set('components', 'country:CO');
    url.searchParams.set('types', type);
    url.searchParams.set('location', `${center.lat},${center.lng}`);
    url.searchParams.set('radius', String(DEFAULT_RADIUS_M));
    if (!sessionRef.current) sessionRef.current = newSessionToken();
    url.searchParams.set('sessiontoken', sessionRef.current);
    return url.toString();
  };

  // Autocomplete fetch (address + establishment) con cancelación, merge y ranking
  useEffect(() => {
    if (!FEATURE_GEOCODING || !autocompleteEnabled) return;
    const q = debouncedQuery.trim();
    if (!q || q.length < 3) {
      // limpiar sin disparar request
      autoAbortRef.current?.abort();
      setSuggestions([]);
      setAutoError(null);
      return;
    }
    if (q === lastQueryRef.current) return;

    const controller = new AbortController();
    autoAbortRef.current = controller;

    (async () => {
      try {
        setLoadingAuto(true);
        setAutoError(null);
        lastQueryRef.current = q;

        const [addrRes, estRes] = await Promise.all([
          fetch(buildAutocompleteUrl(q, 'address'), { signal: controller.signal }),
          fetch(buildAutocompleteUrl(q, 'establishment'), { signal: controller.signal }),
        ]);

        const addrJson = await addrRes.json();
        const estJson = await estRes.json();

        const ok = (js: any) => js.status === 'OK' || js.status === 'ZERO_RESULTS';
        if (!ok(addrJson) || !ok(estJson)) {
          throw new Error(addrJson.error_message || estJson.error_message || 'Autocomplete error');
        }

        // Merge + dedupe por place_id
        const merged: Suggestion[] = [
          ...(addrJson.predictions ?? []),
          ...(estJson.predictions ?? []),
        ];
        const seen = new Set<string>();
        const dedup = merged.filter(p => (seen.has(p.place_id) ? false : (seen.add(p.place_id), true)));

        const ranked = rankVillaLeyvaFirst(dedup);
        setSuggestions(ranked);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setAutoError(err?.message || 'No se pudo autocompletar');
        setSuggestions([]);
      } finally {
        setLoadingAuto(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedQuery, GOOGLE_KEY, bias, autocompleteEnabled]);

  // Register fields
  useEffect(() => {
    register('label'); register('recipient'); register('phone');
    register('line1'); register('line2');
    register('isDefault'); register('lat'); register('lng');
    register('additionalDetails'); register('aptRoom');
  }, [register]);

  // Reset al editar existente
  useEffect(() => {
    reset(initialValues, { keepDirty: false });
    // precargar query desde line1 cuando se edita
    const preset = address?.line1 ?? '';
    setQuery(preset);
    setHasSelectedSuggestion(!!preset);
    setAutocompleteEnabled(false);
  }, [initialValues, reset, address?.line1]);

  const handlePickSuggestion = async (s: Suggestion) => {
    if (runningDetailsRef.current === s.place_id) return;
    runningDetailsRef.current = s.place_id;

    try {
      autoAbortRef.current?.abort(); // detiene autocomplete en curso
      autoAbortRef.current = null;
      setHasSelectedSuggestion(true);
      setAutocompleteEnabled(false);
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

      // 1) Mostrar la direccion elegida inmediatamente en el input
      const displayAddress = formatted_address || s.description;
      lastQueryRef.current = displayAddress; // evita re-consulta inmediata
      setQuery(displayAddress);
      setValue('line1', displayAddress);
      setSuggestions([]);

      // 2) Guardar coords en form
      setValue('lat', lat);
      setValue('lng', lng);

      // Normalización para backend (si se envía en validate)
      const norm: NormalizedAddress = {
        placeId,
        formattedAddress: formatted_address,
        lat, lng,
        ...mapAddressComponents(address_components || []),
        plusCode: plus_code?.global_code || plus_code?.compound_code,
      };

      // 3) Validar cobertura (badge)
      try {
        setCheckingCoverage(true);
        const resp = await validateGeo({ lat, lng, normalizedAddress: norm });
        setCoverage({ inCoverage: resp.inCoverage, distanceKm: resp.distanceKm, shippingCost: resp.shippingCost });
      } finally {
        setCheckingCoverage(false);
      }

      // Fin de sesión de Places
      sessionRef.current = null;
    } catch (err: any) {
      const hasQuery = query.trim().length > 0;
      if (err.name === 'AbortError') {
        setHasSelectedSuggestion(false);
        setAutocompleteEnabled(hasQuery);
      } else {
        setHasSelectedSuggestion(false);
        setAutocompleteEnabled(hasQuery);
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

    const lat = data.lat ?? null;
    const lng = data.lng ?? null;

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

    // Consolidar Detalles Adicionales + Apto/Habitación en line2
    const line2Composed = [data.additionalDetails?.trim(), data.aptRoom?.trim()]
      .filter(Boolean)
      .join(' - ') || undefined;

    const { additionalDetails, aptRoom, ...rest } = data;

    const payload: Address = {
      ...rest,
      line2: line2Composed ?? rest.line2,
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

  // Acción limpiar campo (botón X)
  const clearAddressField = () => {
    autoAbortRef.current?.abort();
    setQuery('');
    setSuggestions([]);
    setCoverage(null);
    setValue('line1', '');
    setValue('lat', null);
    setValue('lng', null);
    setHasSelectedSuggestion(false);
    setAutocompleteEnabled(false);
    lastQueryRef.current = '';
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
              {/* contenedor para overlay del botón X */}
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, paddingRight: 36 }}
                  onChangeText={(t) => {
                    setQuery(t);
                    setValue('line1', t);
                    setHasSelectedSuggestion(false);
                    setAutocompleteEnabled(t.trim().length > 0);
                    if (t.trim().length === 0) {
                      lastQueryRef.current = '';
                    } else if (hasSelectedSuggestion) {
                      lastQueryRef.current = '';
                    }
                    // Si el usuario edita, limpiamos coords & cobertura
                    setValue('lat', null);
                    setValue('lng', null);
                    setCoverage(null);
                    if (!t.trim()) {
                      // cancelar solicitudes en curso
                      autoAbortRef.current?.abort();
                      setSuggestions([]);
                    }
                  }}
                  value={query}
                  placeholder="Escribe tu dirección (CO)..."
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  // iOS nativo
                  clearButtonMode="never"
                />
                {/* Botón X (iOS/Android) */}
                {query.length > 0 && (
                  <Pressable
                    onPress={clearAddressField}
                    hitSlop={8}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      height: 28,
                      width: 28,
                      borderRadius: 14,
                      backgroundColor: '#eee',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>✕</Text>
                  </Pressable>
                )}
              </View>

              {loadingAuto && <ActivityIndicator style={{ marginVertical: 6 }} />}

              {autoError ? (
                <Text style={{ color: 'tomato' }}>
                  {autoError} — usando modo manual (puedes escribir la dirección completa).
                </Text>
              ) : null}

              {(!hasSelectedSuggestion || suggestions.length > 0) && (
                <View style={{ maxHeight: 280, marginBottom: 8, zIndex: 10 }}>
                  <ScrollView
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled
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
                  >
                    {suggestions.length > 0 ? (
                      suggestions.map((item) => (
                        <Pressable
                          key={item.place_id}
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
                      ))
                    ) : !hasSelectedSuggestion && debouncedQuery && !loadingAuto ? (
                      <Text style={{ color: '#888', paddingVertical: 6, paddingHorizontal: 12 }}>Sin resultados</Text>
                    ) : null}
                  </ScrollView>
                </View>
              )}

              {/* NUEVO: Detalles adicionales */}
              <TextInput
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 8 }}
                onChangeText={(t) => setValue('additionalDetails', t)}
                value={watch('additionalDetails') ?? ''}
                placeholder="Detalles adicionales (ej. Junto al Hotel Puente Piedra)"
                multiline
                numberOfLines={2}
              />

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
              <TextInput
                style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 8 }}
                onChangeText={(t) => setValue('additionalDetails', t)}
                value={watch('additionalDetails') ?? ''}
                placeholder="Detalles adicionales (opcional)"
              />
            </>
          )}

          {/* Apto/Habitación (mantenemos este campo) */}
          <TextInput
            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 8 }}
            onChangeText={(t) => setValue('aptRoom', t)}
            value={watch('aptRoom') ?? ''}
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
            <Switch value={!!watch('isDefault')} onValueChange={(v) => setValue('isDefault', v)} />
            <Text>Predeterminada</Text>
          </View>

          <Button
            title={detailsLoading ? 'Validando...' : 'Guardar'}
            onPress={handleSubmit(onSubmit)}
            disabled={detailsLoading}
          />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
