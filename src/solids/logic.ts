import { z } from "zod";

// "Solid materials": two real NASA tables (public/data/solids.json, built by scripts/solids/build.py).
export const Outcome = z.enum(["burned", "quenched", "blowoff", "no-blowoff", "no-ignition"]);
export type Outcome = z.infer<typeof Outcome>;

const Source = z.object({ id: z.string(), title: z.string(), url: z.string().url(), where: z.string() });
const Test = z.object({
  test: z.string(),
  series: z.string(),
  widthCm: z.number(),
  flowFrom: z.number().positive(),
  flowTo: z.number().positive(),
  o2: z.number(),
  outcome: Outcome,
  o2Uncertain: z.boolean().optional(),
});
export type FabricTest = z.infer<typeof Test>;
const Level = z.enum(["none", "part", "all"]);
export type Level = z.infer<typeof Level>;
const Side = z.object({ level: Level, text: z.string() });
const Sample = z.object({
  sample: z.string(),
  material: z.string(),
  thickness: z.string(),
  flowDirection: z.string(),
  o2: z.union([z.number(), z.string()]),
  space: Side,
  earth: Side,
  comparable: z.boolean().optional(),
  note: z.string().optional(),
});
export type SaffireSample = z.infer<typeof Sample>;

export const SolidsDoc = z.object({
  about: z.string(),
  flammability: z.object({
    source: Source,
    material: z.string(),
    flow: z.string(),
    findings: z.array(z.string()),
    tests: z.array(Test).min(1),
    excluded: z.array(z.string()),
    excludedWhy: z.string(),
    maxO2: z.number(),
    minBurnO2: z.number(),
    counts: z.record(z.string(), z.number()),
  }),
  saffire: z.object({
    source: Source,
    o2: z.tuple([z.number(), z.number()]),
    flowCmS: z.array(z.number()),
    sampleLengthCm: z.number(),
    samples: z.array(Sample).min(1),
    skipped: z.array(z.string()),
    skippedWhy: z.string(),
  }),
});
export type SolidsDoc = z.infer<typeof SolidsDoc>;

export const parseSolids = (raw: unknown): SolidsDoc | null => {
  const r = SolidsDoc.safeParse(raw);
  return r.success ? r.data : null;
};

/** Plain words for each outcome, in legend order. */
export const OUTCOME: Record<Outcome, { label: string; text: string }> = {
  burned: { label: "Burned", text: "Flame burned; the table notes no limit" },
  quenched: { label: "Went out, too little air", text: "Flame went out as the crew turned the airflow down" },
  "no-blowoff": { label: "Still burning at high flow", text: "Airflow turned up; the flame was not blown out" },
  blowoff: { label: "Blown out", text: "Airflow turned up until the flame was blown out" },
  "no-ignition": { label: "Would not light", text: "The igniter could not start a flame" },
};
export const OUTCOME_ORDER: Outcome[] = ["burned", "quenched", "no-blowoff", "blowoff", "no-ignition"];

/** Chart frame: flow on a log axis (cm/s), oxygen on a linear axis (% by volume). */
export const X = { min: 1.5, max: 70, ticks: [2, 3, 5, 10, 20, 50] };
export const BOX = { w: 640, h: 340, l: 52, r: 20, t: 14, b: 44 };

/** Top of the oxygen axis: room for the habitat's air when it is near; very high oxygen (the suit) is shown as off the chart. */
export const yRange = (doc: SolidsDoc, habitatO2: number) => {
  const top = habitatO2 <= 34 ? Math.max(habitatO2 + 1.5, doc.flammability.maxO2 + 2) : doc.flammability.maxO2 + 2;
  return { min: 15, max: Math.ceil(top), offChart: habitatO2 > 34 };
};

export const xPx = (v: number) => BOX.l + ((Math.log10(v) - Math.log10(X.min)) / (Math.log10(X.max) - Math.log10(X.min))) * (BOX.w - BOX.l - BOX.r);
export const yPx = (v: number, y: { min: number; max: number }) => BOX.t + ((y.max - v) / (y.max - y.min)) * (BOX.h - BOX.t - BOX.b);

/** How far the habitat's air sits above every fabric test (null when it is inside the tested range). */
export const habitatGap = (doc: SolidsDoc, habitatO2: number) => {
  const gap = Math.round((habitatO2 - doc.flammability.maxO2) * 10) / 10;
  return gap > 0 ? gap : null;
};

/** One sentence on the SAFFIRE-II comparison, counted from the table. */
export function saffireSummary(doc: SolidsDoc) {
  const s = doc.saffire.samples.filter((x) => x.comparable !== false);
  const earthWorse = s.filter((x) => rank(x.earth.level) > rank(x.space.level)).length;
  const same = s.filter((x) => x.earth.level === x.space.level).length;
  return { total: s.length, earthWorse, same, spaceWorse: s.length - earthWorse - same };
}
const rank = (l: Level) => ["none", "part", "all"].indexOf(l);

export const LEVEL: Record<Level, string> = { none: "Did not spread", part: "Part burned", all: "All burned" };

/** Every fabric test as a CSV row, for "Download the table". */
export function testsCsv(doc: SolidsDoc) {
  const head = "test,series,width_cm,flow_from_cm_s,flow_to_cm_s,o2_percent,outcome,o2_reading_uncertain";
  const rows = doc.flammability.tests.map((t) => [t.test, t.series, t.widthCm, t.flowFrom, t.flowTo, t.o2, t.outcome, t.o2Uncertain ? "yes" : ""].join(","));
  return [`# Source: ${doc.flammability.source.where}, ${doc.flammability.source.url}`, head, ...rows].join("\n") + "\n";
}
