import { describe, expect, it } from "vitest";
import {
  DIRECTION_REPEAT_DELAY_MS,
  DIRECTION_REPEAT_INTERVAL_MS,
  HeldDirectionRepeat,
} from "@/player/heldDirectionRepeat";

describe("held direction repeat", () => {
  it("waits out the delay, then repeats, and starts over when the direction changes", () => {
    const repeat = new HeldDirectionRepeat();
    const start = 10_000;

    expect(repeat.tick(["ArrowDown", "Enter", "Shift"], start)).toEqual([]);
    expect(repeat.tick(["ArrowDown"], start + DIRECTION_REPEAT_DELAY_MS - 1)).toEqual([]);
    expect(repeat.tick(["ArrowDown"], start + DIRECTION_REPEAT_DELAY_MS)).toEqual(["ArrowDown"]);
    expect(repeat.tick(["ArrowDown"], start + DIRECTION_REPEAT_DELAY_MS + DIRECTION_REPEAT_INTERVAL_MS - 1)).toEqual([]);
    expect(repeat.tick(["ArrowDown"], start + DIRECTION_REPEAT_DELAY_MS + DIRECTION_REPEAT_INTERVAL_MS)).toEqual(["ArrowDown"]);

    const changedAt = start + 2_000;
    expect(repeat.tick(["ArrowUp"], changedAt)).toEqual([]);
    expect(repeat.tick(["ArrowUp"], changedAt + DIRECTION_REPEAT_DELAY_MS - 1)).toEqual([]);
    expect(repeat.tick(["ArrowUp"], changedAt + DIRECTION_REPEAT_DELAY_MS)).toEqual(["ArrowUp"]);
  });

  it("forgets a direction that was released", () => {
    const repeat = new HeldDirectionRepeat();
    repeat.tick(["ArrowLeft"], 0);
    repeat.tick([], 10);
    expect(repeat.tick(["ArrowLeft"], DIRECTION_REPEAT_DELAY_MS)).toEqual([]);
    expect(repeat.tick(["ArrowLeft"], DIRECTION_REPEAT_DELAY_MS + DIRECTION_REPEAT_DELAY_MS)).toEqual(["ArrowLeft"]);
  });
});