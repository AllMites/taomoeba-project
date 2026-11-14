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
  }),
  tested: z.object({ runs: z.number(), test_dates: z.number() }),
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
  return r.data.values.length === n * N ? r.data : null; // an incomplete grid would silently misplace every value
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
};

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
  return out.map(({ change, to }) => {
    const there = predict(doc, to);
    if (!here.possible || !there.possible) return { change, to, note: "not a possible mix" };
    const sup = support(there).level;
    return {
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
