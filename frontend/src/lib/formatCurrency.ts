// src/lib/formatCurrency.ts
// Helpers de formato monetario. Exporta named y default para evitar mismatches.

type IntlCurrency = 'COP' | 'USD' | 'EUR' | string;

export function formatCurrency(
  value: number,
  currency: IntlCurrency = 'COP',
  locale = 'es-CO',
  maximumFractionDigits = 0
): string {
  // Guard por si llega null/undefined
  if (value == null || Number.isNaN(Number(value))) return '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits,
    }).format(value);
  } catch {
    // Fallback súper simple
    return `${currency} ${Math.round(Number(value)).toLocaleString(locale)}`;
  }
}

/** Alias directo para COP (enteros). */
export function formatCOP(value: number): string {
  return formatCurrency(value, 'COP', 'es-CO', 0);
}

// Compatibilidad: algunos imports usan default
export default formatCOP;
