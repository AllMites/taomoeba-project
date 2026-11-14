// Flame API shared by every scene. Lane D owns the inside of this folder; the props below are the
// contract other scenes build against, so change them only through the integrator.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { PlaneGeometry, SphereGeometry } from "three";
import { flameLook, leanFromAirflow } from "./look.ts";
import { makeCharMaterial, makeHaloMaterial, makeShellMaterial } from "./materials.ts";
import { FX_PAINT } from "./palette.ts";

export { flameLook, leanFromAirflow, REF_O2_PERCENT, REF_PRESSURE_KPA, type FlameLook } from "./look.ts";

export type FlameProps = {
  /** Oxygen in the air, percent by volume. */
  o2Percent: number;
  /** Air pressure, kPa. */
  pressureKPa?: number;
  /** Air flow past the flame, cm/s. The flame leans downstream (+x in local space). */
  airflowCmS?: number;
  /** Flame diameter in metres at 21% oxygen, before the oxygen scaling. */
  size?: number;
  /** True: draw one still frame, no flicker. */
  calm?: boolean;
};

// Shared unit geometry: one copy for every flame on the page.
const SPHERE_HI = new SphereGeometry(1, 48, 32);
const SPHERE_LO = new SphereGeometry(1, 32, 16);
const STRIP = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);

/** Fixed shader time for calm frames, picked so the still frame is not at a flicker extreme. */
const CALM_TIME = 0.37;

function useFlameMaterials() {
  const shell = useMemo(makeShellMaterial, []);
  const halo = useMemo(makeHaloMaterial, []);
  useEffect(
    () => () => {
      shell.dispose();
      halo.dispose();
    },
    [shell, halo],
  );
  return { shell, halo };
}

/** A microgravity flame: round, blue shell, pale core, no plume. Place it with a parent <group>. */
export function Flame({ o2Percent, pressureKPa, airflowCmS, size = 0.1, calm = false }: FlameProps) {
  const look = flameLook(o2Percent, pressureKPa);
  const lean = leanFromAirflow(airflowCmS);
  const { shell, halo } = useFlameMaterials();

  useFrame(({ clock }) => {
    const t = calm ? CALM_TIME : clock.elapsedTime;
    for (const m of [shell, halo]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uLean.value = lean;
      m.uniforms.uBright.value = look.brightness;
    }
    shell.uniforms.uFlicker.value = calm ? 0 : 1;
  });

  if (!look.lit) return null;
  const r = (size / 2) * look.scale;
  return (
    <group>
      <mesh geometry={SPHERE_LO} material={halo} scale={r * 2.4} renderOrder={1} />
      <mesh geometry={SPHERE_HI} material={shell} scale={r} renderOrder={2} />
      <pointLight color={FX_PAINT.light} intensity={0.02 * look.brightness * (size / 0.1) ** 2} distance={size * 15} decay={2} />
    </group>
  );
}

export type FlameFrontProps = {
  /** Sample length along the flow, metres. The sample lies in local x 0..length, z centred, face up (+y). */
  length: number;
  /** Sample width across the flow, metres. */
  width: number;
  /** Flame-front position, metres from the upstream (ignition) end. Char covers 0..front. */
  front: number;
  /** Oxygen in the air, percent by volume. */
  o2Percent: number;
  /** Air pressure, kPa. */
  pressureKPa?: number;
  /** Air flow along the sample, cm/s. The flame trails downstream (+x). */
  airflowCmS?: number;
  /** 0..1: how alive the flame is (0 = out, only char left). Use it to fade in at ignition and out at burnout. */
  intensity?: number;
  /** True: one still frame, no flicker. */
  calm?: boolean;
};

/**
 * A line of flame burning along a flat sample sheet, with the char trail it leaves behind.
 * Draws only the flame and the char; the scene draws the unburnt sheet underneath.
 */
export function FlameFront({
  length,
  width,
  front,
  o2Percent,
  pressureKPa,
  airflowCmS,
  intensity = 1,
  calm = false,
}: FlameFrontProps) {
  const look = flameLook(o2Percent, pressureKPa);
  const lean = leanFromAirflow(airflowCmS);
  const { shell, halo } = useFlameMaterials();
  const char = useMemo(makeCharMaterial, []);
  useEffect(() => () => char.dispose(), [char]);

  const x = Math.min(Math.max(front, 0), length);
  const alive = look.lit ? Math.min(Math.max(intensity, 0), 1) : 0;

  useFrame(({ clock }) => {
    const t = calm ? CALM_TIME : clock.elapsedTime;
    for (const m of [shell, halo]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uLean.value = lean;
      m.uniforms.uBright.value = look.brightness * alive;
    }
    shell.uniforms.uFlicker.value = calm ? 0 : 1;
    char.uniforms.uTime.value = t;
    char.uniforms.uGlow.value = alive * Math.min(look.brightness, 1.5);
    // Ember band about 1.5 cm wide whatever the char length; mottling cells about 7 mm long.
    char.uniforms.uBandK.value = x / 0.015;
    char.uniforms.uSegments.value = Math.max(1, x / 0.007);
  });

  // Flame body: an ellipsoid sitting across the sample at the front, on both faces of the sheet.
  const r = width * 0.6 * look.scale * (0.45 + 0.55 * alive);
  return (
    <group>
      {x > 1e-4 && <mesh geometry={STRIP} material={char} scale={[x, 1, width]} position={[0, 0.0005, 0]} />}
      {/* Always mounted, only hidden when out: adding or removing a light changes the light count, which makes
          three.js relink every lit material in the scene (a hitch on a phone at each ignition and burnout). */}
      <group position={[x + r * 0.15, 0, 0]} visible={alive > 0.01}>
        <mesh geometry={SPHERE_LO} material={halo} scale={[r * 3.2, r * 2.2, r * 2.8]} renderOrder={1} />
        <mesh geometry={SPHERE_HI} material={shell} scale={[r * 1.25, r * 0.8, r * 1.15]} renderOrder={2} />
      </group>
      <pointLight
        color={FX_PAINT.light}
        position={[x + r * 0.15, r * 2, 0]}
        intensity={alive > 0.01 ? 0.003 * look.brightness * alive : 0}
        distance={width * 12}
        decay={2}
      />
    </group>
  );
}
