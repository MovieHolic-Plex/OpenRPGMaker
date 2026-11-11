// 명세 은행 대조(scripts/qa/assistant-v2/specBank/metrics.mts) — 분모만 바뀐 줄을 나빠짐·좋아짐으로 치지 않는다.
// 2026-11-11 #4617 대조: 건물이 346 → 232 로 줄자 «눌러도 반응 없는 입구 110/379 → 108/263» 이 수는 줄었는데 나빠짐으로 찍혔다.
import { describe, expect, it } from "vitest";
import { denominatorOnly, diffReport, direction, showRate, type GameMetrics } from "../scripts/qa/assistant-v2/specBank/metrics.mts";

describe("spec bank diff — a rate that moved only because the denominator changed is not worse or better", () => {
  it("lower-is-better: fewer bad cases over a smaller total is not worse", () => {
    expect(direction("entrancesSilent", [110, 379], [108, 263])).toBe(0);
    expect(denominatorOnly("entrancesSilent", [110, 379], [108, 263])).toBe(true);
    expect(direction("gateWrongPrereq", [1, 232], [1, 218])).toBe(0);
  });
  it("lower-is-better: more bad cases at a worse rate is worse, fewer at a better rate is better", () => {
    expect(direction("foeStaysAfterWin", [0, 12], [3, 12])).toBe(-1);
    expect(direction("foeStaysAfterWin", [11, 12], [0, 12])).toBe(1);
    expect(direction("gateWrongPrereq", [3, 52], [0, 82])).toBe(1);
  });
  it("higher-is-better: fewer good cases with the same bad count is not worse; new bad cases are worse; fewer bad cases are better", () => {
    // 잠김 한 줄 244/250 → 123/129: 건물이 줄어 좋은 쪽도 줄었지만 나쁜 쪽은 6 그대로다.
    expect(direction("lockedOnEntrance", [244, 250], [123, 129])).toBe(0);
    expect(denominatorOnly("lockedOnEntrance", [244, 250], [123, 129])).toBe(true);
    expect(direction("exitsOnRoad", [40, 43], [40, 50])).toBe(-1);
    expect(direction("exitsOnRoad", [10, 43], [10, 30])).toBe(1);
    expect(direction("exitsOnRoad", [10, 43], [40, 43])).toBe(1);
    expect(direction("purposeEnterable", [14, 346], [20, 232])).toBe(1);
  });
  it("a side without a denominator is compared by counts", () => {
    expect(direction("exitsFullWidth", [0, 0], [2, 2])).toBe(1);
    expect(direction("exitsFullWidth", [0, 0], [0, 3])).toBe(-1);
    expect(direction("exitsFullWidth", [0, 0], [0, 0])).toBe(0);
  });
  it("a move inside 0.1 percentage point is the same; plain counts compare as before", () => {
    expect(direction("arrowWalkUnreached", [500, 1759], [523, 1844])).toBe(0);
    expect(direction("shipBlockers", 13, 20)).toBe(-1);
    expect(direction("shipBlockers", 20, 13)).toBe(1);
    expect(direction("maps", 100, 106)).toBe(0);
  });
  it("shows the count with its rate, and only where the cell is a share", () => {
    expect(showRate([108, 263])).toBe("108/263(41.1%)");
    expect(showRate([8, 10])).toBe("8/10(80%)");
    expect(showRate([59714, 106])).toBe("59714/106");
    expect(showRate([0, 0])).toBe("0/0");
    expect(showRate(13)).toBe("13");
  });
  it("the report names a game only when it really got worse and marks denominator-only lines", () => {
    const game = (id: string, values: GameMetrics["values"]): GameMetrics => ({ id, kind: "game", values, lines: {}, probeErrors: [] });
    const report = diffReport(
      [game("desert", { entrancesSilent: [1, 61], shipBlockers: 0 }), game("snow", { entrancesSilent: [109, 318], shipBlockers: 1 })],
      [game("desert", { entrancesSilent: [0, 16], shipBlockers: 5 }), game("snow", { entrancesSilent: [108, 247], shipBlockers: 1 })],
      "a", "b",
    );
    const silent = report.rows.find((row) => row.key === "entrancesSilent")!;
    expect(silent.dir).toBe(0);
    expect(silent.denominatorOnly).toBe(true);
    expect(silent.worseGames).toEqual([]);
    expect(report.rows.find((row) => row.key === "shipBlockers")!.worseGames).toEqual(["desert(0→5)"]);
    expect(report.text).toContain("(분모만 바뀜)");
  });
});
