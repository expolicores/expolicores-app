import AsyncStorage from '@react-native-async-storage/async-storage';

export type PublishedPromoOverlay = {
  id: string;
  name: string;
  productId: string;      // numeric string
  price?: number;         // para PRICE_OVERRIDE
  imageUrl?: string;      // banner elegido (si lo tienes)
  publishedAt: number;    // epoch ms
};

const KEY = 'published_promos_overlay_v1';
const MAX = 3;

export async function readOverlay(): Promise<PublishedPromoOverlay[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function writeOverlay(items: PublishedPromoOverlay[]) {
  const trimmed = items.slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
}

export async function upsertPublishedPromo(p: PublishedPromoOverlay) {
  const list = await readOverlay();
  const idx = list.findIndex(x => x.id === p.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...p, publishedAt: Date.now() };
  else {
    if (list.length >= MAX) list.pop(); // FIFO simple
    list.unshift({ ...p, publishedAt: Date.now() });
  }
  await writeOverlay(list);
  return list;
}

export async function removePublishedPromo(id: string) {
  const list = await readOverlay();
  const out = list.filter(x => x.id !== id);
  await writeOverlay(out);
  return out;
}
