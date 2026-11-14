import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { frameAt, loopSpan, midBurn, spreadCmS, statusLine, type SaffireRecord } from "./timeline.ts";

const rec = JSON.parse(readFileSync(new URL("../../../public/data/scenes/saffire.json", import.meta.url), "utf8")) as SaffireRecord;
const runs = JSON.parse(readFileSync(new URL("../../../public/data/runs/PSI-99.json", import.meta.url), "utf8")) as {
  rows: Record<string, unknown>[];
};

describe("saffire.json holds only numbers on record", () => {
  const row = runs.rows.find((r) => r.sample_number === rec.run.sample)!;
  const num = (v: unknown) => Number.parseFloat(String(v));
  it("matches the PSI-99 run table row for its sample", () => {
    expect(row).toBeDefined();
    expect(row.material).toBe(rec.run.material);
    expect(row.flow_direction).toBe(rec.run.flowDirection);
    expect(num(row.o2_percent)).toBe(rec.values.o2Percent.value);
    expect(num(row.airflow_cm_s)).toBe(rec.values.airflowCmS.value);
    expect(num(row.sample_length)).toBe(rec.values.sampleLengthCm.value);
    expect(num(row.sample_width_cm)).toBe(rec.values.sampleWidthCm.value);
    expect(num(row.microgravity_spread_length)).toBe(rec.values.spreadRateMmS.value);
    expect(num(row.microgravity_burn_length)).toBe(rec.values.burnLengthCm.value);
    expect(num(row.burn_time_s)).toBe(rec.values.burnTimeS.value);
    expect(num(row.ignition_power_w)).toBe(rec.values.ignitionPowerW.value);
    expect(num(row.ignition_time_s)).toBe(rec.values.ignitionTimeS.value);
  });

  it("every value names its source, or is null with a stated default", () => {
    for (const v of Object.values(rec.values)) {
      if (v.value == null) {
        expect(v.source).toBeNull();
        expect(typeof v.default).toBe("number");
      } else {
        expect(v.source).toBe("psi:PSI-99");
      }
    }
  });

  it("lists the card samples as the run table does", () => {
    expect(rec.card.samples.map((s) => s.sample)).toEqual(runs.rows.map((r) => r.sample_number));
    for (const s of rec.card.samples) {
      const r = runs.rows.find((x) => x.sample_number === s.sample)!;
      expect(s.material).toBe(r.material);
      expect(s.microgravityBurnLength).toBe(r.microgravity_burn_length);
    }
  });
});

describe("replay timeline", () => {
  it("moves the front at the recorded spread rate, 2.1 mm/s", () => {
    expect(spreadCmS(rec)).toBeCloseTo(0.21);
    expect(frameAt(rec, 0).frontCm).toBe(0);
    expect(frameAt(rec, 100).frontCm).toBeCloseTo(21);
  });

  it("never passes the recorded burn length, 29 cm", () => {
    expect(frameAt(rec, 140).frontCm).toBe(29);
    expect(frameAt(rec, 999).frontCm).toBe(29);
  });

  it("is igniting for the recorded 9.2 s before the burn clock starts", () => {
    expect(loopSpan(rec).start).toBeCloseTo(-9.2);
    expect(frameAt(rec, -5).phase).toBe("igniting");
    expect(frameAt(rec, -5).intensity).toBe(0);
  });

  it("burns at full strength mid-burn and is out at the recorded 145 s", () => {
    const mid = frameAt(rec, midBurn(rec));
    expect(midBurn(rec)).toBe(72.5);
    expect(mid.phase).toBe("burning");
    expect(mid.intensity).toBe(1);
    expect(mid.frontCm).toBeCloseTo(15.225);
    expect(frameAt(rec, 145).phase).toBe("out");
    expect(frameAt(rec, 145).intensity).toBe(0);
    expect(frameAt(rec, 142).intensity).toBeGreaterThan(0);
    expect(frameAt(rec, 142).intensity).toBeLessThan(1);
  });
});

describe("status line", () => {
  it("says mid-burn only when the frame on screen is mid-burn", () => {
    expect(statusLine(rec, frameAt(rec, midBurn(rec)), false)).toBe("Still frame, mid-burn");
    // After "Play once" ends, the clock sits at the end of the loop: the strip is burnt out.
    expect(statusLine(rec, frameAt(rec, loopSpan(rec).end), false)).toBe("Still frame, burn over");
    expect(statusLine(rec, frameAt(rec, 30), false)).toBe("Paused");
    expect(statusLine(rec, frameAt(rec, 30), true)).toBe("Replay 10× speed");
  });
});
