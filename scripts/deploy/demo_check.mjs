// The evening-before check of the live site.
//
//   node scripts/deploy/demo_check.mjs https://<site>          free: pages, data files, every saved demo answer
//   node scripts/deploy/demo_check.mjs https://<site> --live   also one fresh SI answer and one off-topic refusal
//                                                              (costs about 1 US cent; shows the API key and budget work)
//
// Prints PASS / FAIL per check and exits 1 if anything failed. Waits 7 s between questions (the site's rate limit).
const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "").replace(/\/+$/, "");
if (!base) {
  console.error("usage: node scripts/deploy/demo_check.mjs https://<site> [--live]");
  process.exit(2);
}
const LIVE = args.includes("--live");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const pass = (what) => console.log(`PASS ${what}`);
const fail = (what, why) => {
  failed++;
  console.log(`FAIL ${what}: ${why}`);
};

async function getJson(path) {
  const r = await fetch(base + path);
  if (!r.ok) throw new Error(`status ${r.status}`);
  return r.json();
}

// 1. The page and the data files every section needs.
try {
  const r = await fetch(base + "/");
  const t = await r.text();
  r.ok && /<div id="root"|<html/i.test(t) ? pass("page /") : fail("page /", `status ${r.status}`);
} catch (e) {
  fail("page /", e.message);
}
for (const [path, ok] of [
  ["/health", (j) => j.ok === true],
  ["/data/facts.json", (j) => Array.isArray(j) && j.length > 100],
  ["/data/sources.json", (j) => (j.items ?? j).length > 10],
  ["/data/index.json", (j) => JSON.stringify(j).length > 1000],
  ["/data/whatif.json", (j) => Array.isArray(j.values) && !!j.theory],
  ["/data/saved-answers.json", (j) => (j.items ?? []).length > 0],
  ["/data/ask-eval.json", (j) => typeof j.questions === "number"],
]) {
  try {
    const j = await getJson(path);
    ok(j) ? pass(path) : fail(path, "unexpected content");
  } catch (e) {
    fail(path, e.message);
  }
}

// 2. Every saved demo answer comes back instantly as "saved" (no API call, nothing can fail on stage).
async function ask(question, fresh = false) {
  const t0 = Date.now();
  const r = await fetch(base + "/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, fresh }),
  });
  return { status: r.status, ms: Date.now() - t0, body: await r.json().catch(() => ({})) };
}
let saved = [];
try {
  saved = (await getJson("/data/saved-answers.json")).items ?? [];
} catch {
  /* reported above */
}
for (const [i, it] of saved.entries()) {
  if (i) await sleep(7000);
  try {
    const r = await ask(it.question);
    r.body.mode === "saved" ? pass(`saved answer (${r.ms} ms): ${it.question}`) : fail(`saved answer: ${it.question}`, `mode ${r.body.mode ?? r.status}`);
  } catch (e) {
    fail(`saved answer: ${it.question}`, e.message);
  }
}

// 3. Optional: the live path, fresh.
if (LIVE) {
  await sleep(7000);
  try {
    const r = await ask("What is a cool flame?", true);
    r.body.mode === "live" && !r.body.degraded
      ? pass(`fresh SI answer (${r.ms} ms)`)
      : fail("fresh SI answer", `mode ${r.body.mode ?? r.status}${r.body.degraded ? ", degraded (check the API key and budget)" : ""}`);
  } catch (e) {
    fail("fresh SI answer", e.message);
  }
  await sleep(7000);
  try {
    const r = await ask("How long does it take to travel to Mars?", true);
    String(r.body.answer ?? "").startsWith("The PSI records I have do not cover") ? pass("off-topic question refused") : fail("off-topic question refused", "it was answered");
  } catch (e) {
    fail("off-topic question refused", e.message);
  }
}

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
process.exitCode = failed ? 1 : 0;
