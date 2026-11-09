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

  it("does not compare towns with fewer than four blocks, and ignores a block that is most of the map", () => {
    const a = fp(townMap(LAYOUT_A));
    const tiny = { comps: [[0.5, 0.5, 0.1], [0.2, 0.2, 0.1], [0.7, 0.3, 0.1]] as const, density: 0.2 };
    expect(townSimilarity(a, tiny)).toBe(0);
    expect(townStructOf(townMap([[0, 0, 30, 20], ...LAYOUT_A]))!.comps.some((c) => c.size > 0.4)).toBe(false);
  });

  it("does not call two layouts the same when block sizes differ", () => {
    const small = fp(townMap([[3, 3, 3, 3], [14, 3, 3, 3], [26, 4, 3, 3], [4, 14, 3, 3], [16, 15, 3, 3]]));
    const big = fp(townMap([[3, 3, 9, 7], [14, 3, 9, 7], [26, 4, 9, 7], [4, 14, 9, 7], [16, 15, 9, 7]]));
    expect(townSimilarity(small, big)).toBeLessThan(TOWN_SIMILARITY_LIMIT);
  });

  it("blocks a newly built VILLAGE that matches a known town, names the variants, and leaves other maps and old maps alone", () => {
    const before = createBlankProject() as Project;
    const after = structuredClone(before) as Project;
    const copy = townMap(LAYOUT_A);
    const known = [{ id: "mine/copy", comps: fp(copy).comps, density: fp(copy).density }];
    expect(nearestKnownTown(copy, known)!.similarity).toBeGreaterThanOrEqual(0.99);
    after.maps["town"] = copy;
    const problems = townStructureProblems(before, after, new Set(["town"]), known);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("mine/copy");
    expect(problems[0]).toContain("광장");
    // 마을로 지은 맵이 아니면(던전·들판·실내) 같은 구조여도 막지 않는다.
    expect(townStructureProblems(before, after, new Set(), known)).toEqual([]);
    // 요청 전에 이미 있던 맵은 막지 않는다.
    const kept = structuredClone(after) as Project;
    expect(townStructureProblems(kept, kept, new Set(["town"]), known)).toEqual([]);
    // 다른 배치는 통과.
    after.maps["town"] = townMap(LAYOUT_B);
    expect(townStructureProblems(before, after, new Set(["town"]), known)).toEqual([]);
  });
});
