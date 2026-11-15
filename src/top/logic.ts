import { BASE_ORDER, habitatOf } from "../app/console.ts";
import type { Claim, HabitatId, HabitatPreset, Investigation, RankItem, Source } from "../contracts/index.ts";
import { orderBrief } from "../brief/brief.ts";
import { briefFor, rankedFor } from "../data/select.ts";
import { buildRows, topRows, type Row } from "../ranking/logic.ts";

export const TOP_N = 3;

/** The first three cards of the Rank sheet for this habitat: same rule, same order, same positions. */
export const topThree = (rank: RankItem[], investigations: Investigation[], claims: Claim[], habitat: HabitatId): Row[] =>
  topRows(buildRows(rankedFor(rank, habitat), investigations, claims)).slice(0, TOP_N);

/** The habitats the base carousel can pick. Earth ranks with the ISS figures, so it adds none. */
export const PICKER_HABITATS: HabitatId[] = [...new Set(BASE_ORDER.map(habitatOf))];

/**
 * The other picker bases whose cabin air (oxygen and pressure) is the same as this one's, so the card can say why
 * their lists match. A base is named only when its top three really agree (same experiments, same scores).
 */
export function sameAirAs(habitats: HabitatPreset[], habitat: HabitatId, sameTop: (other: HabitatId) => boolean): HabitatPreset[] {
  const own = habitats.find((h) => h.id === habitat);
  if (!own) return [];
  return habitats.filter(
    (h) => h.id !== habitat && PICKER_HABITATS.includes(h.id) && h.o2Percent === own.o2Percent && h.pressureKPa === own.pressureKPa && sameTop(h.id),
  );
}

/** One plain line for the card, or null. */
export const sameAirLine = (others: { label: string }[]) =>
  others.length ? `Same air as ${others.map((o) => o.label).join(" and ")}, so the same ranking.` : null;

/** Two top-three lists show the same experiments in the same order with the same scores. */
export const sameRows = (a: Row[], b: Row[]) =>
  a.length === b.length && a.every((r, i) => r.inv.id === b[i]!.inv.id && scoreText(r.item.score) === scoreText(b[i]!.item.score));

/** Score as the card shows it: 0.86 -> "86". */
export const scoreText = (score: number) => `${Math.round(score * 100)}`;

/** The first card of the Interpret sheet for this habitat, with the sources it cites. null when there is no brief. */
export function leadTakeaway(claims: Claim[], sources: Source[], habitat: HabitatId): { claim: Claim; cited: Source[] } | null {
  const claim = orderBrief(briefFor(claims, habitat))[0];
  if (!claim) return null;
  return { claim, cited: claim.sourceIds.flatMap((id) => sources.filter((s) => s.id === id)) };
}
