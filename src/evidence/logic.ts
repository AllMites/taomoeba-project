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

/** Plain word for a 0 to 1 factor value. null = not on record. Same bands as the card rationale (scripts/rank/build.ts). */
export function strengthWord(v: number | null): string {
  if (v === null) return NOT_ON_RECORD;
  if (v >= 0.8) return "Strong";
  if (v >= 0.4) return "Partial";
  return "Weak";
}

export const scoreText = (score: number) => `Score ${score.toFixed(2)} of 1`;

/** Unit words a source header may carry at its end, as "Width (cm)" or "Burn time; s". */
const HEADER_UNIT = /\s*(?:\(\s*(?:atm|mmhg|bar|kpa|psi|c|k|s|sec|seconds?|min|minutes?|cm\/s|mm|cm|m|w|mg\/s|sccm|ppm|percent|%)\s*\)|;\s*(?:atm|mmhg|bar|kpa|psi|c|k|s|sec|seconds?|min|minutes?|cm\/s|mm|cm|m|w|mg\/s|sccm|ppm|percent|%|mole fraction))\s*$/i;

/**
 * Run-table column heading. Values are stored in `unit`, which can differ from the unit in the source
 * header (pressure in atm or mmHg is stored as kPa), so the source unit is dropped and `unit` shown once.
 */
export function columnHeader(c: { original: string; unit: string | null }): string {
  const original = restoreMicro(c.original);
  if (!c.unit) return original;
  return `${original.replace(HEADER_UNIT, "")} (${c.unit})`;
}

/** NASA's file lost the micro sign: "?-g Burn Length" was "µ-g Burn Length". Say it in words. Other typos ("Samle") stay as the source has them. */
const restoreMicro = (h: string) => h.replace(/^\?-g\b/, "Microgravity");

/**
 * Word for one factor in the drawer. Goal fit takes the band its own reason states ("rated the fit high"),
 * so the word cannot disagree with the sentence under it; other factors use strengthWord.
 */
export function factorWord(f: { key: string; value: number | null; reason: string }): string {
  if (f.key === "goalFit" && f.value !== null) {
    const m = /rated the fit (high|medium|low)\b/i.exec(f.reason);
    if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  }
  return strengthWord(f.value);
}

/** Only http(s) URLs from the data become links; anything else is shown as plain text. */
export function safeHref(url: string | null | undefined): string | null {
  const u = url?.trim();
  return u && /^https?:\/\//i.test(u) ? u : null;
}

/** True when the open drawer switches from one experiment to another (Related), so focus must move. */
export const isSwitch = (prev: string | null, next: string | null) => prev !== null && next !== null && prev !== next;

/** Rationale lines for the picked habitat only; never every habitat's lines when the preset is missing. */
export const rationaleFor = <C extends { kind: string; investigationId: string; habitat?: string }>(claims: C[], investigationId: string, habitat: string) =>
  claims.filter((c) => c.kind === "rationale" && c.investigationId === investigationId && c.habitat === habitat);
