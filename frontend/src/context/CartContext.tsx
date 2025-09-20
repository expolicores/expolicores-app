import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';


export type CartItem = {
productId: number;
name: string;
price: number; // COP (int)
imageUrl?: string | null;
qty: number; // >= 1
stock: number; // validación UI
category?: string | null;
};


export type CartState = {
items: CartItem[];
add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
remove: (productId: number) => void;
setQty: (productId: number, qty: number) => void;
clear: () => void;
count: number; // total de unidades
subtotal: number; // sum(price*qty)
};


const STORAGE_KEY = '@expolicores/cart:v1';


const CartCtx = createContext<CartState | null>(null);


export function CartProvider({ children }: { children: ReactNode }) {
const [items, setItems] = useState<CartItem[]>([]);


// Hydration inicial desde AsyncStorage
useEffect(() => {
(async () => {
try {
const raw = await AsyncStorage.getItem(STORAGE_KEY);
if (raw) setItems(JSON.parse(raw));
} catch {}
})();
}, []);


// Persistencia automática
useEffect(() => {
AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
}, [items]);


const add: CartState['add'] = (item, qty = 1) => {
setItems(prev => {
const i = prev.findIndex(p => p.productId === item.productId);
if (i >= 0) {
const merged = [...prev];
const nextQty = Math.min(merged[i].qty + qty, merged[i].stock);
merged[i] = { ...merged[i], qty: nextQty };
return merged;
}
return [...prev, { ...item, qty: Math.min(qty, item.stock) }];
});
};


const remove: CartState['remove'] = (productId) =>
setItems(prev => prev.filter(p => p.productId !== productId));


const setQty: CartState['setQty'] = (productId, qty) =>
setItems(prev => prev.map(p => p.productId === productId
? { ...p, qty: Math.min(Math.max(qty, 1), p.stock) }
: p
));


const clear: CartState['clear'] = () => setItems([]);


const subtotal = useMemo(() => items.reduce((s, it) => s + it.price * it.qty, 0), [items]);
const count = useMemo(() => items.reduce((s, it) => s + it.qty, 0), [items]);


const value: CartState = { items, add, remove, setQty, clear, subtotal, count };


return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}


export function useCart(): CartState {
const ctx = useContext(CartCtx);
if (!ctx) throw new Error('useCart must be used within CartProvider');
return ctx;
}