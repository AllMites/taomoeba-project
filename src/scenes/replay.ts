// What the center replay shows for a picked base. Pure, so the mapping is tested without a browser.
import { habitatOf, type BaseId } from "../app/console.ts";
import type { HabitatId, SceneId } from "../contracts/index.ts";

/** Past = the Saffire fire that really burned. Now = a flame drawn in the picked base's air. */
export type When = "past" | "now";

export type Replay = {
  scene: SceneId;
  /** The habitat preset handed to the scene. Earth has none of its own: its air is the station's. */
  habitat: HabitatId;
  /** Still picture shown first, and for good where the 3D cannot run. */
  poster: string;
  /** Portrait crop of the poster for a phone, where one exists. */
  posterNarrow?: string;
  /** One line on the glass chip. */
  caption: string;
};

export function replayFor(base: BaseId, when: When, label?: string): Replay {
  const habitat = habitatOf(base);
  if (when === "past") {
    return { scene: "saffire", habitat, poster: "/img/scenes/saffire.webp", caption: "Past: SAFFIRE-II, a real fire inside a cargo ship. Timing from the run table." };
  }
  if (base === "moon" || base === "rover") {
    return {
      scene: "lunar",
      habitat,
      poster: `/img/scenes/lunar-${base}.webp`,
      posterNarrow: `/img/scenes/lunar-${base}-narrow.webp`,
      caption: `Now: a flame in ${label ?? "your base"} air beside station air. Illustration.`,
    };
  }
  return {
    scene: "lunar",
    habitat,
    poster: "/img/scenes/lunar-iss.webp",
    caption: base === "earth" ? "On Earth: the same air at 1 g beside weightless. Illustration." : "Now: a flame in station air. Illustration.",
  };
}
