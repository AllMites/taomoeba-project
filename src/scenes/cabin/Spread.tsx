// Fire in this base: everyday objects on the bench, flame fronts that creep over the ones that burn, char behind
// them, soot where the smoke reached, and the cabin's airflow. Everything comes from ../spread/story.ts (pure, tested).
import { Edges } from "@react-three/drei";
import { useMemo } from "react";
import { CanvasTexture, DoubleSide, FrontSide, Plane, Vector3 } from "three";
import type { BaseId } from "../../app/console.ts";
import { Flame } from "../../fx/index.tsx";
import { usePlayback } from "../playback.ts";
import { OBJECTS, type CabinObject, type Gravity } from "../spread/spread.ts";
import { smokeAt, storyAt, type Puff, type Story, type StoryAt } from "../spread/story.ts";
import type { Air } from "./air.ts";
import type { ChipSpec } from "./Cabin.tsx";
import { nextPick } from "./callout.ts";
import { Kit, surfaceMaterial } from "./kit.ts";
import { anchorsOf, type V3 } from "./layout.ts";
import { propParts } from "./props.ts";

/** Mono paint: the fire stays the only colour on screen. Combustible things are pale, the rest metal grey. */
const PAINT = { fuel: "#d8d6d0", inert: "#7d7c78", glass: "#b9c2c6", outline: "#ffffff", smoke: "#9a9893", flow: "#ecebe6", soot: "#5d5a55", char: "#141210" };

const top = (o: CabinObject) => o.hd[0];
const midX = (o: CabinObject) => (o.x0 + o.x1) / 2;

/**
 * One object, shaped like what it is (props.ts). Hover outlines it white and previews its callout; a press pins the
 * callout (Callout.tsx). The body takes the object's state: pale when it burns here, grey when it does not, darker where smoke reached.
 */
function Thing({ o, g, lit, soot }: { o: CabinObject; g: Gravity; lit: boolean; soot: boolean }) {
  const hover = usePlayback((s) => s.hovered === o.id);
  const picked = usePlayback((s) => s.picked === o.id);
  const parts = propParts(o);
  const burns = o.burns(g);
  const metal = o.id === "locker";
  return (
    <group
      position={[midX(o), 0, o.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        // Touch has no hover: a tap pins (the preview would only flash).
        if (e.pointerType !== "touch") usePlayback.getState().hover(o.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (usePlayback.getState().hovered === o.id) usePlayback.getState().hover(null);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        const st = usePlayback.getState();
        st.pick(nextPick(st.picked, o.id));
      }}
    >
      <mesh geometry={parts.body}>
        <meshStandardMaterial
          vertexColors
          map={parts.map ?? null}
          color={soot ? PAINT.soot : o.id === "window" ? PAINT.glass : metal ? "#a9a8a3" : burns ? PAINT.fuel : PAINT.inert}
          roughness={metal ? 0.4 : o.id === "panel" || o.id === "window" ? 0.12 : 0.85}
          metalness={metal ? 0.55 : 0}
          transparent={parts.opacity !== undefined}
          opacity={parts.opacity ?? 1}
          depthWrite={parts.opacity === undefined}
          side={parts.twoSided || parts.opacity !== undefined ? DoubleSide : FrontSide}
          emissive={lit ? "#1a0d04" : "#000000"}
        />
      </mesh>
      {parts.trim.map(([k, geo]) => (
        <mesh key={k} geometry={geo} material={surfaceMaterial(k)} />
      ))}
      {(hover || picked) && <Edges geometry={parts.bounds} position={parts.center} color={PAINT.outline} lineWidth={2} />}
    </group>
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

/** A soft round dot (white centre to clear edge), made once: smoke puffs drawn with it overlap into a volume. */
let soft: CanvasTexture | null = null;
function softDot() {
  if (soft) return soft;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return (soft = new CanvasTexture(c));
}

/** The smoke volume: soft puffs from smokeAt (story.ts), placed by the seeker's time so scrubbing moves them too. */
function SmokeCloud({ puffs }: { puffs: Puff[] }) {
  return (
    <group>
      {puffs.map((p, i) => (
        <sprite key={i} position={[p.x, p.y, p.z]} scale={[p.r * 2.6, p.r * 2.6, 1]}>
          <spriteMaterial map={softDot()} color={PAINT.smoke} transparent opacity={p.o} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

/** The detector's housing and mount, merged once: a disc with slots, a domed cover, an arm to the back. */
let detectorGeo: ReturnType<Kit["build"]> | null = null;
function detectorParts() {
  if (detectorGeo) return detectorGeo;
  const k = new Kit();
  k.cyl("paint", 0.05, 0.052, 0.018, { r: [Math.PI / 2, 0, 0], c: "#e4e2dc" }, 28);
  k.ball("paint", 0.036, { p: [0, 0, 0.006], s: [1, 1, 0.35], c: "#eceae4" }, 20);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.box("dark", [0.012, 0.003, 0.004], { p: [Math.cos(a) * 0.044, Math.sin(a) * 0.044, 0.009], r: [0, 0, a], c: "#3a3936" });
  }
  k.box("metal", [0.12, 0.12, 0.008], { p: [0, 0, -0.014], c: "#8d8b86" });
  k.cyl("metal", 0.006, 0.006, 0.12, { p: [0, -0.11, -0.014], c: "#8d8b86" }, 8);
  k.box("dark", [0.006, 0.006, 0.003], { p: [0.03, 0.03, 0.011], c: "#20201e" });
  return (detectorGeo = k.build());
}

/** The smoke detector on the air return: a disc on its mount whose ring lights white when it trips. */
function Detector({ at, tripped }: { at: V3; tripped: boolean }) {
  return (
    <group position={at}>
      {[...detectorParts()].map(([k, geo]) => (
        <mesh key={k} geometry={geo} material={surfaceMaterial(k)} />
      ))}
      <mesh position={[0, 0, 0.0095]}>
        <ringGeometry args={[0.024, 0.031, 32]} />
        <meshBasicMaterial color={tripped ? PAINT.outline : "#55544f"} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The cabin air vent upstream of the cloth: a slatted grille in a frame on a duct, facing along the flow (+x). */
let ventGeo: ReturnType<Kit["build"]> | null = null;
function Vent({ at }: { at: V3 }) {
  if (!ventGeo) {
    const k = new Kit();
    const [h, d] = [0.16, 0.3];
    k.box("metal", [0.012, h, 0.014], { p: [0.04, 0, d / 2 - 0.007], c: "#9b9994" });
    k.box("metal", [0.012, h, 0.014], { p: [0.04, 0, -d / 2 + 0.007], c: "#9b9994" });
    k.box("metal", [0.012, 0.014, d], { p: [0.04, h / 2 - 0.007, 0], c: "#9b9994" });
    k.box("metal", [0.012, 0.014, d], { p: [0.04, -h / 2 + 0.007, 0], c: "#9b9994" });
    for (let i = 0; i < 7; i++) k.box("metal", [0.026, 0.004, d - 0.02], { p: [0.036, -h / 2 + 0.025 + i * 0.018, 0], r: [0, 0, -0.5], c: "#b9b7b1" });
    k.box("dark", [0.06, h - 0.01, d - 0.01], { p: [0.0, 0, 0], c: "#262624" });
    k.box("paint", [0.08, h + 0.03, d + 0.03], { p: [-0.05, 0, 0], c: "#6c6b66" });
    k.cyl("paint", 0.05, 0.05, 0.03, { p: [-0.1, 0, 0], r: [0, 0, Math.PI / 2], c: "#5d5c57" }, 16);
    ventGeo = k.build();
  }
  return (
    <group position={at}>
      {[...ventGeo].map(([k, geo]) => (
        <mesh key={k} geometry={geo} material={surfaceMaterial(k)} />
      ))}
    </group>
  );
}

/** Char on the burnt span of each object: the prop's own shape in black, clipped to the span along the bench. */
function Char({ o, span }: { o: CabinObject; span: [number, number] }) {
  const planes = useMemo(() => [new Plane(new Vector3(1, 0, 0), 0), new Plane(new Vector3(-1, 0, 0), 0)], []);
  planes[0].constant = -span[0];
  planes[1].constant = span[1];
  if (span[1] - span[0] < 1e-3) return null;
  return (
    <mesh geometry={propParts(o).body} position={[midX(o), 0.0004, o.z]}>
      <meshStandardMaterial color={PAINT.char} roughness={1} clippingPlanes={planes} side={DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

/** A flame front: low and round in orbit, a little taller on the Moon (estimate), a teardrop at 1 g. */
function Front({ x, y, g, o2, kPa, strength, calm, flow }: { x: number; y: number; g: Gravity; o2: number; kPa?: number; strength: number; calm: boolean; flow: number }) {
  const k = 0.35 + 0.65 * strength;
  return (
    <group position={[x, y, 0]} scale={[k, k * (g === "partial" ? 1.4 : 1), k]}>
      {g === "earth" ? (
        <Flame o2Percent={o2} pressureKPa={kPa} size={0.14} gravity="earth" calm={calm} />
      ) : (
        <group scale={[1, 0.55, 1]}>
          <Flame o2Percent={o2} pressureKPa={kPa} size={0.12} airflowCmS={flow} calm={calm} />
        </group>
      )}
    </group>
  );
}

/** Screen seconds the carbon dioxide puff takes, whatever the timeline's speed (illustrative). */
export const PUFF_SCREEN_S = 2.5;

/**
 * The carbon dioxide discharge, at scenario time t on a timeline running `rate` times real time: null before the
 * crew responds or for another response; else k (0..1 along the puff) and how opaque the gas is drawn.
 */
export function puffAt(st: Story, t: number, rate: number): { k: number; opacity: number } | null {
  if (st.input.response !== "co2" || t < st.respond) return null;
  const k = (t - st.respond) / (PUFF_SCREEN_S * Math.max(1, rate));
  if (k > 2) return null;
  return { k: Math.min(1, k), opacity: k <= 1 ? 0.65 : 0.65 * (2 - k) };
}

/** A wall nozzle and a short pale puff of gas toward the fire. Illustration: no test in the data did this. */
function Co2Puff({ from, to, k, opacity }: { from: [number, number, number]; to: [number, number, number]; k: number; opacity: number }) {
  const blobs = [0, 0.18, 0.36, 0.54, 0.72];
  return (
    <group>
      <mesh position={from} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.018, 0.05, 12]} />
        <meshStandardMaterial color={PAINT.inert} metalness={0.6} roughness={0.35} />
      </mesh>
      {blobs.map((b) => {
        const u = Math.max(0, Math.min(1, k * 1.4 - b));
        if (u <= 0) return null;
        const p = from.map((v, i) => v + (to[i] - v) * u) as [number, number, number];
        return (
          <mesh key={b} position={p} scale={0.03 + 0.1 * u}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshBasicMaterial color="#eef1f2" transparent opacity={opacity * (1 - u * 0.5)} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/** The object a point along the bench sits on (the burnable one on the bench line), for the flame's height. */
const heightAt = (x: number, g: Gravity) => OBJECTS.find((o) => o.burns(g) && Math.abs(o.z) < 0.1 && o.x0 - 0.06 <= x && x <= o.x1 + 0.06)?.hd[0] ?? 0.004;

/** The fire at the seeker's time, the objects, the soot and the airflow. */
export function SpreadSet({ base, st, air, calm, chips }: { base: BaseId; st: Story; air: { o2Percent?: number; pressureKPa?: number }; calm: boolean; chips?: ChipSpec[] }) {
  const set = anchorsOf(base);
  const t = usePlayback((s) => s.t);
  const g = st.input.g;
  const o2 = st.input.o2;
  const rate = usePlayback((s) => s.timeline?.rate ?? 1);
  const at = storyAt(st, t);
  const puff = puffAt(st, t, rate);
  const flow = at.vent ? 10 : 0;
  if (chips) placeSpreadChips(chips, st, at);
  const fronts = at.alive ? [...new Set([at.hi, at.lo].map((x) => Math.round(x * 1000) / 1000))] : [];
  return (
    <group>
      {OBJECTS.map((o) => (
        <Thing key={o.id} o={o} g={g} lit={at.alive && !!at.burnt[o.id]} soot={at.sooted.has(o.id)} />
      ))}
      {OBJECTS.map((o) => {
        const span = at.burnt[o.id];
        return span && <Char key={o.id} o={o} span={span} />;
      })}
      {fronts.map((x, i) => (
        <Front key={i} x={x} y={heightAt(x, g)} g={g} o2={o2} kPa={air.pressureKPa} strength={at.strength} calm={calm} flow={flow} />
      ))}
      <SmokeCloud puffs={smokeAt(st, t, 22)} />
      <Detector at={set.detector} tripped={at.tripped} />
      <Vent at={set.vent} />
      {at.vent && <Airflow />}
      {puff && <Co2Puff from={[st.xs + 0.5, 0.2, -0.18]} to={[at.hi, heightAt(at.hi, g) + 0.03, 0]} k={puff.k} opacity={puff.opacity} />}
    </group>
  );
}

/** Glass labels on the fire: flame front, burnt zone, unburnt fuel, airflow direction. Placed by placeSpreadChips. */
export function spreadChips(g: Gravity, detect: number, base: BaseId): ChipSpec[] {
  const d = anchorsOf(base).detector;
  return [
    { id: "detector", at: [d[0], d[1] - 0.05, d[2]], text: "Smoke detector", sub: `detected at ${Math.round(detect)} s`, below: true, hide: true },
    { id: "front", at: [0, 0.08, 0], text: "Flame front", sub: g === "earth" ? "a rising flame" : g === "partial" ? "estimate for the Moon" : "low, it hugs the surface" },
    { id: "burnt", at: [0, 0.01, 0.1], text: "Burnt zone", below: true, hide: true },
    { id: "unburnt", at: [0, 0.02, 0.12], text: "Unburnt fuel", below: true, hide: true },
    { id: "airflow", at: [-0.35, 0.26, -0.1], text: "Airflow", sub: "10 cm/s along the bench" },
  ];
}

/** Moves the fire's labels to where they belong at this moment (in place, so the scene does not re-render). */
export function placeSpreadChips(chips: ChipSpec[], st: Story, at: StoryAt) {
  const g = st.input.g;
  for (const c of chips) {
    if (c.id === "front") {
      c.at = [at.hi, g === "earth" ? 0.16 : 0.06, 0];
      c.hide = !at.alive;
    } else if (c.id === "burnt") {
      c.at = [(at.lo + at.hi) / 2, 0.01, 0.1];
      c.hide = at.hi - at.lo < 0.1;
    } else if (c.id === "unburnt") {
      c.at = [(at.hi + st.run[1]) / 2 + 0.05, 0.02, 0.12];
      c.hide = st.run[1] - at.hi < 0.12;
    } else if (c.id === "detector") {
      c.hide = !at.tripped;
    } else if (c.id === "airflow") {
      c.hide = !at.vent;
    }
  }
}
