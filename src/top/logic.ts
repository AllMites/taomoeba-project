import type { Claim, HabitatId, Investigation, RankItem, Source } from "../contracts/index.ts";
import { orderBrief } from "../brief/brief.ts";
import { briefFor, rankedFor } from "../data/select.ts";
import { buildRows, topRows, type Row } from "../ranking/logic.ts";

export const TOP_N = 3;

/** The first three cards of the Rank sheet for this habitat: same rule, same order, same positions. */
export const topThree = (rank: RankItem[], investigations: Investigation[], claims: Claim[], habitat: HabitatId): Row[] =>
  topRows(buildRows(rankedFor(rank, habitat), investigations, claims)).slice(0, TOP_N);

/** Score as the card shows it: 0.86 -> "86". */
export const scoreText = (score: number) => `${Math.round(score * 100)}`;

/** The first card of the Interpret sheet for this habitat, with the sources it cites. null when there is no brief. */
export function leadTakeaway(claims: Claim[], sources: Source[], habitat: HabitatId): { claim: Claim; cited: Source[] } | null {
  const claim = orderBrief(briefFor(claims, habitat))[0];
  if (!claim) return null;
  return { claim, cited: claim.sourceIds.flatMap((id) => sources.filter((s) => s.id === id)) };
}
