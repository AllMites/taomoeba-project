// Fire spread in the cabin: everyday objects on the bench, a flame front that creeps over the ones that burn, char
// behind it, smoke and the cabin's airflow. Positions and verdicts come from ../spread/spread.ts (pure, tested).
import { Edges } from "@react-three/drei";
import { useState } from "react";
import { Flame, FlameFront } from "../../fx/index.tsx";
import { usePlayback } from "../playback.ts";
import { JUMP_M, OBJECTS, reach, spreadAt, type CabinObject, type Fabric, type Gravity } from "../spread/spread.ts";
import type { Air } from "./air.ts";
import type { ChipSpec } from "./Cabin.tsx";

/** Mono paint: the fire stays the only colour on screen. Combustible things are pale, the rest metal grey. */
const PAINT = { fuel: "#d8d6d0", inert: "#7d7c78", glass: "#b9c2c6", outline: "#ffffff", smoke: "#9a9893", flow: "#ecebe6" };

const top = (o: CabinObject) => o.hd[0];
const midX = (o: CabinObject) => (o.x0 + o.x1) / 2;

/** One object: a box on the bench. Hover, focus (via the panel) or tap outlines it white and opens its card. */
function Thing({ o, g, lit }: { o: CabinObject; g: Gravity; lit: boolean }) {
  const [hover, setHover] = useState(false);
  const picked = usePlayback((s) => s.picked === o.id);
  const [h, d] = o.hd;
  const w = o.x1 - o.x0;
  const burns = o.burns(g);
  return (
    <mesh
      position={[midX(o), h / 2, o.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        usePlayback.getState().pick(picked ? null : o.id);
      }}
    >
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        color={o.id === "window" ? PAINT.glass : burns ? PAINT.fuel : PAINT.inert}
        roughness={o.id === "locker" ? 0.35 : 0.8}
        metalness={o.id === "locker" ? 0.6 : 0}
        transparent={o.id === "window"}
        opacity={o.id === "window" ? 0.35 : 1}
        emissive={lit ? "#1a0d04" : "#000000"}
      />
      {(hover || picked) && <Edges color={PAINT.outline} threshold={15} />}
    </mesh>
  );
}

/** Faint arrows along the bench, the way the cabin air moves. */
function Airflow() {
  return (
    <group>
      {[-0.35, 0.35, 1.05].map((x) => (
        <group key={x} position={[x, 0.24, -0.1]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.22, 0.004, 0.004]} />
            <meshBasicMaterial color={PAINT.flow} transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <mesh position={[0.12, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.014, 0.04, 12]} />
            <meshBasicMaterial color={PAINT.flow} transparent opacity={0.45} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Smoke as a few soft puffs, placed by the seeker's time so scrubbing moves them too. In microgravity it drifts
 * downstream with the airflow, close to the surface; at 1 g it rises.
 */
function Smoke({ x, y, t, g, flow }: { x: number; y: number; t: number; g: Gravity; flow: number }) {
  const puffs = 7;
  return (
    <group>
      {Array.from({ length: puffs }, (_, i) => {
        const age = (t * 0.35 + i / puffs) % 1;
        const p: [number, number, number] =
          g === "earth" ? [x + age * 0.06, y + 0.12 + age * 0.7, -0.02] : [x + 0.05 + age * 0.3 * Math.min(2, flow / 10 + 0.3), y + 0.02 + age * 0.05, 0];
        const s = 0.04 + age * 0.1;
        return (
          <mesh key={i} position={p} scale={s}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color={PAINT.smoke} transparent opacity={(1 - age) * age * 0.32} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/** The fire at the seeker's time, the objects and the airflow. */
export function SpreadSet({ air, g, fabric, flow, calm, chips }: { air: Air; g: Gravity; fabric: Fabric; flow: number; calm: boolean; chips?: ChipSpec[] }) {
  const t = usePlayback((s) => s.t);
  const o2 = air.o2Percent ?? 21;
  const at = spreadAt(OBJECTS, g, o2, fabric, t);
  // The object the front is on, or about to jump onto across a small gap.
  const on = OBJECTS.filter((o) => o.burns(g) && Math.abs(o.z) < 0.1 && o.x0 <= at.front + JUMP_M && at.front <= o.x1).sort((a, b) => b.x0 - a.x0)[0];
  const y = on ? top(on) : 0.004;
  if (chips) placeSpreadChips(chips, g, o2, fabric, t);
  return (
    <group>
      {OBJECTS.map((o) => (
        <Thing key={o.id} o={o} g={g} lit={at.alive && on?.id === o.id} />
      ))}
      {/* Char on every object the front has passed; the live flame only on the one it is on (microgravity). */}
      {OBJECTS.filter((o) => at.burnt[o.id] > 0 || o.id === on?.id).map((o) => (
        <group key={o.id} position={[Math.max(o.x0, 0), top(o) + 0.0005, o.z]}>
          <FlameFront
            length={o.x1 - Math.max(o.x0, 0)}
            width={o.hd[1]}
            front={o.id === on?.id ? Math.max(at.burnt[o.id], 0.01) : at.burnt[o.id]}
            o2Percent={o2}
            pressureKPa={air.pressureKPa}
            airflowCmS={flow}
            intensity={g !== "earth" && at.alive && o.id === on?.id ? 1 : 0}
            calm={calm}
          />
        </group>
      ))}
      {/* At 1 g: tall teardrop flames standing on the front. */}
      {g === "earth" && at.alive && (
        <group position={[at.front, y, 0]}>
          <Flame o2Percent={o2} pressureKPa={air.pressureKPa} size={0.14} gravity="earth" calm={calm} />
        </group>
      )}
      {/* A flame the airflow cannot keep alive: a small dimming flame at the ignition point. */}
      {!fabric.lives && at.alive && (
        <group position={[0.01, 0.01, 0]}>
          <Flame o2Percent={o2} pressureKPa={air.pressureKPa} size={0.035} airflowCmS={flow} calm={calm} />
        </group>
      )}
      {at.alive && <Smoke x={at.front} y={y} t={t} g={g} flow={flow} />}
      <Airflow />
    </group>
  );
}

/** Glass labels on the fire: flame front, burnt zone, unburnt fuel, airflow direction. Placed by placeSpreadChips. */
export function spreadChips(g: Gravity, flow: number): ChipSpec[] {
  return [
    { id: "front", at: [0, 0.08, 0], text: "Flame front", sub: g === "earth" ? "a rising flame" : "low, it hugs the surface" },
    { id: "burnt", at: [0, 0.01, 0.1], text: "Burnt zone", below: true, hide: true },
    { id: "unburnt", at: [0, 0.02, 0.12], text: "Unburnt fuel", below: true, hide: true },
    { id: "airflow", at: [-0.35, 0.26, -0.1], text: "Airflow", sub: `${flow} cm/s along the bench` },
  ];
}

/** Moves the fire's labels to the front at time t (in place, so the scene does not re-render every frame). */
export function placeSpreadChips(chips: ChipSpec[], g: Gravity, o2: number, fabric: Fabric, t: number) {
  const at = spreadAt(OBJECTS, g, o2, fabric, t);
  const end = fabric.lives ? reach(OBJECTS, g) : 0;
  for (const c of chips) {
    if (c.id === "front") {
      c.at = [at.front, g === "earth" ? 0.16 : 0.06, 0];
      c.hide = !at.alive;
    } else if (c.id === "burnt") {
      c.at = [at.front / 2, 0.01, 0.1];
      c.hide = at.front < 0.12;
    } else if (c.id === "unburnt") {
      c.at = [(at.front + end) / 2 + 0.05, 0.02, 0.12];
      c.hide = end - at.front < 0.12;
    }
  }
}
