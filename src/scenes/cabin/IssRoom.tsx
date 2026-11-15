import { useMemo } from "react";
import { BackSide, DoubleSide, Shape, ShapeGeometry } from "three";
import type { V3 } from "./layout.ts";
import { Inst, type Item } from "./MoonRoom.tsx";

// ISS lab module (PRD 17): a tube with no floor, lined on four sides with rack fronts, handrails, hatch rings at both
// ends, cable bundles in the corners, a laptop on an arm, strapped stowage bags, a round window on Earth. Neutral
// greys only; repeated parts are instanced (one draw each).

const AXIS_Y = 0.25;
const R = 1.1;
const X0 = -2.2;
const X1 = 3.8;
const XC = (X0 + X1) / 2;
const LEN = X1 - X0;
/** Rack faces stand this far from the axis, on all four sides. */
const F = 0.86;

/** The round window on the far (−z) wall: also where its label points (Cabin.tsx). */
export const ISS_WINDOW = { x: 1.25, y: 0.3, r: 0.2, z: -F + 0.01 };

const GREY = {
  shell: "#5a5955",
  rack: "#76746e",
  inset: "#5e5d58",
  dark: "#2e2e2c",
  metal: "#9a9892",
  rail: "#b3b1aa",
  bag: "#8a8780",
  strap: "#45443f",
  cable: "#3c3b38",
  sky: "#050505",
  earth: "#a3a29d",
  cloud: "#c9c8c3",
};

const range = (a: number, b: number, step: number) => Array.from({ length: Math.floor((b - a) / step + 1e-6) + 1 }, (_, i) => a + i * step);
const RACK_W = 0.56;
const RACK_X = range(X0 + 0.15 + RACK_W / 2, X1 - 0.15 - RACK_W / 2, RACK_W + 0.02);
/** The four walls: deck (−y), overhead (+y), far (−z), near (+z), each as a centre and the rotation of a flat panel. */
const WALLS: { c: (x: number) => V3; r: V3; win?: boolean }[] = [
  { c: (x) => [x, AXIS_Y - F, 0], r: [-Math.PI / 2, 0, 0] },
  { c: (x) => [x, AXIS_Y + F, 0], r: [Math.PI / 2, 0, 0] },
  { c: (x) => [x, AXIS_Y, -F], r: [0, 0, 0], win: true },
  { c: (x) => [x, AXIS_Y, F], r: [0, Math.PI, 0] },
];
const inWindowBay = (x: number) => Math.abs(x - ISS_WINDOW.x) < RACK_W / 2;
const RACKS: Item[] = WALLS.flatMap((w) => RACK_X.filter((x) => !(w.win && inWindowBay(x))).map((x): Item => ({ p: w.c(x), r: w.r, s: [RACK_W, F * 2 - 0.3, 0.04] })));
/** Drawer and panel insets on each rack: offset along the wall's own up axis. */
const INSETS: Item[] = WALLS.flatMap((w, wi) =>
  RACK_X.filter((x) => !(w.win && inWindowBay(x))).flatMap((x, xi) =>
    [-0.45, -0.1, 0.3].map((u, k): Item => {
      const [cx, cy, cz] = w.c(x);
      const h = k === 2 ? 0.34 : 0.22 + 0.06 * ((xi + wi) % 2);
      // Up along the panel: +y on the side walls, ±z on deck and overhead; nudged off the face toward the axis.
      const p: V3 = wi < 2 ? [cx, cy + (wi === 0 ? 0.03 : -0.03), cz + u] : [cx, cy + u, cz + (wi === 2 ? 0.03 : -0.03)];
      return { p, r: w.r, s: [RACK_W - 0.1, h, 0.03] };
    }),
  ),
);
/** Handrails: long bars on standoffs, along the side walls and the overhead. */
const RAILS: Item[] = [
  [AXIS_Y + 0.62, -F + 0.07],
  [AXIS_Y + 0.62, F - 0.07],
  [AXIS_Y - 0.55, -F + 0.07],
  [AXIS_Y + F - 0.07, -0.4],
].map(([y, z]) => ({ p: [XC, y, z], s: [1, LEN - 0.6, 1], r: [0, 0, Math.PI / 2] }));
const STANDOFFS: Item[] = [
  [AXIS_Y + 0.62, -F + 0.035],
  [AXIS_Y + 0.62, F - 0.035],
  [AXIS_Y - 0.55, -F + 0.035],
].flatMap(([y, z]) => range(X0 + 0.5, X1 - 0.5, 0.9).map((x): Item => ({ p: [x, y, z], s: [0.03, 0.03, 0.07] })));
/** Cable bundles in the four corners between racks, a few strands each. */
const CABLES: Item[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
].flatMap(([sy, sz], i) =>
  [0, 1, 2].map((k): Item => ({ p: [XC, AXIS_Y + sy * (F - 0.06 - 0.035 * k), sz * (F - 0.06 - 0.03 * ((k + i) % 2))], s: [1 + 0.4 * (k % 2), LEN, 1 + 0.4 * (k % 2)], r: [0, 0, Math.PI / 2] })),
);
/** Corner fillets: 45° panels that close the gaps between rack walls. */
const FILLETS: Item[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
].map(([sy, sz]) => ({ p: [XC, AXIS_Y + sy * 0.86, sz * 0.86], s: [LEN, 0.42, 0.03], r: [(sy * sz * Math.PI) / 4, 0, 0] }));
/** Stowage bags strapped to the near and overhead racks, and their straps. */
const BAGS: Item[] = [
  { p: [-1.6, AXIS_Y + 0.15, -F + 0.15], s: [0.42, 0.3, 0.22] },
  { p: [-1.55, AXIS_Y - 0.2, -F + 0.14], s: [0.34, 0.26, 0.2] },
  { p: [2.6, AXIS_Y + 0.05, -F + 0.15], s: [0.46, 0.34, 0.22] },
  { p: [-0.6, AXIS_Y + F - 0.13, -0.35], s: [0.4, 0.2, 0.32] },
  { p: [2.2, AXIS_Y + F - 0.13, 0.2], s: [0.5, 0.2, 0.36] },
];
const STRAPS: Item[] = BAGS.flatMap((b) => [-0.25, 0.25].map((f): Item => ({ p: [b.p[0] + f * b.s![0], b.p[1], b.p[2]], s: [0.03, b.s![1] + 0.02, b.s![2] + 0.02] })));
/** Laptop on an articulated arm off the far wall, left of the window. */
const ARM: Item[] = [
  { p: [0.1, AXIS_Y + 0.45, -F + 0.12], s: [0.04, 0.04, 0.2] },
  { p: [0.1, AXIS_Y + 0.45, -F + 0.24], s: [0.3, 0.035, 0.035], r: [0, 0.5, 0] },
  { p: [0.24, AXIS_Y + 0.45, -F + 0.33], s: [0.04, 0.12, 0.04] },
];
const LAPTOP = { p: [0.26, AXIS_Y + 0.51, -F + 0.38] as V3, base: [0.34, 0.02, 0.24] as V3 };
const LIGHTS: Item[] = range(X0 + 0.7, X1 - 0.7, 1.2).map((x) => ({ p: [x, AXIS_Y + F - 0.025, 0.42], s: [0.5, 0.02, 0.1] }));

/** Earth through the window: the planet's limb across the lower part of the round pane. */
function earthGeo(r: number) {
  const limb = (x: number) => -1.9 * r + Math.sqrt((2.1 * r) ** 2 - x * x);
  const s = new Shape();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const x = -r + (2 * r * i) / n;
    const y = Math.min(Math.sqrt(Math.max(0, r * r - x * x)), limb(x));
    if (i === 0) s.moveTo(x, 0);
    s.lineTo(x, y);
  }
  for (let i = n; i >= 0; i--) {
    const x = -r + (2 * r * i) / n;
    s.lineTo(x, -Math.sqrt(Math.max(0, r * r - x * x)));
  }
  return new ShapeGeometry(s);
}

export function IssRoom() {
  const W = ISS_WINDOW;
  const earth = useMemo(() => earthGeo(W.r * 0.86), [W.r]);
  return (
    <group>
      <pointLight position={[0.8, AXIS_Y + 0.6, 0]} intensity={0.8} distance={3} color="#f2f2ee" />
      <mesh position={[XC, AXIS_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[R, R, LEN, 24, 1, true]} />
        <meshStandardMaterial color={GREY.shell} side={BackSide} roughness={0.9} />
      </mesh>
      <Inst items={RACKS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.rack} roughness={0.75} />
      </Inst>
      <Inst items={INSETS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.inset} roughness={0.6} metalness={0.2} />
      </Inst>
      <Inst items={FILLETS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.inset} roughness={0.85} />
      </Inst>
      <Inst items={RAILS}>
        <cylinderGeometry args={[0.016, 0.016, 1, 8]} />
        <meshStandardMaterial color={GREY.rail} roughness={0.35} metalness={0.6} />
      </Inst>
      <Inst items={STANDOFFS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.metal} roughness={0.4} metalness={0.6} />
      </Inst>
      <Inst items={CABLES}>
        <cylinderGeometry args={[0.014, 0.014, 1, 6]} />
        <meshStandardMaterial color={GREY.cable} roughness={0.8} />
      </Inst>
      <Inst items={LIGHTS}>
        <boxGeometry />
        <meshStandardMaterial color="#dcdcd8" emissive="#f2f2ee" emissiveIntensity={1} />
      </Inst>
      {/* Hatch rings at both ends, a dark node beyond each. */}
      <Inst items={[{ p: [X0 + 0.02, AXIS_Y, 0], r: [0, Math.PI / 2, 0] }, { p: [X1 - 0.02, AXIS_Y, 0], r: [0, -Math.PI / 2, 0] }]}>
        <ringGeometry args={[0.52, R, 32]} />
        <meshStandardMaterial color={GREY.rack} roughness={0.8} side={DoubleSide} />
      </Inst>
      <Inst items={[{ p: [X0 + 0.04, AXIS_Y, 0], r: [0, Math.PI / 2, 0] }, { p: [X1 - 0.04, AXIS_Y, 0], r: [0, -Math.PI / 2, 0] }]}>
        <torusGeometry args={[0.55, 0.05, 8, 40]} />
        <meshStandardMaterial color={GREY.metal} roughness={0.35} metalness={0.7} />
      </Inst>
      <Inst items={[{ p: [X0, AXIS_Y, 0], r: [0, Math.PI / 2, 0] }, { p: [X1, AXIS_Y, 0], r: [0, -Math.PI / 2, 0] }]}>
        <circleGeometry args={[0.52, 32]} />
        <meshStandardMaterial color={GREY.dark} roughness={1} />
      </Inst>
      {/* Stowage bags, strapped. */}
      <Inst items={BAGS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.bag} roughness={0.95} />
      </Inst>
      <Inst items={STRAPS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.strap} roughness={0.9} />
      </Inst>
      {/* Laptop on its arm. */}
      <Inst items={ARM}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.metal} roughness={0.4} metalness={0.6} />
      </Inst>
      <group position={LAPTOP.p} rotation={[0, 0.35, 0]}>
        <mesh>
          <boxGeometry args={LAPTOP.base} />
          <meshStandardMaterial color={GREY.dark} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.11, -0.12]} rotation={[-0.25, 0, 0]}>
          <boxGeometry args={[0.34, 0.22, 0.015]} />
          <meshStandardMaterial color={GREY.dark} roughness={0.5} emissive="#8d9196" emissiveIntensity={0.25} />
        </mesh>
      </group>
      {/* Round window in its rack bay: a recessed plate, black space, Earth's limb, a thick ring. */}
      <mesh position={[W.x, AXIS_Y, -F - 0.02]}>
        <boxGeometry args={[RACK_W, F * 2 - 0.3, 0.04]} />
        <meshStandardMaterial color={GREY.inset} roughness={0.8} />
      </mesh>
      <group position={[W.x, W.y, W.z]}>
        <mesh>
          <circleGeometry args={[W.r * 0.86, 40]} />
          <meshBasicMaterial color={GREY.sky} />
        </mesh>
        <mesh geometry={earth} position={[0, 0, 0.003]}>
          <meshBasicMaterial color={GREY.earth} side={DoubleSide} />
        </mesh>
        <mesh position={[W.r * 0.2, -W.r * 0.35, 0.005]} scale={[1.8, 0.5, 1]}>
          <circleGeometry args={[W.r * 0.16, 16]} />
          <meshBasicMaterial color={GREY.cloud} />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <torusGeometry args={[W.r * 0.93, W.r * 0.09, 8, 40]} />
          <meshStandardMaterial color={GREY.metal} roughness={0.35} metalness={0.65} />
        </mesh>
      </group>
    </group>
  );
}
