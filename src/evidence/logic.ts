export const NOT_ON_RECORD = "Not on record";

/** "12 to 34 %", "21 %" for a single value, null when the range is missing. */
export function formatRange(range: readonly [number, number] | null | undefined, unit: string): string | null {
  if (!range) return null;
  const [lo, hi] = range;
  return lo === hi ? `${lo} ${unit}` : `${lo} to ${hi} ${unit}`;
}

/** Free-text fields say "Not stated" when the record is silent; show that as "Not on record". */
export function textOrNotOnRecord(v: string | null | undefined): string | null {
  const t = v?.trim();
  return !t || t.toLowerCase() === "not stated" ? null : t;
}

export type Basis = "table" | "record" | null | undefined;

export interface ConditionRow {
  key: string;
  label: string;
  /** null = show "Not on record" */
  value: string | null;
  fromTable: boolean;
}

export interface ConditionInput {
  o2Range: [number, number] | null;
  pressureRange: [number, number] | null;
  airflowRange: [number, number] | null;
  fuel: string;
  sampleShape: string;
  hardware: string;
  conditionBasis?: { o2: Basis; pressure: Basis };
}

/** Conditions always return all six rows; missing values stay null so the UI says "Not on record". */
export function conditionRows(i: ConditionInput): ConditionRow[] {
  const b = i.conditionBasis;
  return [
    { key: "o2", label: "Oxygen", value: formatRange(i.o2Range, "%"), fromTable: b?.o2 === "table" && !!i.o2Range },
    { key: "pressure", label: "Pressure", value: formatRange(i.pressureRange, "kPa"), fromTable: b?.pressure === "table" && !!i.pressureRange },
    { key: "airflow", label: "Airflow", value: formatRange(i.airflowRange, "cm/s"), fromTable: false },
    { key: "fuel", label: "Fuel", value: textOrNotOnRecord(i.fuel), fromTable: false },
    { key: "shape", label: "Sample shape", value: textOrNotOnRecord(i.sampleShape), fromTable: false },
    { key: "hardware", label: "Hardware", value: textOrNotOnRecord(i.hardware), fromTable: false },
  ];
}

export interface BlockInput {
  summary: number;
  findings: number;
  rationale: number;
  factors: number;
  sensors: number;
  measurements: number;
  changing: number;
  related: number;
}

/** Which optional blocks have something to show. Header and conditions always show, so they are not listed. */
export function visibleBlocks(i: BlockInput) {
  return {
    summarize: i.summary + i.findings + i.rationale > 0,
    why: i.factors > 0,
    measured: i.sensors + i.measurements > 0,
    changed: i.changing > 0,
    related: i.related > 0,
  };
}

/** Plain word for a 0 to 1 factor value. null = not on record. */
export function strengthWord(v: number | null): string {
  if (v === null) return NOT_ON_RECORD;
  if (v >= 0.75) return "Strong";
  if (v >= 0.4) return "Partial";
  return "Weak";
}

export const scoreText = (score: number) => `Score ${score.toFixed(2)} of 1`;
