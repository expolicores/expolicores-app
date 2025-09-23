// frontend/src/lib/formatCurrency.ts
export function formatCurrency(value: number, locale = 'es-CO', currency = 'COP') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}
