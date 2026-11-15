// Everything inside the <Canvas>: camera, lights, the set, the burning strip, and the leader-line projector.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Vector3 } from "three";
import { FlameFront } from "../../fx/index.tsx";
import { SET_PAINT } from "./paint.ts";
import { ANCHORS, buildSet, SAMPLE_LEN, SAMPLE_W, sampleZ } from "./set.ts";
import { frameAt, loopSpan, PLAYBACK_SPEED, type ReplayFrame, type SaffireRecord } from "./timeline.ts";
import { Navigate } from "../cabin/Navigate.tsx";
import { usePlayback } from "../playback.ts";

export type LeaderRefs = {
  root: HTMLElement | null;
  /** Indexed like the callouts. */
  lines: (SVGLineElement | null)[];
  dots: (SVGCircleElement | null)[];
  boxes: (HTMLElement | null)[];
  anchors: (keyof typeof ANCHORS)[];
};

type Props = {
  rec: SaffireRecord;
  calm: boolean;
  playing: boolean;
  loop: boolean;
  /** Record clock, seconds; owned by the parent so its Replay button can reset it. */
  clock: RefObject<number>;
  onTick: (f: ReplayFrame) => void;
  onEnd: () => void;
  leaders: RefObject<LeaderRefs>;
  /** Changes when the shown callouts change, so a still frame redraws their leaders. */
  leaderKey: string;
};

type Pose = { pos: Vector3; look: Vector3 };
const POSES: Record<"wide" | "tall", { establish: Pose; close: Pose }> = {
  // Landscape box: start outside the flow unit, looking down the module, then push in low over the window.
  wide: {
    establish: { pos: new Vector3(-0.62, 0.62, 1.9), look: new Vector3(0.02, -0.02, -0.4) },
    close: { pos: new Vector3(-0.26, 0.5, 0.86), look: new Vector3(0.04, 0.0, -0.7) },
  },
  // Portrait box (phone): higher, so the strip sits in the band between the readouts and the note.
  tall: {
    establish: { pos: new Vector3(-0.5, 0.95, 1.85), look: new Vector3(0.02, -0.05, -0.3) },
    close: { pos: new Vector3(-0.14, 0.58, 0.58), look: new Vector3(0.03, -0.02, -0.05) },
  },
};
/** Record second at which the push-in ends (about 3 s of screen time at 10x). */
const DOLLY_END_S = 20;

/**
 * Low 3/4 view into the sample window. Moving replays open on the module and push in while the igniter
 * runs; calm frames go straight to the close view, with no camera move.
 */
function CameraRig({ rec, calm, clock }: Pick<Props, "rec" | "calm" | "clock">) {
  const { camera, size, invalidate } = useThree();
  const aspect = size.width / Math.max(size.height, 1);
  const pose = POSES[aspect >= 1 ? "wide" : "tall"];
  const look = useMemo(() => new Vector3(), []);
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    // About 46 degrees of horizontal view (56 on a phone), never under 36 degrees vertical.
    const hfov = aspect >= 1 ? 46 : 56;
    cam.fov = Math.max(36, (2 * Math.atan(Math.tan(((hfov / 2) * Math.PI) / 180) / aspect) * 180) / Math.PI);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, aspect, invalidate]);
  useFrame(() => {
    // The viewer has the camera (Navigate): the rig waits until "Reset view".
    if (usePlayback.getState().steered) return;
    const start = loopSpan(rec).start;
    const u = calm ? 1 : Math.min(1, Math.max(0, (clock.current - start) / (DOLLY_END_S - start)));
    const k = u * u * (3 - 2 * u);
    camera.position.lerpVectors(pose.establish.pos, pose.close.pos, k);
    look.lerpVectors(pose.establish.look, pose.close.look, k);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  });
  return <Navigate calm={calm} follow={look} minDistance={0.15} maxDistance={2.5} />;
}

function SetPieces({ rec }: { rec: SaffireRecord }) {
  const geo = useMemo(() => buildSet(rec.card.samples.map((s) => s.material)), [rec]);
  const solidMat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.08 }), []);
  const glowMat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  useEffect(
    () => () => {
      geo.solid.dispose();
      geo.glow.dispose();
      solidMat.dispose();
      glowMat.dispose();
    },
    [geo, solidMat, glowMat],
  );
  return (
    <>
      <mesh geometry={geo.solid} material={solidMat} />
      <mesh geometry={geo.glow} material={glowMat} />
    </>
  );
}

/** The burning strip (sample 2-5): advances the record clock and moves the flame front. */
function Burning({ rec, calm, playing, loop, clock, onTick, onEnd }: Omit<Props, "leaders" | "leaderKey">) {
  const [frame, setFrame] = useState<ReplayFrame>(() => frameAt(rec, clock.current));
  const span = loopSpan(rec);
  const idx = rec.card.samples.findIndex((s) => s.sample === rec.run.sample);
  const v = rec.values;

  useFrame((_, delta) => {
    if (playing) {
      let t = clock.current + Math.min(delta, 0.1) * PLAYBACK_SPEED;
      if (t > span.end) {
        if (loop) t = span.start;
        else {
          t = span.end;
          onEnd();
        }
      }
      clock.current = t;
    }
    const f = frameAt(rec, clock.current);
    if (f.frontCm !== frame.frontCm || f.intensity !== frame.intensity || f.phase !== frame.phase) setFrame(f);
    onTick(f);
  });

  return (
    <group position={[-SAMPLE_LEN / 2, 0.0012, sampleZ(idx)]}>
      <FlameFront
        length={(v.sampleLengthCm.value ?? 29) / 100}
        width={(v.sampleWidthCm.value ?? 5) / 100}
        front={(frame.frontCm ?? 0) / 100}
        o2Percent={v.o2Percent.value ?? 21}
        pressureKPa={v.pressureKPa.value ?? v.pressureKPa.default}
        airflowCmS={v.airflowCmS.value ?? undefined}
        intensity={frame.intensity}
        calm={calm}
      />
      {/* Igniter glow at the upstream end while the 80 W igniter is on. Always mounted and only hidden, so its
          material is not rebuilt and its shader not relinked on every loop. */}
      <mesh position={[0.004, 0.002, 0]} visible={frame.phase === "igniting"}>
        <boxGeometry args={[0.006, 0.003, SAMPLE_W]} />
        <meshBasicMaterial color={SET_PAINT.orange} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Projects each callout's 3D anchor to the screen and draws its leader to the nearest edge of its box. */
function Leaders({ leaders, leaderKey }: { leaders: RefObject<LeaderRefs>; leaderKey: string }) {
  const { camera, size, invalidate } = useThree();
  const p = useMemo(() => new Vector3(), []);
  // A still frame (calm or paused) renders on demand only: picking another note must ask for one frame,
  // or the new note's leader stays undrawn.
  useEffect(() => invalidate(), [leaderKey, invalidate]);
  useFrame(() => {
    const L = leaders.current;
    if (!L.root) return;
    const root = L.root.getBoundingClientRect();
    L.anchors.forEach((name, i) => {
      const line = L.lines[i];
      const dot = L.dots[i];
      const boxEl = L.boxes[i];
      if (!line || !dot) return;
      if (!boxEl || boxEl.offsetParent === null) {
        line.style.visibility = "hidden";
        dot.style.visibility = "hidden";
        return;
      }
      camera.updateMatrixWorld();
      p.copy(ANCHORS[name]).project(camera);
      const ax = ((p.x + 1) / 2) * size.width;
      const ay = ((1 - p.y) / 2) * size.height;
      const r = boxEl.getBoundingClientRect();
      const left = r.left - root.left;
      const top = r.top - root.top;
      const bx = Math.min(Math.max(ax, left), left + r.width);
      const by = Math.min(Math.max(ay, top), top + r.height);
      line.setAttribute("x1", ax.toFixed(1));
      line.setAttribute("y1", ay.toFixed(1));
      line.setAttribute("x2", bx.toFixed(1));
      line.setAttribute("y2", by.toFixed(1));
      dot.setAttribute("cx", ax.toFixed(1));
      dot.setAttribute("cy", ay.toFixed(1));
      line.style.visibility = "visible";
      dot.style.visibility = "visible";
    });
  });
  return null;
}

export function World(props: Props) {
  return (
    <>
      <color attach="background" args={[SET_PAINT.background]} />
      <fog attach="fog" args={[SET_PAINT.background, 3.5, 12]} />
      <CameraRig rec={props.rec} calm={props.calm} clock={props.clock} />
      <hemisphereLight args={[SET_PAINT.skyLight, SET_PAINT.groundLight, 1.1]} />
      <pointLight position={[0, 1.9, -1.2]} intensity={12} distance={7} decay={2} color={SET_PAINT.ledLight} />
      <pointLight position={[0, 1.9, -3.8]} intensity={12} distance={7} decay={2} color={SET_PAINT.ledLight} />
      {/* Camera-side fill, so the flow unit and the cargo read against the dark. */}
      <directionalLight position={[-1, 1.5, 3]} intensity={1.1} color={SET_PAINT.fillLight} />
      <SetPieces rec={props.rec} />
      <Burning {...props} />
      <Leaders leaders={props.leaders} leaderKey={props.leaderKey} />
    </>
  );
}
