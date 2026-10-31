import { describe, expect, it } from "vitest";
import { claudeTurnCost } from "../scripts/lib/localCliAgent/claude";

describe("claudeTurnCost", () => {
  it("reports only this turn's share of Claude Code's cumulative total_cost_usd", () => {
    // Two turns in one process: Claude Code reports 0.0149 then 0.0251 (cumulative).
    let reported = 0;
    const turns = [0.0149, 0.0251].map((total) => { const c = claudeTurnCost(total, reported); reported = total; return c; });
    expect(turns[0]).toBeCloseTo(0.0149, 6);
    expect(turns[1]).toBeCloseTo(0.0102, 6);
    expect(turns[0]! + turns[1]!).toBeCloseTo(0.0251, 6);
  });
  it("never goes negative", () => {
    expect(claudeTurnCost(0.01, 0.02)).toBe(0);
  });
});
