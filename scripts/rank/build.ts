// Builds public/data/rank.json: one RankItem per investigation x habitat.  Run: node scripts/rank/build.ts
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HabitatPreset } from "../../src/contracts/habitat.ts";
import type { Investigation } from "../../src/contracts/investigation.ts";
import type { RankItem } from "../../src/contracts/rank.ts";

/** Weight on SI relevance; the rest goes to condition overlap. */
export const ALPHA = 0.5;
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const data = (p: string) => join(root, "public/data", p);
const cacheDir = join(root, "scripts/rank/.cache");

type OverlapRow = { investigationId: string; habitat: string; overlap: number | null; dimsUsed: 0 | 1 | 2 };
type Claimish = { id: string; investigationId: string };
export type Inputs = { investigations: Investigation[]; overlaps: OverlapRow[]; habitats: HabitatPreset[]; claims: Claimish[]; fixtures: boolean };

export function computeScore(siRelevance: number | null, overlap: number | null): number {
  if (overlap === null) return siRelevance ?? 0;
  if (siRelevance === null) return overlap;
  return ALPHA * siRelevance + (1 - ALPHA) * overlap;
}

const num = (n: number) => String(Math.round(n * 10) / 10);
const range = (r: [number, number], unit: string) => (r[0] === r[1] ? `${num(r[0])}${unit}` : `${num(r[0])} to ${num(r[1])}${unit}`);
const covers = (r: [number, number], v: number) => v >= r[0] && v <= r[1];

/** One plain sentence from the numbers; no model call. */
export function rationale(inv: Investigation, hab: HabitatPreset, overlap: number | null): string {
  if (overlap === null) return "No oxygen or pressure conditions were recorded, so this rests on how relevant its goals are alone.";
  const tested: string[] = [], habit: string[] = [], hit: boolean[] = [];
  if (inv.o2Range) { tested.push(`${range(inv.o2Range, "% oxygen")}`); habit.push(`${num(hab.o2Percent)}%`); hit.push(covers(inv.o2Range, hab.o2Percent)); }
  if (inv.pressureRange) { tested.push(range(inv.pressureRange, " kPa")); habit.push(`${num(hab.pressureKPa)} kPa`); hit.push(covers(inv.pressureRange, hab.pressureKPa)); }
  if (!tested.length) return "No oxygen or pressure conditions were recorded, so this rests on how relevant its goals are alone.";
  const verb = hit.every(Boolean) ? "which covers" : hit.some(Boolean) ? "which covers only part of" : "which does not reach";
  return `Tested at ${tested.join(" and ")}, ${verb} this habitat's ${habit.join(" and ")}.`;
}

export type RelevanceFn = (inv: Investigation, hab: HabitatPreset) => Promise<number | null>;

export async function buildItems(inp: Inputs, relevance: RelevanceFn): Promise<RankItem[]> {
  const items: RankItem[] = [];
  for (const inv of inp.investigations) {
    for (const hab of inp.habitats) {
      const row = inp.overlaps.find((o) => o.investigationId === inv.id && o.habitat === hab.id);
      const overlap = row?.overlap ?? null;
      const si = await relevance(inv, hab);
      items.push({
        id: `rank-${inv.id}-${hab.id}`,
        investigationId: inv.id,
        habitat: hab.id,
        overlap,
        dimsUsed: overlap === null ? 0 : (row?.dimsUsed ?? 0),
        siRelevance: si,
        score: computeScore(si, overlap),
        rationale: rationale(inv, hab, overlap),
        claimIds: inp.claims.filter((c) => c.investigationId === inv.id).map((c) => c.id),
        provenance: overlap === null ? "illustrative" : "measured",
      });
    }
  }
  return items;
}

// ---- TypeSafe relevance, cached on disk by input hash ----
export const usage = { calls: 0, cached: 0, input_tokens: 0, output_tokens: 0 };

export function typesafeRelevance(key: string | undefined, fetchImpl: typeof fetch = fetch): RelevanceFn {
  return async (inv, hab) => {
    const state = {
      habitat: { name: hab.label, oxygenPercent: hab.o2Percent, pressureKPa: hab.pressureKPa, note: hab.note },
      investigation: { title: inv.title, objectives: inv.objectives, fuel: inv.fuel, measurements: inv.measurements, pds: inv.pds },
    };
    const levels = [
      "Has nothing to do with fire risk in this habitat",
      "Only loosely related to fire risk in this habitat",
      "Partly informs fire prevention, detection or suppression here",
      "Clearly informs fire safety decisions for this habitat",
      "Directly answers a key fire-safety question for this habitat",
    ];
    const body = {
      model: MODEL,
      state,
      questions: {
        relevance: {
          type: "score",
          instructions: "How much do this investigation's objectives help answer the fire-safety question for the habitat?",
          criteria: levels,
        },
      },
    };
    const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const file = join(cacheDir, `${hash}.json`);
    if (existsSync(file)) {
      usage.cached++;
      return (JSON.parse(readFileSync(file, "utf8")) as { value: number }).value;
    }
    if (!key) return null;
    const res = await fetchImpl(TYPESAFE_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { console.error(`typesafe ${res.status} for ${inv.id}/${hab.id}`); return null; }
    const j = (await res.json()) as { answers: { relevance: { score: number } }; usage: { input_tokens: number; output_tokens: number } };
    usage.calls++; usage.input_tokens += j.usage.input_tokens; usage.output_tokens += j.usage.output_tokens;
    const value = Math.round((j.answers.relevance.score / (levels.length - 1)) * 1000) / 1000;
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(file, JSON.stringify({ value }));
    return value;
  };
}

// ---- main ----
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
  const items = await buildItems(inp, typesafeRelevance(process.env.TYPESAFE_API_KEY));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ items }, null, 2) + "\n");
  console.log(`${items.length} items -> ${out}${inp.fixtures ? " (FIXTURE INPUTS: do not commit)" : ""}`);
  console.log(`typesafe: ${usage.calls} calls, ${usage.cached} cached, ${usage.input_tokens} in / ${usage.output_tokens} out tokens`);
}
