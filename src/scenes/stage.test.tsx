import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseId } from "../app/console.ts";
import Stage from "./Stage.tsx";

// A server render reads a zustand store's first state only, so the picked base is handed in here.
const picked = vi.hoisted(() => ({ base: "moon" as BaseId }));
vi.mock("../app/console.ts", async (original) => ({
  ...(await original<typeof import("../app/console.ts")>()),
  useConsole: (select: (s: { base: BaseId }) => unknown) => select(picked),
}));

beforeEach(() => {
  picked.base = "moon";
});

describe("center replay, before any 3D has loaded (and for good where it cannot load)", () => {
  it("shows a plain loading card on glass (the cabin has no still picture yet), with no canvas and no button to press first", () => {
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toMatch(/class="stage-loading glass" role="status"/);
    expect(html).not.toContain("stage-poster");
    expect(html).not.toContain("lunar-moon.webp");
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("stage-scene");
    expect(html).not.toMatch(/Load 3D view|role="alert"/);
  });

  it("follows the base in the console store, and never shows the old exterior shot under a cabin caption", () => {
    picked.base = "rover";
    expect(renderToStaticMarkup(<Stage />)).not.toContain("lunar-rover.webp");
    picked.base = "earth";
    const earth = renderToStaticMarkup(<Stage />);
    expect(earth).not.toContain("lunar-iss.webp");
    expect(earth).toContain("a cabin on Earth");
  });

  it("offers three named scenes with model burn picked, and no Past / Now", () => {
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toMatch(/name="replay-scene" checked=""\/><span class="stage-pick-opt-name">This base: model burn<\/span>/);
    expect(html).toContain("This base: fire spread");
    expect(html).toContain("Real fire: Saffire flight test");
    expect(html).not.toMatch(/>Past<|>Now</);
  });

  it("says it is an illustration on the glass caption, with the longer note behind a real About control", () => {
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toMatch(/class="stage-caption-text glass"><p>A fuel droplet burning in [^<]*Illustration, not a simulation\.<\/p>/);
    expect(html).toContain('<summary aria-label="About this replay">');
    expect(html).toContain("No fire experiment on record ran in Moon gravity.");
  });
});
