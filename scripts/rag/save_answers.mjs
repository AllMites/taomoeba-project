// Record live answers to the demo questions into public/data/saved-answers.json.
//
// 1. Start the site with the API key set (npx wrangler dev, with ANTHROPIC_API_KEY and SPEND_MODE=live in .dev.vars).
// 2. In a second terminal:  node scripts/rag/save_answers.mjs            (or pass another base URL)
//
// Each question is asked fresh (no cache, no older saved answer). Only live answers are kept: a question that fell
// back to quoting, or that the records do not cover, is reported and left out, so a saved answer is always one
// that passed every check. The site then answers these exact questions instantly, labelled "Saved SI answer".
// Waits 7 s between questions to stay inside the site's own rate limit.
//
// Redo only some questions and keep the rest of the saved file:
//   node scripts/rag/save_answers.mjs --only "What caused the Apollo 1 fire?"
// Save only the questions below that have no saved answer yet (keeps the rest; cheapest after adding questions):
//   node scripts/rag/save_answers.mjs https://<site> --new
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const onlyAt = args.indexOf("--only");
const ONLY = onlyAt >= 0 ? args.slice(onlyAt + 1) : null;
const NEW = args.includes("--new");
const BASE = args.slice(0, onlyAt >= 0 ? onlyAt : args.length).find((a) => /^https?:\/\//.test(a)) ?? "http://localhost:8787";
const OUT = new URL("../../public/data/saved-answers.json", import.meta.url);
const QUESTIONS = [
  // example chips on the page
  "Do bigger droplets go out at a bigger diameter?",
  "Which experiment ranks highest for ISS?",
  "What caused the Apollo 1 fire?",
  "What is a cool flame?",
  // likely demo follow-ups
  "Why did so many high-oxygen FLEX runs end in disruption?",
  "Do inverse flames self-extinguish less often than normal flames?",
  "Does helium change droplet extinction?",
  "Why did the Apollo 13 oxygen tank explode?",
  "What happened during the Mir fire?",
  "What lessons did NASA learn from the Mir fire?",
  "How is smoke different in microgravity?",
  "What happened to silicone in microgravity?",
  "Which experiments tested 30% oxygen?",
  "How does fire spread over solid materials in microgravity?",
  // the what-if tool's "Ask about this setting" chips (src/whatif/askAbout.ts, ASK_ABOUT_QUESTIONS)
  "What did FLEX find about methanol droplet flames?",
  "What did FLEX find about heptane droplet flames?",
  "How does carbon dioxide affect droplet flames?",
  "Can we trust the model predictions for a Moon base?",
  "Would a droplet burn faster on the Moon than on the ISS?",
  "How do measured burning rates compare with droplet combustion theory?",
  // the "On Earth too" cards' Ask buttons (public/data/earth.json)
  "How does water mist put out fires?",
  "What did SAME find about smoke particles?",
  "How could ACME research reduce pollution on Earth?",
  "How did NASA help firefighters' breathing equipment?",
  "What is PBI fabric and how do firefighters use it?",
  // the "Solid materials in microgravity" Ask buttons (src/solids/index.tsx, SOLIDS_ASK)
  "What oxygen levels have fabrics been burned at in microgravity?",
  "Why did silicone burn on Earth but not in space in SAFFIRE-II?",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (q) => q.toLowerCase().replace(/\s+/g, " ").replace(/[\s?.!]+$/, "").trim();
// With --only, start from the saved file and replace just the named questions.
const prev = (ONLY || NEW) && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).items ?? [] : [];
const asked = ONLY ?? (NEW ? QUESTIONS.filter((q) => !prev.some((it) => norm(it.question) === norm(q))) : QUESTIONS);
if (NEW) console.log(`${asked.length} questions without a saved answer: ${asked.join(" | ") || "none"}`);
const items = prev.filter((it) => !asked.some((q) => norm(q) === norm(it.question)));
for (const [i, question] of asked.entries()) {
  if (i) await sleep(7000);
  let result;
  try {
    const res = await fetch(`${BASE}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, fresh: true }),
    });
    result = await res.json();
  } catch (e) {
    console.log(`FAILED   ${question}  (${e.message}; is the site running at ${BASE}?)`);
    continue;
  }
  const covered = !result.answer?.startsWith("The PSI records I have do not cover");
  if (result.mode === "live" && covered) {
    items.push({ question, result });
    console.log(`saved    ${question}`);
  } else {
    console.log(`SKIPPED  ${question}  (mode: ${result.mode ?? result.error}${covered ? "" : ", not covered"})`);
  }
}
const made = new Date().toISOString().slice(0, 10);
writeFileSync(OUT, JSON.stringify({ made, items }, null, 1) + "\n");
console.log(`\n${items.length} answers in public/data/saved-answers.json (${asked.length} asked this run)`);
