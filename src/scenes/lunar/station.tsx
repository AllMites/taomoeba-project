import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box3, type Group, type Material, type Mesh, type MeshStandardMaterial, type Object3D, type PerspectiveCamera } from "three";
import { fitBox, monoGrey } from "./fit.ts";
import { hold } from "./hold.ts";
import { disposeTree, DRACO, LoadGuard, PALETTE } from "./world.tsx";

// NASA's two ISS models (public/models/iss/, CREDITS.md). The small one (39 KB) is in the first frame; the full
// one (475 KB) is fetched once the scene is up, and replaces it when decoded.
const BASE = `${import.meta.env.BASE_URL}models/iss/`;
export const ISS_URLS = { lo: `${BASE}iss-lo.glb`, hi: `${BASE}iss.glb` } as const;

/** Truss length (x, after POSE) in scene units, and how it sits: seen from slightly below, truss across the frame. */
const SPAN = 30;
const AT: [number, number, number] = [0, -1.5, 0];
const TURN = { x: 0.32, y: -0.55 };
/** Each file's own rotation into a common pose (truss along x, modules along z), after its node transforms. */
const POSE: Record<keyof typeof ISS_URLS, [number, number, number]> = { lo: [0, 0, 0], hi: [0, Math.PI / 2, 0] };
/**
 * Shift after the fit, scene units. iss.glb carries stray parts below the station that pull its box centre down;
 * this puts its truss where the small model's truss was, so the swap does not jump. Measured by eye.
 */
const NUDGE: Record<keyof typeof ISS_URLS, [number, number, number]> = { lo: [0, 0, 0], hi: [-3.4, 2.6, 0] };

const loaded = new Map<string, Object3D>();

function releaseStation() {
  for (const url of Object.values(ISS_URLS)) {
    const root = loaded.get(url);
    if (root) disposeTree(root);
    loaded.delete(url);
    useGLTF.clear(url);
  }
}

/** One model, turned to the common pose, fitted by its bounding box, materials made mono grey. */
function Fitted({ which, visible, onReady }: { which: keyof typeof ISS_URLS; visible: boolean; onReady?: () => void }) {
  const url = ISS_URLS[which];
  const { scene } = useGLTF(url, DRACO);
  const invalidate = useThree((s) => s.invalidate);
  const fit = useMemo(() => {
    // Measured on its own, so a remount (scene still under the old group) measures the same box.
    const parent = scene.parent;
    parent?.remove(scene);
    scene.rotation.set(...POSE[which]);
    scene.updateMatrixWorld(true);
    const b = new Box3().setFromObject(scene);
    parent?.add(scene);
    return fitBox({ min: b.min.toArray(), max: b.max.toArray() }, SPAN, 0);
  }, [scene, which]);
  useLayoutEffect(() => {
    scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as Material[]) {
        const std = mat as MeshStandardMaterial;
        if (!std.color) continue;
        const g = monoGrey(std.color.r, std.color.g, std.color.b);
        std.color.setRGB(g, g, g);
        std.metalness = Math.min(std.metalness ?? 0, 0.3);
        std.roughness = Math.max(std.roughness ?? 1, 0.55);
      }
    });
  }, [scene]);
  useEffect(() => {
    loaded.set(url, scene);
    invalidate();
    onReady?.();
  }, [scene, url, invalidate, onReady]);
  return (
    <group visible={visible} scale={fit.scale} position={[0, 1, 2].map((i) => fit.offset[i] + NUDGE[which][i]) as [number, number, number]}>
      <primitive object={scene} />
    </group>
  );
}

const warn = (e: unknown) => console.warn("Station model failed to load; the flame stays.", e);
/** Station width as a share of the frame width. */
const FILL_W = 0.55;

/** The station behind the flame: the small model first, the full model after the scene is up. Slow turn unless calm. */
export function Station({ calm }: { calm: boolean }) {
  useEffect(() => hold("iss-models", releaseStation), []);
  const [loReady, setLoReady] = useState(false);
  const [wantHi, setWantHi] = useState(false);
  const [hiReady, setHiReady] = useState(false);
  const spin = useRef<Group>(null);
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const invalidate = useThree((st) => st.invalidate);
  // Back the camera off until the station fills FILL_W of the frame width, whatever the box shape.
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const tan = Math.tan((cam.fov / 2) * (Math.PI / 180));
    cam.position.set(0, 1.4, Math.max(50, SPAN / FILL_W / (2 * tan * aspect)));
    cam.lookAt(0, 0, 0);
    cam.far = Math.max(cam.far, cam.position.z + 200);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate]);
  const onLo = useMemo(() => () => setLoReady(true), []);
  const onHi = useMemo(() => () => setHiReady(true), []);

  // The full model waits until the small one is on screen and the page is idle.
  useEffect(() => {
    if (!loReady || wantHi) return;
    const go = () => setWantHi(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(go, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(go, 1000);
    return () => clearTimeout(id);
  }, [loReady, wantHi]);

  useFrame((_, dt) => {
    if (!calm && spin.current) spin.current.rotation.y += Math.min(dt, 0.1) * 0.012;
  });

  return (
    <>
      <directionalLight color={PALETTE.sun} intensity={3.2} position={[-30, 25, 40]} />
      <hemisphereLight args={["#d8d6d0", PALETTE.space, 0.35]} />
      <group position={AT} rotation={[TURN.x, 0, 0]}>
        <group ref={spin} rotation={[0, TURN.y, 0]}>
          <LoadGuard onError={warn}>
            <Suspense fallback={null}>
              <Fitted which="lo" visible={!hiReady} onReady={onLo} />
            </Suspense>
          </LoadGuard>
          {wantHi && (
            <LoadGuard onError={warn}>
              <Suspense fallback={null}>
                <Fitted which="hi" visible={hiReady} onReady={onHi} />
              </Suspense>
            </LoadGuard>
          )}
        </group>
      </group>
    </>
  );
}
