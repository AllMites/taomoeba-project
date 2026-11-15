import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OBJECTS } from "./spread.ts";
import {
  aftermath,
  aftermathLines,
  captionFor,
  DETECTOR,
  outcomeOf,
  QUENCH_S,
  RESPONSE_S,
  RESPONSES,
  LAYER_Y,
  responseLines,
  SMOKE_S,
  smokeAt,
  WEAK_FLOW_X,
  scenarioQuestion,
  stageAt,
  STARTS,
  story,
  storyAt,
  type StoryInput,
} from "./story.ts";

const iss: StoryInput = { g: "micro", o2: 21, start: "cloth", response: "vent" };
const moon: StoryInput = { g: "partial", o2: 30, start: "cloth", response: "vent" };
const earth: StoryInput = { g: "earth", o2: 21, start: "cloth", response: "vent" };
const all: StoryInput[] = [];
for (const g of ["micro", "partial", "earth"] as const)
  for (const o2 of [21, 30])
    for (const s of STARTS) for (const r of RESPONSES) all.push({ g, o2, start: s.id, response: r.id });

describe("fire in this base: the story", () => {
  it("has five stages in order, starting at ignition, for every scenario", () => {
    for (const s of all) {
      const st = story(s);
      expect(st.stages.map((x) => x.id)).toEqual(["ignition", "spread", "smoke", "detect", "after"]);
      for (let i = 1; i < 5; i++) expect(st.stages[i].at).toBeGreaterThan(st.stages[i - 1].at);
      expect(st.end).toBeGreaterThan(st.stages[4].at);
    }
  });

  it("smoke follows the ventilation to the detector; the crew responds after it trips", () => {
    const st = story(iss);
    expect(st.respond).toBe(st.detect + RESPONSE_S);
    expect(storyAt(st, st.detect - 0.5).tripped).toBe(false);
    expect(storyAt(st, st.detect).tripped).toBe(true);
    expect(storyAt(st, st.detect).smoke).toBeGreaterThanOrEqual(DETECTOR.x - 0.05);
  });

  it("stopping the air at 21% oxygen in orbit puts the cloth fire out a short time later (BASS-II, ACME BRE)", () => {
    const st = story(iss);
    expect(st.outcome).toBe("out");
    expect(st.out).toBeCloseTo(st.respond + QUENCH_S);
    expect(storyAt(st, st.out + 1).alive).toBe(false);
  });

  it("in richer oxygen it keeps burning without airflow (ACME BRE)", () => {
    const st = story({ ...iss, o2: 30 });
    expect(st.outcome).toBe("burns");
    expect(storyAt(st, st.respond + 30).alive).toBe(true);
  });

  it("a response the records do not settle is never drawn as a clean success", () => {
    expect(outcomeOf(moon)).toBe("weaker");
    expect(outcomeOf({ ...iss, response: "co2" })).toBe("weaker");
    expect(outcomeOf({ ...iss, start: "checklist" })).toBe("weaker");
    for (const s of all) {
      const st = story(s);
      if (st.outcome !== "weaker") continue;
      expect(storyAt(st, st.respond + 5).alive).toBe(true);
      expect(storyAt(st, st.respond + 5).strength).toBeLessThan(1);
      expect(responseLines(st).unknown).toMatch(/[Nn]ot tested/);
      expect(captionFor(st, "detect", "x").text).toMatch(/Not tested/);
    }
  });

  it("only one case is drawn as put out: the tested fabric, still air, 21% oxygen, in orbit", () => {
    const outs = all.filter((s) => story(s).outcome === "out");
    expect(outs).toEqual([{ g: "micro", o2: 21, start: "cloth", response: "vent" }]);
  });

  it("the spread path depends on the start point and never crosses what does not burn", () => {
    for (const { id } of STARTS) {
      const st = story({ ...moon, start: id, response: "none" });
      const at = storyAt(st, st.end);
      expect(at.burnt[id]).not.toBeNull();
      for (const o of OBJECTS.filter((x) => !x.burns("partial"))) expect(at.burnt[o.id]).toBeNull();
    }
    expect(storyAt(story({ ...moon, start: "cloth" }), 20).lo).not.toBe(storyAt(story({ ...moon, start: "foam" }), 20).lo);
  });

  it("burnt, sooted and untouched add up, and a burnt object is never counted as only sooted", () => {
    for (const s of all) {
      const st = story(s);
      const n = aftermath(st);
      expect(n.burned + n.sooted + n.untouched).toBe(OBJECTS.length);
      const at = storyAt(st, st.end);
      for (const id of at.sooted) expect(at.burnt[id]).toBeNull();
    }
  });

  it("the aftermath says what the response did, what is untested, and that there is no structural test", () => {
    const lines = aftermathLines(story(iss));
    expect(lines.join(" ")).toMatch(/Stop the ventilation: the flame went out/);
    expect(lines.at(-1)).toMatch(/no test of damage to a habitat's structure/);
  });

  it("the scenario is one question for Ask SI", () => {
    expect(scenarioQuestion(story(iss), "ISS")).toMatch(/^If a fire starts on the cloth near the air vent in the ISS at 21% oxygen.*stop the ventilation\?$/);
  });

  it("stage 1 asks what if a fire starts here, with the base name; stages are found by time", () => {
    const st = story(iss);
    expect(captionFor(st, "ignition", "Moon Base").text).toMatch(/^What if a fire starts here, in the Moon Base\?/);
    expect(stageAt(st, 0).id).toBe("ignition");
    expect(stageAt(st, st.detect).id).toBe("detect");
    expect(stageAt(st, st.end).id).toBe("after");
  });

  it("the Moon is labelled an estimate", () => {
    expect(captionFor(story(moon), "smoke", "Moon Base").text).toMatch(/Estimate: no fire test has run in Moon gravity/);
    expect(story(earth).outcome).toBe("burns");
  });
});

describe("captions: a record where one supports them, the word Illustration where none does", () => {
  const facts = new Set((JSON.parse(readFileSync("public/data/facts.json", "utf8")) as { id: string }[]).map((f) => f.id));
  const claims = new Set((JSON.parse(readFileSync("public/data/claims.json", "utf8")) as { items: { id: string }[] }).items.map((c) => c.id));
  const samples = new Set(
    (JSON.parse(readFileSync("public/data/solids.json", "utf8")) as { saffire: { samples: { sample: string }[] } }).saffire.samples.map((s) => s.sample),
  );
  const known = (ref: string) => {
    const i = ref.indexOf(":");
    const kind = ref.slice(0, i);
    const id = ref.slice(i + 1);
    if (kind === "fact") return facts.has(id);
    if (kind === "claim") return claims.has(id);
    if (kind === "solids") return samples.has(id.replace(/^sample:/, ""));
    return false;
  };
  it("every caption and evidence line cites a record that exists, or says Illustration", () => {
    for (const s of all) {
      const st = story(s);
      for (const c of [...st.stages.map((x) => captionFor(st, x.id, "the cabin")), responseLines(st).evidence]) {
        for (const r of c.refs) expect(known(r), r).toBe(true);
        if (!c.refs.length) expect(c.text).toMatch(/[Ii]llustrat/);
      }
    }
  });
});

describe("smoke in the air (15.9)", () => {
  it("none before smoke leaves the fire; in orbit it reaches the detector along the bench without rising", () => {
    const st = story(iss);
    expect(smokeAt(st, SMOKE_S - 0.5)).toEqual([]);
    const at = smokeAt(st, st.detect);
    expect(Math.max(...at.map((p) => p.x))).toBeGreaterThan(DETECTOR.x - 0.1);
    expect(Math.max(...at.map((p) => p.y))).toBeLessThan(0.2);
  });
  it("gathers where the flow is weak: puffs against the locker are denser than mid-bench", () => {
    const st = story(iss);
    const at = smokeAt(st, st.detect);
    const weak = at.filter((p) => p.x >= WEAK_FLOW_X);
    const mid = at.filter((p) => p.x > st.xs + 0.3 && p.x < WEAK_FLOW_X - 0.3);
    expect(weak.length).toBeGreaterThan(0);
    expect(Math.min(...weak.map((p) => p.o))).toBeGreaterThan(Math.max(...mid.map((p) => p.o)));
  });
  it("at 1 g it rises to the layer under the ceiling; on the Moon it rises part way (estimate)", () => {
    const e = story(earth);
    expect(Math.max(...smokeAt(e, e.detect).map((p) => p.y))).toBeCloseTo(LAYER_Y + 0.04, 1);
    const m = story(moon);
    const ym = Math.max(...smokeAt(m, m.detect).map((p) => p.y));
    expect(ym).toBeGreaterThan(0.2);
    expect(ym).toBeLessThan(LAYER_Y);
  });
});
