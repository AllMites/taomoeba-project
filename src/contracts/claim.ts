import { z } from "zod";
import { HabitatId } from "./habitat.ts";

// One SI-written sentence shown to the user, always tied to a source excerpt.
// summary: what the investigation did. finding: what it found, in plain words.
// rationale: why it matters for one habitat (habitat is set only for this kind).
export const Claim = z.object({
  id: z.string(),
  investigationId: z.string(),
  kind: z.enum(["summary", "finding", "rationale"]),
  habitat: HabitatId.optional(),
  text: z.string(),
  sourceIds: z.array(z.string()),
  excerpt: z.string(),
  verdict: z.enum(["supports", "contradicts", "unrelated"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  flagged: z.boolean().optional(),
});
export type Claim = z.infer<typeof Claim>;
