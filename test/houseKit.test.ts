import { describe, expect, it } from "vitest";
import { rectHouseHeight, stampRectHouseKit } from "@/editor/houseKit";
import { createBlankProject, TILE } from "@/project/defaults";
import type { GameMap } from "@/project/types";

// 하네싱 골든 테스트 — 키트 전개 결과가 사용자 기준 집(fable-village 연습04)의
// 실데이터와 "셀 단위로" 일치해야 한다. 정본: docs/knowledge/images/2026-07-08-house-harness-design.png
const E = TILE.EMPTY;
const G = 270; // 풀

function freshMap(): GameMap {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.lowerTiles.fill(G);
  map.upperTiles.fill(E);
  return map;
}

function row(map: GameMap, layer: "lower" | "upper", y: number, x0: number, x1: number): number[] {
  const arr = layer === "lower" ? map.lowerTiles : map.upperTiles;
  return Array.from({ length: x1 - x0 + 1 }, (_, i) => arr[y * map.width + (x0 + i)]);
}

describe("house kit — 하네싱 골든", () => {
  it("파랑+석벽 키트(폭6·1층·몸통1행)가 연습04 기준 집을 셀 단위로 재현한다", () => {
    const map = freshMap();
    const result = stampRectHouseKit(map, { x: 2, y: 2, width: 6, stories: 1, roofBodyRows: 1, kitId: "blue-stone" });
    expect(result.ok, result.reason).toBe(true);
    expect(result.height).toBe(6);

    // 연습04 실데이터 (x2..7, y2..7):
    expect(row(map, "lower", 2, 2, 7)).toEqual([G, 406, 406, 406, 406, G]); // 최상행: 좌우 1칸 인셋
    expect(row(map, "upper", 2, 2, 7)).toEqual([356, E, E, E, E, 357]); // 인셋 모서리 = 상위 대각
    expect(row(map, "lower", 3, 2, 7)).toEqual([406, 406, 406, 406, 406, 407]); // 몸통행: 우측 끝만 407
    expect(row(map, "lower", 4, 2, 7)).toEqual([467, 467, 467, 467, 467, 467]); // 처마: 벽과 같은 폭
    expect(row(map, "upper", 4, 2, 7)).toEqual([386, E, E, E, E, 387]); // 처마 끝 대각(처마 위에 겹침)
    expect(row(map, "lower", 5, 2, 7)).toEqual([15, 16, 16, 16, 16, 17]); // 벽 상단
    expect(row(map, "lower", 6, 2, 7)).toEqual([45, 46, 46, 46, 46, 47]); // 벽 중단
    expect(row(map, "lower", 7, 2, 7)).toEqual([75, 76, 76, 76, 76, 77]); // 벽 하단
    expect(result.doorAt).toEqual({ x: 5, y: 7 });
  });

  it("밝은오렌지+회벽 키트는 연습08 규칙(용마루 위 한 줄·트림·오버행 처마)을 지킨다", () => {
    const map = freshMap();
    const result = stampRectHouseKit(map, { x: 2, y: 2, width: 6, stories: 1, roofBodyRows: 2, kitId: "bright-plaster" });
    expect(result.ok, result.reason).toBe(true);

    // 용마루(상위) 행: 몸통 폭(인셋), 캡은 바깥.
    expect(row(map, "upper", 2, 2, 7)).toEqual([354, 374, 374, 374, 374, 355]);
    expect(row(map, "lower", 2, 2, 7)).toEqual([G, G, G, G, G, G]); // 용마루 행 하위는 비움
    // 몸통 2행: 인셋 + 좌우 바깥 열 상위 트림.
    for (const y of [3, 4]) {
      expect(row(map, "lower", y, 2, 7)).toEqual([G, 404, 404, 404, 404, G]);
      expect(row(map, "upper", y, 2, 7)).toEqual([376, E, E, E, E, 377]);
    }
    // 처마: 벽 폭(몸통보다 +1 오버행), 트림 하단 캡이 처마 위에 겹침.
    expect(row(map, "lower", 5, 2, 7)).toEqual([405, 405, 405, 405, 405, 405]);
    expect(row(map, "upper", 5, 2, 7)).toEqual([384, E, E, E, E, 385]);
    // 흰 회벽 3행.
    expect(row(map, "lower", 6, 2, 7)).toEqual([12, 13, 13, 13, 13, 14]);
    expect(row(map, "lower", 7, 2, 7)).toEqual([42, 43, 43, 43, 43, 44]);
    expect(row(map, "lower", 8, 2, 7)).toEqual([72, 73, 73, 73, 73, 74]);
  });

  it("2층은 벽 중단 행만 세로 반복한다 (상단/하단은 1행 고정)", () => {
    const map = freshMap();
    const result = stampRectHouseKit(map, { x: 2, y: 2, width: 5, stories: 2, roofBodyRows: 1, kitId: "blue-stone" });
    expect(result.ok, result.reason).toBe(true);
    expect(result.height).toBe(1 + 1 + 1 + (2 + 3)); // 지붕 3행 + 벽 5행(상1+중3+하1)

    expect(row(map, "lower", 5, 2, 6)).toEqual([15, 16, 16, 16, 17]); // 상단 1행
    for (const y of [6, 7, 8]) expect(row(map, "lower", y, 2, 6)).toEqual([45, 46, 46, 46, 47]); // 중단 ×3
    expect(row(map, "lower", 9, 2, 6)).toEqual([75, 76, 76, 76, 77]); // 하단 1행
  });

  it("상위 마감은 빈 칸에만 얹는다 — 이웃 오브젝트를 덮지 않는다", () => {
    const map = freshMap();
    map.upperTiles[2 * map.width + 2] = 260; // 좌상 모서리 자리에 기존 나무 꼭대기
    const result = stampRectHouseKit(map, { x: 2, y: 2, width: 6, stories: 1, roofBodyRows: 1, kitId: "blue-stone" });
    expect(result.ok).toBe(true);
    expect(map.upperTiles[2 * map.width + 2]).toBe(260); // 보존
    expect(map.upperTiles[2 * map.width + 7]).toBe(357); // 빈 쪽은 정상 마감
  });

  it("경계를 벗어나면 시공을 거부한다", () => {
    const map = freshMap();
    const result = stampRectHouseKit(map, {
      x: map.width - 3,
      y: 2,
      width: 6,
      stories: 1,
      roofBodyRows: 1,
      kitId: "blue-stone",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("경계");
  });

  it("rectHouseHeight는 층수·지붕 몸통 행수에 따라 결정된다", () => {
    expect(rectHouseHeight({ stories: 1, roofBodyRows: 1, kitId: "blue-stone" })).toBe(6);
    expect(rectHouseHeight({ stories: 2, roofBodyRows: 2, kitId: "bright-plaster" })).toBe(9);
  });
});
