import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { story, type StoryInput } from "../spread/story.ts";
import { SpreadPanel } from "./SpreadPanel.tsx";

// A server render reads a zustand store's first state only, so the pick is handed in here.
vi.mock("../playback.ts", async (original) => ({
  ...(await original<typeof import("../playback.ts")>()),
  usePlayback: (select: (s: { picked: string }) => unknown) => select({ picked: "cloth" }),
}));

const panel = (s: Partial<StoryInput> = {}) =>
  renderToStaticMarkup(
    <SpreadPanel air="ISS" g="micro" doc={null} fabric={{ lives: true, test: null, beyond: false }} st={story({ g: "micro", o2: 21, start: "cloth", response: "vent", ...s })} />,
  );

it("a picked object's card comes before the object list (P1-5)", () => {
  const html = panel();
  const card = html.indexOf('class="spread-card"');
  expect(card).toBeGreaterThan(0);
  expect(card).toBeLessThan(html.indexOf('class="spread-list"'));
});

describe("the scenario controls and the outcome card (15.10)", () => {
  it("offers the three start points and the three responses, the chosen one pressed", () => {
    const html = panel({ response: "co2" });
    for (const t of ["Cloth near the air vent", "Paper on the desk", "Foam pad by the bench", "Do nothing", "Stop the ventilation", "Discharge carbon dioxide"]) expect(html).toContain(t);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Discharge carbon dioxide/);
  });
  it("stopping the ventilation on the cloth in orbit at 21% puts the flame out, citing BASS-II", () => {
    const html = panel({ response: "vent" });
    expect(html).toContain("The flame goes out");
    expect(html).toContain("BASS-II");
  });
  it("carbon dioxide is drawn weaker and says Not tested, never out", () => {
    const html = panel({ response: "co2" });
    expect(html).toContain("Not tested: drawn as a weaker flame");
    expect(html).not.toContain("The flame goes out");
  });
  it("the picked object's card offers to start the fire there when it is another start point", () => {
    expect(panel({ start: "foam" })).toContain("Start a fire here");
    expect(panel({ start: "cloth" })).not.toContain("Start a fire here");
  });
});
