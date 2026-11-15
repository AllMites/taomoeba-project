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
