// BM25 over an injected index. No network, no files: tests and the Worker pass the data in.
// derived: our own written sentence (a claim or brief takeaway filed under a source), not the source's own text.
// Searchable, but never quotable as the source in a live answer.
// restricted: text of a paper NASA marks "short quotes only". It lives only in the server's private store
// (never a public file), is never quoted in quote-only mode, and is quoted at most 15 words at a time.
export type Chunk = {
  id: string;
  sourceId: string;
  investigationId: string | null;
  text: string;
  habitat?: string;
  derived?: boolean;
  restricted?: boolean;
};
export type Bm25Index = { chunks: Chunk[]; idf: Record<string, number>; avgLen: number };

const STOP = new Set(["the", "a", "an", "of", "in", "on", "at", "to", "is", "are", "was", "were", "and", "or", "for", "with", "what", "how", "does", "do", "that", "this", "it", "be"]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t));
}

/** Build idf + avgLen from chunks (used for the fixture index; Lane B ships its own). */
export function buildIndex(chunks: Chunk[]): Bm25Index {
  const df: Record<string, number> = {};
  let total = 0;
  for (const c of chunks) {
    const { tf, len } = counts(c);
    total += len;
    for (const t of tf.keys()) df[t] = (df[t] ?? 0) + 1;
  }
  const n = chunks.length;
  const idf: Record<string, number> = {};
  for (const [t, d] of Object.entries(df)) idf[t] = Math.log(1 + (n - d + 0.5) / (d + 0.5));
  return { chunks, idf, avgLen: n ? total / n : 0 };
}

const K1 = 1.5;
const B = 0.75;

// Token counts per chunk, computed once per chunk object: with hundreds of long-report chunks, re-tokenizing every
// chunk on every question would cost the Worker real CPU time.
const counted = new WeakMap<Chunk, { tf: Map<string, number>; len: number }>();
function counts(chunk: Chunk) {
  let c = counted.get(chunk);
  if (!c) {
    const toks = tokenize(chunk.text);
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    c = { tf, len: toks.length };
    counted.set(chunk, c);
  }
  return c;
}

export function score(index: Bm25Index, query: string, k = 3): { chunk: Chunk; score: number }[] {
  const q = [...new Set(tokenize(query))];
  const out: { chunk: Chunk; score: number }[] = [];
  for (const chunk of index.chunks) {
    const { tf, len } = counts(chunk);
    let s = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      s += (index.idf[t] ?? 0) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * len) / (index.avgLen || 1))));
    }
    if (s > 0) out.push({ chunk, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Like score(), over a wider pool, but at most `cap` chunks per source, so one long document cannot fill the list.
 * (Measured in the x5 experiment: with long reports in the corpus, the cap restored top-5 accuracy.)
 */
export function scoreCapped(index: Bm25Index, query: string, k = 20, cap = 2): { chunk: Chunk; score: number }[] {
  const all = score(index, query, Number.MAX_SAFE_INTEGER);
  const seen = new Map<string, number>();
  const out: { chunk: Chunk; score: number }[] = [];
  for (const h of all) {
    const n = seen.get(h.chunk.sourceId) ?? 0;
    if (n >= cap) continue;
    seen.set(h.chunk.sourceId, n + 1);
    out.push(h);
    if (out.length >= k) break;
  }
  return out;
}
