import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGraph, radius } from "./logic.ts";
import { createSim, drift, placeLabels, step } from "./sim.ts";

const doc = parseGraph(JSON.parse(readFileSync(`${process.cwd()}/public/data/graph.json`, "utf8")))!;
const nodes = doc.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, r: radius(n) }));

describe("graph motion", () => {
  it("dots spring out from the centre and settle near their built positions", () => {
    const sim = createSim(nodes, doc.edges);
    const start = Math.hypot(sim.bodies[0].x - sim.bodies[0].ax, sim.bodies[0].y - sim.bodies[0].ay);
    for (let i = 0; i < 800 && step(sim); i++);
    const off = sim.bodies.map((b) => Math.hypot(b.x - b.ax, b.y - b.ay));
    expect(Math.max(...off)).toBeLessThan(Math.max(start, 60));
    expect(off.reduce((a, b) => a + b, 0) / off.length).toBeLessThan(25);
    expect(step(sim)).toBe(false); // it stops
  });
  it("a held dot stays under the pointer and pulls its neighbours", () => {
    const sim = createSim(nodes, doc.edges, false);
    const i = sim.index.get("PSI-69")!;
    const j = sim.index.get("PSI-68")!;
    const before = { ...sim.bodies[j] };
    for (let k = 0; k < 40; k++) step(sim, { id: "PSI-69", x: sim.bodies[i].ax + 150, y: sim.bodies[i].ay });
    expect(sim.bodies[i].x).toBeCloseTo(sim.bodies[i].ax + 150, 5);
    expect(sim.bodies[j].x).toBeGreaterThan(before.x);
  });
  it("the idle drift is small", () => {
    const sim = createSim(nodes, doc.edges, false);
    for (const t of [0, 1000, 5000]) for (const v of drift(sim.bodies[3], t)) expect(Math.abs(v)).toBeLessThanOrEqual(2.5);
  });
});

describe("labels never overlap", () => {
  const overlap = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  it("crowded dots: placed labels do not cross each other; the focused one always shows", () => {
    const dots = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, x: (i % 4) * 30, y: Math.floor(i / 4) * 20, r: 6 }));
    const items = dots.map((d, i) => ({ ...d, text: `Experiment ${i}`, priority: i, force: i === 5 }));
    const out = placeLabels(items, dots, 11);
    expect(out.some((l) => l.id === "n5")).toBe(true);
    const boxes = out.map((l) => {
      const w = l.text.length * 11 * 0.56;
      const x0 = l.anchor === "middle" ? l.x - w / 2 : l.anchor === "start" ? l.x : l.x - w;
      return [x0, l.y - 11, x0 + w, l.y + 2];
    });
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) expect(overlap(boxes[a], boxes[b])).toBe(false);
    expect(out.length).toBeLessThan(items.length); // some had no room and were left out
  });
});
