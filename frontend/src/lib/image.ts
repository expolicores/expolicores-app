const DEFAULT_PRODUCT_IMAGE =
  'https://via.placeholder.com/400x400.png?text=Producto';

/** Sanitiza URLs de imagen provenientes del backend o Prisma Studio. */
export function resolveProductImageUri(
  raw?: string | null,
  fallback: string = DEFAULT_PRODUCT_IMAGE,
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  const isHttp = /^https?:\/\//i.test(trimmed);
  if (!isHttp) return fallback;
  const encoded = encodeURI(trimmed);
  try {
    const url = new URL(encoded);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // noop: fallback below
  }
  return fallback;
}

export const PRODUCT_IMAGE_PLACEHOLDER = DEFAULT_PRODUCT_IMAGE;
