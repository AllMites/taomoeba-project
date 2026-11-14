import { compareRank } from "../../scripts/rank/compare.ts";
import type { Claim, HabitatId, HabitatPreset, RankItem } from "../contracts/index.ts";

/** Habitats offered in the picker. suit-ref and mars stay in the data but are not a place a visitor designs for. */
export const PICKER_HABITATS: HabitatId[] = ["iss", "moon", "rover"];
export const pickerHabitats = (all: HabitatPreset[]) => PICKER_HABITATS.flatMap((id) => all.filter((h) => h.id === id));

/** Rank items for one habitat, best first, in the order the ranking rule states. */
export const rankedFor = (rank: RankItem[], habitat: HabitatId) => rank.filter((r) => r.habitat === habitat).sort(compareRank);

/** Claims of one kind, optionally for one investigation. Rationales are per habitat; summaries and findings are not. */
export const claimsFor = (claims: Claim[], kind: Claim["kind"], investigationId?: string, habitat?: HabitatId) =>
  claims.filter(
    (c) =>
      c.kind === kind &&
      (!investigationId || c.investigationId === investigationId) &&
      (!habitat || !c.habitat || c.habitat === habitat),
  );

/** The habitat brief: takeaways for one habitat, in file order. */
export const briefFor = (claims: Claim[], habitat: HabitatId) => claims.filter((c) => c.kind === "takeaway" && c.habitat === habitat);

/** Run-level table behind "Download runs". notes holds captions and footnotes that are not test runs. */
export type RunTable = {
  source: string;
  columns: { name: string; unit: string | null; original: string }[];
  notes: string[];
  rows: Record<string, string | number | null>[];
};
export const runUrls = (path: string) => ({ json: `/data/${path}`, csv: `/data/${path.replace(/\.json$/, ".csv")}` });
export async function loadRuns(path: string): Promise<RunTable> {
  const res = await fetch(runUrls(path).json);
  if (!res.ok) throw new Error(`Run table not found: ${path}`);
  return (await res.json()) as RunTable;
}
