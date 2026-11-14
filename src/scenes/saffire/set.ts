// The set: inside of a Cygnus pressurized cargo module with the SAFFIRE flow unit, built in code.
// Everything static is merged into two meshes (one lit, one glowing) so a phone draws it in two calls.
//
// Units are metres. Axes: x = along the air flow in the flow unit (downstream +x), y = up, z = along the
// module (the camera looks toward -z, down the module).
//
// Sizes (stylized; set geometry, not data shown to the viewer):
// - Flow-unit box 90 x 53 x 133 cm: the Saffire IV-VI module size, about 53 x 90 x 133 cm (NTRS 20170002628).
// - Sample card frame 40.6 x 94 cm: the SAFFIRE-I sample size in runs/PSI-98.json (also about 0.4 x 0.95 m in NTRS 20170002628).
// - SAFFIRE-II samples 29 x 5 cm: runs/PSI-99.json. Their layout on the card is not on record; laid side by side.
// - Module: inner radius 1.45 m, about 6.4 m long. Stylized estimate.
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, TorusGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SET_PAINT } from "./paint.ts";

export const SAMPLE_LEN = 0.29;
export const SAMPLE_W = 0.05;
export const SAMPLE_PITCH = 0.1;
export const CARD = { x: 0.406, z: 0.94 };
export const BOX = { x: 0.9, y: 0.53, z: 1.33, floorY: -0.3 };
export const BOX_TOP = BOX.floorY + BOX.y;
const DECK_Y = BOX.floorY;
const HULL_R = 1.45;
const HULL_Y = DECK_Y + 0.95;
const HULL_Z0 = -5.2;
const HULL_Z1 = 1.2;

/** z of sample i (0-based, sample 2-1 is 0) on the card. Sample 2-5 sits on the centre line. */
export const sampleZ = (i: number) => (i - 4) * SAMPLE_PITCH;

/** 3D anchors for the callout leader lines. */
export const ANCHORS = {
  box: new Vector3(-CARD.x / 2, 0, -0.05),
  silicone: new Vector3(SAMPLE_LEN / 2, 0.004, sampleZ(1.5)),
} as const;

type Piece = BufferGeometry;

function paint(g: BufferGeometry, hex: string): Piece {
  const c = new Color(hex);
  const n = g.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, hex: string, rotY = 0): Piece {
  const g = new BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return paint(g, hex);
}

/** Deterministic pseudo-random, so the set looks the same on every load. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hull(): Piece[] {
  const out: Piece[] = [];
  const len = HULL_Z1 - HULL_Z0;
  const shell = new CylinderGeometry(HULL_R, HULL_R, len, 40, 1, true);
  // Turn the shell inside out: flip winding by mirroring, then point normals inward.
  shell.scale(-1, 1, 1);
  const nrm = shell.getAttribute("normal");
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  shell.rotateX(Math.PI / 2).translate(0, HULL_Y, (HULL_Z0 + HULL_Z1) / 2);
  out.push(paint(shell, SET_PAINT.hull));
  // Ribs every 0.7 m.
  for (let z = HULL_Z0 + 0.3; z < HULL_Z1; z += 0.7) {
    const rib = new TorusGeometry(HULL_R - 0.03, 0.035, 6, 40);
    rib.translate(0, HULL_Y, z);
    out.push(paint(rib, SET_PAINT.structure));
  }
  // Longerons.
  for (const a of [0.35, 0.75, 1.2, 1.94, 2.39, 2.79]) {
    const r = HULL_R - 0.06;
    out.push(box(0.05, 0.05, len, Math.cos(a) * r, HULL_Y + Math.sin(a) * r, (HULL_Z0 + HULL_Z1) / 2, SET_PAINT.structure));
  }
  // Far end wall and hatch.
  const wall = new CylinderGeometry(HULL_R, HULL_R, 0.04, 40);
  wall.rotateX(Math.PI / 2).translate(0, HULL_Y, HULL_Z0);
  out.push(paint(wall, SET_PAINT.hull));
  const hatch = new CylinderGeometry(0.55, 0.55, 0.06, 32);
  hatch.rotateX(Math.PI / 2).translate(0, HULL_Y - 0.1, HULL_Z0 + 0.03);
  out.push(paint(hatch, SET_PAINT.panel));
  out.push(box(0.4, 0.05, 0.06, 0, HULL_Y - 0.1, HULL_Z0 + 0.07, SET_PAINT.structure));
  // Deck.
  out.push(box(2.1, 0.03, len, 0, DECK_Y - 0.015, (HULL_Z0 + HULL_Z1) / 2, SET_PAINT.deck));
  for (let z = HULL_Z0 + 0.6; z < HULL_Z1; z += 1.2) out.push(box(2.1, 0.034, 0.012, 0, DECK_Y - 0.015, z, SET_PAINT.structure));
  return out;
}

function bags(): Piece[] {
  const out: Piece[] = [];
  const rand = rng(7);
  const tones = [SET_PAINT.bagA, SET_PAINT.bagB, SET_PAINT.bagC];
  for (const side of [-1, 1]) {
    let z = HULL_Z0 + 0.4;
    while (z < HULL_Z1 - 0.3) {
      const d = 0.45 + rand() * 0.35;
      let y = DECK_Y;
      const depth = 0.32 + rand() * 0.12;
      const xIn = 0.68 + rand() * 0.05;
      while (y < HULL_Y + 0.6) {
        const h = 0.22 + rand() * 0.25;
        // Keep stacks inside the curved hull.
        const top = y + h - HULL_Y;
        const maxX = Math.sqrt(Math.max(0, (HULL_R - 0.1) ** 2 - top * top));
        const xOut = Math.min(xIn + depth, maxX);
        if (xOut - xIn < 0.15) break;
        const w = xOut - xIn;
        const tone = tones[Math.floor(rand() * tones.length)]!;
        out.push(box(w, h - 0.015, d - 0.03, side * (xIn + w / 2), y + h / 2, z + d / 2, tone));
        y += h;
      }
      // Strap down the face of the stack.
      out.push(box(0.012, y - DECK_Y, 0.04, side * (xIn - 0.006), (y + DECK_Y) / 2, z + d / 2, SET_PAINT.strap));
      z += d;
    }
  }
  return out;
}

function flowUnit(): Piece[] {
  const out: Piece[] = [];
  const { x: bx, y: by, z: bz, floorY } = BOX;
  const t = 0.025;
  const cy = floorY + by / 2;
  // Floor and four walls.
  out.push(box(bx, t, bz, 0, floorY + t / 2, 0, SET_PAINT.boxInner));
  out.push(box(t, by, bz, -bx / 2 + t / 2, cy, 0, SET_PAINT.box));
  out.push(box(t, by, bz, bx / 2 - t / 2, cy, 0, SET_PAINT.box));
  out.push(box(bx, by, t, 0, cy, -bz / 2 + t / 2, SET_PAINT.box));
  out.push(box(bx, by, t, 0, cy, bz / 2 - t / 2, SET_PAINT.box));
  // Inner liner, darker than the outside so the flame reads. Set 6 mm off the walls to avoid z-fighting.
  const g = 0.006;
  out.push(box(bx - 2 * t, 0.002, bz - 2 * t, 0, floorY + t + g, 0, SET_PAINT.boxInner));
  out.push(box(0.003, by - t, bz - 2 * t, -bx / 2 + t + g, cy, 0, SET_PAINT.boxInner));
  out.push(box(0.003, by - t, bz - 2 * t, bx / 2 - t - g, cy, 0, SET_PAINT.boxInner));
  out.push(box(bx - 2 * t - 2 * g, by - t, 0.003, 0, cy, -bz / 2 + t + g, SET_PAINT.boxInner));
  out.push(box(bx - 2 * t - 2 * g, by - t, 0.003, 0, cy, bz / 2 - t - g, SET_PAINT.boxInner));
  // Top frame around the viewing window.
  const wx = 0.72;
  const wz = 1.1;
  const top = BOX_TOP + 0.002; // frame sits just proud of the wall tops, so their faces never coincide
  out.push(box((bx - wx) / 2, t, bz, -(bx + wx) / 4, top - t / 2, 0, SET_PAINT.box));
  out.push(box((bx - wx) / 2, t, bz, (bx + wx) / 4, top - t / 2, 0, SET_PAINT.box));
  out.push(box(wx, t, (bz - wz) / 2, 0, top - t / 2, -(bz + wz) / 4, SET_PAINT.box));
  out.push(box(wx, t, (bz - wz) / 2, 0, top - t / 2, (bz + wz) / 4, SET_PAINT.box));
  // Straps over the box, outside the window.
  for (const z of [-0.6, 0.6]) {
    out.push(box(bx + 0.02, 0.008, 0.05, 0, top + 0.004, z, SET_PAINT.strap));
    out.push(box(0.008, by, 0.05, -bx / 2 - 0.004, cy, z, SET_PAINT.strap));
    out.push(box(0.008, by, 0.05, bx / 2 + 0.004, cy, z, SET_PAINT.strap));
  }
  // Flow straightener on the upstream wall: a dark panel with a few broad vanes (fine grids shimmer on phones).
  out.push(box(0.01, 0.3, 1.0, -bx / 2 + t + 0.02, -0.02, 0, SET_PAINT.structure));
  for (let i = -3; i <= 3; i++) out.push(box(0.04, 0.3, 0.012, -bx / 2 + t + 0.04, -0.02, i * 0.15, SET_PAINT.card));
  // Sample card: an open frame, so each strip is free on both faces as in flight.
  const cx = CARD.x;
  const cz = CARD.z;
  const r = 0.012;
  out.push(box(cx, r, r, 0, -0.004, -cz / 2, SET_PAINT.card));
  out.push(box(cx, r, r, 0, -0.004, cz / 2, SET_PAINT.card));
  out.push(box(r, r, cz, -cx / 2, -0.004, 0, SET_PAINT.card));
  out.push(box(r, r, cz, cx / 2, -0.004, 0, SET_PAINT.card));
  // Card legs down to the box floor.
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    out.push(box(0.015, 0.29, 0.015, (lx * cx) / 2, floorY + 0.15, (lz * cz) / 2, SET_PAINT.card));
  }
  return out;
}

/** The nine strips. Silicone a little lighter and smoother, fabrics warm grey, PMMA clear grey. */
function samples(materials: (string | null)[]): Piece[] {
  const out: Piece[] = [];
  materials.forEach((m, i) => {
    const z = sampleZ(i);
    const tone = m?.startsWith("Silicone") ? SET_PAINT.silicone : m?.startsWith("PMMA") ? SET_PAINT.pmma : SET_PAINT.fabric;
    out.push(box(SAMPLE_LEN, 0.0012, SAMPLE_W, 0, 0, z, tone));
    // Clamps at both ends and the igniter wire at the upstream end.
    out.push(box(0.012, 0.006, SAMPLE_W + 0.01, -SAMPLE_LEN / 2 - 0.004, 0, z, SET_PAINT.card));
    out.push(box(0.012, 0.006, SAMPLE_W + 0.01, SAMPLE_LEN / 2 + 0.004, 0, z, SET_PAINT.card));
    // Rails along both edges hold the strip to the card.
    out.push(box(SAMPLE_LEN + 0.02, 0.004, 0.004, 0, -0.003, z - SAMPLE_W / 2 - 0.004, SET_PAINT.card));
    out.push(box(SAMPLE_LEN + 0.02, 0.004, 0.004, 0, -0.003, z + SAMPLE_W / 2 + 0.004, SET_PAINT.card));
  });
  // Cross rails carry the strips across the card.
  for (const x of [-SAMPLE_LEN / 2 - 0.01, SAMPLE_LEN / 2 + 0.01]) out.push(box(0.008, 0.008, CARD.z, x, -0.006, 0, SET_PAINT.card));
  return out;
}

function glowing(): Piece[] {
  const out: Piece[] = [];
  // LED modules along the ceiling.
  for (let z = HULL_Z0 + 0.8; z < HULL_Z1 - 0.3; z += 1.4) {
    out.push(box(0.5, 0.01, 0.12, 0, HULL_Y + HULL_R - 0.12, z, SET_PAINT.led));
  }
  // Orange: floor guide strips and placards only.
  // Floor strips stop short of the flow unit, so no orange sits in the foreground.
  for (const x of [-0.85, 0.85]) out.push(box(0.025, 0.004, 3.8, x, DECK_Y + 0.003, HULL_Z0 + 0.4 + 1.9, SET_PAINT.orange));
  out.push(box(0.22, 0.08, 0.01, -0.3, HULL_Y + 0.35, HULL_Z0 + 0.04, SET_PAINT.orange));
  out.push(box(0.12, 0.004, 0.06, -BOX.x / 2 + 0.07, BOX_TOP + 0.002, BOX.z / 2 - 0.07, SET_PAINT.orange));
  return out;
}

export type SetGeometry = { solid: BufferGeometry; glow: BufferGeometry; triangles: number };

export function buildSet(sampleMaterials: (string | null)[]): SetGeometry {
  const solid = mergeGeometries([...hull(), ...bags(), ...flowUnit(), ...samples(sampleMaterials)]);
  const glow = mergeGeometries(glowing());
  if (!solid || !glow) throw new Error("SAFFIRE set: geometry merge failed");
  const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  return { solid, glow, triangles: tris(solid) + tris(glow) };
}
