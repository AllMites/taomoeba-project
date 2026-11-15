import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { BackSide, DoubleSide } from "three";
import type { BaseId } from "../../app/console.ts";
import { ROOMS, type V3 } from "./layout.ts";
import { MOON_WINDOW, MoonRoom } from "./MoonRoom.tsx";
import { ISS_WINDOW, IssRoom } from "./IssRoom.tsx";

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

export type ChipSpec = { id: string; at: V3; text: string; sub?: string; below?: boolean; left?: boolean; hide?: boolean };

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
          className={`scene-chip${c.below ? " scene-chip-below" : ""}${c.left ? " scene-chip-left" : ""}`}
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
/** In-scene labels on screen at once, at most (PRD 18.2). */
export const MAX_CHIPS = 5;
/** The window on the far wall: left of the flame as the camera sees it, clear of the console's glass. */
const WIN_R = 0.2;
/** Where the window sits on the far wall: right of the flame as the camera sees it, clear of the model panel on the left. */
const winAt = (r: (typeof ROOMS)[BaseId]) =>
  r === ROOMS.moon ? { x: MOON_WINDOW.x, y: MOON_WINDOW.y, r: MOON_WINDOW.h / 2 } : r === ROOMS.iss ? { x: ISS_WINDOW.x, y: ISS_WINDOW.y, r: ISS_WINDOW.r } : r.shape === "tube" ? { x: 1.2, y: 0.02, r: 0.15 } : r.size[2] < 3 ? { x: 1.4, y: -0.2, r: WIN_R } : { x: 1.9, y: -0.3, r: WIN_R };
/** The far wall at the window's height: a tube's wall curves, a box's is flat. */
const winZ = (r: (typeof ROOMS)[BaseId]) =>
  r === ROOMS.moon ? MOON_WINDOW.z + 0.03 : r === ROOMS.iss ? ISS_WINDOW.z + 0.02 : r.shape === "tube" ? -Math.sqrt(r.size[1] ** 2 - (winAt(r).y - r.base) ** 2) + 0.14 : -r.size[2] / 2 + 0.02;

/** Moves each chip to its point's screen position every frame; hides chips whose point is behind the camera. */
export function ChipTracker({ chips, refs }: { chips: ChipSpec[]; refs: React.RefObject<Map<string, HTMLDivElement>> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  // How far down the stage's own top controls reach: a chip that would sit under them flips below its point.
  const clearTop = useRef(0);
  useEffect(() => {
    const read = () => {
      const layer = refs.current.values().next().value?.parentElement;
      clearTop.current = layer ? parseFloat(getComputedStyle(layer).getPropertyValue("--replay-clear-top")) || 0 : 0;
    };
    read();
    window.addEventListener("replay-zone", read);
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("replay-zone", read);
      window.removeEventListener("resize", read);
    };
  }, [refs]);
  useFrame(() => {
    for (const c of chips) {
      const el = refs.current.get(c.id);
      if (!el) continue;
      P.set(...c.at).project(camera);
      const off = c.hide || P.z > 1 || P.x < -1.2 || P.x > 1.2 || P.y < -1.2 || P.y > 1.2;
      el.style.visibility = off ? "hidden" : "visible";
      // Keep the chip on screen: past the right edge it slides left (the leader line then points less exactly).
      const x = ((P.x + 1) / 2) * size.width;
      el.style.left = `${c.left ? Math.max(x, el.offsetWidth + 4) : Math.max(4, Math.min(x, size.width - el.offsetWidth - 4))}px`;
      const y = ((1 - P.y) / 2) * size.height;
      const flip = !c.below && !c.left && y - el.offsetHeight < clearTop.current;
      if (!c.below && !c.left) el.classList.toggle("scene-chip-flip", flip);
      // A flipped chip whose point is under the top controls slides down to clear them.
      el.style.top = `${flip ? Math.max(y, clearTop.current) : y}px`;
    }
    // Chips come in order of importance: one that overlaps an earlier chip steps aside (hidden) for it, and no more
    // than MAX_CHIPS show at once.
    // A callout card in the scene (17.5) comes first: a label under it steps aside.
    const shown: DOMRect[] = [];
    const layer = refs.current.values().next().value?.parentElement?.parentElement;
    const cards = [...(layer?.querySelectorAll<HTMLElement>(".callout-card") ?? [])].filter((e) => e.style.visibility !== "hidden").map((e) => e.getBoundingClientRect());
    for (const c of chips) {
      const el = refs.current.get(c.id);
      if (!el || el.style.visibility === "hidden") continue;
      const b = el.firstElementChild?.getBoundingClientRect();
      if (!b) continue;
      if (shown.length >= MAX_CHIPS || cards.some((a) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) || shown.some((a) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)) el.style.visibility = "hidden";
      else shown.push(b);
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
      {base === "moon" ? (
        <MoonRoom />
      ) : base === "iss" ? (
        <IssRoom />
      ) : r.shape === "tube" ? (
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
        <boxGeometry args={[3.2, 0.06, 0.36]} />
        <meshStandardMaterial color={CABIN_PAINT.bench} roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Window on the far wall, and what lies outside it (Moon Base draws its own). */}
      {base !== "moon" && base !== "iss" && <group position={[w.x, w.y, winZ(r)]} scale={w.r / WIN_R}>
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
      </group>}
    </group>
  );
}

/** Where the window is, for its label. */
export function windowAt(base: BaseId): V3 {
  const r = ROOMS[base];
  const w = winAt(r);
  return [w.x - w.r * 0.75, w.y - w.r * 0.75, winZ(r)];
}
