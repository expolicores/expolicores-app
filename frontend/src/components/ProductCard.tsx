import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Product } from '../types/product';


export default function ProductCard({ product, onAdd }: { product: Product; onAdd?: () => void }) {
return (
<View style={{ flexDirection: 'row', gap: 12, paddingVertical: 10 }}>
<Image source={{ uri: product.imageUrl ?? 'https://picsum.photos/80' }} style={{ width: 80, height: 80, borderRadius: 8 }} />
<View style={{ flex: 1 }}>
<Text style={{ fontWeight: '600' }}>{product.name}</Text>
<Text>${product.price.toLocaleString('es-CO')}</Text>
<TouchableOpacity onPress={onAdd} style={{ marginTop: 6, backgroundColor: '#111', padding: 8, borderRadius: 8 }}>
<Text style={{ color: 'white', textAlign: 'center' }}>Agregar</Text>
</TouchableOpacity>
</View>
</View>
);
}