import { describe, expect, it } from "vitest";
import factsJson from "../public/data/facts.json";
import { findFacts, type DataFact } from "./facts.ts";

const facts = factsJson as DataFact[];
// Labelled before running: expected first fact id, or [] for questions that are about paper topics, not our data.
const CASES: [string, string[]][] = [
  ["Why does burning rate rise with oxygen in the FLEX data?", ["flex-br-o2-methanol", "flex-br-o2-heptane", "model-pd-br-o2-methanol", "model-pd-br-o2-heptane"]],
  ["Do bigger droplets go out at a bigger diameter?", ["flex-dext-d0-methanol", "flex-dext-d0-heptane"]],
  ["Why did so many high-oxygen FLEX runs end in disruption?", ["flex-end-o2"]],
  ["How many FLEX runs used helium?", ["flex-diluent-he"]],
  ["Why do gas flames self-extinguish at low oxygen in CFI-G?", ["cfig-se-o2-normal", "cfig-se-normal"]],
  ["Do inverse flames self-extinguish less often than normal flames?", ["cfig-se-inverse", "cfig-se-normal"]],
  ["How accurate is the burning rate model?", ["model-br-accuracy"]],
  ["What matters most for extinction diameter in the model?", ["model-importance-flex_ext_diameter"]],
  ["Can we trust the model predictions for a Moon base?", ["model-moon-validity"]],
  ["Will droplets break apart at Moon base conditions?", ["model-disruption-moon"]],
  ["How likely is a droplet to break apart?", ["model-disruption"]],
  ["How accurate is the refined extinction diameter model?", ["model-dext-refined"]],
  ["Why is the ignition model not used?", ["model-ignition-weak"]],
  ["Why is FLEX ranked first for the Moon base?", ["dash-rank-PSI-69-moon"]],
  ["How does SAFFIRE-I rank for the ISS?", ["dash-rank-PSI-98-iss"]],
  ["Which experiment ranks highest for the pressurized rover?", ["dash-rank-PSI-69-rover"]],
  ["How do measured burning rates compare with droplet combustion theory?", ["physics-textbook-gap"]],
  ["Would a droplet burn faster on the Moon than on the ISS?", ["physics-gravity-estimate"]],
  ["Does adding physics theory improve the burning rate model?", ["physics-no-accuracy-gain"]],
  ["Does the burning rate model agree with theory when helium is added?", ["physics-direction"]],
  ["What is the unit of the burning rate in the FLEX data?", ["flex-br-unit"]],
  ["How many FLEX runs were used to train the models?", ["flex-model-data"]],
  ["What is dark matter?", []],
  ["What did SAME find about smoke particles?", []],
  ["How does water mist put out fires?", []],
  ["What is the Burning Rate Emulator?", []],
  ["How does the BRE burner imitate solid fuels?", []],
];

describe("data facts", () => {
  it("every fact has a statement, a dataset and numbers that appear in its statement", () => {
    for (const f of facts) {
      expect(f.statement && f.dataset && f.source, f.id).toBeTruthy();
      for (const n of f.numbers) expect(f.statement, f.id).toContain(n);
    }
  });
  it.each(CASES)("%s", (q, expected) => {
    const got = findFacts(facts, q).map((f) => f.id);
    if (!expected.length) expect(got).toEqual([]);
    else expect(expected).toContain(got[0]);
  });
});

describe("dashboard ranking facts only for ranking questions", () => {
  const ids = (q: string) => findFacts(facts as DataFact[], q).map((f) => f.id);
  it("a topic question gets no ranking facts", () => {
    expect(ids("What is a cool flame?").some((id) => id.startsWith("dash-"))).toBe(false);
  });
  it("'ranks highest for ISS' gets the ISS number one only", () => {
    expect(ids("Which experiment ranks highest for ISS on the dashboard?")).toEqual(["dash-rank-PSI-69-iss"]);
  });
  it("'lowest on the Moon' gets the last-ranked Moon Base entry", () => {
    const got = ids("Which experiment ranks lowest for the Moon base?");
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((id) => id.startsWith("dash-") && id.endsWith("-moon"))).toBe(true);
  });
});

it("a dashboard ranking question gets ranking facts only", () => {
  expect(findFacts(facts as DataFact[], "Which experiment ranks highest for ISS?").map((f) => f.id)).toEqual(["dash-rank-PSI-69-iss"]);
});
