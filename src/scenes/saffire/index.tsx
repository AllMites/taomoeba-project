import type { SceneModule } from "../../contracts/index.ts";
import { SaffireScene } from "./SaffireScene.tsx";

const scene: SceneModule = {
  id: "saffire",
  title: "A real fire inside a cargo spacecraft",
  caption:
    "A fabric strip from SAFFIRE-II burns inside a Cygnus cargo ship; its spread and timing come from the run table, its look is illustrative.",
  Component: SaffireScene,
};

export default scene;
