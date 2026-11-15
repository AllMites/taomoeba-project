import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Spherical, Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import { usePlayback } from "../playback.ts";
import type { Pose } from "./layout.ts";

const S = new Spherical();
const V = new Vector3();

/**
 * Drag to orbit, wheel or pinch to zoom, right-drag or two fingers to pan, with damping and limits. The camera starts
 * at `home` with a slow drift that stops for good on the first interaction; "Reset view" returns to `home`. Arrow keys
 * and plus/minus on the focused stage arrive as nudges through the playback store.
 */
export function Navigate({ home, calm, minDistance = 0.12, maxDistance = 3.5, rig }: { home: Pose; calm: boolean; minDistance?: number; maxDistance?: number; rig?: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const controls = useRef<Controls>(null);
  const resetN = usePlayback((s) => s.resetN);
  const nudge = usePlayback((s) => s.nudge);
  const homeKey = home.pos.join() + home.target.join() + home.fov;

  // Home: on mount, on "Reset view" and when the home itself changes (another base or scene).
  useEffect(() => {
    if (rig) return;
    camera.position.set(...home.pos);
    camera.fov = home.fov;
    camera.near = 0.01;
    camera.far = 60;
    camera.updateProjectionMatrix();
    controls.current?.target.set(...home.target);
    controls.current?.update();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeKey, resetN, rig, camera, invalidate]);

  // Slow drift until the viewer moves the camera. Off under reduced motion.
  useFrame(({ clock }) => {
    const st = usePlayback.getState();
    if (rig || calm || st.drifted || st.steered || !controls.current) return;
    const t = clock.elapsedTime;
    camera.position.set(home.pos[0] + Math.sin(t / 9) * 0.04, home.pos[1] + Math.sin(t / 13) * 0.015, home.pos[2]);
    controls.current.target.set(...home.target);
  }, -2);

  useEffect(() => {
    const c = controls.current;
    if (!c || nudge.n === 0) return;
    V.copy(camera.position).sub(c.target);
    S.setFromVector3(V);
    S.theta += nudge.orbit;
    S.phi = Math.min(Math.PI - 0.15, Math.max(0.15, S.phi + nudge.tilt));
    S.radius = Math.min(maxDistance, Math.max(minDistance, S.radius * (nudge.zoom || 1)));
    V.setFromSpherical(S);
    camera.position.copy(c.target).add(V);
    c.update();
    invalidate();
  }, [nudge, camera, invalidate, minDistance, maxDistance]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI - 0.15}
      onStart={() => usePlayback.getState().steer()}
    />
  );
}
