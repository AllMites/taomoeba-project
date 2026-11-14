import { z } from "zod";

// Precomputed predictions of the team's models (public/data/whatif.json, made by the model package's 06_whatif_grid.py).
// The page only looks numbers up in this grid; it never computes a prediction of its own.

const Mix = z.object({ gas: z.enum(["n2", "co2", "he"]), amount: z.number() });
export type Mix = z.infer<typeof Mix>;
export type Gas = Mix["gas"];

export const WhatIfDoc = z.object({
  made: z.string(),
  about: z.string(),
  axes: z.object({
    fuel: z.array(z.string()).min(1),
    mix: z.array(Mix).min(1),
    o2: z.array(z.number()).min(2),
    p_mmHg: z.array(z.number()).min(1),
    d0: z.array(z.number()).min(1),
  }),
  values: z.array(z.number().int()),
  models: z.object({
    ext_diameter: z.object({ name: z.string(), rmse_mm: z.number(), band_mm: z.number(), band_coverage: z.number() }),
    disruption: z.object({ name: z.string(), auc: z.number(), typical_rate: z.number() }),
    burning_rate: z.object({ name: z.string(), rmse: z.number(), unit: z.string() }),
    // d^2-law check: burn time from the table's own numbers vs measured burn time (FLEX runs that ended in flame-out)
    d2law: z.object({ runs: z.number(), corr: z.number(), median_rel_err: z.number() }).optional(),
  }),
  tested: z.object({ runs: z.number(), test_dates: z.number() }),
  // Textbook physics stored beside the grid (model package physics.py, checked in 07_physics_check.py)
  theory: z
    .object({
      k: z.array(z.number().int()), // theory burning rate *1000, row-major fuel, mix, o2
      gravity: z.object({ earth: z.array(z.number().int()), moon: z.array(z.number().int()) }), // factor *1000, mix, o2, p, d0
      measured_over_theory: z.record(z.string(), z.number()),
      direction_agreement: z.record(z.string(), z.number()),
      rmse: z.object({ ridge: z.number(), ridge_plus_theory: z.number(), theory_scaled: z.number() }),
    })
    .optional(),
});
export type WhatIfDoc = z.infer<typeof WhatIfDoc>;

/** One index per axis, so a selection is always a real grid point. */
export type Sel = { fuel: number; mix: number; o2: number; p: number; d0: number };

export type Prediction =
  | { possible: false }
  | {
      possible: true;
      extDiameterMm: number;
      bandMm: [number, number];
      pDisruption: number;
      burningRate: number;
      inRange: boolean;
      similarRuns: number; // tight neighbourhood (same rule as predict.applicability in the model package)
      nearbyRuns: number; // wide neighbourhood
    };

const N = 6; // values per point

export function parseDoc(raw: unknown): WhatIfDoc | null {
  const r = WhatIfDoc.safeParse(raw);
  if (!r.success) return null;
  const a = r.data.axes;
  const n = a.fuel.length * a.mix.length * a.o2.length * a.p_mmHg.length * a.d0.length;
  if (r.data.values.length !== n * N) return null; // an incomplete grid would silently misplace every value
  const t = r.data.theory;
  const nk = a.fuel.length * a.mix.length * a.o2.length;
  const ng = a.mix.length * a.o2.length * a.p_mmHg.length * a.d0.length;
  if (t && (t.k.length !== nk || t.gravity.earth.length !== ng || t.gravity.moon.length !== ng)) return { ...r.data, theory: undefined };
  return r.data;
}

/** Row-major position of a selection (fuel, mix, o2, pressure, d0), as written by the grid script. */
export function indexOf(doc: WhatIfDoc, s: Sel): number {
  const a = doc.axes;
  return (((s.fuel * a.mix.length + s.mix) * a.o2.length + s.o2) * a.p_mmHg.length + s.p) * a.d0.length + s.d0;
}

export function predict(doc: WhatIfDoc, s: Sel): Prediction {
  const i = indexOf(doc, s) * N;
  const [d, pd, br, inR, sim, wide] = doc.values.slice(i, i + N);
  if (d < 0) return { possible: false };
  const ext = d / 100;
  const h = doc.models.ext_diameter.band_mm;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    possible: true,
    extDiameterMm: ext,
    bandMm: [r2(Math.max(ext - h, 0)), r2(ext + h)],
    pDisruption: pd / 1000,
    burningRate: br / 1000,
    inRange: inR === 1,
    similarRuns: sim,
    nearbyRuns: wide,
  };
}

/** Chance of break-up across the whole oxygen axis, other choices fixed (for the trend chart); null where impossible. */
export function o2Curve(doc: WhatIfDoc, s: Sel): { o2: number; p: number | null }[] {
  return doc.axes.o2.map((o2, i) => {
    const r = predict(doc, { ...s, o2: i });
    return { o2, p: r.possible ? r.pDisruption : null };
  });
}

export const nearest = (values: number[], v: number) =>
  values.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(values[best] - v) ? i : best), 0);

/** Moon Base / rover air (30% O2 or more at 620 mmHg or less): the report says extinction diameter is not valid there. */
export const isMoonLike = (doc: WhatIfDoc, s: Sel) => doc.axes.o2[s.o2] >= 0.3 && doc.axes.p_mmHg[s.p] <= 620;

export type Level = "good" | "sparse" | "far" | "out" | "impossible";
export type Support = { level: Level; text: string };

export const LEVEL_LABEL: Record<Level, string> = {
  good: "many similar runs",
  sparse: "few similar runs",
  far: "no run nearby",
  out: "outside tested ranges",
  impossible: "not a possible mix",
};

const runs = (n: number) => `${n} ${n === 1 ? "run" : "runs"}`;

/** How far to trust this point, in plain words: tested ranges, and how many real FLEX runs lie close by. */
export function support(p: Prediction): Support {
  if (!p.possible) return { level: "impossible", text: "This mix is not possible: oxygen plus the added gas would be more than 100%." };
  if (!p.inRange) return { level: "out", text: "Outside what FLEX tested: these numbers are extrapolation. Do not rely on them." };
  if (p.similarRuns >= 5) return { level: "good", text: `Inside the tested conditions, with ${runs(p.similarRuns)} very like this one.` };
  if (p.nearbyRuns > 0)
    return {
      level: "sparse",
      text:
        p.similarRuns > 0
          ? `Only ${runs(p.similarRuns)} very like this one (${p.nearbyRuns} in the wider area): read it as a trend.`
          : `No run very like this one, ${runs(p.nearbyRuns)} in the wider area: read it as a trend.`,
    };
  return {
    level: "far",
    text: "Each value was tested, but never in this combination: no FLEX run is near it. Treat it as a rough guess.",
  };
}

// ---- textbook physics beside the data model ---------------------------------------------------------------------

/** Textbook (classical droplet theory) burning rate, mm2/s, or null when absent or impossible. No pressure or size term. */
export function theoryRate(doc: WhatIfDoc, s: Sel): number | null {
  const t = doc.theory;
  if (!t) return null;
  const v = t.k[(s.fuel * doc.axes.mix.length + s.mix) * doc.axes.o2.length + s.o2];
  return v < 0 ? null : v / 1000;
}

export type World = "earth" | "moon";

/** Textbook buoyancy factor: how many times faster than with no gravity. A scaling estimate, not data. */
export function gravityFactor(doc: WhatIfDoc, s: Sel, world: World): number | null {
  const t = doc.theory;
  if (!t) return null;
  const a = doc.axes;
  const v = t.gravity[world][((s.mix * a.o2.length + s.o2) * a.p_mmHg.length + s.p) * a.d0.length + s.d0];
  return v < 0 ? null : v / 1000;
}

/** Share of the textbook value that FLEX runs of this fuel actually reached (median), e.g. 0.67. */
export const measuredShare = (doc: WhatIfDoc, s: Sel): number | null => doc.theory?.measured_over_theory[doc.axes.fuel[s.fuel]] ?? null;

// ---- gas mix helpers -----------------------------------------------------------------------------------------

export const GAS_LABEL: Record<Gas, string> = { n2: "Nitrogen only", co2: "Add carbon dioxide", he: "Add helium" };
export const gasOf = (doc: WhatIfDoc, mix: number): Gas => doc.axes.mix[mix].gas;
/** Indexes of the mixes for one gas, in increasing amount. */
export const mixesOf = (doc: WhatIfDoc, gas: Gas) => doc.axes.mix.map((m, i) => ({ m, i })).filter((x) => x.m.gas === gas).map((x) => x.i);

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function mixLabel(m: Mix): string {
  if (m.gas === "n2") return "oxygen and nitrogen";
  return `${pct(m.amount)} ${m.gas === "co2" ? "CO₂" : "helium"} added`;
}

export function pressureLabel(mmHg: number): string {
  if (Math.abs(mmHg - 527.5) < 1) return "527.5 mmHg (Moon Base, rover)";
  if (mmHg === 760) return "760 mmHg (ISS, sea level)";
  if (mmHg === 1520) return "1520 mmHg (2 atmospheres)";
  if (mmHg === 2280) return "2280 mmHg (3 atmospheres)";
  return `${mmHg} mmHg`;
}

/** One-line summary of a setting, for the comparison. */
export function describe(doc: WhatIfDoc, s: Sel): string {
  const a = doc.axes;
  const fuel = a.fuel[s.fuel][0].toUpperCase() + a.fuel[s.fuel].slice(1);
  return `${fuel}, ${pct(a.o2[s.o2])} O₂, ${mixLabel(a.mix[s.mix])}, ${a.p_mmHg[s.p]} mmHg, ${a.d0[s.d0]} mm droplet`;
}

/** Oxygen and pressure of a habitat as the nearest grid point, or null when the habitat is outside the grid (suit). */
export function habitatPoint(doc: WhatIfDoc, o2Percent: number, pressureKPa: number): { o2: number; p: number } | null {
  const o2 = o2Percent / 100;
  const mmHg = pressureKPa * 7.50062;
  const a = doc.axes;
  if (o2 < a.o2[0] - 0.005 || o2 > a.o2[a.o2.length - 1] + 0.005) return null;
  if (mmHg < a.p_mmHg[0] * 0.95 || mmHg > a.p_mmHg[a.p_mmHg.length - 1] * 1.05) return null;
  return { o2: nearest(a.o2, o2), p: nearest(a.p_mmHg, mmHg) };
}

// ---- what matters most here: one step in each input, read from the same grid ---------------------------------

export type Effect = {
  change: string;
  to: Sel;
  dChance?: number; // percentage points
  dExt?: number; // mm
  dBurn?: number; // mm2/s
  note?: string; // the changed point is impossible, out of range or far from data
  theory?: "faster" | "slower" | "none"; // what the textbook formula says this change does to burning rate
  agrees?: boolean; // model and textbook move the same way (only when the textbook has a term for the change)
};

/** Smallest model change in burning rate (mm2/s) read as a real direction; smaller is "about the same". */
const BURN_SAME = 0.01;

export function effects(doc: WhatIfDoc, s: Sel): Effect[] {
  const a = doc.axes;
  const out: { change: string; to: Sel }[] = [];
  const step = (k: "o2" | "p" | "d0", by: number, len: number) => {
    const up = s[k] + by <= len - 1;
    return { to: { ...s, [k]: up ? s[k] + by : s[k] - by } as Sel, up };
  };
  const o = step("o2", 5, a.o2.length);
  out.push({ change: `${o.up ? "+" : "−"}5% oxygen (to ${pct(a.o2[o.to.o2])})`, to: o.to });
  const p = step("p", 1, a.p_mmHg.length);
  out.push({ change: `Pressure ${a.p_mmHg[s.p]} → ${a.p_mmHg[p.to.p]} mmHg`, to: p.to });
  const d = step("d0", 1, a.d0.length);
  out.push({ change: `Droplet ${a.d0[s.d0]} → ${a.d0[d.to.d0]} mm`, to: d.to });
  const gas = gasOf(doc, s.mix);
  if (gas === "n2") {
    for (const g of ["co2", "he"] as Gas[]) {
      const first = mixesOf(doc, g)[0];
      if (first !== undefined) out.push({ change: `Add ${pct(a.mix[first].amount)} ${g === "co2" ? "CO₂" : "helium"}`, to: { ...s, mix: first } });
    }
  } else {
    const list = mixesOf(doc, gas);
    const at = list.indexOf(s.mix);
    const next = at < list.length - 1 ? list[at + 1] : list[at - 1];
    if (next !== undefined) out.push({ change: `${gas === "co2" ? "CO₂" : "Helium"} ${pct(a.mix[s.mix].amount)} → ${pct(a.mix[next].amount)}`, to: { ...s, mix: next } });
  }
  out.push({ change: `Switch to ${a.fuel[s.fuel === 0 ? 1 : 0]}`, to: { ...s, fuel: s.fuel === 0 ? 1 : 0 } });

  const here = predict(doc, s);
  const k0 = theoryRate(doc, s);
  return out.map(({ change, to }) => {
    const there = predict(doc, to);
    if (!here.possible || !there.possible) return { change, to, note: "not a possible mix" };
    const sup = support(there).level;
    const k1 = theoryRate(doc, to);
    let theory: Effect["theory"];
    let agrees: boolean | undefined;
    if (k0 !== null && k1 !== null) {
      const dk = k1 - k0;
      theory = Math.abs(dk) < 1e-9 ? "none" : dk > 0 ? "faster" : "slower";
      const dm = there.burningRate - here.burningRate;
      if (theory !== "none" && Math.abs(dm) >= BURN_SAME) agrees = (dm > 0) === (theory === "faster");
    }
    return {
      theory,
      agrees,
      change,
      to,
      dChance: Math.round((there.pDisruption - here.pDisruption) * 100),
      dExt: Math.round((there.extDiameterMm - here.extDiameterMm) * 100) / 100,
      dBurn: Math.round((there.burningRate - here.burningRate) * 1000) / 1000,
      note: sup === "out" ? "outside the tested ranges" : sup === "far" ? "no FLEX run near that point" : undefined,
    };
  });
}

/** Signed, readable change: "+18 pts", "−0.12 mm", "0" stays "no change". */
export function signed(x: number | undefined, unit: string, digits = 0): string {
  if (x === undefined) return "–";
  const v = Number(x.toFixed(digits));
  if (v === 0) return "no change";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)} ${unit}`;
}

// ---- the predicted burn (d^2-law): diameter^2 falls at the burning rate until the flame goes out ---------------

export type Burn = {
  d0: number; // mm
  k: number; // burning rate, mm2/s
  dEnd: number; // mm: predicted extinction diameter, or 0 when the droplet burns away
  tEnd: number; // s
  ends: "flame-out" | "burns-away";
};

/** Smallest extinction diameter drawn as a flame-out; below it the droplet is shown burning away completely. */
const MIN_EXT_MM = 0.05;

export function burnPlan(d0: number, k: number, extMm: number): Burn | null {
  if (!(k > 0.01) || !(d0 > 0)) return null; // no meaningful burning rate: nothing to animate
  const out = extMm >= MIN_EXT_MM && extMm < d0;
  const dEnd = out ? extMm : 0;
  return { d0, k, dEnd, tEnd: (d0 * d0 - dEnd * dEnd) / k, ends: out ? "flame-out" : "burns-away" };
}

/** Droplet diameter (mm) after t seconds, by the d^2-law, never below the end diameter. */
export function diameterAt(b: Burn, t: number): number {
  const tt = Math.min(Math.max(t, 0), b.tEnd);
  return Math.sqrt(Math.max(b.d0 * b.d0 - b.k * tt, b.dEnd * b.dEnd));
}

/** Playback speed so a burn never takes more than `maxSeconds` on screen (1 = real time). */
export const playbackSpeed = (b: Burn, maxSeconds = 12) => Math.max(1, Math.ceil(b.tEnd / maxSeconds));
