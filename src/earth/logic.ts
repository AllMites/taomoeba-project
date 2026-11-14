import { z } from "zod";

// Benefits on Earth of NASA fire research (public/data/earth.json), each tied to its sources.
export const Status = z.enum(["in-use", "research", "heritage"]);
export type Status = z.infer<typeof Status>;

const Item = z.object({
  id: z.string(),
  title: z.string(),
  status: Status,
  summary: z.string(),
  experiments: z.array(z.string()),
  note: z.string().optional(),
  sources: z.array(z.object({ id: z.string(), title: z.string(), url: z.string().url() })).min(1),
  ask: z.string().optional(),
});
export type EarthItem = z.infer<typeof Item>;
export const EarthDoc = z.object({ about: z.string(), items: z.array(Item).min(1) });
export type EarthDoc = z.infer<typeof EarthDoc>;

export const parseEarth = (raw: unknown): EarthDoc | null => {
  const r = EarthDoc.safeParse(raw);
  return r.success ? r.data : null;
};

/** How far each benefit has come, in plain words. Order: most to least established. */
export const STATUS: Record<Status, { label: string; text: string }> = {
  "in-use": { label: "In use on Earth", text: "Already in products or practice." },
  research: { label: "Research direction", text: "A benefit NASA names for this research; not yet a product." },
  heritage: { label: "NASA heritage", text: "Older NASA technology, not from the PSI data in this dashboard." },
};
export const STATUS_ORDER: Status[] = ["in-use", "research", "heritage"];

export const counts = (d: EarthDoc) => Object.fromEntries(STATUS_ORDER.map((s) => [s, d.items.filter((i) => i.status === s).length])) as Record<Status, number>;
