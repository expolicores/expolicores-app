// frontend/src/lib/phone.ts

/** Devuelve solo dígitos de un string. */
export const digits = (s: string | undefined | null) => String(s ?? '').replace(/\D/g, '');

/**
 * Normaliza números CO a formato E.164 simple.
 * - Si viene con +57, lo deja igual (limpia espacios).
 * - Si viene con 57XXXXXXXXXX, antepone '+'.
 * - Si viene 0XXXXXXXXX o 3XXXXXXXXX, agrega +57.
 * - Si no tiene 10 dígitos válidos, retorna null.
 */
export function normalizePhoneCo(raw?: string | null): string | null {
  const v = String(raw ?? '').trim();
  if (!v) return null;

  // ya viene con +...
  if (v.startsWith('+')) {
    const d = '+' + digits(v);
    // +57 y 10 dígitos
    if (/^\+57\d{10}$/.test(d)) return d;
    return null;
  }

  // empieza por 57...
  if (v.startsWith('57')) {
    const d = digits(v);
    if (/^57\d{10}$/.test(d)) return `+${d}`;
    return null;
  }

  // quitar ceros iniciales y espacios
  const d = digits(v).replace(/^0+/, '');
  // 10 dígitos (celular CO)
  if (/^\d{10}$/.test(d)) return `+57${d}`;

  return null;
}

/** Enmascara un número E.164: +57*****1234 */
export function maskPhone(p?: string | null): string {
  const v = String(p ?? '');
  const d = digits(v);
  if (d.length < 4) return v;
  const tail = d.slice(-4);
  // preserva prefijo +57 si existe
  const prefix = v.startsWith('+57') ? '+57' : v.startsWith('+') ? '+' : '';
  return `${prefix}*****${tail}`;
}

export default normalizePhoneCo; // opcional: export default para imports por defecto
