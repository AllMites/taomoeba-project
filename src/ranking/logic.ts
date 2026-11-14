import type { Claim, Investigation, RankFactor, RankItem } from "../contracts/index.ts";
import type { PdsFilter } from "../app/store.ts";
import { claimsFor } from "../data/select.ts";

/** Cards shown before "Show all". */
export const TOP_COUNT = 8;
/** One fixed oxygen scale for every card, so spans can be compared by eye. */
export const O2_SCALE_MAX = 100;

export interface Row {
  /** Position in the full ranked list for this habitat, starting at 1. */
  position: number;
  item: RankItem;
  inv: Investigation;
  summary: string | null;
}

/** Join ranked items (already in order) with their experiment and summary sentence. Items with no experiment are dropped. */
export function buildRows(ranked: RankItem[], investigations: Investigation[], claims: Claim[]): Row[] {
  const byId = new Map(investigations.map((i) => [i.id, i]));
  const rows: Row[] = [];
  for (const item of ranked) {
    const inv = byId.get(item.investigationId);
    if (!inv) continue;
    rows.push({ position: rows.length + 1, item, inv, summary: claimsFor(claims, "summary", inv.id)[0]?.text ?? null });
  }
  return rows;
}

export const isFiltering = (pds: PdsFilter, search: string) => pds !== "all" || search.trim() !== "";

/** Filter by Prevention / Detection / Suppression and by search over name, id, fuel and hardware. */
export function matchRows(rows: Row[], pds: PdsFilter, search: string): Row[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(({ inv }) => {
    if (pds !== "all" && inv.pds !== pds) return false;
    const hay = `${inv.title} ${inv.id} ${inv.fuel} ${inv.hardware}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** True when a lit card would sit behind "Show all" (so the list must open). */
export function litHidden(rows: Row[], highlightIds: string[]): boolean {
  if (!highlightIds.length) return false;
  const top = new Set(topRows(rows).map((r) => r.inv.id));
  return rows.some((r) => highlightIds.includes(r.inv.id) && !top.has(r.inv.id));
}

/** First TOP_COUNT rows in order, never an experiment tagged Other. */
export const topRows = (rows: Row[]) => rows.filter((r) => r.inv.pds !== "Other").slice(0, TOP_COUNT);

/** The first card "Show all" reveals. Keyboard focus moves there, since the button itself goes away. */
export function firstRevealedId(rows: Row[]): string | null {
  const top = new Set(topRows(rows).map((r) => r.inv.id));
  return rows.find((r) => !top.has(r.inv.id))?.inv.id ?? null;
}

/**
 * Rows to draw. A filter or search shows every match. Otherwise the top 8, or all when
 * the visitor asked for it or a lit card would be hidden.
 */
export function visibleRows(rows: Row[], o: { pds: PdsFilter; search: string; showAll: boolean; highlightIds: string[] }): Row[] {
  if (isFiltering(o.pds, o.search)) return matchRows(rows, o.pds, o.search);
  if (o.showAll || litHidden(rows, o.highlightIds)) return rows;
  return topRows(rows);
}

export type DotLevel = "high" | "mid" | "low" | "unknown";
/** high from 2/3 up, low under 1/3, mid between; null is its own level. */
export function dotLevel(value: number | null): DotLevel {
  if (value === null) return "unknown";
  if (value >= 2 / 3) return "high";
  if (value >= 1 / 3) return "mid";
  return "low";
}

/** Name of one dot, "<label>: <reason>". Says "not on record" once, even when the reason already does. */
export function dotName(f: Pick<RankFactor, "label" | "value" | "reason">): string {
  const say = f.value === null && !/not on record/i.test(f.reason);
  return `${f.label}: ${say ? "not on record. " : ""}${f.reason}`;
}

/** Short word under each dot, by factor key. */
export const SHORT_LABEL: Record<RankFactor["key"], string> = {
  o2: "Oxygen",
  pressure: "Pressure",
  directness: "Direct",
  evidence: "Flight",
  goalFit: "Goal fit",
};

/** Percent position (0 to 100) on the fixed scale; clamped. */
export const scalePct = (o2: number) => Math.min(100, Math.max(0, (o2 / O2_SCALE_MAX) * 100));

/** "19.8 to 85%" with at most one decimal. */
export const fmt = (n: number) => `${Math.round(n * 10) / 10}`;
export const rangeText = (r: [number, number]) => (r[0] === r[1] ? `${fmt(r[0])}%` : `${fmt(r[0])} to ${fmt(r[1])}%`);
