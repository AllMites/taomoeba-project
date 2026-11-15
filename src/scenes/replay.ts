// What the center replay shows for a picked base. Pure, so the mapping is tested without a browser.
import { habitatOf, type BaseId } from "../app/console.ts";
import type { HabitatId, SceneId } from "../contracts/index.ts";
import { compareLine, EARTH_LINE, LIMITS } from "./lunar/copy.ts";

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
  /** One line on the glass chip. Says "illustration" wherever the flame is drawn, not filmed or replayed. */
  caption: string;
  /** The longer note behind the chip's "About" disclosure. */
  notes: string[];
  /** Flames the scene draws side by side (0: the scene places its own fire). The stage clears room for them. */
  flames: 0 | 1 | 2;
};

const ILLUSTRATION = LIMITS[0];

export function replayFor(base: BaseId, when: When, label?: string): Replay {
  const habitat = habitatOf(base);
  if (when === "past") {
    return {
      scene: "saffire",
      habitat,
      poster: "/img/scenes/saffire.webp",
      caption: "Past: SAFFIRE-II, a real fire inside a cargo ship. Timing from the run table.",
      notes: [],
      flames: 0,
    };
  }
  if (base === "moon" || base === "rover") {
    return {
      scene: "lunar",
      habitat,
      poster: `/img/scenes/lunar-${base}.webp`,
      posterNarrow: `/img/scenes/lunar-${base}-narrow.webp`,
      caption: `Now: station air beside ${label ?? "your base"} air. ${ILLUSTRATION}`,
      notes: [LIMITS[1], compareLine(false, false)],
      flames: 2,
    };
  }
  if (base === "earth") {
    return {
      scene: "lunar",
      habitat,
      poster: "/img/scenes/lunar-iss.webp",
      caption: `On Earth: the same air at 1 g beside weightless. ${ILLUSTRATION}`,
      notes: [EARTH_LINE],
      flames: 2,
    };
  }
  return { scene: "lunar", habitat, poster: "/img/scenes/lunar-iss.webp", caption: `Now: a flame in station air. ${ILLUSTRATION}`, notes: [compareLine(true, true)], flames: 1 };
}
