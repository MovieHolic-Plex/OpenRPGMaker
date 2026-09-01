import { describe, expect, it } from "vitest";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { defaultTileset } from "@/project/defaults/defaultAssets";

describe("buildGroupSample — 역할별 샘플 모양 (특성화)", () => {
  it("wall 은 문법이 없어도 나인슬라이스 크기로 나온다", () => {
    const sample = buildGroupSample(defaultTileset(), {
      role: "wall",
      tileIds: [15, 16, 17, 45, 46, 47, 75, 76, 77],
    });
    expect(sample.w).toBe(3);
    expect(sample.h).toBe(3);
  });

  it("문법 없는 prop 은 정확히 2타일일 때만 세로 쌍이다", () => {
    const tileset = defaultTileset();
    // verticalSample 은 침엽수 3그루를 한 칸씩 띄워 늘어놓는다 → 5x2.
    const pair = buildGroupSample(tileset, { role: "prop", tileIds: [262, 292] });
    expect(pair.w).toBe(5);
    expect(pair.h).toBe(2);

    // 3개 이상은 세로로 묶지 않는다 (소품 가방 방어, groupSampleBuilder.ts:58 주석).
    // fallbackSample 로 떨어져 한 줄(h=1)이 된다 — 세로 쌍이면 h=2 가 됐을 것이다.
    const bag = buildGroupSample(tileset, { role: "prop", tileIds: [262, 292, 289] });
    expect(bag.w).toBe(3);
    expect(bag.h).toBe(1);
  });

  it("roof 는 전용 샘플 경로를 탄다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "roof", tileIds: [404, 405] });
    expect(sample.w).toBeGreaterThan(0);
    expect(sample.h).toBeGreaterThan(0);
  });
});

describe("buildGroupSample — 레이어·배경 (특성화)", () => {
  it("prop 타일은 상위 레이어에 놓인다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "prop", tileIds: [289] });
    const placedUpper = sample.upper.some((tile) => tile === 289);
    expect(placedUpper).toBe(true);
  });

  it("prop 샘플은 배경에 잔디가 깔린다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "prop", tileIds: [289] });
    // backdropTile 이 defaultGrassTile 을 깔면 lower 에 잔디가 있다.
    expect(sample.lower.some((tile) => tile >= 0)).toBe(true);
  });

  it("terrain 샘플은 배경을 깔지 않는다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "terrain", tileIds: [303] });
    expect(sample.upper.every((tile) => tile < 0)).toBe(true);
  });
});
