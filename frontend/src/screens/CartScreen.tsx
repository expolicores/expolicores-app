import React from 'react';
import { View, Text, Image, FlatList, Pressable, Alert } from 'react-native';
import { useCart } from '../context/CartContext';


export default function CartScreen() {
const { items, setQty, remove, subtotal, clear } = useCart();


const renderItem = ({ item }: any) => (
<View className="flex-row items-center bg-white rounded-2xl p-3 mb-3 shadow">
{item.imageUrl ? (
<Image source={{ uri: item.imageUrl }} className="w-16 h-16 rounded-xl mr-3" />
) : null}
<View className="flex-1">
<Text className="font-semibold" numberOfLines={1}>{item.name}</Text>
<Text className="text-emerald-700 font-bold mt-1">${(item.price * item.qty).toLocaleString('es-CO')}</Text>
<View className="flex-row items-center mt-2">
<Pressable onPress={() => setQty(item.productId, Math.max(1, item.qty - 1))} className="bg-slate-200 px-3 py-1 rounded-xl mr-2"><Text>-</Text></Pressable>
<Text className="mx-1 font-semibold">{item.qty}</Text>
<Pressable onPress={() => setQty(item.productId, Math.min(item.qty + 1, item.stock))} className="bg-slate-200 px-3 py-1 rounded-xl ml-2"><Text>+</Text></Pressable>
</View>
</View>
<Pressable onPress={() => remove(item.productId)} className="ml-3"><Text className="text-red-500">Eliminar</Text></Pressable>
</View>
);


if (items.length === 0) {
return (
<View className="flex-1 items-center justify-center p-6">
<Text className="text-slate-600">Tu carrito está vacío</Text>
</View>
);
}


return (
<View className="flex-1 p-4">
<FlatList data={items} keyExtractor={(it) => String(it.productId)} renderItem={renderItem} />


<View className="bg-white rounded-2xl p-4 shadow mt-2">
<View className="flex-row justify-between mb-2">
<Text className="text-slate-600">Subtotal</Text>
<Text className="font-bold">${subtotal.toLocaleString('es-CO')}</Text>
</View>
<Text className="text-slate-500 text-xs">* El envío se calcula en el checkout.</Text>


<Pressable
onPress={() => Alert.alert('Checkout', 'El checkout se habilitará en el próximo módulo (US09).')}
className="bg-emerald-600 rounded-2xl py-3 mt-3"
>
<Text className="text-white text-center font-semibold">Continuar</Text>
</Pressable>


<Pressable onPress={() => clear()} className="rounded-2xl py-3 mt-2 border border-slate-300">
<Text className="text-center text-slate-600">Vaciar carrito</Text>
</Pressable>
</View>
</View>
);
}