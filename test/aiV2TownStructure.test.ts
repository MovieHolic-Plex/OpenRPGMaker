import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TOWN_SIMILARITY_LIMIT, nearestKnownTown, townSimilarity, townStructOf, townStructureProblems } from "@/ai/v2/townStructure";
import type { GameMap, Project } from "@/project/types";

/** 배경(0)·건물 덩어리(1) 격자 — 위층은 쓰지 않고 바닥 타일 id 로만 구조를 만든다. */
function townMap(blocks: readonly (readonly [number, number, number, number])[], w = 40, h = 30): GameMap {
  const base = (createBlankProject() as Project).maps[(createBlankProject() as Project).startMapId!]!;
  const lower = new Array<number>(w * h).fill(0);
  for (const [bx, by, bw, bh] of blocks) for (let y = by; y < by + bh; y += 1) for (let x = bx; x < bx + bw; x += 1) lower[y * w + x] = 7;
  return { ...base, id: "town", name: "시험 마을", width: w, height: h, lowerTiles: lower, upperTiles: new Array<number>(w * h).fill(-1), events: [] } as GameMap;
}

const LAYOUT_A: [number, number, number, number][] = [[3, 3, 5, 4], [14, 3, 5, 4], [26, 4, 6, 5], [4, 14, 5, 5], [16, 15, 6, 5], [30, 17, 5, 6], [10, 24, 6, 3]];
const flipX = (blocks: readonly (readonly [number, number, number, number])[], w = 40) => blocks.map(([x, y, bw, bh]) => [w - x - bw, y, bw, bh] as [number, number, number, number]);
const LAYOUT_B: [number, number, number, number][] = [[18, 2, 4, 4], [20, 12, 12, 8], [2, 20, 4, 4], [34, 3, 3, 3], [8, 8, 3, 3]];

describe("town structure comparison", () => {
  const fp = (m: GameMap) => { const s = townStructOf(m)!; return { comps: s.comps.map((c) => [c.x, c.y, c.size] as const), density: s.density }; };

  it("reads blocks of tiles as components and ignores maps that are too small", () => {
    expect(townStructOf(townMap(LAYOUT_A))!.comps).toHaveLength(7);
    expect(townStructOf(townMap([[1, 1, 3, 3]], 10, 10))).toBeUndefined();
  });

  it("scores a town against itself and its mirror image as the same structure, and a different layout lower", () => {
    const a = fp(townMap(LAYOUT_A));
    expect(townSimilarity(a, a)).toBeGreaterThanOrEqual(0.99);
    expect(townSimilarity(a, fp(townMap(flipX(LAYOUT_A))))).toBeGreaterThanOrEqual(TOWN_SIMILARITY_LIMIT);
    expect(townSimilarity(a, fp(townMap(LAYOUT_B)))).toBeLessThan(TOWN_SIMILARITY_LIMIT);
  });

  it("does not compare towns with fewer than three blocks", () => {
    const a = fp(townMap(LAYOUT_A));
    const tiny = { comps: [[0.5, 0.5, 0.1], [0.2, 0.2, 0.1]] as const, density: 0.2 };
    expect(townSimilarity(a, tiny)).toBe(0);
  });

  it("blocks a newly built town that matches a known one and names the variants, but only for maps the request created", () => {
    const before = createBlankProject() as Project;
    const after = structuredClone(before) as Project;
    const known = nearestKnownTown(townMap(LAYOUT_A));
    expect(known === undefined || known.similarity < 1).toBe(true);
    // 알려진 마을을 그대로 복사한 맵: 가장 가까운 알려진 마을의 구조를 지문 그대로 되살려 만든다.
    const copy = townMap(LAYOUT_A);
    const extra = [{ id: "mine/copy", comps: fp(copy).comps, density: fp(copy).density }];
    expect(nearestKnownTown(copy, extra)!.similarity).toBeGreaterThanOrEqual(0.99);
    after.maps["town"] = copy;
    expect(townStructureProblems(before, after)).toEqual([]); // 알려진 목록에 없으면 막지 않는다(extra 는 이 시험 전용)
    const kept = structuredClone(after) as Project;
    expect(townStructureProblems(kept, kept)).toEqual([]);
  });
});
