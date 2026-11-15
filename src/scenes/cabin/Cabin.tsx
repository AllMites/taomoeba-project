import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { BackSide, DoubleSide } from "three";
import type { BaseId } from "../../app/console.ts";
import { ROOMS, type V3 } from "./layout.ts";

// Mono palette for the cabin: physical surfaces, not UI. The only colour on screen is the fire.
export const CABIN_PAINT = {
  wall: "#4a4945",
  wallLine: "#3a3a37",
  bench: "#55534f",
  outsideSky: "#050505",
  regolith: "#7d7a74",
  earthSky: "#9c9b97",
  frame: "#8a8882",
};

export type ChipSpec = { id: string; at: V3; text: string; sub?: string; below?: boolean };

/**
 * Labels on glass, each with a short leader line to the point it names. They live in the DOM over the canvas and
 * follow their points through <ChipTracker> inside the canvas. Never on bare 3D.
 */
export function ChipLayer({ chips, refs }: { chips: ChipSpec[]; refs: React.RefObject<Map<string, HTMLDivElement>> }) {
  return (
    <div className="scene-chips" aria-hidden="true">
      {chips.map((c) => (
        <div
          key={c.id}
          className={`scene-chip${c.below ? " scene-chip-below" : ""}`}
          ref={(el) => {
            if (el) refs.current.set(c.id, el);
            else refs.current.delete(c.id);
          }}
        >
          <span className="scene-chip-box glass">
            <span className="scene-chip-text">{c.text}</span>
            {c.sub && <span className="scene-chip-sub t-readout">{c.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

const P = new Vector3();
/** The window on the far wall: left of the flame as the camera sees it, clear of the console's glass. */
const WIN_R = 0.2;
/** Where the window sits on the far wall. A module's curved wall leaves no room low down, so its window is to the right. */
const winAt = (r: (typeof ROOMS)[BaseId]) => (r.shape === "tube" ? { x: 1.6, y: 0 } : { x: -0.4, y: -0.3 });
/** The far wall at the window's height: a tube's wall curves, a box's is flat. */
const winZ = (r: (typeof ROOMS)[BaseId]) =>
  r.shape === "tube" ? -Math.sqrt(r.size[1] ** 2 - (winAt(r).y - r.base) ** 2) + 0.06 : -r.size[2] / 2 + 0.02;

/** Moves each chip to its point's screen position every frame; hides chips whose point is behind the camera. */
export function ChipTracker({ chips, refs }: { chips: ChipSpec[]; refs: React.RefObject<Map<string, HTMLDivElement>> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useFrame(() => {
    for (const c of chips) {
      const el = refs.current.get(c.id);
      if (!el) continue;
      P.set(...c.at).project(camera);
      const off = P.z > 1 || P.x < -1.2 || P.x > 1.2 || P.y < -1.2 || P.y > 1.2;
      el.style.visibility = off ? "hidden" : "visible";
      // Keep the chip on screen: past the right edge it slides left (the leader line then points less exactly).
      el.style.left = `${Math.max(4, Math.min(((P.x + 1) / 2) * size.width, size.width - el.offsetWidth - 4))}px`;
      el.style.top = `${((1 - P.y) / 2) * size.height}px`;
    }
  });
  return null;
}

/** The base's cabin: walls, a bench along the airflow, a window on the far wall, soft cabin light. */
export function Cabin({ base }: { base: BaseId }) {
  const r = ROOMS[base];
  const w = winAt(r);
  return (
    <group>
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#e8e6e0", "#2a2a28", 1.1]} />
      <directionalLight position={[1.5, 2.5, 2]} intensity={1.1} />
      {r.shape === "tube" ? (
        <mesh position={[0.8, r.base, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[r.size[1], r.size[1], r.size[0], 16, 1, true]} />
          <meshStandardMaterial color={CABIN_PAINT.wall} side={BackSide} roughness={0.9} flatShading />
        </mesh>
      ) : (
        <mesh position={[0.8, r.base + r.size[1] / 2, 0]}>
          <boxGeometry args={r.size} />
          <meshStandardMaterial color={CABIN_PAINT.wall} side={BackSide} roughness={0.9} />
        </mesh>
      )}
      {/* Bench (an aluminium rail in a module, a table in a habitat). */}
      <mesh position={[0.75, -0.03, 0]}>
        <boxGeometry args={[3.2, 0.06, 0.7]} />
        <meshStandardMaterial color={CABIN_PAINT.bench} roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Window on the far wall, and what lies outside it. */}
      <group position={[w.x, w.y, winZ(r)]}>
        <mesh>
          <ringGeometry args={[WIN_R * 0.84, WIN_R, 40]} />
          <meshStandardMaterial color={CABIN_PAINT.frame} side={DoubleSide} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, -0.01]}>
          <circleGeometry args={[WIN_R * 0.84, 40]} />
          <meshBasicMaterial color={r.outside === "earth" ? CABIN_PAINT.earthSky : CABIN_PAINT.outsideSky} />
        </mesh>
        {r.outside === "moon" && (
          <mesh position={[0, 0, -0.005]}>
            <circleGeometry args={[WIN_R * 0.84, 40, Math.PI, Math.PI]} />
            <meshBasicMaterial color={CABIN_PAINT.regolith} />
          </mesh>
        )}
        {r.outside === "orbit" && (
          <mesh position={[WIN_R * 0.25, -WIN_R * 0.35, -0.005]}>
            <circleGeometry args={[WIN_R * 0.4, 40]} />
            <meshBasicMaterial color={CABIN_PAINT.earthSky} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Where the window is, for its label. */
export function windowAt(base: BaseId): V3 {
  const r = ROOMS[base];
  const w = winAt(r);
  return [w.x, w.y - WIN_R * 1.05, winZ(r)];
}
