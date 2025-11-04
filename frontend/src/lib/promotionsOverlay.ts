// src/lib/promotionsOverlay.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Overlay publicado por backend para el feed/promos.
 * Mantiene compatibilidad con el contrato actual y agrega bannerKey.
 */
export type PublishedPromoOverlay = {
  id: string;
  name: string;
  productId: string;      // SKU efectivo (puede ser bundleId o SKU base)
  price?: number;         // PRICE_OVERRIDE (si aplica)
  imageUrl?: string;      // imagen/banner asociado (si existe)
  bannerKey?: string;     // slot.id o clave del banner (si existe)
  publishedAt?: number;   // epoch ms
};

/**
 * Item del feed (slot item). El front ya soporta id o productId.
 */
export type FeedSlotItem = {
  id?: string | number;
  productId?: string | number;
  image?: string | null;
  bannerKey?: string;
};

/** Clave de almacenamiento local (no cambiar por compat). */
export const OVERLAY_ASYNC_KEY = 'published_promos_overlay_v1';

/* =============================================================================
 * Helpers de normalización (IDs e imágenes)
 * ========================================================================== */
function toPidString(v?: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s;
}

function normPid(v?: string | number | null): string {
  return toPidString(v).toLowerCase();
}

function normUrl(u?: string | null): string {
  if (!u) return '';
  return String(u).trim().replace(/\?.*$/, '').toLowerCase();
}

function fileNameFromUrl(u?: string | null): string {
  const nu = normUrl(u);
  if (!nu) return '';
  const last = nu.split('/').pop() || '';
  const base = last.replace(/\.(jpg|jpeg|png|webp|gif|avif)$/i, '');
  // Quita sufijos de tamaño comunes o @2x/@3x
  const pruned = base.replace(
    /(-|\.)?(100|200|300|320|360|400|450|480|600|640|720|750|800|900|1080|1200|1440|1536|1600|1920|2048)(@2x|@3x)?$/i,
    '',
  );
  return pruned;
}

/** Heurística flexible para equiparar imágenes (URL exacta / filename). */
function sameImageHeuristic(a?: string | null, b?: string | null): boolean {
  const A = normUrl(a);
  const B = normUrl(b);
  if (!A || !B) return false;
  if (A === B) return true;
  const ka = fileNameFromUrl(A);
  const kb = fileNameFromUrl(B);
  if (ka && kb && ka === kb) return true;
  if (A.includes(kb) || B.includes(ka)) return true;
  return false;
}

/* =============================================================================
 * Persistencia en AsyncStorage
 * ========================================================================== */

/** Lee TODOS los overlays publicados (sin límite artificial). */
export async function readOverlay(): Promise<PublishedPromoOverlay[]> {
  try {
    const raw = await AsyncStorage.getItem(OVERLAY_ASYNC_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const list: any[] = Array.isArray(arr) ? arr : [];
    const now = Date.now();
    // Normaliza tipos/campos
    return list.map((o) => ({
      id: String(o.id),
      name: String(o.name ?? ''),
      productId: toPidString(o.productId),
      price: typeof o.price === 'number' ? o.price : undefined,
      imageUrl: o.imageUrl ?? o.image ?? o.img ?? undefined,
      bannerKey: o.bannerKey ?? undefined,
      publishedAt: typeof o.publishedAt === 'number' ? o.publishedAt : now,
    }));
  } catch {
    return [];
  }
}

/** Escribe todos los overlays publicados (sin trimming). */
export async function writeOverlay(items: PublishedPromoOverlay[]) {
  await AsyncStorage.setItem(OVERLAY_ASYNC_KEY, JSON.stringify(items ?? []));
}

/**
 * Inserta/actualiza un overlay preservando orden "más reciente primero".
 * Si ya existe por id, mezcla y mueve al frente con publishedAt=now.
 */
export async function upsertPublishedPromo(p: PublishedPromoOverlay) {
  const list = await readOverlay();
  const now = Date.now();

  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) {
    const updated: PublishedPromoOverlay = {
      ...list[idx],
      ...p,
      publishedAt: now,
      productId: toPidString(p.productId),
      imageUrl: p.imageUrl ?? (list[idx].imageUrl ?? undefined),
    };
    const rest = list.filter((_, i) => i !== idx);
    const out = [updated, ...rest];
    await writeOverlay(out);
    return out;
  }

  const out = [{ ...p, productId: toPidString(p.productId), publishedAt: now }, ...list];
  await writeOverlay(out);
  return out;
}

/** Elimina un overlay por id. */
export async function removePublishedPromo(id: string) {
  const list = await readOverlay();
  const out = list.filter((x) => x.id !== id);
  await writeOverlay(out);
  return out;
}

/** Guarda un snapshot completo (útil tras fetch remoto o "Limpiar caché"). */
export async function cacheOverlaySnapshot(overlays: PublishedPromoOverlay[]) {
  const now = Date.now();
  const normalized = (overlays ?? []).map((o) => ({
    ...o,
    productId: toPidString(o.productId),
    publishedAt: o.publishedAt ?? now,
  }));
  await writeOverlay(normalized);
  return normalized;
}

/* =============================================================================
 * Indexación y emparejamiento Feed ↔ Overlay
 * ========================================================================== */

export type OverlayIndex = {
  list: PublishedPromoOverlay[];
  byProductId: Record<string, PublishedPromoOverlay>;
  byImageUrl: Record<string, PublishedPromoOverlay>;
  byImageName: Record<string, PublishedPromoOverlay>;
  byBannerKey: Record<string, PublishedPromoOverlay>;
};

/**
 * Construye índices para emparejar rápido por:
 * 1) productId / id (normalizado)
 * 2) imageUrl (normalizada)
 * 3) image filename (tolerante)
 * 4) bannerKey
 * Fallback: por posición (idx) si nada coincide (opcional).
 */
export function buildOverlayIndex(overlays: PublishedPromoOverlay[]): OverlayIndex {
  const byProductId: Record<string, PublishedPromoOverlay> = {};
  const byImageUrl: Record<string, PublishedPromoOverlay> = {};
  const byImageName: Record<string, PublishedPromoOverlay> = {};
  const byBannerKey: Record<string, PublishedPromoOverlay> = {};

  for (const o of overlays) {
    const pidKey = normPid(o.productId);
    if (pidKey && !byProductId[pidKey]) byProductId[pidKey] = o;

    const urlKey = normUrl(o.imageUrl);
    if (urlKey && !byImageUrl[urlKey]) byImageUrl[urlKey] = o;

    const nameKey = fileNameFromUrl(o.imageUrl);
    if (nameKey && !byImageName[nameKey]) byImageName[nameKey] = o;

    const bKey = (o.bannerKey || '').trim();
    if (bKey && !byBannerKey[bKey]) byBannerKey[bKey] = o;
  }

  return { list: overlays, byProductId, byImageUrl, byImageName, byBannerKey };
}

/**
 * Busca el overlay más apropiado para un item del feed.
 * Prioridad:
 *  1) item.productId || item.id === overlay.productId (normalizado)
 *  2) item.image === overlay.imageUrl (normalizado)
 *  3) heurística por filename de imagen
 *  4) item.bannerKey === overlay.bannerKey
 *  5) Fallback: overlays[idx] si existe
 */
export function findOverlayForItem(
  item: FeedSlotItem,
  idx: number,
  index: OverlayIndex,
): PublishedPromoOverlay | undefined {
  // 1) productId / id
  const pidKey = normPid(item.productId ?? item.id ?? '');
  if (pidKey && index.byProductId[pidKey]) return index.byProductId[pidKey];

  // 2) imageUrl exacta (normalizada)
  const imgKey = normUrl(item.image ?? undefined);
  if (imgKey && index.byImageUrl[imgKey]) return index.byImageUrl[imgKey];

  // 3) filename heurístico
  const fname = fileNameFromUrl(item.image ?? undefined);
  if (fname && index.byImageName[fname]) return index.byImageName[fname];

  // 4) bannerKey
  const bKey = (item.bannerKey || '').trim();
  if (bKey && index.byBannerKey[bKey]) return index.byBannerKey[bKey];

  // 5) Fallback por índice
  return index.list[idx];
}

/* =============================================================================
 * Resolver para carrito (Agregar / − / 🗑)
 * ========================================================================== */

export type EffectiveFromFeed = {
  effectiveProductId: string;        // SKU base o bundleId
  priceOverride?: number | null;     // solo para PRICE_OVERRIDE
};

/**
 * Dado un slot item y (opcional) su overlay, resuelve:
 *  - productId efectivo (bundle o SKU base)
 *  - priceOverride (si aplica)
 * Debe usarse SIEMPRE para calcular qty y operaciones del carrito.
 */
export function resolveEffectiveFromFeed(args: {
  slotItem: FeedSlotItem;
  overlay?: PublishedPromoOverlay | null;
}): EffectiveFromFeed {
  const itemId = toPidString(args.slotItem.productId ?? args.slotItem.id ?? '');
  const o = args.overlay;

  if (o) {
    const effectiveProductId = toPidString(o.productId || itemId);
    const priceOverride = typeof o.price === 'number' && Number.isFinite(o.price) ? o.price : null;
    return { effectiveProductId, priceOverride };
  }

  return { effectiveProductId: itemId, priceOverride: null };
}

/* =============================================================================
 * Atajo sin índice (útil en UIs pequeñas)
 * ========================================================================== */

/**
 * Busca overlay para un item SIN construir índice (útil en sitios donde llames poco).
 * Para listas largas, usa buildOverlayIndex + findOverlayForItem para performance.
 */
export function matchOverlayInline(
  overlays: PublishedPromoOverlay[],
  item: FeedSlotItem,
  idx = 0,
): PublishedPromoOverlay | undefined {
  const index = buildOverlayIndex(overlays);
  return findOverlayForItem(item, idx, index);
}
