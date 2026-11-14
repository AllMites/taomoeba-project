import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseDoc } from "../whatif/logic.ts";
import { TrustView } from "./index.tsx";
import { evalLines, parseEval } from "./logic.ts";

const doc = parseDoc(JSON.parse(readFileSync(`${process.cwd()}/public/data/whatif.json`, "utf8")))!;
const sample = {
  date: "2026-11-14T15:00:00.000Z",
  questions: 100,
  papers: { n: 58, cites_a_labelled_paper: 40, first_claim_cites_a_labelled_paper: 30, wrongly_refused: 2 },
  offtopic: { n: 19, refused: 19 },
  data: { n: 10, right_fact: 9 },
  model: { n: 10, model_fact: 8 },
  modes: { live: 95, extractive: 5 },
  claims: { total: 200, not_double_checked: 10 },
  latency_ms: { median: 6000, p90: 9000 },
};

describe("how we know", () => {
  it("score lines come from the file, in plain words", () => {
    const e = parseEval(sample)!;
    const lines = evalLines(e);
    expect(lines[0]).toEqual(expect.objectContaining({ big: "69%" }));
    expect(lines.map((l) => l.big)).toEqual(["69%", "100%", "90%", "80%", "95%", "95%"]);
    expect(parseEval({ ...sample, papers: undefined })).toBeNull();
  });
  it("shows the measured scores, the model scores from the grid, the physics check and the kinds of number", () => {
    const html = renderToStaticMarkup(<TrustView ev={parseEval(sample)} doc={doc} />);
    expect(html).toContain("How we know");
    expect(html).toContain("69%");
    expect(html).toContain(`AUC ${doc.models.disruption.auc.toFixed(2)}`);
    expect(html).toContain("moves the same way as textbook theory");
    expect(html).toContain("Theory estimate");
    expect(html).toContain("Not covered");
  });
  it("adds the held-out score and the reviewer's verdict when the file has them", () => {
    const e = parseEval({ ...sample, papers_by_group: { tuning: { n: 34, hit: 20 }, held_out: { n: 23, hit: 15 } }, judged: { n: 57, yes: 45, partly: 6, no: 6, model: "m" } })!;
    const texts = evalLines(e).map((l) => `${l.big} ${l.text}`);
    expect(texts[1]).toMatch(/^65% on the 23 of those questions that were never used to tune/);
    expect(texts[2]).toMatch(/^79% of 57 research answers directly answer the question/);
  });
  it("says plainly when the Ask box has not been measured, and never shows made-up scores", () => {
    const html = renderToStaticMarkup(<TrustView ev="none" doc={doc} />);
    expect(html).toContain("Not measured on this copy of the site yet.");
    expect(html).not.toContain("69%");
  });
});
