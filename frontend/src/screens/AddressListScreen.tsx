import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, Button, TouchableOpacity } from 'react-native';
import { listAddresses, updateAddress, deleteAddress } from '../lib/api.addresses';
import type { Address } from '../types/address';

export default function AddressListScreen({ navigation }: any) {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAddresses();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refrescar cuando la pantalla toma foco
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  // Botón "Agregar" en el header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Mis direcciones',
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('AddressForm')}>
          <Text style={{ fontSize: 16, color: '#2563eb' }}>Agregar</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Botón dentro del cuerpo (opcional; puedes quitarlo si te basta el del header) */}
      <Button title="Agregar dirección" onPress={() => navigation.navigate('AddressForm')} />

      <FlatList
        style={{ marginTop: 12 }}
        refreshing={loading}
        onRefresh={load}
        data={items}
        keyExtractor={(a) => String(a.id)}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: '#eee',
              borderRadius: 8,
              marginBottom: 10,
              backgroundColor: '#fff',
            }}
          >
            <Text style={{ fontWeight: '600', marginBottom: 2 }}>
              {item.label} {item.isDefault ? '⭐' : ''}
            </Text>
            <Text style={{ color: '#374151' }}>
              {item.recipient} · {item.phone}
            </Text>
            <Text style={{ color: '#374151' }}>
              {item.line1}
              {item.line2 ? `, ${item.line2}` : ''}
            </Text>

            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              {/* Editar */}
              <TouchableOpacity
                onPress={() => navigation.navigate('AddressForm', { addressId: item.id })}
                style={{ marginRight: 16 }}
              >
                <Text style={{ color: '#2563eb' }}>Editar</Text>
              </TouchableOpacity>

              {/* Predeterminada */}
              {!item.isDefault && (
                <TouchableOpacity
                  onPress={async () => {
                    await updateAddress(item.id, { isDefault: true });
                    await load();
                  }}
                  style={{ marginRight: 16 }}
                >
                  <Text style={{ color: '#16a34a' }}>Hacer predeterminada</Text>
                </TouchableOpacity>
              )}

              {/* Eliminar */}
              <TouchableOpacity
                onPress={async () => {
                  await deleteAddress(item.id);
                  await load();
                }}
              >
                <Text style={{ color: '#dc2626' }}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}
