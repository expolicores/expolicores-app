import { z } from 'zod';

// Acepta 10 dígitos CO (300xxxxxxx) o E.164 (+57XXXXXXXXXX)
export const phoneSchema = z.string().trim().refine(v => {
  const d = v.replace(/\D/g, '');
  return d.length === 10 || /^\+57\d{10}$/.test(v);
}, 'Ingresa un celular válido de 10 dígitos (CO) o en formato +57XXXXXXXXXX');

// (Opcional) Normaliza a +57 para enviar al BE (solo UX; el BE ya normaliza)
export const normalizeCoPhone = (v: string) => {
  const d = (v || '').replace(/\D/g, '');
  if (d.startsWith('57') && d.length === 12) return `+${d}`;
  if (d.length === 10) return `+57${d}`;
  if (v?.startsWith('+')) return v;
  return `+57${d}`;
};
