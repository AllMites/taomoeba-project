import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { story, type StoryInput } from "../spread/story.ts";
import { SpreadPanel } from "./SpreadPanel.tsx";

// A server render reads a zustand store's first state only, so the pick is handed in here.
vi.mock("../playback.ts", async (original) => ({
  ...(await original<typeof import("../playback.ts")>()),
  usePlayback: (select: (s: { picked: string }) => unknown) => select({ picked: "cloth" }),
}));

const panel = (s: Partial<StoryInput> = {}, kPa: number | undefined = 101.3) =>
  renderToStaticMarkup(
    <SpreadPanel air="ISS" kPa={kPa} g="micro" doc={null} fabric={{ lives: true, test: null, beyond: false }} st={story({ g: "micro", o2: 21, start: "cloth", response: "vent", ...s })} />,
  );

it("a picked object's details leave the side panel for the scene callout (17.5), and are read out there (P1-5)", () => {
  const html = panel();
  // No detail card in the panel: the details are pinned in the scene.
  expect(html).not.toContain('class="spread-card"');
  // The object list stays as the keyboard path, the pinned row pressed, ahead of nothing it must scroll past.
  expect(html).toMatch(/aria-pressed="true"><span class="burn-mark"[^>]*><\/span>Cotton-fiberglass cloth/);
  // The pinned details are announced politely.
  expect(html).toMatch(/<p class="sr-only" aria-live="polite">Cotton-fiberglass cloth \(SIBAL\): combustible here\./);
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
  it("the pinned callout offers to start the fire there when it is another start point", async () => {
    const { ObjectCard } = await import("./SpreadPanel.tsx");
    const { OBJECTS } = await import("../spread/spread.ts");
    const cloth = OBJECTS.find((o) => o.id === "cloth")!;
    const card = (start: string) => renderToStaticMarkup(<ObjectCard o={cloth} g="micro" doc={null} fabric={{ lives: true, test: null, beyond: false }} start={start} />);
    expect(card("foam")).toContain("Start a fire here");
    expect(card("cloth")).not.toContain("Start a fire here");
  });
});

it("the panel says there is more below until its end is in view", async () => {
  const { moreBelow } = await import("./SpreadPanel.tsx");
  expect(moreBelow({ scrollHeight: 600, scrollTop: 0, clientHeight: 400 })).toBe(true);
  expect(moreBelow({ scrollHeight: 600, scrollTop: 200, clientHeight: 400 })).toBe(false);
  expect(moreBelow({ scrollHeight: 400, scrollTop: 0, clientHeight: 400 })).toBe(false);
});

describe("carbon dioxide discharge in the scene", () => {
  it("puffs from the crew's response for a few screen seconds at any speed, and only for carbon dioxide", async () => {
    const { puffAt, PUFF_SCREEN_S } = await import("./Spread.tsx");
    const { captionFor } = await import("../spread/story.ts");
    const co2 = story({ g: "micro", o2: 21, start: "checklist", response: "co2" });
    expect(puffAt(co2, co2.respond - 1, 88)).toBeNull();
    expect(puffAt(co2, co2.respond + 88 * PUFF_SCREEN_S * 0.5, 88)?.k).toBeCloseTo(0.5);
    expect(puffAt(co2, co2.respond + 88 * PUFF_SCREEN_S * 3, 88)).toBeNull();
    expect(puffAt(story({ g: "micro", o2: 21, start: "checklist", response: "vent" }), co2.respond + 1, 1)).toBeNull();
    const cap = captionFor(co2, "detect", "a station module").text;
    expect(cap).toContain("Not tested here");
    expect(cap).toContain("Illustration");
  });
});

describe("the gravity switch (15.10)", () => {
  it("offers orbit and Earth as measured and the Moon as an estimate, the scenario's gravity pressed", () => {
    const html = panel({ g: "partial" });
    expect(html).toMatch(/In orbit<span class="spread-how">measured/);
    expect(html).toMatch(/aria-pressed="true"[^>]*><span>On the Moon<span class="spread-how">estimate/);
    expect(html).toMatch(/On Earth<span class="spread-how">measured/);
    expect(html).toContain("Estimate: no fire test has run in Moon gravity");
  });
  it("says nothing about an estimate in orbit or on Earth", () => {
    expect(panel({ g: "micro" })).not.toContain("Estimate: no fire test");
    expect(panel({ g: "earth" })).not.toContain("Estimate: no fire test");
  });
  it("says the gravity is measured but this air is not, for a base whose air no test burned in (Moon Base, rover)", () => {
    const html = panel({ g: "earth", o2: 30 }, 70.3);
    expect(html).toMatch(/On Earth<span class="spread-how">gravity measured, this air not tested/);
    expect(html).toMatch(/In orbit<span class="spread-how">gravity measured, this air not tested/);
    expect(html).not.toMatch(/On Earth<span class="spread-how">measured/);
  });
  it("keeps (measured) only for station air at sea-level pressure; an unknown pressure is not tested", async () => {
    const { gravityName } = await import("../spread/story.ts");
    expect(gravityName("earth", 21, 101.3)).toBe("On Earth (measured)");
    expect(gravityName("earth", 30, 70.3)).toBe("On Earth (gravity measured, this air not tested)");
    expect(gravityName("earth", 21, undefined)).toBe("On Earth (gravity measured, this air not tested)");
    expect(gravityName("partial", 30, 70.3)).toBe("On the Moon (estimate)");
  });
});

it("is closed at rest behind one Scenario button, and carries the aftermath inside it (18.2)", () => {
  const html = panel();
  // A dropdown like the scene picker: a label, the current start and response, a chevron; closed at rest.
  expect(html).toMatch(/<div class="burn"><button type="button" class="burn-toggle stage-pick-btn glass" aria-expanded="false" aria-controls="[^"]+-panel"><span class="stage-pick-label t-readout">Scenario<\/span><span class="stage-pick-name">[^<]+ · [^<]+<\/span><svg/);
});
