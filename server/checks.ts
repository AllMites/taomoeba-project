// Deterministic claim checks, ported from the measured Python research chat (x5 experiment).
// A claim must say only what its quoted sentence says: no added numbers, negations, absolutes or flipped directions.
// No network, no model: pure functions, unit-tested in checks.test.ts.

const NUM = /(?<![A-Za-z\d.])\d+(?:[.,]\d+)?/g;
const NEG = new Set(["absence", "absent", "cannot", "lack", "lacked", "lacking", "neither", "never", "no", "none", "nor", "not", "without"]);
const ABSOLUTE = new Set(["all", "always", "completely", "entirely", "every", "exclusively", "never", "none", "only", "solely"]);
const OPPOSITE: [string, string][] = [
  ["larger", "smaller"], ["bigger", "smaller"], ["higher", "lower"], ["more", "less"], ["increase", "decrease"],
  ["increased", "decreased"], ["increases", "decreases"], ["faster", "slower"], ["longer", "shorter"], ["above", "below"],
  ["rises", "falls"], ["rose", "fell"], ["easier", "harder"], ["stronger", "weaker"],
];

const words = (t: string) => t.toLowerCase().match(/[a-z']+/g) ?? [];

function nums(t: string): Set<string> {
  const out = new Set<string>();
  for (const m of t.match(NUM) ?? []) {
    const n = m.replace(",", ".");
    out.add(n.includes(".") ? n.replace(/0+$/, "").replace(/\.$/, "") : n);
  }
  return out;
}

const hasNeg = (ws: string[]) => ws.some((w) => NEG.has(w) || w.endsWith("n't"));

/** Reason the claim says something its excerpt does not, or null. */
export function addsFacts(text: string, excerpt: string): string | null {
  const tw = words(text);
  const ew = words(excerpt);
  const en = nums(excerpt);
  const extra = [...nums(text)].filter((n) => !en.has(n)).sort();
  if (extra.length) return `adds number(s) not in excerpt: ${extra.join(", ")}`;
  if (hasNeg(tw) && !hasNeg(ew)) return "adds a negation the excerpt does not have";
  const es = new Set(ew);
  const abs = [...new Set(tw.filter((w) => ABSOLUTE.has(w) && !es.has(w)))].sort();
  if (abs.length) return `adds an absolute word not in excerpt: ${abs.join(", ")}`;
  const ts = new Set(tw);
  for (const [a, b] of OPPOSITE)
    for (const [x, y] of [[a, b], [b, a]])
      if (ts.has(x) && es.has(y) && !es.has(x)) return `says '${x}' where the excerpt says '${y}'`;
  return null;
}

/** True if `text` copies more than n consecutive words of the source (copyrighted sources are paraphrased only). */
export function quotesTooMuch(text: string, source: string, n = 15): boolean {
  const w = text.toLowerCase().match(/\w+/g) ?? [];
  const s = ` ${(source.toLowerCase().match(/\w+/g) ?? []).join(" ")} `;
  for (let i = 0; i + n < w.length; i++) if (s.includes(` ${w.slice(i, i + n + 1).join(" ")} `)) return true;
  return false;
}

export const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
export const sentenceCount = (t: string) => (t.trim().match(/[.!?](?:\s|$)/g) ?? []).length;

// ---- scope: is the question about fire and combustion at all? -------------------------------------------------
// Readable hand list (not fitted to test questions). A question with none of these stems AND little overlap with the
// retrieved text is answered "not covered".
export const SCOPE_STEMS = [
  "fire", "flam", "flame", "smok", "combust", "burn", "ignit", "extingu", "suppress", "soot", "pyroly", "droplet", "fuel",
  "oxid", "oxygen", "spread", "detect", "particl", "aerosol", "mist", "co2", "carbon", "pmma", "plexiglas", "acrylic",
  "cotton", "fabric", "silicone", "nomex", "kapton", "teflon", "wire", "heat", "thermal", "temperatur", "radiat", "extinct",
  "blowoff", "liftoff", "lift", "quench", "cool", "methanol", "heptane", "decane", "ethane", "propane", "butane", "ethylene",
  "methane", "hydrogen", "saffire", "flex", "bass", "same", "acme", "cfi", "bre", "spice", "slice", "daft", "melts", "psi",
  "cir", "ntrs", "emulator", "inert", "nitrogen", "helium", "diluent", "sensor", "alarm", "overheat", "insulat",
];
const STOP = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it", "its", "of", "on", "or", "that", "the", "this", "to", "was", "were", "which", "with"]);
export const terms = (t: string) => (t.normalize("NFKC").toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w));
export const inScope = (q: string) => terms(q).some((w) => SCOPE_STEMS.some((s) => w.startsWith(s)));

/** Share of the question's meaning (idf-weighted) found in the best of the given texts; unknown words count as rarest. */
export function coverage(question: string, texts: string[], idf: Record<string, number>): number {
  const vals = Object.values(idf);
  const rare = vals.length ? Math.max(...vals) : 1;
  const q = [...new Set(terms(question))];
  const w = (t: string) => idf[t] ?? rare;
  const total = q.reduce((a, t) => a + w(t), 0) || 1;
  let best = 0;
  for (const tx of texts) {
    const have = new Set(terms(tx));
    best = Math.max(best, q.filter((t) => have.has(t)).reduce((a, t) => a + w(t), 0) / total);
  }
  return best;
}
export const MIN_COVERAGE = 0.3;
