import { beforeEach, describe, expect, it } from "vitest";
import { stageView, usePlayback } from "./playback.ts";

const initial = usePlayback.getState();
beforeEach(() => usePlayback.setState(initial, true));

describe("navigation state", () => {
  it("the first drag or key stops the drift for good; Reset view gives the camera back but keeps the drift off", () => {
    const s = usePlayback.getState;
    expect(s()).toMatchObject({ drifted: false, steered: false, resetN: 0 });
    s().push(0.2, 0, 1);
    expect(s()).toMatchObject({ drifted: true, steered: true, nudge: { orbit: 0.2, n: 1 } });
    s().resetView();
    expect(s()).toMatchObject({ drifted: true, steered: false, resetN: 1 });
    s().steer();
    expect(s().steered).toBe(true);
  });
});

describe("the scene is live when its canvas has drawn, whatever the input", () => {
  it("shows the scene only once loaded and drawn; before that the poster, or a loading card where there is none", () => {
    expect(stageView({ loaded: true, live: true })).toBe("scene");
    expect(stageView({ loaded: true, live: false, poster: "/p.webp" })).toBe("poster");
    expect(stageView({ loaded: false, live: false })).toBe("loading");
    expect(stageView({ loaded: false, live: true })).toBe("loading");
  });

  it("a drawn frame sets it, with no pointer event; the scene going away clears it", () => {
    expect(usePlayback.getState().live).toBe(false);
    usePlayback.getState().setLive(true);
    expect(usePlayback.getState().live).toBe(true);
    usePlayback.getState().setLive(false);
    expect(usePlayback.getState().live).toBe(false);
  });
});
