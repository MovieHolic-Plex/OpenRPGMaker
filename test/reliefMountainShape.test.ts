// 지형 리뷰 F6: 산이 같은 간격의 동심 팔각 고리(등고선)로 나왔다. 고리 반지름이 방향마다 달라야 한다.
import { describe, expect, it } from "vitest";
import { buildReliefOps } from "@/project/relief/ops";

function ringSpread(h: number[][], cx: number, cy: number, level: number): number {
  const radii: number[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    let r = 0;
    for (let t = 0; t < 30; t += 0.5) {
      const x = Math.round(cx + Math.cos(a) * t), y = Math.round(cy + Math.sin(a) * t);
      if (y < 0 || x < 0 || y >= h.length || x >= h[0]!.length || h[y]![x]! < level) break;
      r = t;
    }
    radii.push(r);
  }
  return Math.max(...radii) - Math.min(...radii);
}

describe("산 모양 (sculpt_relief mountain)", () => {
  it("봉우리 높이는 그대로, 고리 반지름은 방향마다 3칸 이상 다르다", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const base = Array.from({ length: 60 }, () => new Array<number>(60).fill(0));
      const { h } = buildReliefOps({ seed, ops: [{ op: "mountain", at: [30, 30], peak: 6, slope: 2 }] }, base);
      expect(Math.max(...h.flat())).toBe(6);
      expect(ringSpread(h, 30, 30, 2)).toBeGreaterThanOrEqual(3);
    }
  });
});
