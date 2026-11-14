import { describe, expect, it } from "vitest";
import { buildSet } from "./set.ts";

describe("SAFFIRE set", () => {
  it("stays inside the per-scene budget of 100k triangles", () => {
    const set = buildSet(["Silicone", "Silicone", "Silicone", "Silicone", "Cotton-Fiberglass (SIBAL)", null, "PMMA & Nomex", "PMMA", null]);
    // The flame meshes add about 4.6k (two shells, two halos at most) on top of the set.
    expect(set.triangles).toBeLessThan(95_000);
  });
});
