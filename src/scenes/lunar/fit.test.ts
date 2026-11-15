import { describe, expect, it } from "vitest";
import { fitBox, monoGrey } from "./fit.ts";

const apply = (p: [number, number, number], f: ReturnType<typeof fitBox>) => p.map((v, i) => v * f.scale + f.offset[i]);

describe("fit a model by its bounding box", () => {
  it("centres the box and scales its longest side to the span (iss.glb's off-centre pivot)", () => {
    const box = { min: [-11.1, -4.2, -22.9], max: [3.3, 41.3, 22.7] } as const;
    const f = fitBox(box, 30);
    expect(f.scale).toBeCloseTo(30 / 45.6, 6);
    const lo = apply([...box.min], f);
    const hi = apply([...box.max], f);
    for (let i = 0; i < 3; i++) expect(lo[i] + hi[i]).toBeCloseTo(0, 6);
    expect(Math.max(...hi.map((v, i) => v - lo[i]))).toBeCloseTo(30, 6);
  });

  it("gives two models of different scale the same size", () => {
    const small = fitBox({ min: [0, 0, 0], max: [0.7, 0.3, 0.5] }, 30);
    const big = fitBox({ min: [-50, -20, -10], max: [60, 20, 10] }, 30);
    expect(0.7 * small.scale).toBeCloseTo(30, 6);
    expect(110 * big.scale).toBeCloseTo(30, 6);
  });

  it("can size by one side: both files by their truss, so the swap keeps the truss in place", () => {
    const f = fitBox({ min: [-10, -40, -2], max: [10, 40, 2] }, 30, 0);
    expect(f.scale).toBeCloseTo(1.5, 6);
    expect(f.offset).toEqual([-0, -0, -0]);
  });

  it("leaves an empty box alone", () => {
    expect(fitBox({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }, 30)).toEqual({ scale: 1, offset: [0, 0, 0] });
  });
});

describe("mono materials", () => {
  it("turns the blue solar panels into a dark grey and keeps greys as they are", () => {
    expect(monoGrey(0.07, 0.04, 0.47)).toBeCloseTo(0.255, 3);
    expect(monoGrey(0.4, 0.4, 0.4)).toBe(0.4);
    expect(monoGrey(0, 0, 0)).toBe(0.12);
    expect(monoGrey(1, 1, 1)).toBe(0.5);
  });
});
