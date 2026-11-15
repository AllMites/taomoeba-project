// Fact-picking eval: the keyword picker (findFacts) against the Haiku picker (pickFacts) on fact_questions.json.
// Usage: node scripts/rag/eval_facts.mjs            (Node 22.6+ loads the server's .ts files directly)
// Key: ANTHROPIC_API_KEY, else read from .dev.vars beside the repo root (never printed). One Haiku call per question.
// Without a key only the keyword picker runs.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findFacts, namesPaperTopic } from "../../server/facts.ts";
import { pickFacts } from "../../server/factpick.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const facts = JSON.parse(readFileSync(join(root, "public/data/facts.json"), "utf8"));
const { questions } = JSON.parse(readFileSync(join(here, "fact_questions.json"), "utf8"));

function keyFromDevVars() {
  // The worktree's own .dev.vars, else the main checkout's (worktrees live in <repo>/.claude/worktrees/<name>).
  for (const p of [join(root, ".dev.vars"), resolve(root, "../../../.dev.vars")]) {
    if (!existsSync(p)) continue;
    const m = /^ANTHROPIC_API_KEY\s*=\s*"?([^"\r\n]+)"?/m.exec(readFileSync(p, "utf8"));
    if (m) return m[1].trim();
  }
  return undefined;
}
const key = process.env.ANTHROPIC_API_KEY || keyFromDevVars();

function score(name, rows) {
  const out = { name };
  for (const kind of ["old", "para"]) {
    const rs = rows.filter((r) => r.kind === kind && r.expect.length);
    out[`${kind}_first`] = `${rs.filter((r) => r.expect.includes(r.got[0])).length}/${rs.length}`;
    out[`${kind}_in2`] = `${rs.filter((r) => r.got.some((id) => r.expect.includes(id))).length}/${rs.length}`;
  }
  const none = rows.filter((r) => !r.expect.length);
  out.none_shown = `${none.filter((r) => r.got.length).length}/${none.length}`;
  return out;
}

const oldRows = questions.map((x) => ({ ...x, got: findFacts(facts, x.q).map((f) => f.id) }));
const tables = [score("keyword (findFacts)", oldRows)];
let newRows = [];
if (key) {
  const env = { ANTHROPIC_API_KEY: key };
  let calls = 0;
  for (const x of questions) {
    const r = await pickFacts(facts, x.q, env, false); // no veto; the veto variant is derived below without a call
    calls += r.used ? 1 : 0;
    newRows.push({ ...x, got: r.facts.map((f) => f.id), used: r.used });
  }
  const vetoRows = newRows.map((r) => (namesPaperTopic(facts, r.q) ? { ...r, got: [] } : r));
  tables.push(score("haiku, no veto", newRows), score("haiku, veto in front", vetoRows));
  console.log(`model calls with a usable reply: ${calls} of ${questions.length}`);
} else console.log("No ANTHROPIC_API_KEY (env or .dev.vars): keyword picker only.");
console.table(tables);
for (const [i, r] of oldRows.entries()) {
  const n = newRows[i];
  const mark = (got) => (r.expect.length ? (r.expect.includes(got[0]) ? "ok " : got.some((id) => r.expect.includes(id)) ? "2nd" : "MISS") : got.length ? "SHOWN" : "ok ");
  console.log(`${r.kind.padEnd(4)} old:${mark(r.got).padEnd(5)}${n ? ` new:${mark(n.got).padEnd(5)}` : ""} ${r.q}  old=[${r.got}]${n ? ` new=[${n.got}]` : ""}`);
}
