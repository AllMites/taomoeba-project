import { useMemo } from "react";
import { BackSide, DoubleSide } from "three";
import { frameGeo, horizon, Inst, type Item } from "./MoonRoom.tsx";

// Pressurized rover cockpit (PRD 17): cramped, a wide windshield on the lunar surface, a dashboard with screens and a
// hand controller, two seats, overhead stowage. Neutral greys only; repeated parts are instanced.

// Room box (layout.ts): x -0.9..2.5, y -0.8..1.2, z -1.2..1.2.
const X0 = -0.9;
const X1 = 2.5;
const XC = (X0 + X1) / 2;
const LEN = X1 - X0;
const FLOOR_Y = -0.8;
const TOP_Y = 1.2;
const D = 1.2;

/** The windshield on the far wall: also where its label points (Cabin.tsx). */
export const ROVER_WINDOW = { x: 0.85, y: 0.62, w: 2.6, h: 0.6, z: -D + 0.02 };

const GREY = {
  shell: "#66655f",
  rib: "#76746e",
  floor: "#3e3d3a",
  dash: "#4a4945",
  metal: "#9a9892",
  seat: "#585752",
  cushion: "#7a7872",
  bin: "#77756f",
  latch: "#3a3936",
  dark: "#2a2a28",
  sky: "#050505",
  near: "#6f6c66",
  far: "#9a9791",
};

const range = (a: number, b: number, step: number) => Array.from({ length: Math.floor((b - a) / step + 1e-6) + 1 }, (_, i) => a + i * step);

/** Frame ribs: a hoop of three bars (two walls and the roof) every 0.55 m. */
const RIBS: Item[] = range(X0 + 0.2, X1 - 0.2, 0.55).flatMap((x): Item[] => [
  { p: [x, (FLOOR_Y + TOP_Y) / 2, D - 0.03], s: [0.06, TOP_Y - FLOOR_Y, 0.06] },
  { p: [x, TOP_Y - 0.03, 0], s: [0.06, 0.06, 2 * D] },
  { p: [x, (FLOOR_Y + 0.25) / 2, -D + 0.03], s: [0.06, 0.25 - FLOOR_Y, 0.06] },
]);
/** Windshield mullions. */
const W = ROVER_WINDOW;
const MULLIONS: Item[] = [-0.33, 0.33].map((f) => ({ p: [W.x + f * W.w, W.y, W.z + 0.03], s: [0.05, W.h + 0.04, 0.04] }));
/** Dashboard: a sloped console under the windshield, its screens and a hand controller. */
const SCREENS: Item[] = [-0.75, 0, 0.75].map((f) => ({ p: [W.x + f * 1.05, 0.2, -D + 0.33], s: [0.42, 0.24, 0.02], r: [-0.55, 0, 0] }));
const KEYS: Item[] = range(0, 9, 1).map((i) => ({ p: [W.x - 1.1 + i * 0.245, 0.06, -D + 0.47], s: [0.07, 0.02, 0.05], r: [-0.55, 0, 0] }));
/** Two seats behind the bench, facing the windshield: cushion, back, headrest, then a pedestal each. */
const SEAT_X = [-0.45, 2.1];
const SEATS: Item[] = SEAT_X.flatMap((x): Item[] => [
  { p: [x, -0.3, -0.55], s: [0.5, 0.1, 0.48] },
  { p: [x, 0.05, -0.33], s: [0.5, 0.62, 0.1], r: [-0.12, 0, 0] },
  { p: [x, 0.45, -0.29], s: [0.28, 0.16, 0.09], r: [-0.12, 0, 0] },
]);
const PEDESTALS: Item[] = SEAT_X.flatMap((x): Item[] => [
  { p: [x, (FLOOR_Y - 0.35) / 2, -0.55], s: [0.08, -0.35 - FLOOR_Y, 0.08] },
  { p: [x, FLOOR_Y + 0.02, -0.55], s: [0.4, 0.04, 0.4] },
]);
/** Overhead stowage bins along both sides of the roof, with their latches. */
const BIN_X = range(X0 + 0.35, X1 - 0.35, 0.68);
const BINS: Item[] = [-1, 1].flatMap((sz) => BIN_X.map((x): Item => ({ p: [x, TOP_Y - 0.17, sz * (D - 0.24)], s: [0.64, 0.3, 0.44] })));
const LATCHES: Item[] = [-1, 1].flatMap((sz) => BIN_X.map((x): Item => ({ p: [x, TOP_Y - 0.26, sz * (D - 0.24) - sz * 0.225], s: [0.12, 0.03, 0.02] })));
const LIGHTS: Item[] = [{ p: [XC, TOP_Y - 0.01, 0], s: [LEN - 0.6, 0.015, 0.14] }];

export function RoverRoom() {
  const geo = useMemo(() => ({ far: horizon(W.w, W.h, -0.04, 0.05, 2.2), near: horizon(W.w, W.h, -0.16, 0.04, 5.3), frame: frameGeo(W.w, W.h, 0.07) }), []);
  return (
    <group>
      <pointLight position={[XC, 0.9, 0.3]} intensity={0.7} distance={3} color="#f2f2ee" />
      <mesh position={[XC, (FLOOR_Y + TOP_Y) / 2, 0]}>
        <boxGeometry args={[LEN, TOP_Y - FLOOR_Y, 2 * D]} />
        <meshStandardMaterial color={GREY.shell} side={BackSide} roughness={0.85} />
      </mesh>
      <mesh position={[XC, FLOOR_Y + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LEN, 2 * D]} />
        <meshStandardMaterial color={GREY.floor} roughness={0.95} />
      </mesh>
      <Inst items={RIBS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.rib} roughness={0.6} metalness={0.3} />
      </Inst>
      <Inst items={LIGHTS}>
        <boxGeometry />
        <meshStandardMaterial color="#dcdcd8" emissive="#f2f2ee" emissiveIntensity={1} />
      </Inst>
      {/* Windshield on the lunar surface. */}
      <group position={[W.x, W.y, W.z]}>
        <mesh>
          <planeGeometry args={[W.w, W.h]} />
          <meshBasicMaterial color={GREY.sky} />
        </mesh>
        <mesh geometry={geo.far} position={[0, 0, 0.003]}>
          <meshBasicMaterial color={GREY.far} side={DoubleSide} />
        </mesh>
        <mesh geometry={geo.near} position={[0, 0, 0.006]}>
          <meshBasicMaterial color={GREY.near} side={DoubleSide} />
        </mesh>
        <mesh geometry={geo.frame} position={[0, 0, 0.015]}>
          <meshStandardMaterial color={GREY.metal} side={DoubleSide} roughness={0.4} metalness={0.6} />
        </mesh>
      </group>
      <Inst items={MULLIONS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.metal} roughness={0.4} metalness={0.6} />
      </Inst>
      {/* Dashboard, screens, keys, hand controller. */}
      <mesh position={[W.x, 0.1, -D + 0.25]} rotation={[-0.55, 0, 0]}>
        <boxGeometry args={[W.w + 0.1, 0.12, 0.6]} />
        <meshStandardMaterial color={GREY.dash} roughness={0.7} />
      </mesh>
      <mesh position={[W.x, -0.35, -D + 0.12]}>
        <boxGeometry args={[W.w + 0.1, 0.9, 0.24]} />
        <meshStandardMaterial color={GREY.dash} roughness={0.8} />
      </mesh>
      <Inst items={SCREENS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.dark} roughness={0.4} emissive="#9aa0a6" emissiveIntensity={0.3} />
      </Inst>
      <Inst items={[...KEYS, ...LATCHES]}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.latch} roughness={0.6} />
      </Inst>
      <group position={[SEAT_X[0] + 0.32, 0.12, -D + 0.5]}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.06, 0.04, 16]} />
          <meshStandardMaterial color={GREY.metal} roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.09, 0]} rotation={[0.2, 0, 0]}>
          <capsuleGeometry args={[0.028, 0.12, 4, 10]} />
          <meshStandardMaterial color={GREY.dark} roughness={0.6} />
        </mesh>
      </group>
      {/* Seats. */}
      <Inst items={SEATS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.cushion} roughness={0.95} />
      </Inst>
      <Inst items={PEDESTALS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.seat} roughness={0.5} metalness={0.5} />
      </Inst>
      {/* Overhead stowage. */}
      <Inst items={BINS}>
        <boxGeometry />
        <meshStandardMaterial color={GREY.bin} roughness={0.8} />
      </Inst>
    </group>
  );
}
