import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { useConsole } from "../app/console.ts";
import { useStore } from "../app/store.ts";
import type { HabitatPreset } from "../contracts/index.ts";
import Carousel from "./Carousel.tsx";
import { StatusStrip, TopBar } from "./chrome.tsx";
import { baseForKey, openRankOnHighlight, stepBase, toggleView } from "./logic.ts";
import Sheet, { inertBehind, Scrim, type InertNode } from "./Sheet.tsx";

const habitats: HabitatPreset[] = [
  { id: "iss", label: "ISS", o2Percent: 21, pressureKPa: 101.3, note: "" },
  { id: "moon", label: "Moon Base", o2Percent: 30, pressureKPa: 70.3, note: "" },
  { id: "rover", label: "Pressurized rover", o2Percent: 30, pressureKPa: 70.3, note: "" },
];

beforeEach(() => {
  useConsole.setState({ base: "moon", view: "stage", leftOpen: false, askOpen: false });
  useStore.setState({ habitat: "moon", highlightIds: [] });
});

describe("base carousel", () => {
  it("steps left and right and wraps at both ends", () => {
    expect(stepBase("moon", 1)).toBe("rover");
    expect(stepBase("iss", -1)).toBe("earth");
    expect(stepBase("earth", 1)).toBe("iss");
  });
  it("arrow keys step, Home and End jump, other keys do nothing", () => {
    expect(baseForKey("ArrowRight", "moon")).toBe("rover");
    expect(baseForKey("ArrowLeft", "moon")).toBe("iss");
    expect(baseForKey("Home", "rover")).toBe("iss");
    expect(baseForKey("End", "iss")).toBe("earth");
    expect(baseForKey("Enter", "moon")).toBeNull();
  });
  it("is one radio group of four with only the picked base checked and in the tab order", () => {
    const html = renderToStaticMarkup(<Carousel base="moon" habitats={habitats} />);
    expect(html.match(/role="radio"/g)).toHaveLength(4);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true" tabindex="0"[^>]*>Moon Base</);
    expect(html).toContain(">Earth<");
    expect(html).toContain("<b>30%</b>");
    expect(html).toContain("<b>70.3</b> kPa");
  });
  it("Earth shows the ISS air, because it ranks with the ISS figures", () => {
    const html = renderToStaticMarkup(<Carousel base="earth" habitats={habitats} />);
    expect(html).toContain("<b>21%</b>");
    expect(html).toContain("Same air as the ISS");
  });
  it("names the bases before the habitat data arrives", () => {
    expect(renderToStaticMarkup(<Carousel base="moon" habitats={null} />)).toContain(">Pressurized rover<");
  });
});

describe("nav and sheets", () => {
  it("pressing a view opens it; pressing the open view closes it", () => {
    expect(toggleView("stage", "rank")).toBe("rank");
    expect(toggleView("compare", "rank")).toBe("rank");
    expect(toggleView("rank", "rank")).toBe("stage");
  });
  it("marks the open view as pressed and gives every view a description", () => {
    const html = renderToStaticMarkup(<TopBar view="rank" leftOpen={false} askOpen={true} />);
    expect(html).toMatch(/id="nav-rank"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/id="nav-compare"[^>]*aria-pressed="false"/);
    expect(html.match(/role="tooltip"/g)).toHaveLength(5);
    expect(html).toMatch(/class="ask-pill" aria-pressed="true"/);
  });
  it("the status strip reads out the picked base; Earth reads the ISS air", () => {
    const strip = (base: "rover" | "earth") =>
      renderToStaticMarkup(<StatusStrip base={base} habitats={habitats} sources={42} experiments={26} isFixture={false} />);
    expect(strip("rover")).toContain("<dd>Pressurized rover</dd>");
    expect(strip("rover")).toContain("<dd>70.3 kPa</dd>");
    expect(strip("earth")).toContain("<dd>Earth</dd>");
    expect(strip("earth")).toContain("<dd>21%</dd>");
    expect(strip("earth")).toContain("<dd>42</dd>");
    expect(strip("earth")).not.toContain("sample data");
  });
  it("a sheet names its view, has a close button and holds its section", () => {
    const html = renderToStaticMarkup(
      <Sheet view="models">
        <h2>What if</h2>
      </Sheet>,
    );
    expect(html).toContain('aria-label="Team models"');
    expect(html).toContain('aria-label="Close Team models"');
    expect(html).toContain("<h2>What if</h2>");
  });
  it("cards lighting up open the Rank sheet; clearing them does not", () => {
    const stop = openRankOnHighlight();
    useStore.getState().setHighlightIds(["PSI-69"]);
    expect(useConsole.getState().view).toBe("rank");
    useConsole.getState().setView("stage");
    useStore.getState().setHighlightIds([]);
    expect(useConsole.getState().view).toBe("stage");
    stop();
    useStore.getState().setHighlightIds(["PSI-68"]);
    expect(useConsole.getState().view).toBe("stage");
  });
  it("on a phone, lit cards also close the Ask bottom sheet that sits over the Rank sheet; on a wide screen it stays", () => {
    useConsole.setState({ askOpen: true });
    const wide = openRankOnHighlight(() => false);
    useStore.getState().setHighlightIds(["PSI-69"]);
    expect(useConsole.getState()).toMatchObject({ view: "rank", askOpen: true });
    wide();
    useConsole.setState({ view: "stage" });
    const phone = openRankOnHighlight(() => true);
    useStore.getState().setHighlightIds(["PSI-68"]);
    expect(useConsole.getState()).toMatchObject({ view: "rank", askOpen: false });
    phone();
  });
});

/** A stand-in element with only what inertBehind uses. */
function node(cls: string, kids: InertNode[] = []): InertNode {
  const attrs = new Set<string>();
  const n: InertNode = {
    parentElement: null,
    children: kids,
    classList: { contains: (c) => cls.split(" ").includes(c) },
    hasAttribute: (a) => attrs.has(a),
    setAttribute: (a) => void attrs.add(a),
    removeAttribute: (a) => void attrs.delete(a),
  };
  for (const k of kids) k.parentElement = n;
  return n;
}
function consoleTree() {
  const sheet = node("sheet glass");
  const center = node("console-center", [node("console-carousel"), node("stage"), node("console-ticks"), node("console-hud"), node("sheet-scrim"), sheet]);
  const root = node("console", [node("console-top"), node("console-rail"), node("console-left"), center, node("console-right"), node("console-status")]);
  const names = ["console-top", "console-rail", "console-left", "console-right", "console-status", "console-carousel", "stage", "console-ticks", "console-hud"];
  const inert = () =>
    [...root.children, ...center.children].filter((el) => el.hasAttribute("inert")).map((el) => names.find((c) => el.classList.contains(c)));
  return { sheet, inert };
}

describe("what a sheet covers", () => {
  it("on a wide screen, Tab cannot reach the replay, brief or top 3 behind a sheet; the carousel and panels stay live", () => {
    const { sheet, inert } = consoleTree();
    const undo = inertBehind(sheet, false);
    expect(inert()).toEqual(["stage", "console-ticks", "console-hud"]);
    undo();
    expect(inert()).toEqual([]);
  });
  it("on a phone the sheet is full screen: everything but the Ask panel goes inert", () => {
    const { sheet, inert } = consoleTree();
    const undo = inertBehind(sheet, true);
    expect(inert()).toEqual(["console-top", "console-rail", "console-left", "console-status", "console-carousel", "stage", "console-ticks", "console-hud"]);
    undo();
    expect(inert()).toEqual([]);
  });
  it("a press on the dimming does not take focus, so closing returns focus to the nav button", () => {
    let prevented = false;
    Scrim().props.onMouseDown({ preventDefault: () => (prevented = true) });
    expect(prevented).toBe(true);
  });
});
