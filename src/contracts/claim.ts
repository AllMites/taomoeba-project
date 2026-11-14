import { z } from "zod";

export const Claim = z.object({
  id: z.string(),
  investigationId: z.string(),
  text: z.string(),
  sourceIds: z.array(z.string()),
  excerpt: z.string(),
  verdict: z.enum(["supports", "contradicts", "unrelated"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  flagged: z.boolean().optional(),
});
export type Claim = z.infer<typeof Claim>;
