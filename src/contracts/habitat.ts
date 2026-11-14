import { z } from "zod";

export const HabitatId = z.enum(["iss", "moon", "rover", "mars", "suit-ref"]);
export type HabitatId = z.infer<typeof HabitatId>;

export const HabitatPreset = z.object({
  id: HabitatId,
  label: z.string(),
  o2Percent: z.number(),
  pressureKPa: z.number(),
  note: z.string(),
});
export type HabitatPreset = z.infer<typeof HabitatPreset>;
