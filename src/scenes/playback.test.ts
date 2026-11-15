import { beforeEach, describe, expect, it } from "vitest";
import { usePlayback } from "./playback.ts";

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
