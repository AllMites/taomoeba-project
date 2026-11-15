import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraphView } from "./index.tsx";
import { find, focusIn, linkGroups, LINKS, neighbours, parseGraph, timeline, visibleEdges, visibleNodes, type Tone } from "./logic.ts";

const raw = JSON.parse(readFileSync(`${process.cwd()}/public/data/graph.json`, "utf8"));
const doc = parseGraph(raw)!;
const ON = Object.fromEntries(Object.entries(LINKS).map(([k, v]) => [k, v.on]));

describe("research graph", () => {
  it("every link joins two drawn dots, has a known type and says why it exists", () => {
    expect(doc).not.toBeNull();
    for (const e of doc.edges) {
      expect(LINKS[e.type], e.type).toBeTruthy();
      expect(e.why.length).toBeGreaterThan(5);
    }
    expect(parseGraph({ ...raw, edges: [...raw.edges, { s: "x", t: "y", type: "mentions", why: "zzzzzz", w: 1 }] })).toBeNull();
  });
  it("every PSI experiment is a dot; no paper text is stored", () => {
    const exps = doc.nodes.filter((n) => n.kind === "experiment");
    expect(exps).toHaveLength(26);
    expect(JSON.stringify(raw)).not.toMatch(/"text"\s*:/);
  });
  it("known research links are there: FLEX -> FLEX-2 follow-up, a report on FLEX", () => {
    expect(doc.edges.some((e) => e.s === "PSI-69" && e.t === "PSI-68" && e.type === "follow_up")).toBe(true);
    expect(neighbours(doc.edges, "PSI-69").size).toBeGreaterThan(5);
  });
  it("hub dots appear only while their links are shown", () => {
    expect(visibleNodes(doc, ON).some((n) => n.kind === "area")).toBe(false);
    expect(visibleNodes(doc, { ...ON, area: true }).some((n) => n.kind === "area")).toBe(true);
    expect(visibleEdges(doc, ON).every((e) => ON[e.type])).toBe(true);
  });
  it("search finds experiments first", () => {
    expect(find(doc, "flex")!.id).toBe("PSI-69");
    expect(find(doc, "flex-2")!.id).toBe("PSI-68");
    expect(find(doc, "PSI-25")!.id).toBe("PSI-25");
    expect(find(doc, "")).toBeNull();
  });
  it("renders the canvas, the legend, and a selected dot's links grouped by why", () => {
    const html = renderToStaticMarkup(<GraphView doc={doc} />);
    expect(html).toContain("Research graph");
    expect(html).toContain("Follow-up flight");
    const sel = renderToStaticMarkup(<GraphView doc={doc} initialSelected="PSI-69" onOpen={() => {}} onAsk={() => {}} />);
    expect(sel).toContain("Open experiment details");
    expect(sel).toContain("Reports on");
    expect(sel).toContain("FLEX-2");
  });
  it("Ask focus: only ids that are dots light up; the rest are counted", () => {
    const f = focusIn(doc, ["PSI-69", "ntrs:20150023456", "team:model-report"]);
    expect([...f.lit]).toEqual(["PSI-69", "ntrs:20150023456"]);
    expect(f.missing).toBe(1);
    const html = renderToStaticMarkup(<GraphView doc={doc} focus={{ ids: ["PSI-69", "ntrs:20150023456", "team:model-report"], n: 1 }} onClearFocus={() => {}} />);
    expect(html).toContain("Lit: the 2 sources and experiments your Ask answer used.");
    expect(html).toContain("1 more is the team");
    expect(html.match(/g-hit/g)?.length).toBe(2);
  });
  it("habitat: experiments not tested in that air fade, and the line says how many were", () => {
    const tones = new Map<string, Tone>(doc.nodes.filter((n) => n.kind === "experiment").map((n) => [n.id, "none"]));
    tones.set("PSI-69", "both");
    tones.set("PSI-68", "o2");
    const hab = { label: "Moon Base", o2: 30, kPa: 70.3, tones, both: 1, o2Only: 1 };
    const html = renderToStaticMarkup(<GraphView doc={doc} habitat={hab} />);
    expect(html).toContain("Fade experiments not tested in <b>Moon Base</b> air");
    expect(html.match(/g-node g-experiment[^"]*g-fade/g)?.length).toBe(24);
    expect(html.match(/g-node g-experiment[^"]*g-half/g)?.length).toBe(1);
  });
  it("timeline: reports by year in one row per experiment; nothing undated is placed", () => {
    const t = timeline(doc);
    expect(doc.nodes.filter((n) => n.year !== undefined).length).toBeGreaterThanOrEqual(35);
    const flex = t.rows.find((r) => r.node.id === "PSI-69")!;
    expect(flex.reports.length).toBeGreaterThan(5);
    for (const r of t.rows) expect(r.reports.every((x, i, a) => i === 0 || a[i - 1].year! <= x.year!)).toBe(true);
    expect(t.from).toBeLessThanOrEqual(1995);
    const html = renderToStaticMarkup(<GraphView doc={doc} initialMode="timeline" />);
    expect(html).toContain("Timeline:");
    expect(html).toContain('aria-pressed="true">Timeline');
  });
  it("list view: every dot as a list item with its links and reasons, keyboard reachable", () => {
    const html = renderToStaticMarkup(<GraphView doc={doc} initialMode="list" onOpen={() => {}} />);
    expect(html).toContain("PSI experiments (26)");
    expect(html.match(/<details id="gl-/g)?.length).toBe(visibleNodes(doc, ON).length);
    expect(html).toContain("The next flight of the same experiment series");
    const byId = new Map(doc.nodes.map((n) => [n.id, n]));
    const g = linkGroups(visibleEdges(doc, ON), byId, "PSI-69");
    expect(g[0].type).toBe("reports_on");
  });
});
