import type { Investigation, Pds, Source } from "../contracts/index.ts";

export type LibraryFilter = "all" | Exclude<Pds, "Other">;
export const FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Prevention", label: "Prevention" },
  { value: "Detection", label: "Detection" },
  { value: "Suppression", label: "Suppression" },
];

/** Sources shown before "Show all" when nothing is filtered. */
export const SOURCES_SHOWN = 6;

const words = (search: string) => search.toLowerCase().split(/\s+/).filter(Boolean);
const has = (hay: string, search: string) => {
  const h = hay.toLowerCase();
  return words(search).every((w) => h.includes(w));
};

/** Experiments of one kind whose name, id, fuel or hardware holds every search word. File order. */
export const filterExperiments = (all: Investigation[], pds: LibraryFilter, search: string) =>
  all.filter((i) => (pds === "all" || i.pds === pds) && has(`${i.title} ${i.id} ${i.fuel} ${i.hardware}`, search));

/**
 * Sources whose title or id holds every search word. With a kind picked, only the sources that
 * experiments of that kind cite: a source has no kind of its own.
 */
export function filterSources(all: Source[], experiments: Investigation[], pds: LibraryFilter, search: string) {
  const cited = pds === "all" ? null : new Set(experiments.filter((i) => i.pds === pds).flatMap((i) => i.sourceIds));
  return all.filter((s) => (!cited || cited.has(s.id)) && has(`${s.title} ${s.id}`, search));
}

/** What kind of document a source is, from its id prefix. */
export function sourceKind(id: string): string {
  const prefix = id.split(":")[0];
  return prefix === "psi" ? "PSI record" : prefix === "ntrs" ? "NASA report" : "NASA page";
}

/** The four steps behind every Ask SI answer, in the order the server runs them (server/ask.ts). */
export const PIPELINE: { name: string; tool: string; text: string }[] = [
  { name: "Search", tool: "BM25", text: "Keyword search over the NASA records, reports and the team's data tables." },
  { name: "Pick", tool: "Rerank", text: "The passages that answer the question most directly are kept." },
  { name: "Write", tool: "Claude", text: "Short sentences, each one tied to a line from a source." },
  { name: "Check", tool: "TypeSafe", text: "Each sentence is compared with its line. Failures are dropped." },
];
