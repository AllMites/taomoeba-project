import type { SceneModule } from "../../contracts/index.ts";
import { LunarScene } from "./LunarScene.tsx";

const scene: SceneModule = {
  id: "lunar",
  title: "Your habitat",
  caption: "Your habitat on the Moon, and a flame drawn in station air and in your habitat's air. The air numbers come from the habitat presets.",
  Component: LunarScene,
};
export default scene;
