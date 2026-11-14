import { z } from "zod";
import { HabitatId } from "./habitat.ts";
import { Provenance } from "./provenance.ts";

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
});
export type RankItem = z.infer<typeof RankItem>;
