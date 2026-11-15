import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Spherical, Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import { usePlayback } from "../playback.ts";
import { keepInView, type Pose, type Room, type V3 } from "./layout.ts";

const S = new Spherical();
const V = new Vector3();
const CAM: V3 = [0, 0, 0];
const TGT: V3 = [0, 0, 0];

/**
 * Drag to orbit, wheel or pinch to zoom, right-drag or two fingers to pan, with damping and limits. The camera starts
 * at `home` with a slow drift that stops for good on the first interaction; "Reset view" returns to `home`. Arrow keys
 * and plus/minus on the focused stage arrive as nudges through the playback store.
 */
export function Navigate({
  home,
  calm,
  minDistance = 0.12,
  maxDistance = 3.5,
  follow,
  focus,
  leash = 0.1,
  room,
  maxPolar = Math.PI - 0.15,
}: {
  home?: Pose;
  calm: boolean;
  minDistance?: number;
  maxDistance?: number;
  /** A scene with its own camera rig: the rig moves the camera until the viewer does; orbit then pivots on this point. */
  follow?: Vector3;
  /** The fire: the orbit point stays within `leash` x the camera distance of it, so pan and zoom keep it in view. */
  focus?: V3;
  leash?: number;
  /** The cabin: the camera stays inside its walls. */
  room?: Room;
  /** Lowest the camera may tilt, radians from straight down onto the scene (a cabin: not under the bench). */
  maxPolar?: number;
}) {
  const rig = !!follow;
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const controls = useRef<Controls>(null);
  const resetN = usePlayback((s) => s.resetN);
  const nudge = usePlayback((s) => s.nudge);
  const homeKey = home ? home.pos.join() + home.target.join() + home.fov : "";

  // Home: on mount, on "Reset view" and when the home itself changes (another base or scene).
  useEffect(() => {
    if (!home) return;
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

  // An on-demand canvas (paused, or reduced motion) redraws when the seeker moves.
  useEffect(() => usePlayback.subscribe((s, prev) => void (s.t !== prev.t && invalidate())), [invalidate]);

  // Slow drift until the viewer moves the camera. Off under reduced motion.
  useFrame(({ clock }) => {
    const st = usePlayback.getState();
    if (follow && !st.steered) controls.current?.target.copy(follow);
    if (!home || rig || calm || st.drifted || st.steered || !controls.current) return;
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
    S.phi = Math.min(maxPolar, Math.max(0.15, S.phi + nudge.tilt));
    S.radius = Math.min(maxDistance, Math.max(minDistance, S.radius * (nudge.zoom || 1)));
    V.setFromSpherical(S);
    camera.position.copy(c.target).add(V);
    c.update();
    invalidate();
  }, [nudge, camera, invalidate, minDistance, maxDistance, maxPolar]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={0.15}
      maxPolarAngle={maxPolar}
      onStart={() => usePlayback.getState().steer()}
      onChange={() => {
        const c = controls.current;
        if (!c || !focus) return;
        camera.position.toArray(CAM);
        c.target.toArray(TGT);
        if (!keepInView(CAM, TGT, focus, leash, room)) return;
        camera.position.fromArray(CAM);
        c.target.fromArray(TGT);
        camera.lookAt(c.target);
      }}
    />
  );
}
