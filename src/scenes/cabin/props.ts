// The objects on the bench, shaped like what they are named: a folded cloth, a paper stack with one sheet lifted, a
// rounded foam pad, an acrylic sheet, a locker with a door, a cable bundle with ties, a soft stowage bag, a glass
// screen in a frame. Each is built once from kit parts: a body (the material that burns, chars and soots) and trim
// (hinges, straps, ties) in shared neutral materials. Local coordinates: x along the bench from the object's middle,
// y up from the bench top, z across from the object's line.
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, PlaneGeometry, TubeGeometry, Vector3, type Texture } from "three";
import type { CabinObject, ObjId } from "../spread/spread.ts";
import { canvasTex, Kit, placed, rng, type Surface } from "./kit.ts";

export type PropParts = {
  /** The object's own material: burns, chars, soots. */
  body: BufferGeometry;
  /** Hardware in shared materials. */
  trim: [Surface, BufferGeometry][];
  /** The box the selection outline is drawn on, and its centre. */
  bounds: BoxGeometry;
  center: [number, number, number];
  /** Surface print or weave on the body. */
  map?: Texture;
  /** Cloth and paper are single sheets: drawn from both sides. */
  twoSided?: boolean;
  /** See-through: the glass screen and the acrylic sheet. */
  opacity?: number;
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A sheet lying on the bench (x by z), subdivided, its height set by f(x, z). */
function sheet(w: number, d: number, nx: number, nz: number, f: (x: number, z: number) => number) {
  const g = new PlaneGeometry(w, d, nx, nz);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, f(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  return g;
}

/** Fine woven cloth: a crosshatch of warp and weft. */
const weave = () =>
  canvasTex(
    "weave",
    128,
    128,
    (x, w, h) => {
      x.fillStyle = "#e9e7e1";
      x.fillRect(0, 0, w, h);
      const r = rng(7);
      for (let i = 0; i < w; i += 4) {
        x.fillStyle = `rgba(80,76,70,${0.1 + r() * 0.1})`;
        x.fillRect(i, 0, 1.5, h);
        x.fillStyle = `rgba(80,76,70,${0.08 + r() * 0.08})`;
        x.fillRect(0, i + 2, w, 1.5);
      }
    },
    [6, 3],
  );

/** A printed checklist: a title bar, numbered rows with tick boxes. */
const print = () =>
  canvasTex("checklist", 256, 340, (x, w, h) => {
    x.fillStyle = "#f4f3ef";
    x.fillRect(0, 0, w, h);
    x.fillStyle = "#4a4945";
    x.fillRect(18, 16, w - 36, 22);
    x.fillStyle = "#f4f3ef";
    x.font = "bold 13px sans-serif";
    x.fillText("EMERGENCY  FIRE  RESPONSE", 26, 32);
    x.fillStyle = "#6a6964";
    const r = rng(3);
    for (let i = 0; i < 13; i++) {
      const y = 58 + i * 21;
      x.strokeStyle = "#6a6964";
      x.lineWidth = 1.5;
      x.strokeRect(20, y, 10, 10);
      x.fillRect(38, y + 3, 60 + r() * 130, 3);
      if (r() > 0.5) x.fillRect(38, y + 9, 30 + r() * 80, 2);
    }
    x.fillRect(18, h - 22, w - 36, 1);
  });

/** Open-cell foam: fine speckled pores. */
const pores = () =>
  canvasTex(
    "pores",
    128,
    128,
    (x, w, h) => {
      x.fillStyle = "#e4e2dc";
      x.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 900; i++) {
        x.fillStyle = `rgba(90,86,80,${0.08 + r() * 0.18})`;
        x.beginPath();
        x.arc(r() * w, r() * h, 0.6 + r() * 1.6, 0, Math.PI * 2);
        x.fill();
      }
    },
    [2, 2],
  );

function cloth(w: number, d: number): Partial<PropParts> {
  // Soft folds across the sheet, the far corner folded back over itself.
  const wave = (v: number) => (0.5 + 0.5 * Math.sin(v)) ** 2;
  const fold = (x: number, z: number) => 0.0012 + 0.0032 * wave(x * 24 + z * 7 + Math.sin(z * 14) * 0.8) + 0.0016 * wave(z * 19 - x * 9 + 1.3);
  const g = sheet(w, d, 48, 26, fold);
  const p = g.attributes.position;
  // Flap: the corner past the line x/w + z/d > 0.62 (in half-sizes) mirrors over that line and lies on top.
  const nx = 1 / (w / 2);
  const nz = 1 / (d / 2);
  const len = Math.hypot(nx, nz);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const s = (x * nx + z * nz - 1.15) / len;
    if (s > 0) {
      p.setX(i, x - (2 * s * nx) / len);
      p.setZ(i, z - (2 * s * nz) / len);
      p.setY(i, 0.006 + 0.004 * Math.exp(-s * 60));
    }
  }
  g.computeVertexNormals();
  return { body: g, map: weave(), twoSided: true };
}

function paper(w: number, d: number): Partial<PropParts> {
  const k = new Kit();
  // Three sheets under the top one, each a little turned.
  for (let i = 0; i < 3; i++) k.box("paint", [w, 0.0006, d], { p: [(i - 1) * 0.004, 0.0004 + i * 0.0007, (1 - i) * 0.003], r: [0, (i - 1) * 0.04, 0], c: "#e8e7e2" });
  // The top sheet, its near corner lifted and curling.
  const top = sheet(w * 0.98, d * 0.98, 24, 30, (x, z) => {
    const u = (x / w + 0.5 + (z / d + 0.5)) / 2;
    return 0.0028 + 0.03 * smooth(0.7, 1, u) ** 2;
  });
  top.rotateY(0.03);
  const body = new Kit().add("paint", top, {}).add("paint", (k.build().get("paint") as BufferGeometry) ?? new BufferGeometry(), {}).build().get("paint")!;
  return { body, map: print(), twoSided: true };
}

function foam(w: number, h: number, d: number): Partial<PropParts> {
  const k = new Kit().rbox("soft", [w, h, d], 0.011, { p: [0, h / 2, 0] }, 3);
  const g = k.build().get("soft")!;
  // A shallow dent in the middle of the top: soft, not a block.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > h * 0.8) p.setY(i, y - 0.004 * Math.exp(-((p.getX(i) / (w * 0.35)) ** 2 + (p.getZ(i) / (d * 0.35)) ** 2)));
  }
  g.computeVertexNormals();
  return { body: g, map: pores() };
}

function acrylic(w: number, h: number, d: number): Partial<PropParts> {
  const body = new Kit().rbox("paint", [w, h, d], 0.003, { p: [0, h / 2 + 0.006, 0] }).build().get("paint")!;
  const t = new Kit();
  // Four nylon stand-offs under the sheet and a bolt through each corner.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      t.cyl("dark", 0.007, 0.007, 0.006, { p: [sx * (w / 2 - 0.025), 0.003, sz * (d / 2 - 0.025)], c: "#3a3936" });
      t.cyl("metal", 0.0045, 0.0045, 0.003, { p: [sx * (w / 2 - 0.025), h + 0.0075, sz * (d / 2 - 0.025)], c: "#9a9893" });
    }
  return { body, trim: [...t.build()], opacity: 0.72 };
}

function locker(w: number, h: number, d: number): Partial<PropParts> {
  const b = new Kit();
  b.rbox("paint", [w, h, d - 0.01], 0.006, { p: [0, h / 2, -0.005] });
  // The door: a slab standing proud of the front, a seam all round it.
  b.rbox("paint", [w - 0.024, h - 0.024, 0.008], 0.002, { p: [0, h / 2, d / 2 - 0.006] });
  const t = new Kit();
  const fz = d / 2 - 0.0095;
  t.box("dark", [w - 0.012, h - 0.012, 0.002], { p: [0, h / 2, fz], c: "#1d1d1b" });
  // Hinges on the left edge.
  for (const y of [0.06, h - 0.06]) t.cyl("metal", 0.006, 0.006, 0.04, { p: [-w / 2 + 0.012, y, d / 2 + 0.002], c: "#a9a7a1" });
  // A pull handle on the right on two stand-offs.
  const hx = w / 2 - 0.04;
  t.rod("metal", [hx, h / 2 - 0.05, d / 2 + 0.022], [hx, h / 2 + 0.05, d / 2 + 0.022], 0.0045, "#c4c2bc");
  for (const y of [h / 2 - 0.05, h / 2 + 0.05]) t.rod("metal", [hx, y, d / 2 - 0.002], [hx, y, d / 2 + 0.022], 0.0035, "#c4c2bc");
  // A latch plate, a label holder and louvres low on the door.
  t.box("metal", [0.018, 0.04, 0.004], { p: [hx, h / 2, d / 2 + 0.001], c: "#8c8a85" });
  t.box("paint", [0.12, 0.035, 0.002], { p: [-0.03, h - 0.06, d / 2 + 0.0], c: "#d9d7d0" });
  for (let i = 0; i < 5; i++) t.box("dark", [0.16, 0.005, 0.003], { p: [-0.03, 0.045 + i * 0.013, d / 2 + 0.0], c: "#262624" });
  return { body: b.build().get("paint")!, trim: [...t.build()] };
}

function cable(w: number, h: number): Partial<PropParts> {
  // Three insulated conductors twisted along the run, tied every 12 cm, a connector at each end.
  const r = h / 2;
  const k = new Kit();
  for (let j = 0; j < 3; j++) {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = -w / 2 + 0.02 + ((w - 0.04) * i) / 40;
      const a = x * 22 + (j * Math.PI * 2) / 3;
      pts.push(new Vector3(x, r + Math.sin(a) * r * 0.45, Math.cos(a) * r * 0.45));
    }
    k.add("soft", new TubeGeometry(new CatmullRomCurve3(pts), 80, r * 0.52, 6), { c: j === 1 ? "#cfcdc6" : "#e6e4de" });
  }
  const t = new Kit();
  for (let x = -w / 2 + 0.08; x < w / 2 - 0.05; x += 0.12) t.torus("dark", r * 1.02, 0.0016, { p: [x, r, 0], r: [0, Math.PI / 2, 0], c: "#2a2a28" }, Math.PI * 2, 12);
  for (const s of [-1, 1]) {
    t.cyl("metal", r * 1.25, r * 1.25, 0.03, { p: [s * (w / 2 - 0.012), r, 0], r: [0, 0, Math.PI / 2], c: "#9d9b95" }, 10);
    t.cyl("dark", r * 0.9, r * 1.25, 0.014, { p: [s * (w / 2 - 0.034), r, 0], r: [0, 0, Math.PI / 2], c: "#2f2e2c" }, 10);
  }
  return { body: k.build().get("soft")!, trim: [...t.build()] };
}

function bag(w: number, h: number, d: number): Partial<PropParts> {
  const g = new Kit().rbox("soft", [w, h, d], 0.04, { p: [0, h / 2, 0] }, 4).build().get("soft")!;
  // Soft: the top bulges, the sides sag a little.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2);
    const z = p.getZ(i) / (d / 2);
    const y = p.getY(i) / h;
    p.setY(i, p.getY(i) + 0.012 * y * (1 - x * x) * (1 - z * z));
    p.setZ(i, p.getZ(i) * (1 + 0.06 * Math.sin(Math.PI * y)));
  }
  g.computeVertexNormals();
  const t = new Kit();
  // Two straps round the bag, a zip along the top with a pull, a carry handle.
  for (const x of [-w * 0.27, w * 0.27]) {
    t.box("dark", [0.022, 0.003, d + 0.012], { p: [x, h + 0.006, 0], c: "#3b3a37" });
    t.box("dark", [0.022, h * 0.85, 0.003], { p: [x, h * 0.5, d / 2 + 0.008], c: "#3b3a37" });
    t.box("dark", [0.022, h * 0.85, 0.003], { p: [x, h * 0.5, -d / 2 - 0.008], c: "#3b3a37" });
    t.box("metal", [0.03, 0.012, 0.005], { p: [x, h * 0.55, d / 2 + 0.011], c: "#a6a49e" });
  }
  t.box("dark", [w * 0.82, 0.003, 0.008], { p: [0, h + 0.009, d * 0.18], c: "#2b2a28" });
  t.box("metal", [0.014, 0.004, 0.022], { p: [w * 0.38, h + 0.01, d * 0.18 + 0.01], c: "#b5b3ad" });
  t.torus("dark", 0.035, 0.005, { p: [0, h + 0.008, -d * 0.12], r: [0, 0, 0], c: "#3b3a37" }, Math.PI, 12);
  return { body: g, trim: [...t.build()] };
}

function screen(w: number, h: number, d: number): Partial<PropParts> {
  const body = new BoxGeometry(w - 0.02, h - 0.016, d * 0.6);
  body.translate(0, h / 2 + 0.012, 0);
  const t = new Kit();
  const fh = h + 0.012;
  t.box("metal", [w, 0.012, 0.016], { p: [0, fh, 0], c: "#9c9a94" });
  t.box("metal", [w, 0.016, 0.02], { p: [0, 0.01, 0], c: "#7e7c77" });
  for (const s of [-1, 1]) {
    t.box("metal", [0.012, fh, 0.016], { p: [s * (w / 2 - 0.006), fh / 2, 0], c: "#9c9a94" });
    t.box("dark", [0.03, 0.006, 0.12], { p: [s * (w / 2 - 0.03), 0.003, 0], c: "#2e2d2b" });
  }
  return { body, trim: [...t.build()], opacity: 0.3 };
}

const built = new Map<ObjId, PropParts>();

/** The shaped prop for an object, built once. Its size is the object's span (x0..x1) and hd. */
export function propParts(o: CabinObject): PropParts {
  const hit = built.get(o.id);
  if (hit) return hit;
  const w = o.x1 - o.x0;
  const [h, d] = o.hd;
  const part =
    o.id === "cloth"
      ? cloth(w, d)
      : o.id === "checklist"
        ? paper(w, d)
        : o.id === "foam"
          ? foam(w, h, d)
          : o.id === "panel"
            ? acrylic(w, h, d)
            : o.id === "locker"
              ? locker(w, h, d)
              : o.id === "cable"
                ? cable(w, h)
                : o.id === "bag"
                  ? bag(w, h, d)
                  : screen(w, h, d);
  // Every body carries a vertex colour (its material multiplies by it).
  const body = part.body!.attributes.color ? part.body! : placed(part.body!);
  body.computeBoundingBox();
  const bb = body.boundingBox!;
  const pad = 0.01;
  const size: [number, number, number] = [bb.max.x - bb.min.x + pad, Math.max(0.006, bb.max.y - bb.min.y + pad), bb.max.z - bb.min.z + pad];
  const out: PropParts = {
    trim: [],
    ...part,
    body,
    bounds: new BoxGeometry(...size),
    center: [(bb.max.x + bb.min.x) / 2, (bb.max.y + bb.min.y) / 2, (bb.max.z + bb.min.z) / 2],
  };
  built.set(o.id, out);
  return out;
}
