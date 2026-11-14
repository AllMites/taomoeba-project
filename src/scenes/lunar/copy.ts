import type { HabitatPreset } from "../../contracts/index.ts";

/** The persistent limits line. Two sentences, each under 25 words. */
export const LIMITS = [
  "Illustration, not a simulation.",
  // Not "weightless and Earth-gravity results bracket it": flammability is not known to sit between the two
  // (partial gravity can be the worst case), so the line claims only what the record shows.
  "No fire experiment on record ran in Moon gravity.",
] as const;

export const NOT_ON_RECORD = "Not on record";

/** One side of the comparison, as shown under its flame. */
export type AirSide = {
  key: string;
  /** "ISS air", "Moon Base air". */
  name: string;
  /** "21% oxygen", or Not on record. */
  oxygen: string;
  /** "101.3 kPa", or Not on record. */
  pressure: string;
  /** Flame inputs; undefined when the record has no oxygen value (no flame is drawn). */
  o2Percent: number | undefined;
  pressureKPa: number | undefined;
};

const num = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function airSide(h: HabitatPreset | undefined, fallbackName: string): AirSide {
  const o2 = num(h?.o2Percent);
  const p = num(h?.pressureKPa);
  return {
    key: h?.id ?? fallbackName,
    name: `${h?.label ?? fallbackName} air`,
    oxygen: o2 === undefined ? NOT_ON_RECORD : `${fmt(o2)}% oxygen`,
    pressure: p === undefined ? NOT_ON_RECORD : `${fmt(p)} kPa`,
    o2Percent: o2,
    pressureKPa: p,
  };
}

/**
 * The sides to draw. Left is always ISS air (the air almost every station fire test used);
 * right is the picked habitat. When the pick is ISS, or its air matches ISS exactly, one flame.
 */
export function sidesFor(picked: HabitatPreset | undefined, iss: HabitatPreset | undefined): { sides: AirSide[]; same: boolean } {
  const left = airSide(picked?.id === "iss" ? picked : iss, "ISS");
  if (!picked) return { sides: [left, airSide(undefined, "Your habitat")], same: false };
  const right = airSide(picked, "Your habitat");
  const same = picked.id === "iss" || (left.o2Percent === right.o2Percent && left.pressureKPa === right.pressureKPa && left.o2Percent !== undefined);
  return { sides: same ? [right] : [left, right], same };
}

/** Line above the flames. */
export function compareLine(same: boolean, pickedIss: boolean): string {
  if (same && pickedIss) return "You picked the station: its air is the reference, so one flame is shown.";
  return same
    ? "Your habitat has the same air as the station, so one flame is shown."
    : "Same flame, same airflow. Only the air differs.";
}
