import { describe, expect, it } from "vitest";
import { decideWindowClose, nextQuitHeld, shouldRetryQuit } from "../electron/main/closeFlow";

describe("window close while a project save is in progress", () => {
  it("starts a save only when a project is open and a close is not already waiting", () => {
    expect(decideWindowClose(false, false)).toBe("allow");
    expect(decideWindowClose(false, true)).toBe("flush");
    expect(decideWindowClose(true, true)).toBe("hold");
    expect(decideWindowClose(true, false)).toBe("hold");
  });

  it("remembers that Quit was cancelled because a save held the window", () => {
    expect(nextQuitHeld(false, true, "allow")).toBe(false);
    expect(nextQuitHeld(false, true, "flush")).toBe(true);
    expect(nextQuitHeld(false, true, "hold")).toBe(true);
    expect(nextQuitHeld(false, false, "flush")).toBe(false);
    expect(nextQuitHeld(true, false, "flush")).toBe(true);
    expect(nextQuitHeld(true, false, "allow")).toBe(true);
  });

  it("retries Quit only after every held save has finished", () => {
    const base = { quitRequested: true, quitHeld: true, windowsStillFlushing: 0 };
    expect(shouldRetryQuit(base)).toBe(true);
    expect(shouldRetryQuit({ ...base, windowsStillFlushing: 1 })).toBe(false);
    expect(shouldRetryQuit({ ...base, quitHeld: false })).toBe(false);
    expect(shouldRetryQuit({ ...base, quitRequested: false })).toBe(false);
  });

  it("keeps a two-window Quit waiting until the second save finishes", () => {
    let held = nextQuitHeld(false, true, "flush");
    held = nextQuitHeld(held, true, "flush");
    expect(shouldRetryQuit({ quitRequested: true, quitHeld: held, windowsStillFlushing: 1 })).toBe(false);
    expect(shouldRetryQuit({ quitRequested: true, quitHeld: held, windowsStillFlushing: 0 })).toBe(true);
  });
});
