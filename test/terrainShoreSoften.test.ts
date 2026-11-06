import { describe, expect, it } from "vitest";
import { landRectCells, softenShore } from "@/editor/terrainLandBrush";

const map = { width: 20, height: 15 };

describe("호수 모서리 다듬기", () => {
  it("8×5 사각형 호수는 네 모서리 칸을 빼고 가운데는 남긴다", () => {
    const rect = landRectCells(map, { x: 1, y: 1 }, { x: 8, y: 5 });
    const kept = new Set(softenShore(map, rect));
    for (const [x, y] of [[1, 1], [8, 1], [1, 5], [8, 5]]) expect(kept.has(y * map.width + x)).toBe(false);
    expect(kept.has(3 * map.width + 4)).toBe(true);
    expect(kept.size).toBeGreaterThan(rect.length * 0.8);
  });

  it("작은 사각형(3×3)은 그대로 둔다", () => {
    const rect = landRectCells(map, { x: 1, y: 1 }, { x: 3, y: 3 });
    expect(softenShore(map, rect)).toEqual(rect);
  });
});
