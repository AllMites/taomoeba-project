import type { Claim } from "../contracts/index.ts";

/**
 * Brief order by topic: the last part of the claim id (clm:brief:<habitat>:<slug>).
 * The limits come first (what the records cannot say), then coverage, then the single-experiment findings.
 * A slug not listed here goes after the listed ones, in file order.
 */
export const TOPIC_ORDER = ["gravity-limit", "fuel-gap", "o2-coverage", "pressure-coverage", "bre-airflow", "saffire-gravity"];

export const topicOf = (c: Pick<Claim, "id">) => c.id.split(":").pop() ?? "";

export function orderBrief(claims: Claim[]): Claim[] {
  const rank = (c: Claim) => {
    const i = TOPIC_ORDER.indexOf(topicOf(c));
    return i < 0 ? TOPIC_ORDER.length : i;
  };
  // Array.prototype.sort is stable, so unknown topics keep file order.
  return [...claims].sort((a, b) => rank(a) - rank(b));
}

/**
 * First "N of M" in a sentence, e.g. "Only 6 of 24 experiments ...". null when there is no count to draw.
 * label is the sentence's own words ("6 of 24 experiments", "3 of 4 burned"), so the text equivalent never
 * calls samples "experiments". Whole numbers only: "2.5 of 10" is not a count.
 */
export function parseCount(text: string): { n: number; of: number; label: string } | null {
  const m = /(?<![\d.,])\b(\d+) of (\d+)\b(?![.,]\d)(?: ([A-Za-z]+))?/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const of = Number(m[2]);
  if (!(of > 0 && n <= of)) return null;
  return { n, of, label: m[3] ? `${n} of ${of} ${m[3]}` : `${n} of ${of}` };
}

/** A source link only for http(s) URLs; anything else is shown as plain text. */
export const safeHref = (url: string): string | null => (/^https?:\/\//i.test(url.trim()) ? url.trim() : null);

/** The one experiment a takeaway rests on, or null when it draws on several. */
export function singleExperiment(c: Claim): string | null {
  return c.sourceIds.length === 1 && c.sourceIds[0] === `psi:${c.investigationId}` ? c.investigationId : null;
}
