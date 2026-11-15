import { Billboard } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef, useState } from "react";
import { useConsole } from "../../app/console.ts";
import type { SceneProps } from "../../contracts/index.ts";
import { Flame } from "../../fx/index.tsx";
import { Glow } from "../lunar/FlamePair.tsx";
import { hasWebGL } from "../lunar/LunarScene.tsx";
import { usePlayback } from "../playback.ts";
import { Cabin, CABIN_PAINT, ChipLayer, ChipTracker, windowAt, type ChipSpec } from "./Cabin.tsx";
import { airOf, type Air } from "./air.ts";
import { chipAnchor, DROPLET, flameRadius, homePose, ROOMS, type V3 } from "./layout.ts";
import { Navigate } from "./Navigate.tsx";
import "./cabin.css";

/** The fuel droplet on its fibre holder: drawn larger than life (DROPLET.scale), like the flame around it. */
export function Droplet({ at, dMm }: { at: V3; dMm: number }) {
  const r = (dMm / 2 / 1000) * DROPLET.scale;
  return (
    <group>
      <mesh position={at}>
        <sphereGeometry args={[r, 24, 16]} />
        <meshStandardMaterial color="#cfcac0" roughness={0.15} metalness={0.1} transparent opacity={0.85} />
      </mesh>
      {/* Fibre and stand down to the bench. */}
      <mesh position={[at[0], at[1] / 2, at[2]]}>
        <cylinderGeometry args={[0.0015, 0.0015, at[1], 6]} />
        <meshStandardMaterial color={CABIN_PAINT.frame} />
      </mesh>
      <mesh position={[at[0], 0.01, at[2]]}>
        <cylinderGeometry args={[0.03, 0.04, 0.02, 20]} />
        <meshStandardMaterial color={CABIN_PAINT.frame} metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** A flame burning around the droplet, with a soft additive glow that always faces the camera. */
export function DropletFlame({ air, dMm, calm, faint }: { air: Air & { o2Percent: number }; dMm: number; calm: boolean; faint?: boolean }) {
  const r = flameRadius(dMm);
  return (
    <group position={DROPLET.at}>
      {!faint && (
        <Billboard>
          <Glow size={r * 5} o2Percent={air.o2Percent} pressureKPa={air.pressureKPa} warm={air.gravity === "earth"} />
        </Billboard>
      )}
      <Flame o2Percent={air.o2Percent} pressureKPa={air.pressureKPa} airflowCmS={air.gravity === "earth" ? 0 : 3} size={r * 2} calm={calm} gravity={air.gravity} />
    </group>
  );
}

/** The replay inside the picked base's cabin: a droplet burning on a holder on the bench, the window behind. */
export function CabinScene({ habitat, calm }: SceneProps) {
  const base = useConsole((s) => s.base);
  const mode = usePlayback((s) => s.mode);
  const [webgl] = useState(hasWebGL);
  const air = airOf(base, habitat);
  const room = ROOMS[base];
  const home = homePose(base, mode === "spread" ? "spread" : "burn");
  const dMm = 2;
  const r = flameRadius(dMm);
  const chipEls = useRef(new Map<string, HTMLDivElement>());
  const chips: ChipSpec[] = [
    { id: "flame", at: chipAnchor(DROPLET.at, r), text: `Flame in ${air.name}`, sub: air.readout },
    { id: "window", at: windowAt(base), below: true, text: room.outside === "orbit" ? "Window: Earth from orbit" : room.outside === "moon" ? "Window: the lunar surface" : "Window: daylight on Earth" },
  ];

  if (!webgl) return null;
  return (
    <div className="cabin" data-base={base}>
      <Canvas
        aria-hidden="true"
        dpr={[1, 1.5]}
        frameloop={calm ? "demand" : "always"}
        camera={{ fov: home.fov, near: 0.01, far: 60, position: home.pos }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor(CABIN_PAINT.outsideSky)}
      >
        <Cabin base={base} />
        <Navigate home={home} calm={calm} />
        <Droplet at={DROPLET.at} dMm={dMm} />
        {air.o2Percent !== undefined && <DropletFlame air={{ ...air, o2Percent: air.o2Percent }} dMm={dMm} calm={calm} />}
        <ChipTracker chips={chips} refs={chipEls} />
      </Canvas>
      <ChipLayer chips={chips} refs={chipEls} />
      <p className="sr-only">
        {`Inside the ${room.name}: a fuel droplet burns on a holder on the bench. ${air.name}: ${air.readout}. Illustration, not a simulation.`}
      </p>
    </div>
  );
}
