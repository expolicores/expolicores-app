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
import {
  resolveEffectiveFromFeed,
  type FeedSlotItem,
  type PublishedPromoOverlay,
} from '../lib/promotionsOverlay';

/* =====================================================================
 * Tipos
 * ===================================================================== */
export type CartItem = {
  productId: number;        // ID normalizado a number
  name: string;             // siempre presente (override | nombre producto | fallback)
  price: number;            // COP (int) -- unit price efectivo (override > default)
  imageUrl?: string | null;
  qty: number;              // >= 1
  stock: number;            // límite por ítem (UI y lógica)
  category?: string | null;
  // meta opcional para auditoría
  appliedPromotion?: { source: 'overlay' | 'system'; ts: number } | undefined;
};

export type AddItemOpts = {
  priceOverride?: number;
  nameOverride?: string;
  imageOverride?: string;
  stockOverride?: number;
  categoryOverride?: string | null;
  promoSource?: 'overlay' | 'system';
};

export type FeedOpInput = {
  slotItem: FeedSlotItem;
  overlay?: PublishedPromoOverlay | null;
  // opcional para controlar stock desde el feed (p.ej. bundles)
  stockOverride?: number;
  // opcional para categorizar (si el feed la trae)
  categoryOverride?: string | null;
};

export type CartState = {
  items: CartItem[];

  /**
   * Agrega al carrito. Acepta:
   * - add(productDto, qty?, opts?)
   * - add({productId, name, price, ...}, qty?)
   * - add(productIdNumber, qty?, opts?)
   */
  add: (item: any, qty?: number, opts?: AddItemOpts) => void;
  remove: (productId: number) => void;
  setQty: (productId: number, qty: number) => void; // qty <= 0 elimina
  clear: () => void;

  // Derivados
  count: number;    // total de unidades
  subtotal: number; // sum(price*qty)

  // ===== Helpers para Feed =====
  addFromFeed: (input: FeedOpInput) => void;
  decrementFromFeed: (input: FeedOpInput) => void;  // botón "−"
  removeFromFeed: (input: FeedOpInput) => void;     // icono "basurita"
  qtyFromFeed: (input: FeedOpInput) => number;      // para pintar el contador

  // ===== Aliases legacy (compatibilidad con pantallas antiguas) =====
  addItem?: (productIdOrObj: any, deltaQty?: number, opts?: AddItemOpts) => void;
  updateQty?: (productId: number, qty: number) => void;
  removeItem?: (productId: number) => void;
  decrement?: (productId: number) => void;
  lines?: CartItem[]; // alias de items
};

const STORAGE_KEY = '@expolicores/cart:v1';
const BIG_STOCK = 999_999; // stock virtual cuando no llega desde backend

/* =====================================================================
 * Utils internas
 * ===================================================================== */
function normalizeStock(input?: number | null): number {
  return Number.isFinite(input as number) && (input as number) >= 0
    ? (input as number)
    : BIG_STOCK;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

function toNumberId(idLike: any): number | null {
  if (idLike == null) return null;
  const n = Number(idLike);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrae un "precio por defecto" de un DTO de producto heterogéneo.
 * Prioridad:
 *  1) product.price (si ya viene listo)
 *  2) product.priceB2C
 *  3) product.pricePublic
 *  4) product.priceB2B
 *  5) 0
 */
function defaultUnitPriceFromProduct(p: any): number {
  const cands = [p?.price, p?.priceB2C, p?.pricePublic, p?.priceB2B];
  for (const v of cands) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

/**
 * Intenta construir un CartItem base a partir de distintas formas de entrada.
 * NO asigna qty (eso lo maneja add()).
 */
function normalizeIncomingToCartLineBase(
  item: any,
  opts?: AddItemOpts
): Omit<CartItem, 'qty'> {
  // Caso 1: ya es un objeto estilo CartItem (sin qty)
  if (typeof item === 'object' && item && ('productId' in item) && !('qty' in item)) {
    const pid = toNumberId((item as any).productId);
    const priceBase = Number(item.price);
    const nameBase = String(item.name ?? '');
    return {
      productId: pid ?? 0,
      name: nameBase || opts?.nameOverride || `Item ${pid ?? 'N/D'}`,
      price: Number.isFinite(priceBase) ? Math.floor(priceBase) : 0,
      imageUrl: (item.imageUrl ?? item.image ?? null) as any,
      stock: normalizeStock((item as any).stock),
      category: (item as any).category ?? null,
      appliedPromotion: undefined,
    };
  }

  // Caso 2: viene solo el ID
  if (typeof item === 'number' || typeof item === 'string') {
    const pid = toNumberId(item) ?? 0;
    return {
      productId: pid,
      name: opts?.nameOverride || `Item ${pid}`,
      price: Math.floor(Number(opts?.priceOverride ?? 0)),
      imageUrl: (opts?.imageOverride ?? null) as any,
      stock: normalizeStock(opts?.stockOverride),
      category: opts?.categoryOverride ?? null,
      appliedPromotion: undefined,
    };
  }

  // Caso 3: es un DTO de producto del backend
  if (typeof item === 'object' && item) {
    const pid = toNumberId(item.id ?? item.productId) ?? 0;
    const img = item.imageUrl ?? item.image ?? item.thumbnail ?? null;
    const stock = normalizeStock(item.stock);
    const name =
      (opts?.nameOverride && String(opts.nameOverride).trim()) ||
      String(item.name ?? item.title ?? item.label ?? `Item ${pid}`);

    const price = Number.isFinite(opts?.priceOverride as number)
      ? Math.floor(opts!.priceOverride as number)
      : defaultUnitPriceFromProduct(item);

    return {
      productId: pid,
      name,
      price,
      imageUrl: img,
      stock,
      category: item.category ?? item.categoryName ?? null,
      appliedPromotion: undefined,
    };
  }

  // Fallback
  return {
    productId: 0,
    name: opts?.nameOverride || 'Item',
    price: Math.floor(Number(opts?.priceOverride ?? 0)),
    imageUrl: (opts?.imageOverride ?? null) as any,
    stock: normalizeStock(opts?.stockOverride),
    category: opts?.categoryOverride ?? null,
    appliedPromotion: undefined,
  };
}

/* =====================================================================
 * Contexto
 * ===================================================================== */
const CartCtx = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Hydration inicial
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const arr: any[] = Array.isArray(parsed) ? parsed : [];
        // sanea tipos (productId como number, price como int)
        const clean: CartItem[] = arr.map((it: any) => ({
          productId: toNumberId(it?.productId) ?? 0,
          name: String(it?.name ?? `Item ${it?.productId ?? ''}`),
          price: Math.floor(Number(it?.price ?? 0)),
          imageUrl: it?.imageUrl ?? null,
          qty: Math.max(1, Math.floor(Number(it?.qty ?? 1))),
          stock: normalizeStock(it?.stock),
          category: it?.category ?? null,
          appliedPromotion: it?.appliedPromotion,
        }));
        setItems(clean);
      } catch {
        // noop
      }
    })();
  }, []);

  // Persistencia automática
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items]);

  /* ================= Acciones base ================ */
  const add: CartState['add'] = (item: any, qty = 1, opts?: AddItemOpts) => {
    const base = normalizeIncomingToCartLineBase(item, opts);
    const inc = Math.max(1, Math.floor(qty)); // mínimo 1 al agregar

    // Aplica overrides (si vienen) sobre el base
    const unitPrice =
      typeof opts?.priceOverride === 'number'
        ? Math.floor(opts!.priceOverride as number)
        : base.price;

    const name =
      (opts?.nameOverride && String(opts.nameOverride).trim()) ||
      base.name;

    const imageUrl = (opts?.imageOverride ?? base.imageUrl) ?? null;
    const incomingStock = normalizeStock(opts?.stockOverride ?? base.stock);

    const appliedPromotion =
      opts && (opts.priceOverride != null || (opts.nameOverride && opts.nameOverride.trim().length))
        ? { source: opts.promoSource ?? 'overlay', ts: Date.now() }
        : base.appliedPromotion;

    setItems(prev => {
      const idx = prev.findIndex(p => p.productId === base.productId);
      if (idx >= 0) {
        const next = [...prev];
        const lineStock = normalizeStock(next[idx].stock ?? incomingStock);
        const newQty = clamp(next[idx].qty + inc, 1, lineStock);
        next[idx] = {
          ...next[idx],
          qty: newQty,
          stock: lineStock,
          // si llegan nuevos overrides, actualiza nombre/precio/imagen
          name,
          price: unitPrice,
          imageUrl,
          appliedPromotion: appliedPromotion ?? next[idx].appliedPromotion,
        };
        return next;
      }
      // línea nueva
      return [
        ...prev,
        {
          productId: base.productId,
          name,
          price: unitPrice,
          imageUrl,
          category: base.category ?? null,
          stock: incomingStock,
          qty: clamp(inc, 1, incomingStock),
          appliedPromotion,
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

  /* ============== Helpers para Feed (Agregar / − / 🗑) ============== */
  const addFromFeed: CartState['addFromFeed'] = ({ slotItem, overlay, stockOverride, categoryOverride }) => {
    const { effectiveProductId, priceOverride } = resolveEffectiveFromFeed({ slotItem, overlay });
    const pid = toNumberId(effectiveProductId) ?? 0;

    // nombre/imagen de overlay si existen
    const nameOverride = overlay?.name;
    const imageOverride = overlay?.imageUrl;

    add(
      pid,
      1,
      {
        priceOverride: typeof priceOverride === 'number' ? priceOverride : undefined,
        nameOverride,
        imageOverride,
        stockOverride,
        categoryOverride,
        promoSource: 'overlay',
      }
    );
  };

  const qtyFromFeed: CartState['qtyFromFeed'] = ({ slotItem, overlay }) => {
    const { effectiveProductId } = resolveEffectiveFromFeed({ slotItem, overlay });
    const pid = toNumberId(effectiveProductId) ?? -1;
    const line = items.find(it => it.productId === pid);
    return line?.qty ?? 0;
  };

  const decrementFromFeed: CartState['decrementFromFeed'] = ({ slotItem, overlay }) => {
    const { effectiveProductId } = resolveEffectiveFromFeed({ slotItem, overlay });
    const pid = toNumberId(effectiveProductId) ?? -1;
    setItems(prev => {
      const i = prev.findIndex(p => p.productId === pid);
      if (i < 0) return prev;
      const next = [...prev];
      const newQty = (next[i].qty ?? 1) - 1;
      if (newQty <= 0) {
        return next.filter(p => p.productId !== pid);
      }
      next[i] = { ...next[i], qty: newQty };
      return next;
    });
  };

  const removeFromFeed: CartState['removeFromFeed'] = ({ slotItem, overlay }) => {
    const { effectiveProductId } = resolveEffectiveFromFeed({ slotItem, overlay });
    const pid = toNumberId(effectiveProductId) ?? -1;
    remove(pid);
  };

  /* ============== Aliases legacy para compatibilidad ============== */
  const addItem: CartState['addItem'] = (productIdOrObj: any, deltaQty = 1, opts?: AddItemOpts) => {
    // Si llega un objeto producto, úsalo tal cual con delta
    if (typeof productIdOrObj === 'object' && productIdOrObj) {
      const base = normalizeIncomingToCartLineBase(productIdOrObj, opts);
      if (deltaQty >= 0) return add({ ...base }, deltaQty, opts);
      // delta negativo => bajar cantidad
      setItems(prev => {
        const i = prev.findIndex(p => p.productId === base.productId);
        if (i < 0) return prev;
        const next = [...prev];
        const newQty = (next[i].qty ?? 1) + Math.floor(deltaQty);
        if (newQty <= 0) return next.filter(p => p.productId !== base.productId);
        next[i] = { ...next[i], qty: newQty };
        return next;
      });
      return;
    }

    // Si llega un id (string/number)
    const pid = toNumberId(productIdOrObj) ?? 0;
    if (deltaQty >= 0) return add(pid, deltaQty, opts);

    // delta negativo => bajar cantidad
    setItems(prev => {
      const i = prev.findIndex(p => p.productId === pid);
      if (i < 0) return prev;
      const next = [...prev];
      const newQty = (next[i].qty ?? 1) + Math.floor(deltaQty);
      if (newQty <= 0) return next.filter(p => p.productId !== pid);
      next[i] = { ...next[i], qty: newQty };
      return next;
    });
  };

  const updateQty: CartState['updateQty'] = (productId, qty) => setQty(productId, qty);
  const removeItem: CartState['removeItem'] = (productId) => remove(productId);
  const decrement: CartState['decrement'] = (productId) => {
    setItems(prev => {
      const i = prev.findIndex(p => p.productId === productId);
      if (i < 0) return prev;
      const next = [...prev];
      const newQty = (next[i].qty ?? 1) - 1;
      if (newQty <= 0) return next.filter(p => p.productId !== productId);
      next[i] = { ...next[i], qty: newQty };
      return next;
    });
  };

  /* =================== Derivados =================== */
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.price * it.qty, 0),
    [items],
  );
  const count = useMemo(
    () => items.reduce((s, it) => s + it.qty, 0),
    [items],
  );

  const value: CartState = {
    items,
    add,
    remove,
    setQty,
    clear,
    subtotal,
    count,
    addFromFeed,
    decrementFromFeed,
    removeFromFeed,
    qtyFromFeed,
    // aliases legacy
    addItem,
    updateQty,
    removeItem,
    decrement,
    lines: items,
  };

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
