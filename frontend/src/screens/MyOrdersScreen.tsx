import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function MyOrdersScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => (await api.get('/orders/my')).data as Array<{
      id:number; total:number; status:string; createdAt:string;
      items: { quantity:number; product:{ name:string } }[];
    }>,
  });

  if (isLoading) return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Cargando…</Text></View>;
  if (error) return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Error al cargar</Text></View>;
  if (!data?.length) return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Sin pedidos</Text></View>;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={data}
      keyExtractor={(o) => String(o.id)}
      renderItem={({ item }) => (
        <View style={{ backgroundColor:'#fff', padding:14, borderRadius:12, marginBottom:10 }}>
          <Text style={{ fontWeight:'700' }}>Orden #{item.id} • {item.status}</Text>
          <Text style={{ color:'#6b7280', marginTop:4 }}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
          <Text style={{ marginTop:6 }}>
            {item.items.map(i => `${i.product.name} × ${i.quantity}`).join(', ')}
          </Text>
          <Text style={{ marginTop:8, fontWeight:'700' }}>
            {new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(item.total)}
          </Text>
        </View>
      )}
    />
  );
}
