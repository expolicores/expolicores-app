// frontend/src/lib/image.ts

const DEFAULT_PRODUCT_IMAGE =
  'https://cdn.expressapp.net/placeholders/product.webp';

// Base del CDN: si tienes EXPO_PUBLIC_IMAGE_BASE_URL definida, la usa;
// si no, cae por defecto a cdn.expressapp.net
const IMAGE_BASE_URL =
  process.env.EXPO_PUBLIC_IMAGE_BASE_URL ?? 'https://cdn.expressapp.net';

/** Resuelve URLs de imagen para productos y contenido del feed. */
export function resolveProductImageUri(
  raw?: string | null,
  fallback: string = DEFAULT_PRODUCT_IMAGE,
): string {
  if (!raw) return fallback;

  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // 1) Data URL (ej. recortes de imagen, etc.)
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  let candidate = trimmed;

  // 2) Si NO empieza por http(s), lo tratamos como path relativo
  if (!/^https?:\/\//i.test(trimmed)) {
    const base = IMAGE_BASE_URL.replace(/\/+$/, '');
    const path = trimmed.replace(/^\/+/, '');
    candidate = `${base}/${path}`;
  }

  // 3) Normalizamos / validamos como URL http(s)
  const encoded = encodeURI(candidate);
  try {
    const url = new URL(encoded);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // si se cae aquí, devolvemos placeholder
  }

  return fallback;
}

export const PRODUCT_IMAGE_PLACEHOLDER = DEFAULT_PRODUCT_IMAGE;
