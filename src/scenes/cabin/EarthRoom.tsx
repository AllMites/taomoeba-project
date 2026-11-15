import { BackSide } from "three";
import { Inst, type Item } from "./MoonRoom.tsx";

// Cabin on Earth (PRD 17): an ordinary lab room. A bench on legs with stools, a fume hood, ceiling light panels, a
// door, a daylight window and wall shelves. Neutral greys only; repeated parts are instanced.

// Room box (layout.ts): x -1.7..3.3, y -0.9..1.7, z -2..2.
const X0 = -1.7;
const X1 = 3.3;
const XC = (X0 + X1) / 2;
const LEN = X1 - X0;
const FLOOR_Y = -0.9;
const TOP_Y = 1.7;
const D = 2;
const WALL = -D + 0.01;

/** The daylight window on the far wall: also where its label points (Cabin.tsx). */
export const EARTH_WINDOW = { x: 2.25, y: 0.75, w: 1.1, h: 0.9, z: WALL };
const DOOR = { x: -1.15, w: 0.86, h: 2.05 };
const HOOD = { x: -0.1, w: 1.0, d: 0.7 };
const SHELF = { x0: 0.75, x1: 1.55 };

const GREY = {
  wall: "#8c8b86",
  floor: "#6b6a65",
  tile: "#77766f",
  metal: "#a3a19b",
  cabinet: "#7c7a74",
  dark: "#2e2e2c",
  door: "#6e6c66",
  board: "#9a9892",
  bottle: "#b9b8b2",
  stool: "#55544f",
  day: "#e4e4e0",
};

const range = (a: number, b: number, step: number) => Array.from({ length: Math.floor((b - a) / step + 1e-6) + 1 }, (_, i) => a + i * step);

const TILE = 0.5;
const TILES: Item[] = range(X0 + TILE / 2, X1 - TILE / 2, TILE).flatMap((x) =>
  range(-D + TILE / 2, D - TILE / 2, TILE).map((z): Item => ({ p: [x, FLOOR_Y + 0.004, z], s: [TILE - 0.012, 0.008, TILE - 0.012] })),
);
const PANELS: Item[] = [-0.6, 0.9, 2.4].flatMap((x) => [-0.8, 0.8].map((z): Item => ({ p: [x, TOP_Y - 0.01, z], s: [0.6, 0.02, 0.6] })));
/** Bench legs, a lower shelf and a back rail under the existing bench top (x -0.85..2.35, z ±0.18, top at y 0). */
const BENCH: Item[] = [
  ...[-0.78, 0.75, 2.28].flatMap((x) => [0.15, -0.15].map((z): Item => ({ p: [x, (FLOOR_Y - 0.06) / 2, z], s: [0.045, -FLOOR_Y - 0.06, 0.045] }))),
  { p: [0.75, -0.65, 0], s: [3.12, 0.025, 0.32] },
];
/** Two stools at the near side of the bench: seat, post, foot ring as a flat disc, base. */
const STOOL_X = [-0.35, 1.75];
const STOOLS: Item[] = STOOL_X.flatMap((x): Item[] => [
  { p: [x, -0.3, 0.55], s: [0.17, 0.04, 0.17] },
  { p: [x, -0.6, 0.55], s: [0.025, 0.6, 0.025] },
  { p: [x, -0.62, 0.55], s: [0.13, 0.012, 0.13] },
  { p: [x, FLOOR_Y + 0.015, 0.55], s: [0.2, 0.03, 0.2] },
]);
/** Fume hood: cabinet, two sides, top, a dark interior, a baffle, a sash frame, a work surface. */
const HZ = WALL + HOOD.d / 2;
const HOOD_BODY: Item[] = [
  { p: [HOOD.x, (FLOOR_Y + 0.0) / 2, HZ], s: [HOOD.w, -FLOOR_Y, HOOD.d] },
  { p: [HOOD.x - HOOD.w / 2 + 0.03, 0.75, HZ], s: [0.06, 1.5, HOOD.d] },
  { p: [HOOD.x + HOOD.w / 2 - 0.03, 0.75, HZ], s: [0.06, 1.5, HOOD.d] },
  { p: [HOOD.x, 1.42, HZ], s: [HOOD.w, 0.16, HOOD.d] },
  { p: [HOOD.x, 1.6, WALL + 0.15], s: [0.24, 0.2, 0.24] },
];
const SASH: Item[] = [
  { p: [HOOD.x, 0.95, WALL + HOOD.d - 0.02], s: [HOOD.w - 0.1, 0.04, 0.03] },
  { p: [HOOD.x, 0.35, WALL + HOOD.d - 0.02], s: [HOOD.w - 0.1, 0.04, 0.03] },
  { p: [HOOD.x, 0.03, WALL + HOOD.d - 0.05], s: [HOOD.w - 0.1, 0.04, 0.08] },
];
/** Wall shelves on brackets, with bottles and boxes. */
const SHELF_Y = [0.55, 0.95];
const BOARDS: Item[] = SHELF_Y.flatMap((y): Item[] => [
  { p: [(SHELF.x0 + SHELF.x1) / 2, y, WALL + 0.13], s: [SHELF.x1 - SHELF.x0, 0.025, 0.26] },
  { p: [SHELF.x0 + 0.06, y - 0.07, WALL + 0.1], s: [0.02, 0.14, 0.2] },
  { p: [SHELF.x1 - 0.06, y - 0.07, WALL + 0.1], s: [0.02, 0.14, 0.2] },
]);
const BOTTLES: Item[] = SHELF_Y.flatMap((y, row) =>
  range(0, 5, 1).map((i): Item => {
    const h = 0.12 + 0.05 * ((i + row) % 3);
    return { p: [SHELF.x0 + 0.1 + i * 0.12, y + 0.012 + h / 2, WALL + 0.12 + (i % 2) * 0.04], s: [0.035 + 0.01 * (i % 2), h, 0.035 + 0.01 * (i % 2)] };
  }),
);
/** Door: leaf, frame (three bars), handle; the leaf is recessed a hair into the wall line. */
const DOOR_FRAME: Item[] = [
  { p: [DOOR.x - DOOR.w / 2 - 0.03, FLOOR_Y + DOOR.h / 2, WALL + 0.02], s: [0.06, DOOR.h + 0.06, 0.05] },
  { p: [DOOR.x + DOOR.w / 2 + 0.03, FLOOR_Y + DOOR.h / 2, WALL + 0.02], s: [0.06, DOOR.h + 0.06, 0.05] },
  { p: [DOOR.x, FLOOR_Y + DOOR.h + 0.03, WALL + 0.02], s: [DOOR.w + 0.12, 0.06, 0.05] },
  { p: [DOOR.x + DOOR.w / 2 - 0.1, FLOOR_Y + 1.0, WALL + 0.05], s: [0.13, 0.025, 0.04] },
  { p: [DOOR.x, FLOOR_Y + 1.5, WALL + 0.015], s: [0.3, 0.42, 0.01] },
];
/** Window: frame bars and a cross mullion, a sill. */
const W = EARTH_WINDOW;
const WIN_BARS: Item[] = [
  { p: [W.x, W.y + W.h / 2 + 0.03, W.z + 0.03], s: [W.w + 0.12, 0.06, 0.06] },
  { p: [W.x, W.y - W.h / 2 - 0.03, W.z + 0.05], s: [W.w + 0.2, 0.05, 0.14] },
  { p: [W.x - W.w / 2 - 0.03, W.y, W.z + 0.03], s: [0.06, W.h + 0.06, 0.06] },
  { p: [W.x + W.w / 2 + 0.03, W.y, W.z + 0.03], s: [0.06, W.h + 0.06, 0.06] },
  { p: [W.x, W.y, W.z + 0.025], s: [0.035, W.h, 0.035] },
  { p: [W.x, W.y + 0.1, W.z + 0.025], s: [W.w, 0.035, 0.035] },
];

export function EarthRoom() {
  return (
    <group>
      {/* Daylight through the window, and the room's ceiling panels. */}
      <directionalLight position={[W.x - 0.5, 2.2, 1.5]} intensity={0.6} color="#f4f4f0" />
      <pointLight position={[0.9, 1.4, 0.2]} intensity={0.6} distance={4} color="#f2f2ee" />
      <mesh position={[XC, (FLOOR_Y + TOP_Y) / 2, 0]}>
        <boxGeometry args={[LEN, TOP_Y - FLOOR_Y, 2 * D]} />
        <meshStandardMaterial color={GREY.wall} side={BackSide} roughness={0.9} />
      </mesh>
      <mesh position={[XC, FLOOR_Y + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LEN, 2 * D]} />
        <meshStandardMaterial color={GREY.floor} roughness={1} />
      </mesh>
      <Inst items={TILES}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.tile} roughness={0.8} />
      </Inst>
      <Inst items={PANELS}>
        <boxGeometry />
        <meshStandardMaterial color="#e2e2de" emissive="#f4f4f0" emissiveIntensity={1} />
      </Inst>
      <Inst items={BENCH}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.metal} roughness={0.45} metalness={0.5} />
      </Inst>
      <Inst items={STOOLS}>
        <cylinderGeometry args={[1, 1, 1, 20]} />
        <meshStandardMaterial color={GREY.stool} roughness={0.6} metalness={0.3} />
      </Inst>
      {/* Fume hood: body, a dark interior behind a glass sash. */}
      <Inst items={HOOD_BODY}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.cabinet} roughness={0.7} />
      </Inst>
      <mesh position={[HOOD.x, 0.68, WALL + 0.02]}>
        <boxGeometry args={[HOOD.w - 0.12, 1.3, 0.02]} />
        <meshStandardMaterial color={GREY.dark} roughness={0.9} />
      </mesh>
      <Inst items={SASH}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.metal} roughness={0.4} metalness={0.6} />
      </Inst>
      <mesh position={[HOOD.x, 0.65, WALL + HOOD.d - 0.02]}>
        <planeGeometry args={[HOOD.w - 0.12, 0.6]} />
        <meshStandardMaterial color="#cfd2d4" transparent opacity={0.18} roughness={0.1} depthWrite={false} />
      </mesh>
      {/* Shelves. */}
      <Inst items={BOARDS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.board} roughness={0.7} />
      </Inst>
      <Inst items={BOTTLES}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial color={GREY.bottle} roughness={0.25} metalness={0.1} />
      </Inst>
      {/* Door. */}
      <mesh position={[DOOR.x, FLOOR_Y + DOOR.h / 2, WALL + 0.01]}>
        <boxGeometry args={[DOOR.w, DOOR.h, 0.02]} />
        <meshStandardMaterial color={GREY.door} roughness={0.7} />
      </mesh>
      <Inst items={DOOR_FRAME}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.metal} roughness={0.45} metalness={0.5} />
      </Inst>
      {/* Daylight window: a bright pane, its frame, a cross mullion, a sill. */}
      <mesh position={[W.x, W.y, W.z + 0.005]}>
        <planeGeometry args={[W.w, W.h]} />
        <meshBasicMaterial color={GREY.day} />
      </mesh>
      <Inst items={WIN_BARS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.board} roughness={0.6} />
      </Inst>
    </group>
  );
}
