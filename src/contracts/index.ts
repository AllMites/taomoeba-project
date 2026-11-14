import { Claim } from "./claim.ts";
import { HabitatPreset } from "./habitat.ts";
import { Investigation } from "./investigation.ts";
import { RankItem } from "./rank.ts";
import { Source } from "./source.ts";

export * from "./provenance.ts";
export * from "./source.ts";
export * from "./claim.ts";
export * from "./investigation.ts";
export * from "./habitat.ts";
export * from "./rank.ts";

/** Dataset name -> item schema. Used by the loader, tests and schema export. */
export const datasetSchemas = {
  investigations: Investigation,
  rank: RankItem,
  claims: Claim,
  sources: Source,
  habitats: HabitatPreset,
} as const;
export type DatasetName = keyof typeof datasetSchemas;
