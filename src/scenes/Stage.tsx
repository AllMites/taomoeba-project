import { Component, useEffect, useState, type ReactNode } from "react";
import { useConsole } from "../app/console.ts";
import { prefersCalm } from "../app/motion.ts";
import type { SceneId, SceneModule } from "../contracts/index.ts";
import { useDataset } from "../data/useDataset.ts";
import { scenes } from "./registry.ts";
import { replayFor, type When } from "./replay.ts";
import "./stage.css";

const WHEN: { id: When; label: string; hint: string }[] = [
  { id: "past", label: "Past", hint: "A real fire in a cargo ship" },
  { id: "now", label: "Now", hint: "A flame in this base's air" },
];

/** The old scene fades out for this long before the new one is handed its base (stage.css uses the same time). */
const FADE_OUT_MS = 160;

/** A scene that throws (no WebGL, a model that will not load) leaves the still picture under it on screen. */
class SceneGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The scene shows `shown`, which lags the pick by one fade-out: the old scene fades to the new still picture,
 * then the new scene fades in over it. Under reduced motion the swap is instant.
 */
function useCrossfade<T>(value: T, calm: boolean) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (shown === value) return;
    if (calm) {
      setShown(value);
      return;
    }
    const t = setTimeout(() => setShown(value), FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [value, shown, calm]);
  return { shown, fading: shown !== value };
}

const idle = (run: () => void) => {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: 1500 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 200);
  return () => clearTimeout(id);
};

/**
 * The center replay. It fills main.console-center and always runs: the still picture is in the first frame, and
 * the 3D code and models load after first paint, so nothing the judges need waits for them. Where WebGL is off
 * or a scene fails, the still picture stays.
 */
export default function Stage() {
  const habitats = useDataset("habitats");
  const base = useConsole((s) => s.base);
  const [when, setWhen] = useState<When>("now");
  const [calm] = useState(prefersCalm);
  const [loaded, setLoaded] = useState<Partial<Record<SceneId, SceneModule>>>({});

  const { shown, fading } = useCrossfade(`${base}|${when}`, calm);
  const [shownBase, shownWhen] = shown.split("|") as [typeof base, When];
  const label = (id: string) => (habitats.status === "ready" ? habitats.data.find((h) => h.id === id)?.label : undefined);
  const target = replayFor(base, when, label(base));
  const current = replayFor(shownBase, shownWhen, label(shownBase));
  const habitat = habitats.status === "ready" ? habitats.data.find((h) => h.id === current.habitat) : undefined;
  const mod = loaded[current.scene];

  // After first paint, and again when the other view is first asked for. A failed load keeps the still picture.
  const wanted = target.scene;
  useEffect(() => {
    if (loaded[wanted]) return;
    let live = true;
    const cancel = idle(() => {
      scenes[wanted]().then(
        (m) => live && setLoaded((l) => ({ ...l, [wanted]: m.default })),
        () => {},
      );
    });
    return () => {
      live = false;
      cancel();
    };
  }, [wanted, loaded]);

  return (
    <section className="stage" aria-label="Replay" data-when={when}>
      <picture>
        {target.posterNarrow && <source media="(max-width: 600px)" srcSet={target.posterNarrow} />}
        <img className="stage-poster" src={target.poster} alt="" />
      </picture>
      {mod && (
        <SceneGuard key={current.scene}>
          <div className="stage-scene" data-fading={fading || undefined}>
            <mod.Component habitat={habitat} calm={calm} />
          </div>
        </SceneGuard>
      )}
      <div className="stage-ticks" aria-hidden="true" />
      <p className="stage-caption glass">{target.caption}</p>
      <fieldset className="stage-when glass">
        <legend className="sr-only">Which fire</legend>
        {WHEN.map((w) => (
          <label key={w.id} className="stage-when-opt" title={w.hint}>
            <input type="radio" name="stage-when" className="sr-only" checked={when === w.id} onChange={() => setWhen(w.id)} />
            <span className="t-readout">{w.label}</span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
