// Data facts: numbers computed by code from the team's data (public/data/facts.json, built by
// scripts/rag/build_facts.py). The SI never writes these numbers; it only links papers to them.
// find() matches a question to facts; ported from the measured Python version (facts.py).
import { SCOPE_STEMS, terms } from "./checks.ts";

export type DataFact = {
  id: string;
  dataset: string;
  source: string;
  statement: string;
  numbers: string[];
  keywords: string;
  method: string;
  caveat: string;
};

const GENERIC = new Set(["can", "data", "did", "do", "does", "how", "many", "much", "table", "trust", "we", "what", "which", "why"]);
const MIN_COVERAGE = 0.5;

type FactIndex = { facts: DataFact[]; tf: Map<string, number>[]; idf: Record<string, number>; avg: number; vocab: Set<string> };
const cache = new WeakMap<DataFact[], FactIndex>();

const text = (f: DataFact) => `${f.statement} ${f.keywords} ${f.dataset}`;

function index(facts: DataFact[]): FactIndex {
  const hit = cache.get(facts);
  if (hit) return hit;
  const vocab = new Set(facts.flatMap((f) => terms(text(f))));
  const base = (w: string) => baseForm(w, vocab);
  const tf = facts.map((f) => {
    const m = new Map<string, number>();
    for (const w of terms(text(f)).map(base)) m.set(w, (m.get(w) ?? 0) + 1);
    return m;
  });
  const df = new Map<string, number>();
  for (const m of tf) for (const w of m.keys()) df.set(w, (df.get(w) ?? 0) + 1);
  const n = Math.max(facts.length, 1);
  const idf: Record<string, number> = {};
  for (const [w, d] of df) idf[w] = Math.log(1 + (n - d + 0.5) / (d + 0.5));
  const avg = tf.reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y, 0), 0) / n;
  const out = { facts, tf, idf, avg, vocab };
  cache.set(facts, out);
  return out;
}

/** droplets/droplet, models/model, ended/end -> one form, on both the question and the facts side. */
function baseForm(w: string, vocab: Set<string>): string {
  for (const suf of ["es", "s", "ed"])
    if (w.endsWith(suf) && w.length > suf.length + 2 && vocab.has(w.slice(0, -suf.length))) return w.slice(0, -suf.length);
  return w;
}

// Dashboard ranking facts answer ranking questions only ("Which experiment ranks highest for ISS?"), never a topic
// question that happens to share an experiment's words ("What is a cool flame?").
const RANK_INTENT = new Set(["rank", "ranks", "ranked", "ranking", "rankings", "score", "scores", "scored", "dashboard", "highest", "lowest", "top", "bottom", "best", "worst", "position", "place", "placed"]);
const HIGH = ["highest", "top", "best", "first", "most"];
const LOW = ["lowest", "last", "bottom", "least", "worst"];
const HABITAT_WORDS: Record<string, string> = { iss: "iss", station: "iss", moon: "moon", lunar: "moon", rover: "rover", suit: "ref", reference: "ref" };
const isDashboard = (f: DataFact) => f.id.startsWith("dash-");
/** True when every fact is a dashboard ranking: the answer is the ranking itself, no paper needed. */
export const onlyDashboard = (facts: DataFact[]) => facts.length > 0 && facts.every(isDashboard);

function dashboardAllowed(question: string): (f: DataFact) => boolean {
  const words = terms(question);
  if (!words.some((w) => RANK_INTENT.has(w))) return (f) => !isDashboard(f);
  const habitats = new Set(words.map((w) => HABITAT_WORDS[w]).filter(Boolean));
  const wantHigh = words.some((w) => HIGH.includes(w));
  const wantLow = words.some((w) => LOW.includes(w));
  return (f) => {
    if (!isDashboard(f)) return true;
    if (habitats.size && !habitats.has(f.id.split("-").pop()!)) return false;
    if (wantHigh && !f.keywords.includes("highest")) return false;
    if (wantLow && !f.keywords.includes("lowest")) return false;
    return true;
  };
}

/** Facts most related to the question, best first; [] when none clearly matches or the question is about a paper topic. */
export function findFacts(facts: DataFact[], question: string, k = 2): DataFact[] {
  if (!facts.length) return [];
  const ix = index(facts);
  const q = [...new Set(terms(question).filter((w) => !GENERIC.has(w)).map((w) => baseForm(w, ix.vocab)))];
  if (!q.length) return [];
  // The question names a fire-science term that no fact uses ("Burning Rate Emulator", "water mist", "SAME smoke"):
  // it is about that topic in the papers, not about the team's data.
  if (q.some((w) => !(w in ix.idf) && SCOPE_STEMS.some((s) => w.startsWith(s)))) return [];
  const scored: { s: number; f: DataFact }[] = [];
  const allowed = dashboardAllowed(question);
  ix.tf.forEach((m, i) => {
    if (!allowed(ix.facts[i])) return;
    const dl = [...m.values()].reduce((a, b) => a + b, 0);
    let s = 0;
    for (const w of q) {
      const c = m.get(w);
      if (c) s += ix.idf[w] * ((c * 2.2) / (c + 1.2 * (0.25 + (0.75 * dl) / ix.avg)));
    }
    const cov = q.filter((w) => m.has(w)).length / q.length;
    if (s > 0 && cov >= MIN_COVERAGE) scored.push({ s, f: ix.facts[i] });
  });
  return scored.sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.f);
}
