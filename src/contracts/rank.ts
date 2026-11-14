import { z } from "zod";
import { HabitatId } from "./habitat.ts";
import { Provenance } from "./provenance.ts";

// One visible reason behind a rank. value is 0 to 1, or null when it cannot be known
// (shown as "not on record" and counted as half in the score). reason is one plain sentence.
export const RankFactor = z.object({
  key: z.enum(["o2", "pressure", "directness", "evidence", "goalFit"]),
  label: z.string(),
  value: z.number().min(0).max(1).nullable(),
  reason: z.string(),
  sourceId: z.string().optional(),
  excerpt: z.string().optional(),
});
export type RankFactor = z.infer<typeof RankFactor>;

export const RankItem = z.object({
  id: z.string(),
  investigationId: z.string(),
  habitat: HabitatId,
  overlap: z.number().nullable(),
  dimsUsed: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  siRelevance: z.number().min(0).max(1).nullable(),
  score: z.number(),
  rationale: z.string(),
  claimIds: z.array(z.string()),
  provenance: Provenance,
  // score is the weighted mean of these factors (rule in src/data/rankRule.ts), so every rank can be checked by hand.
  factors: z.array(RankFactor).optional(),
});
export type RankItem = z.infer<typeof RankItem>;
