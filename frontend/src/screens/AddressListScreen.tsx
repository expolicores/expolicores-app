import React from 'react';
import { View, Text, FlatList, Button, TouchableOpacity } from 'react-native';
import { listAddresses, updateAddress, deleteAddress } from '../lib/api.addresses';
import { Address } from '../types/address';

export default function AddressListScreen({ navigation }: any) {
  const [items, setItems] = React.useState<Address[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try { setItems(await listAddresses()); } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { const unsub = navigation.addListener('focus', load); return unsub; }, [navigation, load]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Button title="Agregar dirección" onPress={() => navigation.navigate('Nueva dirección')} />
      <FlatList
        style={{ marginTop: 12 }}
        refreshing={loading}
        onRefresh={load}
        data={items}
        keyExtractor={(a) => String(a.id)}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 10 }}>
            <Text style={{ fontWeight: '600' }}>
              {item.label} {item.isDefault ? '⭐' : ''}
            </Text>
            <Text>{item.recipient} · {item.phone}</Text>
            <Text>{item.line1}{item.line2 ? `, ${item.line2}` : ''}</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {!item.isDefault && (
                <TouchableOpacity onPress={async () => { await updateAddress(item.id, { isDefault: true }); await load(); }}>
                  <Text style={{ color: '#2d7' }}>Hacer predeterminada</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={async () => { await deleteAddress(item.id); await load(); }}>
                <Text style={{ color: '#c33' }}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}
