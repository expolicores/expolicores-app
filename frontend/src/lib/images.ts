// frontend/src/lib/images.ts
import { ENV } from "./env";

export function getImageUrl(path?: string | null) {
  if (!path) {
    return `${ENV.IMAGE_BASE_URL}/placeholders/product.webp`;
  }

  // Si viene una URL absoluta (feed JSON de R2), la respetamos tal cual
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // Si viene un path relativo desde la API (Product.imageUrl)
  return `${ENV.IMAGE_BASE_URL}/${path.replace(/^\/+/, "")}`;
}
