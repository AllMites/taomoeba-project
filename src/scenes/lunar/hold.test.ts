import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hold } from "./hold.ts";

describe("hold", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps resources through a StrictMode cleanup and re-setup", () => {
    const release = vi.fn();
    const first = hold("k1", release);
    first(); // StrictMode cleanup
    const second = hold("k1", release); // StrictMode re-setup, same commit
    vi.runAllTimers();
    expect(release).not.toHaveBeenCalled();
    second(); // real unmount
    vi.runAllTimers();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("releases once even if a cleanup runs twice", () => {
    const release = vi.fn();
    const drop = hold("k2", release);
    drop();
    drop();
    vi.runAllTimers();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
