import { z } from "zod";

// The research graph (public/data/graph.json, built by scripts/graph/build.py): experiments, NASA reports and pages,
// joined by links that each say why they exist. The page only draws it.
const Node = z.object({
  id: z.string(),
  kind: z.enum(["experiment", "report", "page", "area"]),
  title: z.string(),
  label: z.string().optional(),
  url: z.string().nullable().optional(),
  restricted: z.boolean().optional(),
  page: z.string().optional(),
  area: z.string().optional(),
  hardware: z.string().optional(),
  year: z.number().int().optional(),
  x: z.number(),
  y: z.number(),
  degree: z.number(),
});
const Edge = z.object({ s: z.string(), t: z.string(), type: z.string(), why: z.string(), w: z.number() });
export const GraphDoc = z.object({ made: z.string(), about: z.string(), nodes: z.array(Node).min(1), edges: z.array(Edge) });
export type GraphDoc = z.infer<typeof GraphDoc>;
export type GNode = z.infer<typeof Node>;
export type GEdge = z.infer<typeof Edge>;

export const parseGraph = (raw: unknown): GraphDoc | null => {
  const r = GraphDoc.safeParse(raw);
  if (!r.success) return null;
  const ids = new Set(r.data.nodes.map((n) => n.id));
  return r.data.edges.every((e) => ids.has(e.s) && ids.has(e.t)) ? r.data : null;
};

/** Link types, most specific first. `on` = shown when the graph opens. */
export const LINKS: Record<string, { label: string; text: string; on: boolean }> = {
  reports_on: { label: "Reports on", text: "The report or page is about this experiment (listed in the NASA records or the team's library).", on: true },
  follow_up: { label: "Follow-up flight", text: "The next flight of the same experiment series.", on: true },
  builds_on: { label: "Analyses its data", text: "A ground study of a flight experiment's data.", on: true },
  psi_related: { label: "Related in PSI", text: "Listed as related in the experiment's PSI record.", on: true },
  same_event: { label: "Same incident", text: "NASA pages about the same fire or explosion.", on: true },
  mentions: { label: "Mentions", text: "The text names the experiment several times, without being about it.", on: true },
  same_hardware: { label: "Same hardware", text: "Run in the same rack, burner or flow duct.", on: false },
  area: { label: "Fire-safety area", text: "Prevention, detection, suppression, or a benefit on Earth.", on: false },
};

export const KIND_LABEL: Record<GNode["kind"], string> = {
  experiment: "PSI experiment",
  report: "NASA technical report",
  page: "NASA page",
  area: "Fire-safety area",
};
export const PAGE_LABEL: Record<string, string> = { overview: "Experiment overview", incident: "Incident review", spinoff: "Benefit on Earth" };

export const radius = (n: GNode) => (n.kind === "area" ? 11 : n.kind === "experiment" ? 6 + Math.sqrt(n.degree) * 1.4 : 3.5 + Math.sqrt(n.degree));

export function visibleEdges(doc: GraphDoc, on: Record<string, boolean>): GEdge[] {
  return doc.edges.filter((e) => on[e.type]);
}

/** Area hubs are drawn only while their links are shown. */
export const visibleNodes = (doc: GraphDoc, on: Record<string, boolean>) => doc.nodes.filter((n) => n.kind !== "area" || on.area);

export function neighbours(edges: GEdge[], id: string): Map<string, GEdge[]> {
  const m = new Map<string, GEdge[]>();
  for (const e of edges) {
    const other = e.s === id ? e.t : e.t === id ? e.s : null;
    if (other) m.set(other, [...(m.get(other) ?? []), e]);
  }
  return m;
}

/** Best match for a search: exact id, then title start, then title contains; experiments first. */
export function find(doc: GraphDoc, q: string): GNode | null {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  const rank = (n: GNode) => (n.kind === "experiment" ? 0 : n.kind === "area" ? 1 : 2);
  const hits = doc.nodes.filter((n) => n.id.toLowerCase() === s || n.title.toLowerCase().includes(s) || (n.label ?? "").toLowerCase().includes(s));
  const exact = (n: GNode) => Number(n.id.toLowerCase() === s || n.title.toLowerCase() === s || (n.label ?? "").toLowerCase() === s);
  hits.sort((a, b) => exact(b) - exact(a) || Number(b.title.toLowerCase().startsWith(s)) - Number(a.title.toLowerCase().startsWith(s)) || rank(a) - rank(b));
  return hits[0] ?? null;
}

export const shortTitle = (n: GNode, max = 42) => n.label ?? (n.title.length <= max ? n.title : `${n.title.slice(0, max - 1)}…`);

/** Of the ids an Ask answer used, the ones that are dots in the graph; the rest (team data, model report) are counted. */
export function focusIn(doc: GraphDoc, ids: string[]) {
  const have = new Set(doc.nodes.map((n) => n.id));
  const lit = ids.filter((id) => have.has(id));
  return { lit: new Set(lit), missing: ids.length - lit.length };
}

/** How an experiment relates to the habitat's air: both oxygen and pressure tested near it, oxygen only, or neither. */
export type Tone = "both" | "o2" | "none";

/** Timeline rows: one per experiment, holding the dated reports about it (reports_on links), oldest first. */
export type TimelineRow = { node: GNode; reports: GNode[] };
export function timeline(doc: GraphDoc) {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const rows = new Map<string, GNode[]>();
  for (const e of doc.edges) {
    if (e.type !== "reports_on") continue;
    const src = byId.get(e.s);
    const exp = byId.get(e.t);
    if (!src || !exp || exp.kind !== "experiment" || src.year === undefined) continue;
    rows.set(exp.id, [...(rows.get(exp.id) ?? []), src]);
  }
  const out: TimelineRow[] = [...rows.entries()].map(([id, reps]) => ({
    node: byId.get(id)!,
    reports: reps.sort((a, b) => a.year! - b.year! || a.id.localeCompare(b.id)),
  }));
  out.sort((a, b) => a.reports[0].year! - b.reports[0].year! || a.node.title.localeCompare(b.node.title));
  const years = doc.nodes.flatMap((n) => (n.year === undefined ? [] : [n.year]));
  const undated = doc.nodes.filter((n) => n.kind === "report" && n.year === undefined);
  const noReports = doc.nodes.filter((n) => n.kind === "experiment" && !rows.has(n.id));
  return { rows: out, from: Math.min(...years), to: Math.max(...years), undated, noReports };
}

/** For the list view: every dot, grouped by kind, each with its links grouped by type (only the link types shown). */
export const LIST_KINDS: { kind: GNode["kind"]; label: string }[] = [
  { kind: "experiment", label: "PSI experiments" },
  { kind: "report", label: "NASA technical reports" },
  { kind: "page", label: "NASA pages" },
  { kind: "area", label: "Fire-safety areas" },
];
export function linkGroups(edges: GEdge[], byId: Map<string, GNode>, id: string) {
  const groups = new Map<string, { n: GNode; why: string }[]>();
  for (const [other, es] of neighbours(edges, id))
    for (const e of es) {
      const n = byId.get(other);
      if (n) groups.set(e.type, [...(groups.get(e.type) ?? []), { n, why: e.why }]);
    }
  return Object.keys(LINKS)
    .filter((t) => groups.has(t))
    .map((t) => ({ type: t, items: groups.get(t)!.sort((a, b) => a.n.title.localeCompare(b.n.title)) }));
}
