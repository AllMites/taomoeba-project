// Pure ranking comparator, importable by the front end (no Node imports).
export type Rankish = { score: number; investigationId: string; factors?: { value: number | null }[] };

/** Scores are rounded to 3 decimals, so a gap smaller than this is an exact tie (keeps the order transitive). */
export const TIE = 0.0005;

const known = (r: Rankish) => r.factors?.filter((f) => f.value !== null).length ?? 0;

/** Higher score first; on a tie, more answered (non-null) factors first; then investigation id. */
export function compareRank(a: Rankish, b: Rankish): number {
  if (Math.abs(a.score - b.score) > TIE) return b.score - a.score;
  const k = known(b) - known(a);
  if (k) return k;
  return a.investigationId < b.investigationId ? -1 : a.investigationId > b.investigationId ? 1 : 0;
}
