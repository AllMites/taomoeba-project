import { z } from "zod";

export const Source = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  doi: z.string().optional(),
  excerpt: z.string(),
  license: z.string(),
});
export type Source = z.infer<typeof Source>;
