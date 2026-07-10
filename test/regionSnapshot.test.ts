import { describe, expect, it } from "vitest";
import { eventsInRegion, regionSnapshotScale } from "@/editor/regionSnapshot";
import type { GameMap } from "@/project/types";

describe("regionSnapshotScale", () => {
  it("영역 픽셀 폭을 목표 폭에 맞춰 축소하되 최대 2배·최소 1/16로 클램프", () => {
    expect(regionSnapshotScale(70, 140)).toBe(2); // 작은 영역은 2배 상한
    expect(regionSnapshotScale(280, 140)).toBe(0.5);
    expect(regionSnapshotScale(140 * 32, 140)).toBe(0.0625); // 거대 영역 하한(1/16 = 타일 16px 기준 1px/타일)
    expect(regionSnapshotScale(0, 140)).toBe(1); // 비정상 입력 방어
  });
});

describe("eventsInRegion", () => {
  const map = {
    width: 10, height: 10,
    events: [
      { id: "a", x: 2, y: 2 },
      { id: "b", x: 5, y: 5 },
      { id: "c", x: 9, y: 9 },
    ],
  } as unknown as GameMap;
  it("영역 안 이벤트만 반환", () => {
    const inside = eventsInRegion(map, { x: 2, y: 2, width: 4, height: 4 });
    expect(inside.map((event) => event.id)).toEqual(["a", "b"]);
  });
});
