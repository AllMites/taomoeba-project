import { expect, it } from "vitest";
import { heroReturnFocus } from "./focus.ts";

const radio = { id: "", tag: "checked radio" } as unknown as HTMLElement;
const docWith = (activeId: string | null) =>
  ({
    activeElement: activeId === null ? null : ({ id: activeId } as Element),
    querySelector: (sel: string) => (sel === '.picker input[name="habitat"]:checked' ? radio : null),
  }) as unknown as Pick<Document, "activeElement" | "querySelector">;

it("moves focus from the sticky select to the hero's checked radio when the bar goes away", () => {
  expect(heroReturnFocus(docWith("sticky-habitat"))).toBe(radio);
});

it("leaves focus alone when it is anywhere else", () => {
  expect(heroReturnFocus(docWith("ask-q"))).toBeNull();
  expect(heroReturnFocus(docWith(null))).toBeNull();
});
