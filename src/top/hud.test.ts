import { describe, expect, it } from "vitest";
import { closesOnKey, closesOnPress, toggleCard, type HudCard } from "./hud.ts";

describe("HUD bar", () => {
  it("a button opens its card, again closes it, and the other button swaps (one open at a time)", () => {
    let open: HudCard | null = null;
    open = toggleCard(open, "top");
    expect(open).toBe("top");
    open = toggleCard(open, "brief");
    expect(open).toBe("brief");
    open = toggleCard(open, "brief");
    expect(open).toBeNull();
  });
  it("Esc closes only while a card is open", () => {
    expect(closesOnKey("top", "Escape")).toBe(true);
    expect(closesOnKey("brief", "Enter")).toBe(false);
    expect(closesOnKey(null, "Escape")).toBe(false);
  });
  it("a press outside the card and the bar closes; a press inside does not", () => {
    const inside = { contains: (n: unknown) => n === "in" } as unknown as Element;
    const bar = { contains: (n: unknown) => n === "bar" } as unknown as Element;
    expect(closesOnPress("top", "out" as unknown as Node, [inside, bar, null])).toBe(true);
    expect(closesOnPress("top", "in" as unknown as Node, [inside, bar])).toBe(false);
    expect(closesOnPress("top", "bar" as unknown as Node, [inside, bar])).toBe(false);
    expect(closesOnPress(null, "out" as unknown as Node, [inside])).toBe(false);
  });
});
