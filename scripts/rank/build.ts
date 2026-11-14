// Builds public/data/rank.json: one RankItem per investigation x habitat, each with five visible factors.
// Run: node scripts/rank/build.ts   (idempotent; TypeSafe answers are cached on disk by input hash)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HabitatPreset } from "../../src/contracts/habitat.ts";
import type { Investigation } from "../../src/contracts/investigation.ts";
import type { RankFactor, RankItem } from "../../src/contracts/rank.ts";

type FactorKey = RankFactor["key"];

/**
 * The scoring rule, in one place. Oxygen and pressure are the checks that say whether the experiment was run at
 * the reader's conditions, so they count double; the three soft checks count once. score = sum(weight * value) / sum(weight).
 * A factor whose value is null ("not on record") contributes UNKNOWN_VALUE x its weight, not 0: a measured mismatch (0)
 * tells the reader the experiment was NOT run at their conditions, while "not on record" tells them nothing either way,
 * so it must sit between a miss and a match. The factor's `value` stays null in the data; only this arithmetic uses 0.5.
 */
export const FACTOR_WEIGHTS: Record<FactorKey, number> = { o2: 2, pressure: 2, directness: 1, evidence: 1, goalFit: 1 };
export const UNKNOWN_VALUE = 0.5;
export const FACTOR_ORDER: FactorKey[] = ["o2", "pressure", "directness", "evidence", "goalFit"];

/** Shown verbatim in the UI. Keep it at four plain sentences. */
export const HOW_RANKING_WORKS =
  "Each investigation gets five checks for the habitat you pick: oxygen match and pressure match count double, while how directly it studies fire safety, whether it flew in space, and how well its stated goal fits count once. " +
  "Each check is worth 0 to 1; oxygen or pressure inside the tested range scores 1, and outside it falls in a straight line to 0 at a gap equal to the tested span (at least 5 points of oxygen or 10 kPa). " +
  "The score is the weighted average of the five (the weights add up to 7), and a check the record cannot answer counts as half, because unknown is neither a match nor a miss. " +
  "Equal scores are ordered by how many checks the record could answer, then by investigation id. " +
  "The goal-fit check is the only one an SI rates; the other four come straight from the record.";

/** Distance floor (same units as the dimension) when a tested range is a single value. Matches Lane A. */
export const FLOOR = { o2: 5, pressure: 10 };

/** The fixed goal-fit question. Worded by the atmosphere, not the habitat name, so habitats with the same air get the same rating. */
export const goalQuestion = (o2Percent: number, pressureKPa: number) =>
  `Does this experiment's stated goal help prevent, detect or put out fires in a crewed habitat at ${num(o2Percent)}% oxygen and ${num(pressureKPa)} kPa?`;
/** Goal fit below LOW is "low", at or above HIGH is "high", otherwise "medium". */
export const GOAL_BANDS = { low: 0.4, high: 0.7 };
const GOAL_LEVELS = [
  "The goal has nothing to do with fire safety in this habitat",
  "The goal is only loosely related to fire safety here",
  "The goal partly informs fire prevention, detection or suppression here",
  "The goal clearly informs fire safety decisions here",
  "The goal directly answers a key fire-safety question here",
];
const GOAL_EXCERPT_MAX = 400;
const MAX_REASON_WORDS = 24;

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const data = (p: string) => join(root, "public/data", p);
const cacheDir = join(root, "scripts/rank/.cache");

type OverlapRow = { investigationId: string; habitat: string; overlap: number | null; dimsUsed: 0 | 1 | 2 };
type Claimish = { id: string; investigationId: string };
export type Inputs = { investigations: Investigation[]; overlaps: OverlapRow[]; habitats: HabitatPreset[]; claims: Claimish[]; fixtures: boolean };

// ---------- helpers ----------
const num = (n: number) => String(Math.round(n * 10) / 10);
const rangeText = (r: [number, number]) => (r[0] === r[1] ? num(r[0]) : `${num(r[0])} to ${num(r[1])}`);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Keep a reason to one short sentence: cut at the last clause break inside the word limit, end with a period. */
function sentence(s: string): string {
  let t = s.trim().replace(/[.\s]+$/, "");
  const w = words(t);
  if (w.length > MAX_REASON_WORDS) {
    t = w.slice(0, MAX_REASON_WORDS).join(" ");
    const cut = Math.max(t.lastIndexOf(","), t.lastIndexOf(";"), t.lastIndexOf(":"));
    if (cut > t.length / 3) t = t.slice(0, cut);
  }
  return `${cap(t)}.`;
}

/** Lane A's rule: 1 inside the range; outside, linear decay to 0 at a distance equal to the span (floored). */
export function dimScore(value: number, range: [number, number] | null, floor: number): number | null {
  if (!range) return null;
  const [lo, hi] = range;
  const d = value < lo ? lo - value : value > hi ? value - hi : 0;
  if (d === 0) return 1;
  return Math.max(0, 1 - d / Math.max(hi - lo, floor));
}
const r3 = (n: number) => Math.round(n * 1000) / 1000;

// ---------- factors ----------
function conditionFactor(key: "o2" | "pressure", inv: Investigation, hab: HabitatPreset): RankFactor {
  const o2 = key === "o2";
  const range = (o2 ? inv.o2Range : inv.pressureRange) as [number, number] | null;
  const habVal = o2 ? hab.o2Percent : hab.pressureKPa;
  const unit = o2 ? "% oxygen" : " kPa";
  const habText = o2 ? `${num(habVal)}%` : `${num(habVal)} kPa`;
  const label = o2 ? "Oxygen match" : "Pressure match";
  if (!range) return { key, label, value: null, reason: o2 ? "Oxygen level is not on record." : "Pressure is not on record." };
  const value = dimScore(habVal, range, o2 ? FLOOR.o2 : FLOOR.pressure)!;
  const basis = inv.conditionBasis?.[key] ?? null;
  const inside = habVal >= range[0] && habVal <= range[1];
  let reason = `Tested at ${rangeText(range)}${unit}${inside ? `, which covers this habitat's ${habText}` : `; this habitat is at ${habText}`}`;
  if (basis === "record") reason += " (stated in the record, not a data table)";
  const f: RankFactor = { key, label, value: r3(value), reason: sentence(reason) };
  if (basis === "record" && inv.conditionBasis?.excerpt) f.excerpt = inv.conditionBasis.excerpt;
  return f;
}

function directnessFactor(inv: Investigation): RankFactor {
  const label = "Direct or indirect";
  if (inv.pds === "Other") return { key: "directness", label, value: 0, reason: "Not a combustion experiment." };
  if (/^indirect:/i.test(inv.pdsBasis)) {
    return { key: "directness", label, value: 0.5, reason: sentence(inv.pdsBasis.replace(/^indirect:\s*/i, "")) };
  }
  return { key: "directness", label, value: 1, reason: `Directly about ${inv.pds.toLowerCase()}.` };
}

function evidenceFactor(inv: Investigation): RankFactor {
  const label = "Flight or ground";
  if (inv.evidence === "flight") return { key: "evidence", label, value: 1, reason: "Flown in microgravity." };
  if (inv.evidence === "ground") return { key: "evidence", label, value: 0.5, reason: "Ground test or computer model." };
  return { key: "evidence", label, value: null, reason: "Not stated." };
}

/** The objectives text that is both shown as the excerpt and judged by the SI (first sentences, up to the cap). */
export function goalExcerpt(inv: Investigation): string {
  const text = inv.objectives.trim().replace(/\s+/g, " ");
  if (text.length <= GOAL_EXCERPT_MAX) return text;
  let out = "";
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if (out && (out + " " + s).length > GOAL_EXCERPT_MAX) break;
    out = out ? `${out} ${s}` : s;
  }
  return out.length <= GOAL_EXCERPT_MAX ? out : out.slice(0, GOAL_EXCERPT_MAX).replace(/\s+\S*$/, "");
}

export const goalBand = (v: number) => (v < GOAL_BANDS.low ? "low" : v >= GOAL_BANDS.high ? "high" : "medium");

function goalFactor(inv: Investigation, si: number | null): RankFactor {
  const label = "Goal fit (SI-judged)";
  if (si === null) return { key: "goalFit", label, value: null, reason: "SI rating unavailable." };
  return { key: "goalFit", label, value: si, reason: `SI read the stated goal and rated the fit ${goalBand(si)}.`, sourceId: `psi:${inv.id}`, excerpt: goalExcerpt(inv) };
}

/** The weighted mean of the five values; null counts as UNKNOWN_VALUE (see FACTOR_WEIGHTS). */
export function computeScore(factors: Pick<RankFactor, "key" | "value">[]): number {
  let sum = 0, w = 0;
  for (const f of factors) { sum += FACTOR_WEIGHTS[f.key] * (f.value ?? UNKNOWN_VALUE); w += FACTOR_WEIGHTS[f.key]; }
  return r3(sum / w);
}

// ---------- rationale ----------
const NOUN: Record<FactorKey, string> = { o2: "oxygen match", pressure: "pressure match", directness: "link to fire safety", evidence: "evidence type", goalFit: "goal fit" };
const UNKNOWN: Record<FactorKey, string> = { o2: "oxygen is not on record", pressure: "pressure is not on record", directness: "link to fire safety is unknown", evidence: "flight or ground is not stated", goalFit: "the SI rating is unavailable" };
const strength = (v: number) => (v >= 0.8 ? "strong" : v >= 0.4 ? "partial" : "weak");
const isCond = (f: RankFactor) => f.key === "o2" || f.key === "pressure";
const phrase = (f: RankFactor, all: RankFactor[]) => {
  if (f.value !== null) return `${strength(f.value)} ${NOUN[f.key]}`;
  const bothCond = isCond(f) && all.filter(isCond).length === 2 && all.filter(isCond).every((c) => c.value === null);
  return bothCond ? "oxygen and pressure are not on record" : UNKNOWN[f.key];
};

/**
 * One plain sentence naming the strongest and the weakest factor. Weakest is by what the factor adds to the
 * score (null counts as UNKNOWN_VALUE); on a tie a known value wins, so a measured mismatch is named before a gap.
 * A null factor is only ever called "not on record", never weak.
 */
export function rationale(factors: RankFactor[]): string {
  const known = factors.filter((f) => f.value !== null);
  if (!known.length) return "Nothing is known for any of the five checks.";
  const v = (f: RankFactor) => f.value ?? UNKNOWN_VALUE;
  const best = known.reduce((a, b) => (b.value! > a.value! ? b : a));
  let worst = factors.reduce((a, b) => (v(b) < v(a) || (v(b) === v(a) && a.value === null && b.value !== null) ? b : a));
  if (v(best) === v(worst)) {
    const gap = factors.find((f) => f.value === null);
    if (!gap) return `All five checks are about equal: ${phrase(best, factors)}.`;
    worst = gap;
  }
  return `${cap(phrase(best, factors))}; ${phrase(worst, factors)}.`;
}

// ---------- items ----------
export type GoalFn = (inv: Investigation, hab: HabitatPreset) => Promise<number | null>;

export async function buildItems(inp: Inputs, goal: GoalFn): Promise<RankItem[]> {
  const items: RankItem[] = [];
  for (const inv of inp.investigations) {
    for (const hab of inp.habitats) {
      const row = inp.overlaps.find((o) => o.investigationId === inv.id && o.habitat === hab.id);
      const factors = [
        conditionFactor("o2", inv, hab),
        conditionFactor("pressure", inv, hab),
        directnessFactor(inv),
        evidenceFactor(inv),
        goalFactor(inv, await goal(inv, hab)),
      ];
      const cond = factors.slice(0, 2).filter((f) => f.value !== null);
      // Compatibility fields: use Lane A's numbers when present, else derive the same mean from the condition factors.
      const overlap = row ? row.overlap : cond.length ? r3(cond.reduce((s, f) => s + f.value!, 0) / cond.length) : null;
      const fromTable = (k: "o2" | "pressure", f: RankFactor) => f.value !== null && (inv.conditionBasis?.[k] ?? "table") === "table";
      items.push({
        id: `rank-${inv.id}-${hab.id}`,
        investigationId: inv.id,
        habitat: hab.id,
        overlap,
        dimsUsed: row ? row.dimsUsed : (cond.length as 0 | 1 | 2),
        siRelevance: factors[4].value,
        score: computeScore(factors),
        rationale: rationale(factors),
        claimIds: inp.claims.filter((c) => c.investigationId === inv.id).map((c) => c.id),
        provenance: fromTable("o2", factors[0]) || fromTable("pressure", factors[1]) ? "measured" : "illustrative",
        factors,
      });
    }
  }
  return items;
}

// ---------- TypeSafe goal fit, cached on disk by input hash ----------
export const usage = { calls: 0, cached: 0, failed: 0, input_tokens: 0, output_tokens: 0, models: new Set<string>() };

export function typesafeGoal(key: string | undefined, fetchImpl: typeof fetch = fetch, dir: string = cacheDir): GoalFn {
  // One question per investigation x distinct atmosphere; habitats with the same air reuse the answer.
  const memo = new Map<string, Promise<number | null>>();
  return (inv, hab) => {
    const k = `${inv.id}|${hab.o2Percent}|${hab.pressureKPa}`;
    if (!memo.has(k)) memo.set(k, ask(inv, hab));
    return memo.get(k)!;
  };

  async function ask(inv: Investigation, hab: HabitatPreset): Promise<number | null> {
    const excerpt = goalExcerpt(inv);
    if (!excerpt) return null;
    const body = {
      model: MODEL,
      state: { stated_goal: excerpt },
      questions: { goalFit: { type: "score", instructions: goalQuestion(hab.o2Percent, hab.pressureKPa), criteria: GOAL_LEVELS } },
    };
    const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const file = join(dir, `${hash}.json`);
    if (existsSync(file)) {
      usage.cached++;
      return (JSON.parse(readFileSync(file, "utf8")) as { value: number }).value;
    }
    if (!key) return null;
    try {
      const res = await fetchImpl(TYPESAFE_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { model?: string; answers: { goalFit: { score: number } }; usage: { input_tokens: number; output_tokens: number } };
      usage.calls++; usage.input_tokens += j.usage.input_tokens; usage.output_tokens += j.usage.output_tokens;
      if (j.model) usage.models.add(j.model);
      // TypeSafe Score is on the level line 0..(levels-1); anything else is a failure, never a guessed number.
      const raw = j.answers?.goalFit?.score;
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > GOAL_LEVELS.length - 1) throw new Error("bad score");
      const value = r3(raw / (GOAL_LEVELS.length - 1));
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, JSON.stringify({ value, model: j.model ?? null }));
      return value;
    } catch (e) {
      usage.failed++;
      console.error(`typesafe failed for ${inv.id}/${hab.id}: ${(e as Error).message}`); // status only, never the key
      return null;
    }
  }
}

// ---------- main ----------
const readItems = <T>(p: string): T[] => (JSON.parse(readFileSync(p, "utf8")) as { items: T[] }).items;

export function loadInputs(): Inputs {
  const real = existsSync(data("investigations.json")) && existsSync(data("overlap.json"));
  const fx = (n: string) => data(`fixtures/${n}.fixture.json`);
  const claimsDir = data("claims");
  const claims = existsSync(claimsDir)
    ? readdirSync(claimsDir).filter((f) => f.endsWith(".json")).flatMap((f) => readItems<Claimish>(join(claimsDir, f)))
    : readItems<Claimish>(fx("claims"));
  return {
    investigations: readItems<Investigation>(real ? data("investigations.json") : fx("investigations")),
    overlaps: real ? readItems<OverlapRow>(data("overlap.json")) : [],
    habitats: readItems<HabitatPreset>(existsSync(data("habitats.json")) ? data("habitats.json") : fx("habitats")),
    claims,
    fixtures: !real,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inp = loadInputs();
  // Fixture runs go to the (gitignored) cache dir so a fixture rank.json can never be committed by accident.
  const out = inp.fixtures ? join(cacheDir, "rank.fixtures.json") : data("rank.json");
  const items = await buildItems(inp, typesafeGoal(process.env.TYPESAFE_API_KEY));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ items }, null, 2) + "\n");
  console.log(`${items.length} items -> ${out}${inp.fixtures ? " (FIXTURE INPUTS: do not commit)" : ""}`);
  console.log(`typesafe: ${usage.calls} calls, ${usage.cached} cached, ${usage.failed} failed, ${usage.input_tokens} in / ${usage.output_tokens} out tokens; model ${[...usage.models].join(",") || "(all cached)"}`);
  for (const k of FACTOR_ORDER) console.log(`null ${k}: ${items.filter((i) => i.factors!.find((f) => f.key === k)!.value === null).length}`);
}
