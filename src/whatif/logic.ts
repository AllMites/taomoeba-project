import { z } from "zod";

// Precomputed predictions of the team's models (public/data/whatif.json, made by x3 06_whatif_grid.py).
// The page only looks numbers up in this grid; it never computes a prediction of its own.

export const WhatIfDoc = z.object({
  made: z.string(),
  about: z.string(),
  axes: z.object({
    fuel: z.array(z.string()).min(1),
    diluent: z.array(z.string()).min(1),
    diluent_label: z.record(z.string(), z.string()),
    o2: z.array(z.number()).min(2),
    p_mmHg: z.array(z.number()).min(1),
    d0: z.array(z.number()).min(1),
  }),
  points: z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()])),
  models: z.object({
    ext_diameter: z.object({ name: z.string(), rmse_mm: z.number(), band_mm: z.number(), band_coverage: z.number() }),
    disruption: z.object({ name: z.string(), auc: z.number(), typical_rate: z.number() }),
    burning_rate: z.object({ name: z.string(), rmse: z.number(), unit: z.string() }),
  }),
  tested: z.object({ runs: z.number(), test_dates: z.number() }),
});
export type WhatIfDoc = z.infer<typeof WhatIfDoc>;

/** One choice per axis, as indexes into doc.axes (so a selection is always a real grid point). */
export type Sel = { fuel: number; diluent: number; o2: number; p: number; d0: number };

export type Prediction = {
  extDiameterMm: number;
  bandMm: [number, number];
  pDisruption: number;
  burningRate: number;
  inRange: boolean;
  similarRuns: number;
};

export function parseDoc(raw: unknown): WhatIfDoc | null {
  const r = WhatIfDoc.safeParse(raw);
  if (!r.success) return null;
  const a = r.data.axes;
  const n = a.fuel.length * a.diluent.length * a.o2.length * a.p_mmHg.length * a.d0.length;
  return r.data.points.length === n ? r.data : null; // an incomplete grid would silently misplace every value
}

const sizes = (doc: WhatIfDoc) => [doc.axes.fuel, doc.axes.diluent, doc.axes.o2, doc.axes.p_mmHg, doc.axes.d0].map((x) => x.length);

/** Row-major position of a selection (fuel, diluent, o2, pressure, d0), as written by the grid script. */
export function indexOf(doc: WhatIfDoc, s: Sel): number {
  const [, nd, no, np, n0] = sizes(doc);
  return (((s.fuel * nd + s.diluent) * no + s.o2) * np + s.p) * n0 + s.d0;
}

export function predict(doc: WhatIfDoc, s: Sel): Prediction {
  const [d, pd, br, inR, sim] = doc.points[indexOf(doc, s)];
  const h = doc.models.ext_diameter.band_mm;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { extDiameterMm: d, bandMm: [r2(Math.max(d - h, 0)), r2(d + h)], pDisruption: pd, burningRate: br, inRange: inR === 1, similarRuns: sim };
}

/** Chance of break-up across the whole oxygen axis, other choices fixed (for the trend chart). */
export function o2Curve(doc: WhatIfDoc, s: Sel): { o2: number; p: number }[] {
  return doc.axes.o2.map((o2, i) => ({ o2, p: predict(doc, { ...s, o2: i }).pDisruption }));
}

export const nearest = (values: number[], v: number) =>
  values.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(values[best] - v) ? i : best), 0);

/** Moon Base / rover air (30% O2 or more at 620 mmHg or less): the report says extinction diameter is not valid there. */
export const isMoonLike = (doc: WhatIfDoc, s: Sel) => doc.axes.o2[s.o2] >= 0.3 && doc.axes.p_mmHg[s.p] <= 620;

export type Support = { level: "good" | "sparse" | "out"; text: string };

/** How far to trust this point, in plain words: tested range and how many real FLEX runs lie close by. */
export function support(p: Prediction): Support {
  if (!p.inRange) return { level: "out", text: "Outside what FLEX tested: these numbers are extrapolation. Do not rely on them." };
  if (p.similarRuns === 0) return { level: "sparse", text: "Inside the tested ranges, but no similar real run exists: read it as a trend." };
  if (p.similarRuns < 5)
    return {
      level: "sparse",
      text: `Inside the tested ranges, but only ${p.similarRuns} similar real ${p.similarRuns === 1 ? "run" : "runs"}: read it as a trend.`,
    };
  return { level: "good", text: `Inside the tested conditions, with ${p.similarRuns} similar real runs close by.` };
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

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function pressureLabel(mmHg: number): string {
  if (Math.abs(mmHg - 527.5) < 1) return "527.5 mmHg (Moon Base, rover)";
  if (mmHg === 760) return "760 mmHg (ISS, sea level)";
  if (mmHg === 1520) return "1520 mmHg (2 atmospheres)";
  if (mmHg === 2280) return "2280 mmHg (3 atmospheres)";
  return `${mmHg} mmHg`;
}
