// src/context/CartContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== Tipos =====
export type CartItem = {
  productId: number;
  name: string;
  price: number;          // COP (int)
  imageUrl?: string | null;
  qty: number;            // >= 1
  stock: number;          // límite por ítem (UI y lógica)
  category?: string | null;
};

export type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  remove: (productId: number) => void;
  setQty: (productId: number, qty: number) => void; // qty <= 0 elimina
  clear: () => void;
  count: number;    // total de unidades
  subtotal: number; // sum(price*qty)
};

const STORAGE_KEY = '@expolicores/cart:v1';
const BIG_STOCK = 999_999; // stock virtual cuando no llega desde backend

// ===== Utils internas =====
function normalizeStock(input?: number | null): number {
  // null/undefined/NaN => BIG_STOCK
  return Number.isFinite(input as number) && (input as number) >= 0
    ? (input as number)
    : BIG_STOCK;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

// ===== Contexto =====
const CartCtx = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Hydration inicial
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setItems(JSON.parse(raw));
      } catch {
        // noop
      }
    })();
  }, []);

  // Persistencia automática
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items]);

  // ===== Acciones =====
  const add: CartState['add'] = (item, qty = 1) => {
    const incomingStock = normalizeStock(item.stock as number | undefined);
    const inc = Math.max(1, Math.floor(qty)); // mínimo 1 al agregar

    setItems(prev => {
      const idx = prev.findIndex(p => p.productId === item.productId);
      if (idx >= 0) {
        const next = [...prev];
        // si llega nuevo stock lo actualizamos; si no, mantenemos el existente
        const lineStock = normalizeStock(item.stock ?? next[idx].stock);
        const newQty = clamp(next[idx].qty + inc, 1, lineStock);
        next[idx] = { ...next[idx], qty: newQty, stock: lineStock };
        return next;
      }
      // línea nueva
      return [
        ...prev,
        {
          productId: item.productId,
          name: item.name,
          price: item.price,
          imageUrl: item.imageUrl ?? null,
          category: item.category ?? null,
          stock: incomingStock,
          qty: clamp(inc, 1, incomingStock),
        },
      ];
    });
  };

  const remove: CartState['remove'] = (productId) =>
    setItems(prev => prev.filter(p => p.productId !== productId));

  const setQty: CartState['setQty'] = (productId, qty) =>
    setItems(prev => {
      const i = prev.findIndex(p => p.productId === productId);
      if (i < 0) return prev;

      // qty <= 0 elimina la línea
      if (!Number.isFinite(qty) || qty <= 0) {
        return prev.filter(p => p.productId !== productId);
      }

      const next = [...prev];
      const lineStock = normalizeStock(next[i].stock);
      const newQty = clamp(Math.floor(qty), 1, lineStock);
      next[i] = { ...next[i], qty: newQty, stock: lineStock };
      return next;
    });

  const clear: CartState['clear'] = () => setItems([]);

  // Derivados
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.price * it.qty, 0),
    [items],
  );
  const count = useMemo(
    () => items.reduce((s, it) => s + it.qty, 0),
    [items],
  );

  const value: CartState = { items, add, remove, setQty, clear, subtotal, count };

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
