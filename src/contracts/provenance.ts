import { z } from "zod";

export const Provenance = z.enum(["measured", "interpolated", "extrapolated", "illustrative"]);
export type Provenance = z.infer<typeof Provenance>;
