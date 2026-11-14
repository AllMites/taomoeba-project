import { beforeEach, expect, it, vi } from "vitest";
import { issAirNow, loadIssAir, resetIssAir } from "./iss.ts";

const ok = { items: [{ id: "iss", label: "ISS", o2Percent: 21, pressureKPa: 101.3, note: "" }] };

beforeEach(() => resetIssAir());

it("tries again after a failed load instead of keeping Not on record for the whole visit", async () => {
  const fetchFn = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => ok }) as unknown as typeof fetch;
  expect(await loadIssAir("/h.json", fetchFn)).toBeUndefined();
  expect((await loadIssAir("/h.json", fetchFn))?.o2Percent).toBe(21);
  expect(issAirNow()?.pressureKPa).toBe(101.3);
});

it("fetches once when it succeeds", async () => {
  const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ok }) as unknown as typeof fetch;
  await Promise.all([loadIssAir("/h.json", fetchFn), loadIssAir("/h.json", fetchFn)]);
  await loadIssAir("/h.json", fetchFn);
  expect(fetchFn).toHaveBeenCalledTimes(1);
});
