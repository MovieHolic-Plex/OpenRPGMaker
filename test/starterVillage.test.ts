import { describe, expect, it } from "vitest";
import { createStarterMap, TILE } from "@/project/defaults";

describe("starter village map", () => {
  // 2026-10-07 저작권 정리(0d4f13e7c8): 통나무집 세 채·길 장식은 지웠다. 집 패턴·길 연결·길 타일 표본 단언은 폐기하고
  // 크기와 열린 가장자리만 지킨다.
  it("builds the default 마을 as a 30x30 map", () => {
    const m = createStarterMap();

    expect(m.name).toBe("마을");
    expect(m.width).toBe(30);
    expect(m.height).toBe(30);
    expect(m.lowerTiles.length).toBe(30 * 30);
    expect(m.upperTiles.length).toBe(30 * 30);
  });

  it("keeps the compact village boundary open grass (no wall frame)", () => {
    const m = createStarterMap();
    for (let x = 0; x < m.width; x += 1) {
      expect(m.lowerTiles[0 * m.width + x]).not.toBe(TILE.WALL);
      expect(m.lowerTiles[(m.height - 1) * m.width + x]).not.toBe(TILE.WALL);
    }
    for (let y = 0; y < m.height; y += 1) {
      expect(m.lowerTiles[y * m.width + 0]).not.toBe(TILE.WALL);
      expect(m.lowerTiles[y * m.width + (m.width - 1)]).not.toBe(TILE.WALL);
    }
  });
});
