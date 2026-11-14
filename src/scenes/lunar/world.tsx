import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Color, DirectionalLight, Mesh, MeshStandardMaterial, Object3D, ShaderMaterial, Vector3, type Material, type PerspectiveCamera, type Texture } from "three";
import { hold } from "./hold.ts";
import { makeHeightField, makeRegolith, type Pad } from "./terrain.ts";

// Scene colours. Physical surfaces, not UI: the DOM overlay takes its colours from tokens.css.
export const PALETTE = {
  space: "#05070b",
  regolith: "#a19d96",
  sun: "#fff3e2",
  fill: "#b9c8ee", // cool camera-side fill: a truly backlit Moon reads as pure silhouette
  beacon: "#ff6a2a",
  earthDay: "#8fb4ff",
  earthCloud: "#f2f4f8",
};

const BASE = `${import.meta.env.BASE_URL}models/lunar/`;
export const MODEL_URLS = { hdu: `${BASE}hdu.glb`, sev: `${BASE}sev.glb`, astronaut: `${BASE}astronaut.glb` } as const;
const DRACO = `${BASE}draco/`;

/** Where things stand, metres, Y up. HDU at the origin. */
const LAYOUT = {
  hdu: { pos: [0, 0, 0] as const, rotY: 0 },
  sev: { pos: [-15, 0, 9] as const, rotY: -0.58 },
  astronaut: { pos: [5.5, 0, 9.5] as const, rotY: 0.35 },
};

export type ShotId = "moon" | "rover";

type Shot = {
  /** Point the frame is built around. */
  subject: [number, number, number];
  /** Camera distance from the subject (m), compass angle of the camera around it (deg), eye height (m). */
  dist: number;
  az: number;
  eye: number;
  /** Vertical field of view: wide box, narrow (phone) box. Small values = long lens. */
  fov: [number, number];
  /** Shadow box half-size around the subject. */
  shadow: number;
};

export const SHOTS: Record<ShotId, Shot> = {
  moon: { subject: [0, 2.4, 0], dist: 52, az: 12, eye: 1.4, fov: [20, 28], shadow: 22 },
  rover: { subject: [LAYOUT.sev.pos[0], 1.7, LAYOUT.sev.pos[2]], dist: 24, az: -45, eye: 1.0, fov: [20, 28], shadow: 14 },
};

const deg = Math.PI / 180;
/** Scratch vectors for per-frame maths, so the render loop allocates nothing. Earth (priority -1) and Rig (-2) never overlap. */
const V = { a: new Vector3(), b: new Vector3(), c: new Vector3(), d: new Vector3(), e: new Vector3(), f: new Vector3() };

/** Horizontal unit vector from the subject towards the camera. */
const backOf = (s: Shot) => new Vector3(Math.sin(s.az * deg), 0, Math.cos(s.az * deg));

/** Flat pads: under each model, at each camera and along each line of sight, so no bump hides the subject. */
const PADS: Pad[] = [
  [LAYOUT.hdu.pos[0], LAYOUT.hdu.pos[2], 11],
  [LAYOUT.sev.pos[0], LAYOUT.sev.pos[2], 5],
  [LAYOUT.astronaut.pos[0], LAYOUT.astronaut.pos[2], 2],
];
for (const s of Object.values(SHOTS)) {
  const b = backOf(s);
  const cam = [s.subject[0] + b.x * s.dist, s.subject[2] + b.z * s.dist];
  PADS.push([cam[0], cam[1], 7]);
  for (const m of Object.values(LAYOUT))
    for (const f of [0.3, 0.6]) PADS.push([cam[0] + (m.pos[0] - cam[0]) * f, cam[1] + (m.pos[2] - cam[1]) * f, 4]);
}
export const FIELD = makeHeightField({ pads: PADS, centre: [0, 18] });

/** Where the subject sits in the frame (NDC, -1..1): right of centre on a wide box, low and centred on a phone. */
const AIM = { wide: [0.3, -0.32], narrow: [0, -0.6] } as const;
/** Where the Earth sits in the frame (NDC), clear of the overlay column. A phone box has no free sky: no Earth. */
const EARTH_AT = { wide: [0.62, 0.55] as const, narrow: null };

function prepare(root: Object3D) {
  root.traverse((o) => {
    if ((o as Mesh).isMesh) {
      const m = o as Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

/** Loaded model roots and the loader that decoded them, so the last unmount can free them. */
const loaded = new Map<string, Object3D>();
let gltfLoader: { dracoLoader: { dispose(): unknown } | null } | undefined;
const keepLoader = (l: { dracoLoader: { dispose(): unknown } | null }) => {
  gltfLoader = l;
};

function releaseModels() {
  for (const url of Object.values(MODEL_URLS)) {
    const root = loaded.get(url);
    if (root) disposeTree(root);
    loaded.delete(url);
    // Also drops a load still in flight, whose Draco worker is about to be terminated: a remount starts afresh.
    useGLTF.clear(url);
  }
  // Terminates the decoder workers; the decoder source stays, so a remount spawns new workers without refetching.
  gltfLoader?.dracoLoader?.dispose();
}

function Model({ url, pos, rotY }: { url: string; pos: readonly [number, number, number]; rotY: number }) {
  const { scene } = useGLTF(url, DRACO, true, keepLoader);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => prepare(scene), [scene]);
  useEffect(() => {
    loaded.set(url, scene);
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [scene, url, gl, invalidate]);
  return <primitive object={scene} position={pos} rotation={[0, rotY, 0]} />;
}

/** Catches a model that fails to load (missing file, bad data) and reports it, so the scene can show its poster. */
export class LoadGuard extends Component<{ onError: (e: unknown) => void; children?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    this.props.onError(e);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The three models. GPU memory, loader cache and Draco workers go back when the scene really unmounts; the release
 * is deferred (see hold.ts) so a StrictMode remount keeps them instead of refetching on every later render.
 */
export function Models({ onError }: { onError: (e: unknown) => void }) {
  useEffect(() => hold("lunar-models", releaseModels), []);
  return (
    <LoadGuard onError={onError}>
      <Suspense fallback={null}>
        <Model url={MODEL_URLS.hdu} {...LAYOUT.hdu} />
        <Model url={MODEL_URLS.sev} {...LAYOUT.sev} />
        <Model url={MODEL_URLS.astronaut} {...LAYOUT.astronaut} />
      </Suspense>
    </LoadGuard>
  );
}

export function Ground() {
  const { geometry } = useMemo(() => makeRegolith(FIELD), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors color={PALETTE.regolith} roughness={1} metalness={0} />
    </mesh>
  );
}

const beaconMat = new MeshStandardMaterial({ color: PALETTE.beacon, emissive: new Color(PALETTE.beacon), emissiveIntensity: 3, toneMapped: false });

/** Two warning beacons, one on the habitat, one on the rover. Slow pulse unless calm. */
export function Beacons({ calm }: { calm: boolean }) {
  useFrame(({ clock }) => {
    if (calm) return;
    beaconMat.emissiveIntensity = 1.5 + 1.5 * Math.max(0, Math.sin(clock.elapsedTime * 2.2));
  });
  useEffect(() => () => beaconMat.dispose(), []);
  // Positions are the highest points of each model (antenna / dome top), in the model's own frame.
  return (
    <>
      <group position={LAYOUT.hdu.pos} rotation={[0, LAYOUT.hdu.rotY, 0]}>
        <mesh material={beaconMat} position={[-0.71, 5.92, -0.64]}>
          <sphereGeometry args={[0.09, 12, 8]} />
        </mesh>
      </group>
      <group position={LAYOUT.sev.pos} rotation={[0, LAYOUT.sev.rotY, 0]}>
        <mesh material={beaconMat} position={[0.74, 4.03, 1.43]}>
          <sphereGeometry args={[0.07, 12, 8]} />
        </mesh>
      </group>
    </>
  );
}

function sunDirection(shot: Shot) {
  // Low sun, 7 degrees up, behind and to the left of the subject as seen from the camera.
  const a = (shot.az + 180 - 55) * deg;
  return new Vector3(Math.sin(a) * Math.cos(7 * deg), Math.sin(7 * deg), Math.cos(a) * Math.cos(7 * deg)).normalize();
}

export function Lights({ shot }: { shot: ShotId }) {
  const s = SHOTS[shot];
  const sun = useRef<DirectionalLight>(null);
  const dir = useMemo(() => sunDirection(s), [s]);
  const camDir = useMemo(() => new Vector3(Math.sin(s.az * deg), 0.35, Math.cos(s.az * deg)).normalize(), [s]);
  const target = useMemo(() => {
    const o = new Object3D();
    o.position.set(...s.subject);
    return o;
  }, [s]);
  const narrow = useThree((st) => st.size.width < 640);
  const gl = useThree((st) => st.gl);
  const invalidate = useThree((st) => st.invalidate);
  // Sun, target and every shadow caster stand still (only the camera moves), so the shadow map is drawn once per
  // change instead of every frame: one fewer pass over all models on a phone. Models re-flag it when they load.
  useLayoutEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, shot, narrow]);
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={sun}
        color={PALETTE.sun}
        intensity={4.8}
        position={dir.clone().multiplyScalar(80).add(new Vector3(...s.subject))}
        target={target}
        castShadow
        shadow-mapSize={narrow ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-s.shadow}
        shadow-camera-right={s.shadow}
        shadow-camera-top={s.shadow}
        shadow-camera-bottom={-s.shadow}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
      <directionalLight color={PALETTE.fill} intensity={1.2} position={camDir.clone().multiplyScalar(80).add(new Vector3(...s.subject))} target={target} />
      <hemisphereLight args={[PALETTE.fill, PALETTE.space, 0.1]} />
    </>
  );
}

const earthMat = new ShaderMaterial({
  uniforms: { sunDir: { value: new Vector3() }, day: { value: new Color(PALETTE.earthDay) }, cloud: { value: new Color(PALETTE.earthCloud) } },
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vP;
    void main() {
      vN = normalize(mat3(modelMatrix) * normal);
      vP = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 sunDir; uniform vec3 day; uniform vec3 cloud;
    varying vec3 vN; varying vec3 vP;
    void main() {
      float lit = smoothstep(-0.02, 0.3, dot(normalize(vN), sunDir));
      vec3 p = normalize(vP);
      float c = 0.5 + 0.5 * sin(p.x * 9.0 + sin(p.y * 7.0) * 2.0) * sin(p.z * 8.0 + p.y * 5.0);
      vec3 col = mix(day, cloud, 0.6 * smoothstep(0.7, 0.95, c));
      gl_FragColor = vec4(col * lit * 1.1 + day * 0.015, 1.0);
    }`,
});

/**
 * Earth crescent, parked on the camera so it stays put in the frame (it is effectively at infinity, and the
 * dolly only translates).
 */
export function Earth({ shot }: { shot: ShotId }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const ndc = size.width / Math.max(1, size.height) >= 1.2 ? EARTH_AT.wide : EARTH_AT.narrow;
  const mesh = useRef<Mesh>(null);
  const dir = useMemo(() => sunDirection(SHOTS[shot]), [shot]);
  useEffect(() => () => earthMat.dispose(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m || !ndc) return;
    const D = 400;
    // Unproject the NDC point at distance D along the view.
    const p = V.a.set(ndc[0], ndc[1], 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(D);
    m.position.copy(camera.position).add(p);
    // Sun slightly beyond the Earth as seen from here: a thin lit edge on the sun side.
    const toEarth = V.b.copy(p).normalize();
    const side = V.c.copy(dir).addScaledVector(toEarth, -dir.dot(toEarth));
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    // Sun a little behind the Earth and off to the sun's side: about a quarter of the disc lit.
    earthMat.uniforms.sunDir.value.copy(side.normalize().addScaledVector(toEarth, 0.45).normalize());
  }, -1);
  return (
    <mesh ref={mesh} material={earthMat} scale={8.4} visible={!!ndc}>
      <sphereGeometry args={[1, 48, 24]} />
    </mesh>
  );
}

/** Camera: low, long lens, framed by aspect; slow lateral dolly unless calm. */
export function Rig({ shot, calm }: { shot: ShotId; calm: boolean }) {
  const s = SHOTS[shot];
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const invalidate = useThree((st) => st.invalidate);
  const wide = size.width / Math.max(1, size.height) >= 1.2;
  useFrame(({ clock }) => {
    const cam = camera as PerspectiveCamera;
    const fov = wide ? s.fov[0] : s.fov[1];
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.near = 0.3;
      cam.far = 1200;
      cam.updateProjectionMatrix();
    }
    const subject = V.d.set(...s.subject);
    const back = V.e.set(Math.sin(s.az * deg), 0, Math.cos(s.az * deg));
    const right = V.f.set(back.z, 0, -back.x);
    const t = calm ? 0 : clock.elapsedTime;
    const sway = Math.sin((t / 70) * Math.PI * 2) * 3; // +-3 m over 70 s
    const pos = V.a.copy(subject).addScaledVector(back, s.dist + Math.sin((t / 70) * Math.PI) * 1.5).addScaledVector(right, sway);
    pos.y = FIELD.heightAt(pos.x, pos.z) + s.eye;
    const aim = V.b.copy(subject).addScaledVector(right, sway * 0.6);
    cam.position.copy(pos);
    cam.lookAt(aim);
    const [ax, ay] = wide ? AIM.wide : AIM.narrow;
    const tanV = Math.tan((fov / 2) * deg);
    cam.rotateY(Math.atan(ax * tanV * cam.aspect));
    cam.rotateX(Math.atan(-ay * tanV));
    cam.updateMatrixWorld();
  }, -2);
  useEffect(() => invalidate(), [shot, calm, wide, invalidate]);
  return null;
}

/** Free every geometry, material and texture under a root. */
export function disposeTree(root: Object3D) {
  const mats = new Set<Material>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x && mats.add(x));
    }
  });
  mats.forEach((m) => {
    for (const v of Object.values(m)) if (v && (v as Texture).isTexture) (v as Texture).dispose();
    m.dispose();
  });
}
