import { Component, useState, type ReactNode } from "react";
import { prefersCalm } from "../app/motion.ts";
import { useStore } from "../app/store.ts";
import type { SceneId, SceneModule } from "../contracts/index.ts";
import { useDataset } from "../data/useDataset.ts";
import { scenes } from "./registry.ts";
import "./stage.css";

const TABS: { id: SceneId; label: string }[] = [
  { id: "saffire", label: "A real fire in a cargo ship" },
  { id: "lunar", label: "Your habitat" },
];

/** A scene that throws (no WebGL, a model that will not load) falls back to the still picture under it. */
class SceneGuard extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Still picture per view. Moon and rover have a 4:5 crop for phones; any other habitat uses the flames-only still. */
function Poster({ tab, habitatId }: { tab: SceneId; habitatId: string }) {
  if (tab === "saffire") return <img className="stage-poster" src="/img/scenes/saffire.webp" alt="" />;
  const shot = habitatId === "moon" || habitatId === "rover" ? habitatId : "iss";
  return (
    <picture>
      {shot !== "iss" && <source media="(max-width: 600px)" srcSet={`/img/scenes/lunar-${shot}-narrow.webp`} />}
      <img className="stage-poster" src={`/img/scenes/lunar-${shot}.webp`} alt="" />
    </picture>
  );
}

/**
 * Replay section. The 3D code and models load only after the visitor presses "Load 3D view", so the
 * page stays light on a phone and still works where WebGL is off (the still poster stays up).
 */
export default function Stage() {
  const habitats = useDataset("habitats");
  const habitatId = useStore((s) => s.habitat);
  const habitat = habitats.status === "ready" ? habitats.data.find((h) => h.id === habitatId) : undefined;
  const [tab, setTab] = useState<SceneId>("saffire");
  const [loaded, setLoaded] = useState<Partial<Record<SceneId, SceneModule>>>({});
  const [failed, setFailed] = useState(false);
  const mod = loaded[tab];

  function load() {
    setFailed(false);
    scenes[tab]().then(
      (m) => setLoaded((l) => ({ ...l, [tab]: m.default })),
      () => setFailed(true),
    );
  }

  return (
    <section className="stage" aria-labelledby="stage-h">
      <div className="sec-label">
        <p className="sec-word t-readout">Replay</p>
        <h2 id="stage-h" className="sec-h">
          See the fire
        </h2>
      </div>
      <fieldset className="stage-tabs">
        <legend className="sr-only">Which view</legend>
        {TABS.map((t) => (
          <label key={t.id} className="stage-tab">
            <input type="radio" name="stage" checked={tab === t.id} onChange={() => { setTab(t.id); setFailed(false); }} />
            <span>{t.label}</span>
          </label>
        ))}
      </fieldset>
      {mod && <p className="stage-caption">{mod.caption}</p>}
      <div className="stage-box">
        <Poster tab={tab} habitatId={habitatId} />
        {mod ? (
          <SceneGuard key={tab} onFail={() => setFailed(true)}>
            <div className="stage-scene">
              <mod.Component habitat={habitat} calm={prefersCalm()} />
            </div>
          </SceneGuard>
        ) : (
          <button type="button" className="pill stage-load" onClick={load}>
            Load 3D view
          </button>
        )}
      </div>
      {failed && (
        <p role="alert" className="muted">
          The 3D view could not load. The picture above shows the same scene.
        </p>
      )}
    </section>
  );
}
