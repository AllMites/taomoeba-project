import type { SceneModule } from "../../contracts/index.ts";
import { CabinScene } from "../cabin/CabinScene.tsx";

// Replay v2 (docs/RESKIN_PRD.md 15.2): the "lunar" slot of the registry now shows the fire inside the picked base's
// cabin. The registry is feature-locked, so the module keeps its id.
const scene: SceneModule = {
  id: "lunar",
  title: "Your base",
  caption: "A flame burning inside the picked base's cabin, in that base's air. Illustration, not a simulation.",
  Component: CabinScene,
};
export default scene;
