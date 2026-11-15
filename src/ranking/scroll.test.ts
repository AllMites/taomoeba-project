import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { centredScrollTop } from "./scroll.ts";

it("a lit card is centred in its own list, within the list's range", () => {
  const list = { scrollTop: 100, scrollHeight: 2000, clientHeight: 600, top: 150 };
  expect(centredScrollTop(list, { top: 950, height: 200 })).toBe(100 + 800 - 200);
  expect(centredScrollTop(list, { top: 160, height: 200 })).toBe(0);
  expect(centredScrollTop(list, { top: 3000, height: 200 })).toBe(1400);
});

it("the ranking never calls scrollIntoView, which also scrolls the console around the Rank sheet", () => {
  // Show (lit cards) moved the whole console up 88px at 1440x900.
  const src = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
  expect(src).not.toMatch(/\.scrollIntoView\(/);
  expect(src).toMatch(/revealInList\(/);
});
