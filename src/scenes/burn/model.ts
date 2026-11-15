// The model burn: a fuel droplet in the picked base's air, sized and timed by the team's models (src/whatif, read only).
// Pure, so the seeker-to-droplet mapping and the no-prediction case are tested without a browser.
import type { HabitatPreset } from "../../contracts/index.ts";
import {
  burnPlan,
  diameterAt,
  habitatPoint,
  isMoonLike,
  mixesOf,
  nearest,
  playbackSpeed,
  predict,
  support,
  type Burn,
  type Level,
  type Sel,
  type WhatIfDoc,
} from "../../whatif/logic.ts";

/** The settings a viewer picks; oxygen and pressure always come from the base. */
export type BurnPick = Omit<Sel, "o2" | "p">;

export type BurnCase =
  | { kind: "none"; reason: "outside" | "moon-like" | "no-burn" | "earth"; text: string }
  | { kind: "plan"; plan: Burn; sel: Sel; extMm: number; rate: number; level: Level; levelText: string; speed: number };

/** Methanol (the first fuel), oxygen and nitrogen only, the droplet size nearest 2 mm: the plain start. */
export function startPick(doc: WhatIfDoc): BurnPick {
  return { fuel: 0, mix: Math.max(0, mixesOf(doc, "n2")[0] ?? 0), d0: nearest(doc.axes.d0, 2) };
}

export const NO_PREDICTION = {
  outside: "The team's model has no prediction for this air: it is outside what the FLEX droplet tests covered.",
  "moon-like":
    "The team's model has no prediction for this air: the report says its flame-out size is not valid at Moon Base oxygen and pressure. The flame is drawn steady, with no numbers.",
  "no-burn": "The model predicts no meaningful burning for this setting, so there is no burn to play.",
  earth:
    "The team's model is fitted to droplets burning in microgravity (the FLEX tests). At 1 g rising hot gas reshapes the flame, so on Earth it is drawn steady, with no numbers.",
} as const;

/** What the model says for this base and these settings. */
export function burnCase(doc: WhatIfDoc, air: Pick<HabitatPreset, "o2Percent" | "pressureKPa">, pick: BurnPick, earth = false): BurnCase {
  if (earth) return { kind: "none", reason: "earth", text: NO_PREDICTION.earth };
  const hp = habitatPoint(doc, air.o2Percent, air.pressureKPa);
  if (!hp) return { kind: "none", reason: "outside", text: NO_PREDICTION.outside };
  const sel: Sel = { ...pick, ...hp };
  if (isMoonLike(doc, sel)) return { kind: "none", reason: "moon-like", text: NO_PREDICTION["moon-like"] };
  const pr = predict(doc, sel);
  const sup = support(pr);
  if (!pr.possible) return { kind: "none", reason: "no-burn", text: sup.text };
  const plan = burnPlan(doc.axes.d0[sel.d0], pr.burningRate, pr.extDiameterMm);
  if (!plan) return { kind: "none", reason: "no-burn", text: NO_PREDICTION["no-burn"] };
  return { kind: "plan", plan, sel, extMm: pr.extDiameterMm, rate: pr.burningRate, level: sup.level, levelText: sup.text, speed: playbackSpeed(plan) };
}

export type DropletNow = { d: number; lit: boolean; phase: string };

/** The droplet at seeker time t (seconds of the real burn). */
export function dropletAt(c: BurnCase, t: number, d0Fallback: number): DropletNow {
  if (c.kind === "none") return { d: d0Fallback, lit: true, phase: "Burning (no model timing)" };
  const d = diameterAt(c.plan, t);
  const end = t >= c.plan.tEnd - 1e-9;
  if (t <= 0) return { d, lit: true, phase: "Ignition" };
  if (end) return { d, lit: false, phase: c.plan.ends === "flame-out" ? "Flame out" : "Burned away" };
  return { d, lit: true, phase: "Burning, shrinking by the d² law" };
}

/** Support level in a word, shown with a mark: solid (in range), half (sparse), dashed (out of range). */
export const SUPPORT_WORD: Record<Level, { word: string; mark: "solid" | "half" | "dashed" }> = {
  good: { word: "In range", mark: "solid" },
  sparse: { word: "Sparse", mark: "half" },
  far: { word: "Sparse", mark: "half" },
  out: { word: "Out of range", mark: "dashed" },
  impossible: { word: "Out of range", mark: "dashed" },
};
