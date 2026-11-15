import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EarthView } from "./index.tsx";
import { counts, parseEarth } from "./logic.ts";

const read = (p: string) => JSON.parse(readFileSync(`${process.cwd()}/${p}`, "utf8"));
const doc = parseEarth(read("public/data/earth.json"))!;
const invs = read("public/data/investigations.json");
const invIds = new Set((invs.items ?? invs).map((i: { id: string }) => i.id));

describe("on Earth too", () => {
  it("the file parses; every card has a source link and only real experiment ids", () => {
    expect(doc).not.toBeNull();
    for (const it of doc.items) {
      expect(it.sources.length).toBeGreaterThan(0);
      for (const id of it.experiments) expect(invIds.has(id), `${it.id}: ${id}`).toBe(true);
      // a card with no PSI experiment says why
      if (it.experiments.length === 0 && it.status !== "heritage") expect(it.note, it.id).toBeTruthy();
    }
    const c = counts(doc);
    expect(c["in-use"] + c.research + c.heritage).toBe(doc.items.length);
  });
  it("every Ask button question is in the demo save list", () => {
    const save = readFileSync(`${process.cwd()}/scripts/rag/save_answers.mjs`, "utf8");
    for (const it of doc.items) if (it.ask) expect(save, it.ask).toContain(JSON.stringify(it.ask));
  });
  it("every new Earth source is in the library download list", () => {
    const more = new Set(read("scripts/rag/more_sources.json").items.map((i: { id: string }) => i.id));
    for (const it of doc.items) for (const s of it.sources) if (s.id.startsWith("nasa:")) expect(more.has(s.id), s.id).toBe(true);
  });
  it("renders labelled cards, in-use first, with experiment buttons and Ask buttons", () => {
    const html = renderToStaticMarkup(<EarthView doc={doc} titleOf={(id) => `T-${id}`} onOpen={() => {}} onAsk={() => {}} />);
    expect(html).toMatch(/<h2[^>]*>On Earth<\/h2>/);
    expect(html).toContain('class="earth glass"'); // it sits over the replay, so it is glass
    expect(html.indexOf("Water-mist")).toBeLessThan(html.indexOf("Cleaner engines"));
    expect(html).toContain("T-PSI-102");
    expect(html).toContain("Ask: How does water mist put out fires?");
    expect(html).toContain("NASA heritage");
    expect(html).toContain('href="https://spinoff.nasa.gov/node/11065"');
  });
  it("a broken file shows a plain message", () => {
    expect(parseEarth({ about: "x", items: [] })).toBeNull();
    expect(renderToStaticMarkup(<EarthView doc="error" titleOf={(x) => x} />)).toContain("could not be loaded");
  });
});
