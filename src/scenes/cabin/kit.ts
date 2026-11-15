// A small parts kit for the cabins and their props: shapes are placed one by one, then merged into one geometry
// per material, so a detailed room costs a handful of draw calls. Each part carries its own grey as a vertex colour,
// so one material holds many shades. Neutral only: the fire, the smoke and one glow per base carry the colour.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Material,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type V3 = [number, number, number];

/** Surface kinds. Each becomes one material, so one draw call per kind present. */
export type Surface = "paint" | "metal" | "dark" | "soft" | "glass" | "glow" | "panel" | "floor" | "rack";

export type Place = { p?: V3; r?: V3; s?: V3 | number; c?: string };

const M = new Matrix4();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();
const P = new Vector3();
const C = new Color();

/** Puts a shape where it goes and tints it: the result has position, normal, uv and color, unindexed. */
export function placed(geo: BufferGeometry, { p = [0, 0, 0], r = [0, 0, 0], s = 1, c = "#ffffff" }: Place = {}): BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute("uv", new BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  E.set(...r);
  Q.setFromEuler(E);
  if (typeof s === "number") S.set(s, s, s);
  else S.set(...s);
  M.compose(P.set(...p), Q, S);
  g.applyMatrix4(M);
  C.set(c).convertSRGBToLinear();
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([C.r, C.g, C.b], i * 3);
  g.setAttribute("color", new BufferAttribute(col, 3));
  if (g !== geo) geo.dispose();
  g = g as BufferGeometry;
  return g;
}

/** Collects parts by surface and merges them. */
export class Kit {
  parts = new Map<Surface, BufferGeometry[]>();
  add(surface: Surface, geo: BufferGeometry, at: Place = {}) {
    const list = this.parts.get(surface) ?? [];
    list.push(placed(geo, at));
    this.parts.set(surface, list);
    return this;
  }
  box(surface: Surface, size: V3, at: Place = {}) {
    return this.add(surface, new BoxGeometry(...size), at);
  }
  /** A box with rounded edges and corners (r: corner radius). */
  rbox(surface: Surface, size: V3, radius: number, at: Place = {}, seg = 2) {
    return this.add(surface, new RoundedBoxGeometry(size[0], size[1], size[2], seg, Math.min(radius, ...size.map((v) => v / 2 - 1e-4))), at);
  }
  /** A cylinder standing along y (rotate it to lie down). */
  cyl(surface: Surface, rTop: number, rBot: number, h: number, at: Place = {}, seg = 12, open = false) {
    return this.add(surface, new CylinderGeometry(rTop, rBot, h, seg, 1, open), at);
  }
  /** A rod between two points. */
  rod(surface: Surface, a: V3, b: V3, radius: number, c?: string, seg = 8) {
    const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = d.length();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
    const e = new Euler().setFromQuaternion(q);
    return this.cyl(surface, radius, radius, len, { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r: [e.x, e.y, e.z], c }, seg);
  }
  torus(surface: Surface, radius: number, tube: number, at: Place = {}, arc = Math.PI * 2, seg = 24) {
    return this.add(surface, new TorusGeometry(radius, tube, 6, seg, arc), at);
  }
  ball(surface: Surface, radius: number, at: Place = {}, seg = 10) {
    return this.add(surface, new SphereGeometry(radius, seg, Math.max(4, Math.round(seg * 0.7))), at);
  }
  /** One merged geometry per surface. */
  build(): Map<Surface, BufferGeometry> {
    const out = new Map<Surface, BufferGeometry>();
    for (const [k, list] of this.parts) {
      const g = mergeGeometries(list, false);
      if (g) {
        g.computeBoundingSphere();
        out.set(k, g);
      }
      for (const x of list) x.dispose();
    }
    this.parts.clear();
    return out;
  }
}

/** A canvas texture, drawn once and kept. */
const cache = new Map<string, CanvasTexture>();
export function canvasTex(key: string, w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(...repeat);
  }
  cache.set(key, t);
  return t;
}

/** Small seeded noise, so canvas textures draw the same every time. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const mats = new Map<string, Material>();
/** The shared material for a surface kind (textures for panel, floor and rack come from the room). */
export function surfaceMaterial(s: Surface, map?: Texture, glow = "#f1eee6"): Material {
  const key = s + (map?.uuid ?? "") + glow;
  const hit = mats.get(key);
  if (hit) return hit;
  let m: Material;
  if (s === "glow") m = new MeshBasicMaterial({ color: glow, toneMapped: false });
  else if (s === "glass") m = new MeshStandardMaterial({ color: "#c9cfd2", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide });
  else
    m = new MeshStandardMaterial({
      vertexColors: true,
      map: map ?? null,
      roughness: s === "metal" ? 0.38 : s === "dark" ? 0.55 : s === "soft" ? 0.95 : 0.78,
      metalness: s === "metal" ? 0.55 : s === "dark" ? 0.3 : 0.05,
    });
  mats.set(key, m);
  return m;
}
