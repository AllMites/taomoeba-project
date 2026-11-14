// Measure the Ask box on the real site with the team's labelled questions (scripts/rag/eval_questions.json).
//
//   node scripts/rag/eval_ask.mjs https://<your-site>           (or http://localhost:8787 with wrangler dev)
//   node scripts/rag/eval_ask.mjs https://<your-site> --limit 10 (a quick first look)
//   node scripts/rag/eval_ask.mjs https://<your-site> --publish  (also writes public/data/ask-eval.json, the scores the
//                                                                  site's "How we know" section shows; full runs only)
//
// Every question is asked fresh (no cache, no saved answer), one every 7 s to stay inside the site's rate limit, so
// 100 questions take about 12 minutes and cost about USD 0.40 in API calls. Writes eval-results/ask-<date>.json with
// every answer, and prints the scores. Labels come from the x5 experiment (written before this site was built), so a
// paper the label does not list can still be a good answer: "cites a labelled paper" is a lower bound.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:\/\//.test(a)) ?? "http://localhost:8787").replace(/\/$/, "");
const limitAt = args.indexOf("--limit");
const LIMIT = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
const PUBLISH = args.includes("--publish");
const QUESTIONS = JSON.parse(readFileSync(new URL("./eval_questions.json", import.meta.url), "utf8")).slice(0, LIMIT);
const NO_COVER = "The PSI records I have do not cover";
const DATA_ONLY = "No paper in the library explains";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
for (const [i, item] of QUESTIONS.entries()) {
  if (i) await sleep(Number(process.env.EVAL_DELAY_MS ?? 7000));
  const t0 = Date.now();
  let r;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BASE}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: item.q, fresh: true }),
      });
      r = res.status === 429 ? { error: "rate_limited" } : await res.json();
    } catch (e) {
      r = { error: e.message };
    }
    if (r.error !== "rate_limited") break;
    await sleep(10000); // the site's own rate limit: wait and ask again, never score it as a miss
  }
  const ms = Date.now() - t0;
  const claims = r.claims ?? [];
  const cited = claims.map((c) => c.sourceIds?.[0]).filter(Boolean);
  const factIds = (r.facts ?? []).map((f) => f.id);
  const refused = typeof r.answer === "string" && r.answer.startsWith(NO_COVER);
  const row = {
    set: item.set,
    kind: item.kind,
    q: item.q,
    mode: r.mode ?? `error: ${r.error ?? "?"}`,
    ms,
    answer: r.answer,
    cited,
    facts: factIds,
    flagged: claims.filter((c) => c.flagged).length,
    claims: claims.length,
    refused,
  };
  if (item.kind === "papers" || item.kind === "papers-unavailable") {
    row.hit_any = cited.some((s) => item.gold.includes(s));
    row.hit_first = cited.length > 0 && item.gold.includes(cited[0]);
    row.ok = row.hit_any;
  } else if (item.kind === "offtopic") row.ok = refused;
  else if (item.kind === "data") row.ok = factIds.some((f) => item.facts.includes(f));
  else if (item.kind === "model") row.ok = factIds.some((f) => f.startsWith("model-"));
  else if (item.kind === "nodata") row.ok = factIds.length === 0 && !refused && claims.length > 0;
  else row.ok = null; // relabelled: reported, not scored
  rows.push(row);
  const mark = row.ok === null ? "  · " : row.ok ? " ok " : "MISS";
  console.log(`${mark} ${String(i + 1).padStart(3)} ${row.kind.padEnd(10)} ${row.mode.padEnd(10)} ${String(ms).padStart(5)} ms  ${item.q}`);
}

// ---- summary ---------------------------------------------------------------------------------------------------
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const of = (k) => rows.filter((r) => r.kind === k);
const count = (xs, f) => xs.filter(f).length;
const papers = of("papers");
const answered = papers.filter((r) => !r.refused && r.claims > 0);
const allClaims = rows.reduce((a, r) => a + r.claims, 0);
const times = rows.map((r) => r.ms).sort((a, b) => a - b);
const summary = {
  site: BASE,
  date: new Date().toISOString(),
  questions: rows.length,
  papers: {
    n: papers.length,
    cites_a_labelled_paper: count(papers, (r) => r.hit_any),
    first_claim_cites_a_labelled_paper: count(papers, (r) => r.hit_first),
    answered: answered.length,
    wrongly_refused: count(papers, (r) => r.refused),
  },
  offtopic: { n: of("offtopic").length, refused: count(of("offtopic"), (r) => r.ok) },
  data: { n: of("data").length, right_fact: count(of("data"), (r) => r.ok) },
  model: { n: of("model").length, model_fact: count(of("model"), (r) => r.ok) },
  paper_only_questions_without_data_facts: { n: of("nodata").length, ok: count(of("nodata"), (r) => r.ok) },
  errors: count(rows, (r) => r.mode.startsWith("error")),
  modes: Object.fromEntries([...new Set(rows.map((r) => r.mode))].map((m) => [m, count(rows, (r) => r.mode === m)])),
  claims: { total: allClaims, not_double_checked: rows.reduce((a, r) => a + r.flagged, 0) },
  latency_ms: { median: times[Math.floor(times.length / 2)], p90: times[Math.floor(times.length * 0.9)] },
};
console.log("\n=== Ask box scores ===");
console.log(`Paper questions (${summary.papers.n}): cites a labelled paper ${pct(summary.papers.cites_a_labelled_paper, summary.papers.n)}, ` +
  `first claim cites one ${pct(summary.papers.first_claim_cites_a_labelled_paper, summary.papers.n)}, wrongly refused ${summary.papers.wrongly_refused}`);
console.log(`Off-topic questions (${summary.offtopic.n}): refused ${pct(summary.offtopic.refused, summary.offtopic.n)}`);
console.log(`Data questions (${summary.data.n}): right data fact ${pct(summary.data.right_fact, summary.data.n)}`);
console.log(`Model questions (${summary.model.n}): a team-model fact ${pct(summary.model.model_fact, summary.model.n)}`);
console.log(`Answer modes: ${JSON.stringify(summary.modes)}  (extractive = the live step failed and the site quoted instead)`);
console.log(`Claims shown: ${summary.claims.total}, of which not double-checked: ${summary.claims.not_double_checked}`);
console.log(`Time per answer: median ${summary.latency_ms.median} ms, 90% under ${summary.latency_ms.p90} ms`);
mkdirSync("eval-results", { recursive: true });
const out = `eval-results/ask-${summary.date.slice(0, 10)}.json`;
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1) + "\n");
console.log(`\nEvery answer: ${out}`);
if (PUBLISH) {
  if (Number.isFinite(LIMIT)) console.log("Not published: --publish needs the full question set (no --limit).");
  else if (summary.errors > 0) console.log(`Not published: ${summary.errors} questions failed with errors; run again.`);
  else {
    const { site, ...pub } = summary; // the address stays out of the public file
    const dest = new URL("../../public/data/ask-eval.json", import.meta.url);
    writeFileSync(dest, JSON.stringify(pub, null, 1) + "\n");
    console.log("Published the scores to public/data/ask-eval.json");
  }
}
