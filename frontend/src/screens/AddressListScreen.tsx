import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, Button, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listAddresses, updateAddress, deleteAddress } from '../lib/api.addresses';
import type { Address } from '../types/address';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelectedAddress } from '../hooks/useSelectedAddress';

export default function AddressListScreen({ navigation }: any) {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const { selectedAddress, setSelectedAddress } = useSelectedAddress(items);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAddresses();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Mis direcciones',
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('AddressForm')}>
          <Text style={{ fontSize: 16, color: '#2563eb', fontWeight: '600' }}>Agregar</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleSelect = useCallback(
    (addr: Address) => {
      setSelectedAddress(addr);
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
    [navigation, setSelectedAddress],
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Button title="Agregar dirección" onPress={() => navigation.navigate('AddressForm')} />

        <FlatList
          style={{ marginTop: 12 }}
          refreshing={loading}
          onRefresh={load}
          data={items}
          keyExtractor={(a) => String(a.id)}
          renderItem={({ item }) => {
            const isSelected = selectedAddress?.id === item.id;
            return (
              <Pressable
                onPress={() => handleSelect(item)}
                style={({ pressed }) => [
                  {
                    padding: 14,
                    borderWidth: 1,
                    borderColor: isSelected ? '#16a34a' : '#e5e7eb',
                    borderRadius: 14,
                    marginBottom: 12,
                    backgroundColor: '#fff',
                    shadowColor: '#000',
                    shadowOpacity: pressed ? 0.16 : 0.08,
                    shadowRadius: pressed ? 6 : 4,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: pressed ? 3 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827', flex: 1 }}>
                    {item.label || 'Sin nombre'}
                  </Text>
                  {item.isDefault ? (
                    <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '600', marginRight: 8 }}>
                      Predeterminada
                    </Text>
                  ) : null}
                  {isSelected ? <Ionicons name="checkmark-circle" size={20} color="#16a34a" /> : null}
                </View>

                <Text style={{ color: '#374151', fontSize: 13 }}>
                  {item.recipient} · {item.phone}
                </Text>
                <Text style={{ color: '#374151', fontSize: 13, marginTop: 2 }}>
                  {item.line1}
                  {item.line2 ? `, ${item.line2}` : ''}
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 18 }}>
                  <TouchableOpacity onPress={() => navigation.navigate('AddressForm', { address: item })}>
                    <Text style={{ color: '#2563eb', fontWeight: '600' }}>Editar</Text>
                  </TouchableOpacity>

                  {!item.isDefault && (
                    <TouchableOpacity
                      onPress={async () => {
                        await updateAddress(item.id, { isDefault: true });
                        await load();
                      }}
                    >
                      <Text style={{ color: '#16a34a', fontWeight: '600' }}>Hacer predeterminada</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={async () => {
                      await deleteAddress(item.id);
                      await load();
                    }}
                  >
                    <Text style={{ color: '#dc2626', fontWeight: '600' }}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}
