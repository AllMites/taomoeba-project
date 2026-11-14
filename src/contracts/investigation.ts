import { z } from "zod";

const Range = z.tuple([z.number(), z.number()]).nullable();

export const Pds = z.enum(["Prevention", "Detection", "Suppression", "Other"]);
export type Pds = z.infer<typeof Pds>;

export const Investigation = z.object({
  id: z.string(),
  title: z.string(),
  hardware: z.string(),
  hardwareGroup: z.string(),
  pds: Pds,
  pdsBasis: z.string(),
  sensors: z.array(z.string()),
  objectives: z.string(),
  fuelKind: z.enum(["solid", "gas", "droplet", "aerosol"]),
  fuel: z.string(),
  sampleShape: z.string(),
  o2Range: Range,
  pressureRange: Range,
  airflowRange: Range,
  measurements: z.array(z.string()),
  variables: z.array(z.object({ name: z.string(), varies: z.boolean() })),
  sourceIds: z.array(z.string()),
  // Where each test condition came from: computed from the experiment's table, stated in the PSI
  // record text (excerpt holds the verbatim sentence), or null when neither gives it.
  conditionBasis: z
    .object({
      o2: z.enum(["table", "record"]).nullable(),
      pressure: z.enum(["table", "record"]).nullable(),
      excerpt: z.string().optional(),
    })
    .optional(),
  // flight: run in microgravity. ground: ground test or computer model.
  evidence: z.enum(["flight", "ground"]).optional(),
  // Run-level table for export and modeling; null when the investigation has no usable table.
  runs: z.object({ path: z.string(), rows: z.number(), columns: z.array(z.string()) }).nullable().optional(),
  related: z.array(z.object({ id: z.string(), reason: z.string() })).optional(),
});
export type Investigation = z.infer<typeof Investigation>;
