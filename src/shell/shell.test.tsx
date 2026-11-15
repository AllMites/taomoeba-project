import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { useConsole } from "../app/console.ts";
import { useStore } from "../app/store.ts";
import type { HabitatPreset } from "../contracts/index.ts";
import Carousel from "./Carousel.tsx";
import { StatusStrip, TopBar } from "./chrome.tsx";
import { baseForKey, openRankOnHighlight, stepBase, toggleView } from "./logic.ts";
import Sheet from "./Sheet.tsx";

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
});
