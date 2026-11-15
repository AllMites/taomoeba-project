import { beforeEach, expect, it } from "vitest";
import { askAbout, habitatOf, initialConsole, pickBase, useConsole } from "./console.ts";
import { useStore } from "./store.ts";

beforeEach(() => {
  useConsole.setState({ base: "moon", askOpen: false, askAbout: [] });
  useStore.setState({ habitat: "moon" });
});

it("Earth ranks with the ISS figures; every other base is its own habitat", () => {
  expect(habitatOf("earth")).toBe("iss");
  expect(habitatOf("rover")).toBe("rover");
});

it("picking a base moves the habitat the ranking reads", () => {
  pickBase("rover");
  expect(useStore.getState().habitat).toBe("rover");
  pickBase("earth");
  expect(useConsole.getState().base).toBe("earth");
  expect(useStore.getState().habitat).toBe("iss");
});

it("the URL sets the first state; bad values fall back; panels follow screen width unless set", () => {
  expect(initialConsole("?base=rover&view=rank&lib=1&ask=0", false)).toEqual({ base: "rover", view: "rank", leftOpen: true, askOpen: false });
  expect(initialConsole("?base=mars&view=x", true)).toEqual({ base: "moon", view: "stage", leftOpen: true, askOpen: true });
});

it("ask about an experiment opens the panel and adds it once", () => {
  askAbout("PSI-69");
  askAbout("PSI-69");
  expect(useConsole.getState()).toMatchObject({ askOpen: true, askAbout: ["PSI-69"] });
});
