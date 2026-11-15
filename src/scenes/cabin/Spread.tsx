// Fire in this base: everyday objects on the bench, flame fronts that creep over the ones that burn, char behind
// them, soot where the smoke reached, and the cabin's airflow. Everything comes from ../spread/story.ts (pure, tested).
import { Edges } from "@react-three/drei";
import { useState } from "react";
import { Flame } from "../../fx/index.tsx";
import { usePlayback } from "../playback.ts";
import { OBJECTS, type CabinObject, type Gravity } from "../spread/spread.ts";
import { storyAt, type Story, type StoryAt } from "../spread/story.ts";
import type { Air } from "./air.ts";
import type { ChipSpec } from "./Cabin.tsx";

/** Mono paint: the fire stays the only colour on screen. Combustible things are pale, the rest metal grey. */
const PAINT = { fuel: "#d8d6d0", inert: "#7d7c78", glass: "#b9c2c6", outline: "#ffffff", smoke: "#9a9893", flow: "#ecebe6", soot: "#5d5a55", char: "#141210" };

const top = (o: CabinObject) => o.hd[0];
const midX = (o: CabinObject) => (o.x0 + o.x1) / 2;

/** One object: a box on the bench. Hover, focus (via the panel) or tap outlines it white and opens its card. */
function Thing({ o, g, lit, soot }: { o: CabinObject; g: Gravity; lit: boolean; soot: boolean }) {
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
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        usePlayback.getState().pick(picked ? null : o.id);
      }}
    >
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        color={soot ? PAINT.soot : o.id === "window" ? PAINT.glass : burns ? PAINT.fuel : PAINT.inert}
        roughness={o.id === "locker" ? 0.35 : 0.8}
        metalness={o.id === "locker" ? 0.6 : 0}
        transparent={o.id === "window"}
        opacity={o.id === "window" ? 0.35 : 1}
        emissive={lit ? "#1a0d04" : "#000000"}
      />
      {(hover || picked) && <Edges color={PAINT.outline} threshold={15} lineWidth={2.5} />}
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

/** Char on the burnt span of each object: a dark sheet on its top face. */
function Char({ o, span }: { o: CabinObject; span: [number, number] }) {
  const w = span[1] - span[0];
  if (w < 1e-3) return null;
  return (
    <mesh position={[(span[0] + span[1]) / 2, o.hd[0] + 0.0008, o.z]}>
      <boxGeometry args={[w, 0.0012, o.hd[1] * 1.002]} />
      <meshStandardMaterial color={PAINT.char} roughness={1} />
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
export function SpreadSet({ st, air, calm, chips }: { st: Story; air: { o2Percent?: number; pressureKPa?: number }; calm: boolean; chips?: ChipSpec[] }) {
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
      {at.alive && <Smoke x={at.hi} y={heightAt(at.hi, g)} t={t} g={g === "earth" ? "earth" : "micro"} flow={flow} />}
      {at.vent && <Airflow />}
      {puff && <Co2Puff from={[st.xs + 0.5, 0.2, -0.18]} to={[at.hi, heightAt(at.hi, g) + 0.03, 0]} k={puff.k} opacity={puff.opacity} />}
    </group>
  );
}

/** Glass labels on the fire: flame front, burnt zone, unburnt fuel, airflow direction. Placed by placeSpreadChips. */
export function spreadChips(g: Gravity): ChipSpec[] {
  return [
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
    } else if (c.id === "airflow") {
      c.hide = !at.vent;
    }
  }
}
