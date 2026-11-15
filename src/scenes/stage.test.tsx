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
  it("shows the picked base's still picture, with no canvas and no button to press first", () => {
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toContain('class="stage-poster" src="/img/scenes/lunar-moon.webp"');
    expect(html).toContain('srcSet="/img/scenes/lunar-moon-narrow.webp"');
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("stage-scene");
    expect(html).not.toMatch(/Load 3D view|role="alert"/);
  });

  it("follows the base in the console store", () => {
    picked.base = "rover";
    expect(renderToStaticMarkup(<Stage />)).toContain('src="/img/scenes/lunar-rover.webp"');
    picked.base = "earth";
    const earth = renderToStaticMarkup(<Stage />);
    expect(earth).toContain('src="/img/scenes/lunar-iss.webp"');
    expect(earth).toContain("On Earth");
  });

  it("offers Past and Now, with Now picked", () => {
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toMatch(/name="stage-when"\/><span[^>]*>Past<\/span>/);
    expect(html).toMatch(/name="stage-when" checked=""\/><span[^>]*>Now<\/span>/);
  });
});
