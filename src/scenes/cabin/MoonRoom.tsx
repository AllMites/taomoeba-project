import { useLayoutEffect, useMemo, useRef } from "react";
import { BackSide, DoubleSide, type InstancedMesh, Object3D, Shape, ShapeGeometry } from "three";
import type { V3 } from "./layout.ts";

// Moon Base habitat (PRD 17): a ribbed vault on a panel floor, built from primitives. Neutral greys only, so the
// flame stays the one strong colour; detail comes from form and light. Repeated parts are instanced (one draw each).

/** The vault: a cylinder along x, axis at y = AXIS_Y, radius R, so its crown is the room's ceiling (y = 1.7). */
const R = 2.4;
const AXIS_Y = -0.7;
const FLOOR_Y = -0.9;
const X0 = -2.2;
const X1 = 3.8;
const XC = (X0 + X1) / 2;
const LEN = X1 - X0;

/** The window on the far wall (centre, size): also where its label points (Cabin.tsx). */
export const MOON_WINDOW = { x: 2.05, y: 0.35, w: 1.0, h: 0.55, z: -1.96 };
const HATCH = { x: -1.3, y: 0.15, r: 0.42, z: -1.97 };

const GREY = {
  shell: "#5f5e59",
  rib: "#6c6b65",
  floor: "#3c3b38",
  tile: "#58574f",
  metal: "#8a8882",
  dark: "#2c2c2a",
  crate: "#6a6862",
  strap: "#3a3936",
  leaf: "#6c706a",
  sky: "#050505",
  near: "#6f6c66",
  far: "#9a9791",
};

export type Item = { p: V3; s?: V3; r?: V3 };

export function Inst({ items, children }: { items: Item[]; children: React.ReactNode }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      o.rotation.set(...(it.r ?? [0, 0, 0]));
      o.scale.set(...(it.s ?? [1, 1, 1]));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false}>
      {children}
    </instancedMesh>
  );
}

const range = (a: number, b: number, step: number) => Array.from({ length: Math.floor((b - a) / step + 1e-6) + 1 }, (_, i) => a + i * step);
/** A point on the vault, `in` metres inside it, at angle t from the crown (positive toward +z). */
const onShell = (t: number, inset: number): [number, number] => [AXIS_Y + (R - inset) * Math.cos(t), (R - inset) * Math.sin(t)];

const RIBS: Item[] = range(X0 + 0.25, X1 - 0.2, 0.6).map((x) => ({ p: [x, AXIS_Y, 0], r: [0, Math.PI / 2, 0] }));
const STRINGERS: Item[] = [-1.05, -0.55, 0.55, 1.05].map((t) => {
  const [y, z] = onShell(t, 0.06);
  return { p: [XC, y, z], s: [LEN, 0.05, 0.09], r: [-t, 0, 0] };
});
const CONDUITS: Item[] = [-0.3, -0.24, 0.27].map((t) => {
  const [y, z] = onShell(t, 0.14);
  return { p: [XC, y, z], r: [0, 0, Math.PI / 2] };
});
const LIGHTS: Item[] = [-0.42, 0.42].map((z) => ({ p: [XC, 1.6, z], s: [LEN - 0.6, 0.02, 0.12] }));
const TILE = 0.6;
const TILES: Item[] = range(X0 + TILE / 2, X1 - TILE / 2, TILE).flatMap((x) =>
  range(-2.1 + TILE / 2, 2.1 - TILE / 2, TILE).map((z): Item => ({ p: [x, FLOOR_Y + 0.012, z], s: [TILE - 0.025, 0.024, TILE - 0.025] })),
);
/** Workbench legs and crossbars under the bench top (x -0.85..2.35, z ±0.18, top at y 0). */
const LEGS: Item[] = [-0.78, 0.75, 2.28].flatMap((x) => [0.15, -0.15].map((z): Item => ({ p: [x, (FLOOR_Y - 0.06) / 2, z], s: [0.05, -FLOOR_Y - 0.06, 0.05] })));
const BARS: Item[] = [
  { p: [0.75, -0.62, 0], s: [3.12, 0.03, 0.32] },
  { p: [0.75, -0.11, 0.165], s: [3.1, 0.08, 0.025] },
];
/** Bolts around the hatch rim. */
const DOGS: Item[] = range(0, 7, 1).map((i) => {
  const a = (i / 8) * Math.PI * 2;
  return { p: [HATCH.x + Math.cos(a) * HATCH.r * 1.12, HATCH.y + Math.sin(a) * HATCH.r * 1.12, HATCH.z + 0.04], s: [0.05, 0.05, 0.05] };
});
/** Plant rack against the far wall. */
const RACK = { x0: 0.5, x1: 1.3, z: -1.6, d: 0.32 };
const RACK_POSTS: Item[] = [RACK.x0, RACK.x1].flatMap((x) => [RACK.z - RACK.d / 2, RACK.z + RACK.d / 2].map((z): Item => ({ p: [x, -0.02, z], s: [0.035, 1.76, 0.035] })));
const SHELF_Y = [-0.55, -0.1, 0.35, 0.82];
const RACK_SHELVES: Item[] = SHELF_Y.map((y) => ({ p: [(RACK.x0 + RACK.x1) / 2, y, RACK.z], s: [RACK.x1 - RACK.x0 + 0.04, 0.025, RACK.d] }));
const TRAYS: Item[] = SHELF_Y.slice(0, 3).map((y) => ({ p: [(RACK.x0 + RACK.x1) / 2, y + 0.04, RACK.z], s: [RACK.x1 - RACK.x0 - 0.06, 0.06, RACK.d - 0.06] }));
const PLANTS: Item[] = SHELF_Y.slice(0, 3).flatMap((y, row) =>
  range(0, 4, 1).map((i): Item => {
    const k = 0.04 + 0.012 * (((i + row * 2) * 7) % 3);
    return { p: [RACK.x0 + 0.1 + i * 0.15, y + 0.07 + k * 0.7, RACK.z + (i % 2 ? 0.05 : -0.04)], s: [k, k * 1.3, k], r: [0, i * 1.1, 0] };
  }),
);
const GROW: Item[] = SHELF_Y.slice(1).map((y) => ({ p: [(RACK.x0 + RACK.x1) / 2, y - 0.03, RACK.z + 0.04], s: [RACK.x1 - RACK.x0 - 0.1, 0.015, 0.05] }));
/** Stacked crates on the floor, left of the rack. */
const CRATES: Item[] = [
  { p: [-0.25, FLOOR_Y + 0.2, -1.5], s: [0.55, 0.4, 0.45] },
  { p: [-0.8, FLOOR_Y + 0.17, -1.45], s: [0.45, 0.34, 0.5] },
  { p: [-0.32, FLOOR_Y + 0.56, -1.5], s: [0.45, 0.32, 0.4], r: [0, 0.12, 0] },
  { p: [-0.78, FLOOR_Y + 0.48, -1.47], s: [0.36, 0.28, 0.36], r: [0, -0.2, 0] },
  { p: [0.1, FLOOR_Y + 0.13, -1.0], s: [0.32, 0.26, 0.32], r: [0, 0.5, 0] },
];
const STRAPS: Item[] = CRATES.flatMap((c) => {
  const [sx, sy, sz] = c.s!;
  return [-0.3, 0.3].map((f): Item => ({ p: [c.p[0] + Math.cos(c.r?.[1] ?? 0) * f * sx, c.p[1], c.p[2] - Math.sin(c.r?.[1] ?? 0) * f * sx], s: [0.035, sy + 0.01, sz + 0.01], r: c.r }));
});

/** The view outside the window: black sky over a grey horizon, two ridges. */
function horizon(w: number, h: number, base: number, amp: number, seed: number) {
  const s = new Shape();
  s.moveTo(-w / 2, -h / 2);
  for (let i = 0; i <= 24; i++) {
    const x = -w / 2 + (w * i) / 24;
    const y = base + amp * (Math.sin(i * 0.9 + seed) * 0.6 + Math.sin(i * 2.3 + seed * 2) * 0.4);
    s.lineTo(x, Math.min(h / 2, y));
  }
  s.lineTo(w / 2, -h / 2);
  return new ShapeGeometry(s);
}
function frameGeo(w: number, h: number, t: number) {
  const s = new Shape();
  const rr = (sh: Shape | import("three").Path, hw: number, hh: number, r: number) => {
    sh.moveTo(-hw + r, -hh);
    sh.lineTo(hw - r, -hh);
    sh.quadraticCurveTo(hw, -hh, hw, -hh + r);
    sh.lineTo(hw, hh - r);
    sh.quadraticCurveTo(hw, hh, hw - r, hh);
    sh.lineTo(-hw + r, hh);
    sh.quadraticCurveTo(-hw, hh, -hw, hh - r);
    sh.lineTo(-hw, -hh + r);
    sh.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  };
  rr(s, w / 2 + t, h / 2 + t, 0.1);
  const hole = new Shape();
  rr(hole, w / 2, h / 2, 0.07);
  s.holes.push(hole);
  return new ShapeGeometry(s, 6);
}

export function MoonRoom() {
  const W = MOON_WINDOW;
  const geo = useMemo(() => ({ far: horizon(W.w, W.h, -0.02, 0.05, 1.3), near: horizon(W.w, W.h, -0.12, 0.035, 4.1), frame: frameGeo(W.w, W.h, 0.06) }), [W.w, W.h]);
  return (
    <group>
      <pointLight position={[(RACK.x0 + RACK.x1) / 2, 0.2, RACK.z + 0.35]} intensity={0.6} distance={1.6} color="#eef0f2" />
      <directionalLight position={[-1, 3, 1]} intensity={0.5} />
      {/* Shell, end walls, ribs, stringers, conduits, light strips. */}
      <mesh position={[XC, AXIS_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[R, R, LEN, 40, 1, true]} />
        <meshStandardMaterial color={GREY.shell} side={BackSide} roughness={0.85} />
      </mesh>
      <Inst items={[{ p: [X0, AXIS_Y, 0], r: [0, Math.PI / 2, 0] }, { p: [X1, AXIS_Y, 0], r: [0, -Math.PI / 2, 0] }]}>
        <circleGeometry args={[R, 40]} />
        <meshStandardMaterial color={GREY.shell} roughness={0.9} />
      </Inst>
      <Inst items={RIBS}>
        <torusGeometry args={[R - 0.05, 0.06, 4, 64]} />
        <meshStandardMaterial color={GREY.rib} roughness={0.6} metalness={0.3} flatShading />
      </Inst>
      <Inst items={STRINGERS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.rib} roughness={0.6} metalness={0.3} />
      </Inst>
      <Inst items={CONDUITS}>
        <cylinderGeometry args={[0.035, 0.035, LEN, 10]} />
        <meshStandardMaterial color={GREY.metal} roughness={0.45} metalness={0.5} />
      </Inst>
      <Inst items={LIGHTS}>
        <boxGeometry />
        <meshStandardMaterial color="#d8d8d4" emissive="#f2f2ee" emissiveIntensity={0.9} />
      </Inst>
      {/* Floor: a dark deck under raised panels, so the seams read. */}
      <mesh position={[XC, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LEN, 5]} />
        <meshStandardMaterial color={GREY.dark} roughness={1} />
      </mesh>
      <Inst items={TILES}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.tile} roughness={0.75} metalness={0.15} />
      </Inst>
      {/* Workbench under the existing top: legs, a lower shelf, a front apron. */}
      <Inst items={LEGS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.metal} roughness={0.4} metalness={0.6} />
      </Inst>
      <Inst items={BARS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.rib} roughness={0.6} metalness={0.4} />
      </Inst>
      {/* Airlock hatch: a bulkhead plate, a ring, the door, a wheel on two spokes, bolts. */}
      <mesh position={[HATCH.x, HATCH.y, HATCH.z - 0.25]}>
        <boxGeometry args={[1.25, 1.35, 0.5]} />
        <meshStandardMaterial color={GREY.rib} roughness={0.8} />
      </mesh>
      <mesh position={[HATCH.x, HATCH.y, HATCH.z + 0.02]}>
        <torusGeometry args={[HATCH.r * 1.05, 0.06, 8, 40]} />
        <meshStandardMaterial color={GREY.metal} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[HATCH.x, HATCH.y, HATCH.z + 0.01]}>
        <circleGeometry args={[HATCH.r, 40]} />
        <meshStandardMaterial color={GREY.crate} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[HATCH.x, HATCH.y, HATCH.z + 0.1]}>
        <torusGeometry args={[HATCH.r * 0.42, 0.022, 8, 32]} />
        <meshStandardMaterial color={GREY.metal} roughness={0.35} metalness={0.7} />
      </mesh>
      <Inst items={[0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((a, i): Item => ({ p: [HATCH.x, HATCH.y, HATCH.z + (i < 2 ? 0.1 : 0.05)], s: i < 2 ? [HATCH.r * 0.84, 0.025, 0.025] : [0.06, 0.06, 0.1], r: [0, 0, a] }))}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.metal} roughness={0.35} metalness={0.7} />
      </Inst>
      <Inst items={DOGS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.dark} roughness={0.5} metalness={0.5} />
      </Inst>
      {/* Plant rack with a grow light under each upper shelf. */}
      <Inst items={[...RACK_POSTS, ...RACK_SHELVES]}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.metal} roughness={0.45} metalness={0.55} />
      </Inst>
      <Inst items={TRAYS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.dark} roughness={0.9} />
      </Inst>
      <Inst items={PLANTS}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={GREY.leaf} roughness={0.9} flatShading />
      </Inst>
      <Inst items={GROW}>
        <boxGeometry />
        <meshStandardMaterial color="#e6e8ea" emissive="#f4f6f8" emissiveIntensity={1.2} />
      </Inst>
      {/* Stacked crates, strapped. */}
      <Inst items={CRATES}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.crate} roughness={0.8} />
      </Inst>
      <Inst items={STRAPS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.strap} roughness={0.9} />
      </Inst>
      {/* Window on the lunar horizon: a recess plate, black sky, two grey ridges, a rounded frame. */}
      <mesh position={[W.x, W.y, W.z - 0.27]}>
        <boxGeometry args={[W.w + 0.4, W.h + 0.4, 0.5]} />
        <meshStandardMaterial color={GREY.rib} roughness={0.8} />
      </mesh>
      <group position={[W.x, W.y, W.z]}>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[W.w, W.h]} />
          <meshBasicMaterial color={GREY.sky} />
        </mesh>
        <mesh geometry={geo.far} position={[0, 0, 0.008]}>
          <meshBasicMaterial color={GREY.far} side={DoubleSide} />
        </mesh>
        <mesh geometry={geo.near} position={[0, 0, 0.011]}>
          <meshBasicMaterial color={GREY.near} side={DoubleSide} />
        </mesh>
        <mesh geometry={geo.frame} position={[0, 0, 0.02]}>
          <meshStandardMaterial color={GREY.metal} side={DoubleSide} roughness={0.4} metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
