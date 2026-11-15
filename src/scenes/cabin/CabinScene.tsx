import { Billboard } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConsole } from "../../app/console.ts";
import type { SceneProps } from "../../contracts/index.ts";
import { Flame, flameLook } from "../../fx/index.tsx";
import { Glow } from "../lunar/FlamePair.tsx";
import { hasWebGL } from "../lunar/LunarScene.tsx";
import { usePlayback } from "../playback.ts";
import { loadWhatIf } from "../../whatif/load.ts";
import type { WhatIfDoc } from "../../whatif/logic.ts";
import { burnCase, dropletAt, startPick, type BurnCase } from "../burn/model.ts";
import { fabricVerdict, gravityOf } from "../spread/spread.ts";
import { parseSolids, type SolidsDoc } from "../../solids/logic.ts";
import { burnTimeline, storyTimeline, timelineKey } from "../timelines.ts";
import { story } from "../spread/story.ts";
import { Cabin, CABIN_PAINT, ChipLayer, ChipTracker, windowAt, type ChipSpec } from "./Cabin.tsx";
import { airOf, type Air } from "./air.ts";
import { chipAnchor, DROPLET, flameRadius, homePose, lensShift, ROOMS, type Pose, type V3 } from "./layout.ts";
import { BurnPanel } from "./BurnPanel.tsx";
import { Navigate } from "./Navigate.tsx";
import { FirstFrame } from "../FirstFrame.tsx";
import { SpreadSet, spreadChips } from "./Spread.tsx";
import { SpreadPanel } from "./SpreadPanel.tsx";
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

/**
 * Lens shift: moves the picture so the fire sits in the middle of the clear part of the stage (the zone the stage
 * hands down as --fz-* custom properties), not under the console's glass. Orbiting keeps the shift.
 */
function LensShift({ home, focus }: { home: Pose; focus: V3 }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const key = home.pos.join() + focus.join();
  useEffect(() => {
    const apply = () => {
      const host = gl.domElement.closest<HTMLElement>(".stage-scene");
      const css = host ? getComputedStyle(host) : null;
      const px = (n: string) => parseFloat(css?.getPropertyValue(n) ?? "");
      const z = { x: px("--fz-x"), y: px("--fz-y"), w: px("--fz-w"), h: px("--fz-h") };
      const off = Number.isFinite(z.x + z.y + z.w + z.h) ? lensShift(home, size.width, size.height, focus, z) : null;
      if (off) camera.setViewOffset(size.width, size.height, off.x, off.y, size.width, size.height);
      else camera.clearViewOffset();
      invalidate();
    };
    apply();
    window.addEventListener("replay-zone", apply);
    return () => {
      window.removeEventListener("replay-zone", apply);
      camera.clearViewOffset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size.width, size.height, camera, gl, invalidate]);
  return null;
}

/** The model burn at the seeker's time: the droplet shrinks by the d² law and the flame goes out at the predicted size. */
function BurnFire({ c, air, d0, calm, compare }: { c: BurnCase | null; air: Air; d0: number; calm: boolean; compare: boolean }) {
  const t = usePlayback((s) => s.t);
  const now = c ? dropletAt(c, t, d0) : { d: d0, lit: true };
  return (
    <>
      <Droplet at={DROPLET.at} dMm={now.d} />
      {compare && now.lit && <StationOutline dMm={now.d} />}
      {now.lit && air.o2Percent !== undefined && <DropletFlame air={{ ...air, o2Percent: air.o2Percent }} dMm={now.d} calm={calm} />}
    </>
  );
}

/** "Compare with station air": a faint ring the size the same flame would be in station air (21% oxygen, 101.3 kPa). */
function StationOutline({ dMm }: { dMm: number }) {
  const r = flameRadius(dMm) * flameLook(STATION.o2Percent, STATION.pressureKPa).scale;
  return (
    <Billboard position={DROPLET.at}>
      <mesh>
        <ringGeometry args={[r * 0.97, r, 64]} />
        <meshBasicMaterial color="#ecebe6" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

const STATION = { o2Percent: 21, pressureKPa: 101.3 };


/** Loads the team's model grid once. */
function useWhatIf() {
  const [doc, setDoc] = useState<WhatIfDoc | null>(null);
  useEffect(() => {
    let live = true;
    void loadWhatIf().then((d) => live && setDoc(d));
    return () => {
      live = false;
    };
  }, []);
  return doc;
}

/** Loads the solid-materials tests (BASS-II fabric, SAFFIRE-II samples) once, for the fire spread. */
function useSolids(on: boolean) {
  const [doc, setDoc] = useState<SolidsDoc | null>(null);
  useEffect(() => {
    if (!on || doc) return;
    let live = true;
    fetch("/data/solids.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setDoc(parseSolids(j)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [on, doc]);
  return doc;
}

/** The replay inside the picked base's cabin: a droplet burning on a holder on the bench, the window behind. */
export function CabinScene({ habitat, calm }: SceneProps) {
  const base = useConsole((s) => s.base);
  const mode = usePlayback((s) => s.mode);
  const [webgl] = useState(hasWebGL);
  const air = airOf(base, habitat);
  const room = ROOMS[base];
  const home = homePose(base, mode === "spread" ? "spread" : "burn");
  const doc = useWhatIf();
  const chosen = usePlayback((s) => s.sel);
  const compare = usePlayback((s) => s.compare);
  const pick = doc ? (chosen ?? startPick(doc)) : null;
  const c = doc && pick && air.o2Percent !== undefined && air.pressureKPa !== undefined ? burnCase(doc, { o2Percent: air.o2Percent, pressureKPa: air.pressureKPa }, pick, base === "earth") : null;
  const dMm = doc && pick ? doc.axes.d0[pick.d0] : 2;
  const r = flameRadius(dMm);

  // Fire in this base: the scenario (start point, response, gravity) and its story.
  const solids = useSolids(mode === "spread");
  const start = usePlayback((s) => s.start);
  const response = usePlayback((s) => s.response);
  const g = usePlayback((s) => s.grav) ?? gravityOf(base);
  const o2 = air.o2Percent ?? 21;
  const st = useMemo(() => story({ g, o2, start, response }), [g, o2, start, response]);
  // The one timeline: the model burn, or the spread along the bench.
  const tl =
    mode === "spread"
      ? air.o2Percent === undefined
        ? null
        : storyTimeline(st, timelineKey("spread", base, air, g, start, response), room.name)
      : c
        ? burnTimeline(c, timelineKey("burn", base, air, JSON.stringify(pick)))
        : null;
  const tlKey = tl?.key;
  // The stage frames the fire around the console's glass and this scene's own panel: say when the panel comes or goes.
  const panel = mode === "spread" || !!doc;
  useEffect(() => {
    window.dispatchEvent(new Event("replay-obstacles"));
  }, [panel, mode]);
  useEffect(() => {
    usePlayback.getState().setTimeline(tl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tlKey]);
  const chipEls = useRef(new Map<string, HTMLDivElement>());
  const fire = useMemo(() => (mode === "spread" ? spreadChips(g) : null), [mode, g]);
  const chips: ChipSpec[] = [
    ...(fire ?? [{ id: "flame", at: chipAnchor(DROPLET.at, r), text: `Flame in ${air.name}`, sub: air.readout }]),
    { id: "window", at: windowAt(base), left: true, below: true, text: room.outside === "orbit" ? "Window: Earth from orbit" : room.outside === "moon" ? "Window: the lunar surface" : "Window: daylight on Earth" },
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
        <FirstFrame />
        <Cabin base={base} />
        <Navigate home={home} calm={calm} focus={mode === "spread" ? home.target : DROPLET.at} leash={mode === "spread" ? 0.3 : 0.1} room={room} maxPolar={1.75} />
        <LensShift home={home} focus={mode === "spread" ? home.target : DROPLET.at} />
        {mode === "spread" ? <SpreadSet st={st} air={air} calm={calm} chips={fire ?? undefined} /> : <BurnFire c={c} air={air} d0={dMm} calm={calm} compare={compare && base !== "iss"} />}
        <ChipTracker chips={chips} refs={chipEls} />
      </Canvas>
      <ChipLayer chips={chips} refs={chipEls} />
      {mode === "spread" && <SpreadPanel air={air.name} g={g} doc={solids} fabric={fabricVerdict(solids, o2, 10, g)} />}
      {mode !== "spread" && doc && pick && <BurnPanel doc={doc} pick={pick} c={c} air={air.name} compare={base === "iss" ? null : compare} />}
      <p className="sr-only">
        {mode === "spread"
          ? `Inside the ${room.name}: a flame spreads over cloth, paper, foam and an acrylic panel on the bench and stops at a metal locker. ${air.name}: ${air.readout}. Illustration, not a simulation.`
          : `Inside the ${room.name}: a fuel droplet burns on a holder on the bench. ${air.name}: ${air.readout}. Illustration, not a simulation.`}
      </p>
    </div>
  );
}
