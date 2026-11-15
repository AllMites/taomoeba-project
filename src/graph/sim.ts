// A small force simulation so the graph moves like a notes graph: dots spring out into place when it opens,
// tug on their neighbours while one is dragged, then settle; idle dots drift a few units like bubbles.
// Every dot is held by a soft spring to its built position (graph.json), so the picture always returns to the
// same layout. Nothing here changes what is linked to what.

export type Body = { id: string; x: number; y: number; vx: number; vy: number; ax: number; ay: number; r: number; phase: number; period: number };
export type Spring = { a: number; b: number; rest: number; k: number };
export type Sim = { bodies: Body[]; springs: Spring[]; index: Map<string, number>; alpha: number };

/** Deterministic pseudo-random (so tests and reloads start the same). */
const rand = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function createSim(nodes: { id: string; x: number; y: number; r: number }[], links: { s: string; t: string; w: number }[], intro = true): Sim {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const bodies = nodes.map((n, i) => ({
    id: n.id,
    // start pulled toward the centre, then spring out
    x: intro ? n.x * 0.45 + (rand(i) - 0.5) * 40 : n.x,
    y: intro ? n.y * 0.45 + (rand(i + 99) - 0.5) * 40 : n.y,
    vx: 0,
    vy: 0,
    ax: n.x,
    ay: n.y,
    r: n.r,
    phase: rand(i + 7) * Math.PI * 2,
    period: 3800 + rand(i + 3) * 3200,
  }));
  const springs: Spring[] = [];
  for (const l of links) {
    const a = index.get(l.s);
    const b = index.get(l.t);
    if (a === undefined || b === undefined) continue;
    springs.push({ a, b, rest: Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y), k: 0.02 * Math.min(1.2, l.w + 0.2) });
  }
  return { bodies, springs, index, alpha: intro ? 1 : 0 };
}

/** One frame. `held` is the dot being dragged (it stays under the pointer). Returns true while still moving. */
export function step(sim: Sim, held?: { id: string; x: number; y: number }): boolean {
  const { bodies, springs } = sim;
  const a = sim.alpha;
  if (a < 0.002 && !held) return false;
  for (const b of bodies) {
    b.vx += (b.ax - b.x) * 0.012 * a;
    b.vy += (b.ay - b.y) * 0.012 * a;
  }
  for (const s of springs) {
    const p = bodies[s.a];
    const q = bodies[s.b];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const f = ((d - s.rest) / d) * s.k * a;
    p.vx += dx * f;
    p.vy += dy * f;
    q.vx -= dx * f;
    q.vy -= dy * f;
  }
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const p = bodies[i];
      const q = bodies[j];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const min = p.r + q.r + 6;
      if (d < min) {
        const f = ((min - d) / d) * 0.25;
        p.vx -= dx * f;
        p.vy -= dy * f;
        q.vx += dx * f;
        q.vy += dy * f;
      }
    }
  const hi = held ? sim.index.get(held.id) : undefined;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (i === hi) {
      b.x = held!.x;
      b.y = held!.y;
      b.vx = b.vy = 0;
      continue;
    }
    b.vx *= 0.8;
    b.vy *= 0.8;
    b.x += b.vx;
    b.y += b.vy;
  }
  sim.alpha = held ? Math.max(sim.alpha, 0.35) : sim.alpha * 0.985;
  return true;
}

/** Wake the simulation (after a drag or a reset). */
export const reheat = (sim: Sim, to = 0.6) => {
  sim.alpha = Math.max(sim.alpha, to);
};

/** Idle drift in drawing units: a slow, small float per dot. */
export const drift = (b: Body, t: number, amp = 2.5): [number, number] => [
  Math.sin(t / b.period + b.phase) * amp,
  Math.cos(t / (b.period * 1.3) + b.phase) * amp,
];

// ---- labels that never overlap ------------------------------------------------------------------------------

export type LabelIn = { id: string; x: number; y: number; r: number; text: string; priority: number; force?: boolean };
export type LabelOut = { id: string; x: number; y: number; anchor: "middle" | "start" | "end"; text: string };
type Box = [number, number, number, number];
const hit = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * Places labels best-first: above the dot, then below, right, left. A label that would cross another label or
 * another dot is left out, unless `force` (the dot in focus); a hovered dot shows its own name.
 * Sizes are in drawing units: `font` is the font size, widths estimated at 0.56 em per character.
 */
export function placeLabels(items: LabelIn[], dots: { x: number; y: number; r: number; id: string }[], font: number): LabelOut[] {
  const placed: Box[] = [];
  const out: LabelOut[] = [];
  const h = font * 1.15;
  const sorted = [...items].sort((a, b) => Number(!!b.force) - Number(!!a.force) || b.priority - a.priority);
  for (const it of sorted) {
    const w = it.text.length * font * 0.56;
    const gap = it.r + font * 0.35;
    const tries: [Box, number, number, LabelOut["anchor"]][] = [
      [[it.x - w / 2, it.y - gap - h, it.x + w / 2, it.y - gap], it.x, it.y - gap - font * 0.25, "middle"],
      [[it.x - w / 2, it.y + gap, it.x + w / 2, it.y + gap + h], it.x, it.y + gap + font * 0.9, "middle"],
      [[it.x + gap, it.y - h / 2, it.x + gap + w, it.y + h / 2], it.x + gap, it.y + font * 0.35, "start"],
      [[it.x - gap - w, it.y - h / 2, it.x - gap, it.y + h / 2], it.x - gap, it.y + font * 0.35, "end"],
    ];
    let done = false;
    for (const [box, x, y, anchor] of tries) {
      const clashLabel = placed.some((p) => hit(p, box));
      const clashDot = dots.some((d) => d.id !== it.id && hit(box, [d.x - d.r, d.y - d.r, d.x + d.r, d.y + d.r]));
      if (!clashLabel && (!clashDot || it.force)) {
        placed.push(box);
        out.push({ id: it.id, x, y, anchor, text: it.text });
        done = true;
        break;
      }
    }
    if (!done && it.force) {
      const [box, x, y, anchor] = tries[0];
      placed.push(box);
      out.push({ id: it.id, x, y, anchor, text: it.text });
    }
  }
  return out;
}
