// BM25 over an injected index. No network, no files: tests and the Worker pass the data in.
export type Chunk = { id: string; sourceId: string; investigationId: string | null; text: string };
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
    const toks = tokenize(c.text);
    total += toks.length;
    for (const t of new Set(toks)) df[t] = (df[t] ?? 0) + 1;
  }
  const n = chunks.length;
  const idf: Record<string, number> = {};
  for (const [t, d] of Object.entries(df)) idf[t] = Math.log(1 + (n - d + 0.5) / (d + 0.5));
  return { chunks, idf, avgLen: n ? total / n : 0 };
}

const K1 = 1.5;
const B = 0.75;

export function score(index: Bm25Index, query: string, k = 3): { chunk: Chunk; score: number }[] {
  const q = [...new Set(tokenize(query))];
  const out: { chunk: Chunk; score: number }[] = [];
  for (const chunk of index.chunks) {
    const toks = tokenize(chunk.text);
    const tf: Record<string, number> = {};
    for (const t of toks) tf[t] = (tf[t] ?? 0) + 1;
    let s = 0;
    for (const t of q) {
      const f = tf[t];
      if (!f) continue;
      s += (index.idf[t] ?? 0) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * toks.length) / (index.avgLen || 1))));
    }
    if (s > 0) out.push({ chunk, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}
