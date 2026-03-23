// frontend/src/lib/placesRank.ts
type SuggestionLike = { description: string };

const NEEDLES = ['villa de leyva', 'boyacá', 'boyaca'];
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const score = (desc: string) => {
  const n = normalize(desc);
  return NEEDLES.reduce((acc, w) => acc + (n.includes(w) ? 1 : 0), 0);
};

export function rankVillaLeyvaFirst<T extends SuggestionLike>(results: T[]): T[] {
  return [...results].sort((a, b) => score(b.description) - score(a.description));
}
