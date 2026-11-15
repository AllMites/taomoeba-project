import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { SpreadPanel } from "./SpreadPanel.tsx";

// A server render reads a zustand store's first state only, so the pick is handed in here.
vi.mock("../playback.ts", async (original) => ({
  ...(await original<typeof import("../playback.ts")>()),
  usePlayback: (select: (s: { picked: string }) => unknown) => select({ picked: "cloth" }),
}));

it("a picked object's card is at the top of the panel, above the list, so it is in view (P1-5)", () => {
  const html = renderToStaticMarkup(<SpreadPanel air="ISS" g="micro" doc={null} fabric={{ lives: true, test: null, beyond: false }} />);
  const card = html.indexOf('class="spread-card"');
  expect(card).toBeGreaterThan(0);
  expect(card).toBeLessThan(html.indexOf('class="spread-list"'));
});
