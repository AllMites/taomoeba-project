import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraphView } from "./index.tsx";
import { find, LINKS, neighbours, parseGraph, visibleEdges, visibleNodes } from "./logic.ts";

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
});
