import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { scenarioIds, story } from "../spread/story.ts";
import { AftermathCard } from "./Aftermath.tsx";

const clock = vi.hoisted(() => ({ t: 0 }));
vi.mock("../playback.ts", async (original) => ({
  ...(await original<typeof import("../playback.ts")>()),
  usePlayback: (select: (s: unknown) => unknown) => select({ timeline: { compressed: true }, t: clock.t }),
}));

const st = story({ g: "micro", o2: 21, start: "cloth", response: "vent" });

it("shows at stage 5 only: counts, the detector, what the response did, what is unknown, no structural test, Ask", () => {
  clock.t = st.stages[4].at - 1;
  expect(renderToStaticMarkup(<AftermathCard st={st} where="ISS module" />)).toBe("");
  clock.t = st.end;
  const html = renderToStaticMarkup(<AftermathCard st={st} where="ISS module" />);
  expect(html).toMatch(/\d of \d+ objects burned/);
  expect(html).toContain("Smoke reached the detector at");
  expect(html).toContain("the flame went out");
  expect(html).toContain("not a cabin of mixed materials");
  expect(html).toContain("no test of damage to a habitat");
  expect(html).toContain("Ask about this");
  expect(html).not.toMatch(/Artemis|20\d\d/);
});

it("Ask about this carries the experiments behind the response's records", () => {
  expect(scenarioIds(st)).toEqual(["PSI-25", "PSI-20"]);
  expect(scenarioIds(story({ g: "micro", o2: 21, start: "cloth", response: "co2" }))).toEqual(["PSI-69"]);
});
