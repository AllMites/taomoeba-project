// Dev-only harness (npm run dev, then /scenes.html?scene=saffire&habitat=moon&calm=0). Not part of the build.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { HabitatPreset, SceneId, SceneModule } from "../contracts/index.ts";
import "../styles/tokens.css";
import "../styles/base.css";
import { scenes } from "./registry.ts";

const q = new URLSearchParams(location.search);
const id = (q.get("scene") ?? "saffire") as SceneId;

function Dev() {
  const [mod, setMod] = useState<SceneModule | null>(null);
  const [habitat, setHabitat] = useState<HabitatPreset>();
  useEffect(() => {
    void scenes[id]().then((m) => setMod(m.default));
    void fetch("/data/habitats.json")
      .then((r) => r.json())
      .then((d: { items?: HabitatPreset[] } | HabitatPreset[]) => {
        const items = Array.isArray(d) ? d : (d.items ?? []);
        setHabitat(items.find((h) => h.id === (q.get("habitat") ?? "moon")));
      });
  }, []);
  if (!mod) return <p>Loading scene</p>;
  return (
    <main style={{ padding: 16 }}>
      <h2 className="sec-h">{mod.title}</h2>
      <p>{mod.caption}</p>
      {/* The page will give scenes this box: full width, 16:9 on desktop, 4:5 on a phone. */}
      <div style={{ width: "100%", aspectRatio: innerWidth < 600 ? "4 / 5" : "16 / 9", maxHeight: "80vh" }}>
        <mod.Component habitat={habitat} calm={q.get("calm") === "1"} />
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Dev />
  </StrictMode>,
);
