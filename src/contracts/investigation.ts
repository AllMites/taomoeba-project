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
});
export type Investigation = z.infer<typeof Investigation>;
