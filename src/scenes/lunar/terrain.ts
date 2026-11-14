import { BufferAttribute, BufferGeometry } from "three";

/** Flat pads where models stand: [x, z, radius] in metres. Craters and noise fade out over PAD_FADE beyond the radius. */
export type Pad = readonly [number, number, number];
const PAD_FADE = 6;

/** Deterministic PRNG so the regolith is the same on every load (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a hashed lattice. */
function hash(ix: number, iz: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

type Crater = { x: number; z: number; r: number };

export type HeightField = { heightAt: (x: number, z: number) => number; size: number; centre: [number, number]; craters: readonly Crater[] };
export type Regolith = { geometry: BufferGeometry; triangles: number };

/**
 * Lunar ground height: rolling noise, bowl craters with raised rims, a far ridge that hides the mesh edge,
 * and flat pads under the models and the camera paths.
 */
export function makeHeightField(opts: { size?: number; pads: readonly Pad[]; seed?: number; centre?: [number, number] }): HeightField {
  const { size = 260, pads, seed = 7, centre = [0, 0] } = opts;
  const rand = rng(seed);
  const craters: Crater[] = [];
  for (let i = 0; i < 70; i++) {
    const r = 1.5 + Math.pow(rand(), 2.2) * 16;
    const x = (rand() - 0.5) * size * 0.8;
    const z = (rand() - 0.5) * size * 0.8;
    craters.push({ x, z, r });
  }
  const heightAt = (x: number, z: number) => {
    let h = (noise(x / 9, z / 9) - 0.5) * 0.6 + (noise(x / 2.6, z / 2.6) - 0.5) * 0.12 + (noise(x / 31, z / 31) - 0.5) * 1.4;
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d > 2.2) continue;
      const depth = 0.22 * c.r;
      const bowl = d < 1 ? -depth * (1 - d * d) : 0;
      const rim = 0.07 * c.r * Math.exp(-((d - 1) * (d - 1)) / 0.08);
      h += bowl + rim;
    }
    let keep = 1;
    for (const [px, pz, pr] of pads) keep = Math.min(keep, smooth(pr, pr + PAD_FADE, Math.hypot(x - px, z - pz)));
    h *= keep;
    // Far ridge: the ground rises towards the edge so the end of the mesh sits behind a horizon line.
    const r = Math.hypot(x - centre[0], z - centre[1]);
    h += smooth(size * 0.22, size * 0.48, r) * (3 + noise(x / 40, z / 40) * 5);
    return h;
  };
  return { heightAt, size, centre, craters };
}

/** Mesh for a height field. The grid is denser near the centre (where the camera looks) and stretches towards the edge. */
export function makeRegolith(field: HeightField, segments = 130): Regolith {
  const { heightAt, size, centre, craters } = field;
  const n = segments + 1;
  const pos = new Float32Array(n * n * 3);
  const col = new Float32Array(n * n * 3);
  const half = size / 2;
  // Warp: grid spacing grows with distance from the centre (|u|^1.6).
  const warp = (u: number) => Math.sign(u) * Math.pow(Math.abs(u), 1.6) * half;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = centre[0] + warp((i / segments) * 2 - 1);
      const z = centre[1] + warp((j / segments) * 2 - 1);
      const h = heightAt(x, z);
      const k = (j * n + i) * 3;
      pos[k] = x;
      pos[k + 1] = h;
      pos[k + 2] = z;
      // Albedo: slight mottling, brighter fresh ejecta near rims, darker floors.
      let a = 0.82 + (noise(x / 5, z / 5) - 0.5) * 0.16 + (noise(x / 23, z / 23) - 0.5) * 0.14;
      for (const c of craters) {
        const d = Math.hypot(x - c.x, z - c.z) / c.r;
        if (d < 1.6) a += d < 0.85 ? -0.05 : 0.07 * (1 - Math.abs(d - 1.15) / 0.45);
      }
      col[k] = col[k + 1] = col[k + 2] = a;
    }
  }
  const idx = new Uint32Array(segments * segments * 6);
  let p = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b;
      idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("color", new BufferAttribute(col, 3));
  geometry.setIndex(new BufferAttribute(idx, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, triangles: segments * segments * 2 };
}
