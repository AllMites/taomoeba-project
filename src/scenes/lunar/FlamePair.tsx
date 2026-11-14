import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { PerspectiveCamera, Scene } from "three";
import { Flame } from "../../fx/index.tsx";
import type { AirSide } from "./copy.ts";

/** A flame slot measured from the DOM overlay: centre and diameter in CSS px, relative to the canvas box. */
export type Slot = { cx: number; cy: number; d: number };

/** Air drifting past both flames, cm/s. The same for both: only the air differs. */
export const AIRFLOW_CM_S = 3;
const FOV = 30;
const DEPTH = 1;
/** Flame diameter as a share of its slot, leaving room for the oxygen scaling inside Flame. */
const FILL = 0.5;

/**
 * Renders the main scene (when `world` is on), then the flames in their own scene and camera on top, each
 * centred on its DOM slot. The flames never share depth or light with the habitat.
 */
export function FlamePair({ sides, slots, world, calm }: { sides: AirSide[]; slots: Slot[]; world: boolean; calm: boolean }) {
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
    if (world) gl.render(scene, camera);
    else gl.clear();
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
        const y = -(slot.cy - size.height / 2) * mPerPx;
        return (
          <group key={side.key} position={[x, y, -DEPTH]}>
            <Flame o2Percent={side.o2Percent} pressureKPa={side.pressureKPa} airflowCmS={AIRFLOW_CM_S} size={flameSize} calm={calm} />
          </group>
        );
      })}
    </>,
    flameScene,
    { camera: flameCam },
  );
}
