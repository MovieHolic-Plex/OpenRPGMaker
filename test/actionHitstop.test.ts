import { describe, expect, it } from "vitest";
import { consumeHitstop } from "@/battle/action/hitstop";

describe("consumeHitstop", () => {
  it("does not skip the update when no hitstop remains", () => {
    const result = consumeHitstop(0, 16);
    expect(result.skipUpdate).toBe(false);
    expect(result.nextRemainingMs).toBe(0);
  });

  it("normalizes negative remaining time to zero without skipping", () => {
    const result = consumeHitstop(-40, 16);
    expect(result.skipUpdate).toBe(false);
    expect(result.nextRemainingMs).toBe(0);
  });

  it("consumes part of a longer hitstop and skips the frame", () => {
    const result = consumeHitstop(80, 30);
    expect(result.skipUpdate).toBe(true);
    expect(result.nextRemainingMs).toBe(50);
  });

  it("clamps to zero when delta exceeds the remaining hitstop but still skips", () => {
    const result = consumeHitstop(20, 60);
    expect(result.skipUpdate).toBe(true);
    expect(result.nextRemainingMs).toBe(0);
  });

  it("keeps the full remaining time when the frame delta is zero", () => {
    const result = consumeHitstop(60, 0);
    expect(result.skipUpdate).toBe(true);
    expect(result.nextRemainingMs).toBe(60);
  });
});
