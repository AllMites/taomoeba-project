// Fact-picking eval through the site: the keyword picker against the Haiku picker (with and without the topic veto)
// on the labelled set scripts/rag/fact_questions.json, labelled before any run.
//
//   node scripts/rag/eval_facts.mjs https://<your-site>      (or http://localhost:8787 with wrangler dev)
//
// Uses POST /ask with factsOnly (no paper search, writer or checks). 3 requests per question, one every 7 s to stay
// inside the site's rate limit (burst 10, then one per 6 s); 71 questions take about 25 minutes and at most 142 Haiku
// calls (vetoed and dashboard questions make none). Writes eval-results/facts-<date>.json and prints the scores.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:\/\//.test(a)) ?? "http://localhost:8787").replace(/\/$/, "");
const { questions } = JSON.parse(readFileSync(new URL("./fact_questions.json", import.meta.url), "utf8"));
const GROUPS = [
  { name: "keyword", body: { factPicker: "keyword" } },
  { name: "model, veto in front", body: { factPicker: "model" } },
  { name: "model, no veto", body: { factPicker: "model", factVeto: false } },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let sent = 0;
async function pick(question, extra) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (sent++) await sleep(Number(process.env.EVAL_DELAY_MS ?? 7000));
    let r;
    try {
      const res = await fetch(`${BASE}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, factsOnly: true, ...extra }),
      });
      r = res.status === 429 ? { error: "rate_limited" } : await res.json();
    } catch (e) {
      r = { error: e.message };
    }
    if (r.error !== "rate_limited") return r;
    await sleep(10000); // the site's own rate limit: wait and ask again, never score it as a miss
  }
  return { error: "rate_limited" };
}

const rows = [];
for (const [i, x] of questions.entries()) {
  const row = { kind: x.kind, q: x.q, expect: x.expect };
  for (const g of GROUPS) {
    const r = await pick(x.q, g.body);
    row[g.name] = r.error ? { error: r.error } : { got: (r.facts ?? []).map((f) => f.id), picker: r.picker, pool: r.pool };
  }
  rows.push(row);
  const show = (g) => (row[g.name].error ? `error:${row[g.name].error}` : `[${row[g.name].got}]${row[g.name].picker === "fallback" ? " FALLBACK" : ""}`);
  console.log(`${i + 1}/${questions.length} ${x.kind} ${x.q}\n   ${GROUPS.map((g) => `${g.name}=${show(g)}`).join("  ")}`);
}

function score(name) {
  const got = (r) => r[name].got ?? [];
  const out = { name };
  for (const kind of ["old", "para"]) {
    const rs = rows.filter((r) => r.kind === kind && r.expect.length);
    out[`${kind}_first`] = `${rs.filter((r) => r.expect.includes(got(r)[0])).length}/${rs.length}`;
    out[`${kind}_in2`] = `${rs.filter((r) => got(r).some((id) => r.expect.includes(id))).length}/${rs.length}`;
  }
  const none = rows.filter((r) => !r.expect.length);
  out.none_shown = `${none.filter((r) => got(r).length).length}/${none.length}`;
  out.errors = rows.filter((r) => r[name].error).length;
  out.fallbacks = rows.filter((r) => r[name].picker === "fallback").length;
  out.model_calls = rows.filter((r) => r[name].picker === "model").length;
  return out;
}
const scores = GROUPS.map((g) => score(g.name));
console.table(scores);

mkdirSync("eval-results", { recursive: true });
const file = `eval-results/facts-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(file, JSON.stringify({ base: BASE, at: new Date().toISOString(), scores, rows }, null, 2));
console.log(`wrote ${file}`);
console.log("Ship rule: model (chosen veto setting) >= keyword on old_first and old_in2, > keyword on para_first, none_shown <= keyword.");
