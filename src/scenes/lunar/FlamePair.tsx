import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, Color, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial } from "three";
import { Flame, flameLook } from "../../fx/index.tsx";
import { FX_PAINT } from "../../fx/palette.ts";
import type { AirSide } from "./copy.ts";

/** A flame slot measured from the DOM overlay: centre and diameter in CSS px, relative to the canvas box. */
export type Slot = { cx: number; cy: number; d: number };

/** Air drifting past both flames, cm/s. The same for both: only the air differs. */
export const AIRFLOW_CM_S = 3;
const FOV = 30;
const DEPTH = 1;
/** Flame diameter as a share of its slot, leaving room for the oxygen scaling inside Flame. */
const FILL = 0.56;
/** Soft glow behind each flame, as a multiple of the slot: wide and faint, so the flame reads at a glance. */
const GLOW = 2;

const GLOW_PLANE = new PlaneGeometry(1, 1);

/** Additive radial glow, brightest at the centre, gone well before the plane edge. No post-processing pass. */
function makeGlow(color: string) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uStrength: { value: 0.5 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float g = exp(-d * d * 7.0) * 0.8 + exp(-d * d * 2.2) * 0.2;
        g *= smoothstep(1.0, 0.7, d);
        gl_FragColor = vec4(uColor * g * uStrength, 1.0);
      }`,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
}

export function Glow({ size, o2Percent, pressureKPa, warm }: { size: number; o2Percent: number; pressureKPa?: number; warm: boolean }) {
  const mat = useMemo(() => makeGlow(warm ? FX_PAINT.soot : FX_PAINT.light), [warm]);
  useEffect(() => () => mat.dispose(), [mat]);
  const look = flameLook(o2Percent, pressureKPa);
  mat.uniforms.uStrength.value = 0.24 * Math.min(1.6, Math.max(0.6, look.brightness));
  return <mesh geometry={GLOW_PLANE} material={mat} scale={size} renderOrder={0} />;
}

/**
 * Renders the main scene (the habitat, or only the stars for the station and Earth), then the flames in their own scene and camera on top, each
 * centred on its DOM slot. The flames never share depth or light with the habitat.
 */
export function FlamePair({ sides, slots, calm }: { sides: AirSide[]; slots: Slot[]; calm: boolean }) {
  const flameScene = useMemo(() => new Scene(), []);
  const flameCam = useMemo(() => new PerspectiveCamera(FOV, 1, 0.01, 10), []);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  flameCam.aspect = size.width / Math.max(1, size.height);
  flameCam.updateProjectionMatrix();
  const mPerPx = (2 * DEPTH * Math.tan(((FOV / 2) * Math.PI) / 180)) / Math.max(1, size.height);
  // Same size prop for every flame: the smallest slot decides.
  const flameSize = slots.length ? Math.min(...slots.map((s) => s.d)) * mPerPx * FILL : 0;

  useEffect(() => invalidate(), [slots, sides, invalidate]);

  useFrame(({ gl, scene, camera }) => {
    gl.autoClear = true;
    gl.render(scene, camera);
    gl.autoClear = false;
    gl.clearDepth();
    gl.render(flameScene, flameCam);
    gl.autoClear = true;
  }, 1);

  return createPortal(
    <>
      {sides.map((side, i) => {
        const slot = slots[i];
        if (!slot || side.o2Percent === undefined) return null;
        const x = (slot.cx - size.width / 2) * mPerPx;
        // The 1 g teardrop rises above its slot: sit it lower, so its tip stays off the glass above.
        const y = -(slot.cy - size.height / 2) * mPerPx - (side.gravity === "earth" ? slot.d * mPerPx * 0.14 : 0);
        return (
          <group key={side.key} position={[x, y, -DEPTH]}>
            <Glow size={slot.d * mPerPx * GLOW} o2Percent={side.o2Percent} pressureKPa={side.pressureKPa} warm={side.gravity === "earth"} />
            <Flame o2Percent={side.o2Percent} pressureKPa={side.pressureKPa} airflowCmS={AIRFLOW_CM_S} size={flameSize} calm={calm} gravity={side.gravity} />
          </group>
        );
      })}
    </>,
    flameScene,
    { camera: flameCam },
  );
}
