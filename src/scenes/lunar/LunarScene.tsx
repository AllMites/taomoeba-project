import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { HabitatPreset, SceneProps } from "../../contracts/index.ts";
import { compareLine, LIMITS, NOT_ON_RECORD, sidesFor } from "./copy.ts";
import { FlamePair, type Slot } from "./FlamePair.tsx";
import { issAirNow, loadIssAir } from "./iss.ts";
import { posterFor } from "./poster.ts";
import { Beacons, Earth, Ground, Lights, Models, PALETTE, Rig, type ShotId } from "./world.tsx";
import "./lunar.css";

type Shot = ShotId | "iss";

const ALT: Record<Shot, string> = {
  moon: "A Moon Base habitat on grey lunar ground at low sun, a pressurized rover parked beside it, an astronaut for scale, Earth as a thin crescent.",
  rover: "A pressurized rover on grey lunar ground at low sun, the habitat behind it, an astronaut for scale.",
  iss: "Dark backdrop: the station has no surface scene, only the flame.",
};

// Dev only: /scenes.html?scene=lunar&habitat=moon&calm=1&poster hides the flames and readouts for poster capture.
const POSTER_CAPTURE = import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).has("poster");

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

/** ISS reference air for the left flame, from the same habitats file the page uses. */
function useIssAir(picked: HabitatPreset | undefined) {
  const [iss, setIss] = useState<HabitatPreset | undefined>(issAirNow);
  useEffect(() => {
    if (picked?.id === "iss") return;
    let live = true;
    void loadIssAir(`${import.meta.env.BASE_URL}data/habitats.json`).then((h) => live && setIss(h));
    return () => {
      live = false;
    };
  }, [picked?.id]);
  return picked?.id === "iss" ? picked : iss;
}

function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

export function LunarScene({ habitat, calm }: SceneProps) {
  const iss = useIssAir(habitat);
  const { sides, same } = sidesFor(habitat, iss);
  const shot: Shot = habitat?.id === "rover" ? "rover" : habitat?.id === "iss" ? "iss" : "moon";
  const world = shot !== "iss";

  const root = useRef<HTMLDivElement>(null);
  const slotEls = useRef<(HTMLDivElement | null)[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [webgl] = useState(hasWebGL);
  const [lost, setLost] = useState(false);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  const onScreen = useOnScreen(root);
  const fallback = !webgl || lost || failed;
  const onLoadError = useCallback((e: unknown) => {
    console.warn("Lunar scene: a model failed to load, showing the still picture.", e);
    setFailed(true);
  }, []);

  // A lost context (a phone backgrounding the tab, a GPU reset) shows the poster; try the 3D view again when the
  // page is visible again. The old canvas is gone, so the retry gets a fresh context.
  useEffect(() => {
    if (!lost) return;
    const retry = () => document.visibilityState === "visible" && setLost(false);
    document.addEventListener("visibilitychange", retry);
    return () => document.removeEventListener("visibilitychange", retry);
  }, [lost]);

  const measure = useCallback(() => {
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    setWidth(Math.round(box.width));
    const next = slotEls.current.slice(0, sides.length).map((el) => {
      const r = el?.getBoundingClientRect();
      return r ? { cx: r.left - box.left + r.width / 2, cy: r.top - box.top + r.height / 2, d: Math.min(r.width, r.height) } : { cx: 0, cy: 0, d: 0 };
    });
    setSlots((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [sides.length]);

  useLayoutEffect(() => {
    measure();
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, same]);

  const frameloop = calm || !onScreen ? "demand" : "always";

  return (
    <div className="lunar" ref={root} data-shot={shot}>
      <div className="lunar-visual" role="img" aria-label={ALT[shot]}>
        {fallback ? (
          width > 0 && <img className="lunar-poster" src={posterFor(shot, width, import.meta.env.BASE_URL)} alt="" />
        ) : (
          <Canvas
            aria-hidden="true"
            shadows="percentage"
            dpr={[1, 1.75]}
            frameloop={frameloop}
            camera={{ fov: 20, near: 0.3, far: 1200, position: [0, 1.4, 50] }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.setClearColor(PALETTE.space);
              gl.domElement.addEventListener("webglcontextlost", (e) => {
                e.preventDefault();
                setLost(true);
              });
            }}
          >
            {world && (
              <>
                <Rig shot={shot} calm={calm} />
                <Lights shot={shot} />
                <Ground />
                <Beacons calm={calm} />
                <Earth shot={shot} />
                <Models onError={onLoadError} />
              </>
            )}
            {!POSTER_CAPTURE && <FlamePair sides={sides} slots={slots} world={world} calm={calm} />}
          </Canvas>
        )}
      </div>

      {!POSTER_CAPTURE && (
        <div className="lunar-ui">
          <p className="lunar-limits">
            <strong>{LIMITS[0]}</strong> {LIMITS[1]}
          </p>
          <figure className="lunar-compare" data-count={sides.length}>
            <figcaption className="lunar-compare-line">{compareLine(same, habitat?.id === "iss")}</figcaption>
            <div className="lunar-cells">
              {sides.map((s, i) => (
                <div className="lunar-cell" key={s.key}>
                  <div
                    className="lunar-slot"
                    aria-hidden="true"
                    ref={(el) => {
                      slotEls.current[i] = el;
                    }}
                  >
                    {fallback && s.o2Percent !== undefined && <span className="lunar-css-flame" style={{ "--o2": s.o2Percent } as CSSProperties} />}
                  </div>
                  <p className="lunar-air">{s.name}</p>
                  <p className="lunar-readout t-readout">
                    <span className={s.oxygen === NOT_ON_RECORD ? "lunar-nor" : undefined}>{s.oxygen}</span>
                    <span className={s.pressure === NOT_ON_RECORD ? "lunar-nor" : undefined}>{s.pressure}</span>
                  </p>
                </div>
              ))}
            </div>
          </figure>
        </div>
      )}
    </div>
  );
}
