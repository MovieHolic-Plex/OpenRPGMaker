import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { supportsChipsetQuarterComposition } from "@/editor/tilesetImage";
import { dungeonTerrainQuarterKits } from "@/project/defaults/dungeonTerrainQuarter";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";

type MapView = { width: number; height: number; lowerTiles: number[] };

function mapFromRows(rows: readonly (readonly number[])[]): MapView {
  return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
}

function quarterTile(sources: readonly { quarter: string; tile: number }[] | undefined, quarter: string): number | undefined {
  return sources?.find((entry) => entry.quarter === quarter)?.tile;
}

const dungeonTileset = () => createBlankProject().tilesets.easyrpg_chipset_dungeon;

describe("dungeon terrain quarter composition (RM2k3 8×8 미니타일)", () => {
  it("던전 타일셋이 프로덕션 쿼터 렌더 게이트를 통과한다", () => {
    expect(supportsChipsetQuarterComposition(dungeonTileset())).toBe(true);
    expect(dungeonTerrainQuarterKits(dungeonTileset())).toHaveLength(12);
    // 다른 칩셋에서는 던전 킷이 잡히면 안 된다 (combined-town 흙길과 id 충돌).
    expect(dungeonTerrainQuarterKits(createBlankProject().tilesets.easyrpg_chipset_interior)).toBeNull();
  });

  it("심연 링 코너(저장 368): 대각 하나만 열림 → 해당 쿼터만 오목 소스, 나머지는 몸통", () => {
    // 링 안쪽 코너 — S/E는 변 타일, 대각(SE)만 바닥(187).
    const map = mapFromRows([
      [427, 427, 427],
      [427, 368, 457],
      [427, 428, 187],
    ]);
    const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
    expect(composition).not.toBeNull();
    expect(quarterTile(composition?.sources, "nw")).toBe(427); // 몸통 쿼터
    expect(quarterTile(composition?.sources, "ne")).toBe(427);
    expect(quarterTile(composition?.sources, "sw")).toBe(427);
    expect(quarterTile(composition?.sources, "se")).toBe(368); // 노치 1개만
  });

  it("용암 구멍 대각 셀(저장 245): 구멍 방향 쿼터만 오목, 나머지 몸통", () => {
    // 3×3 용암 가운데가 적암(244)으로 뚫린 상황의 NW 대각 셀.
    const map = mapFromRows([
      [304, 304, 304],
      [304, 245, 274],
      [304, 303, 244],
    ]);
    const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
    expect(quarterTile(composition?.sources, "se")).toBe(245);
    expect(quarterTile(composition?.sources, "nw")).toBe(304);
  });

  it("1칸 폭 심연 기둥: 좌우 쿼터가 서/동 변으로 갈라진다", () => {
    const F = 187;
    const map = mapFromRows([
      [F, 427, F],
      [F, 427, F],
      [F, 427, F],
    ]);
    const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
    expect(quarterTile(composition?.sources, "nw")).toBe(426); // 서변
    expect(quarterTile(composition?.sources, "ne")).toBe(428); // 동변
    expect(quarterTile(composition?.sources, "sw")).toBe(426);
    expect(quarterTile(composition?.sources, "se")).toBe(428);
  });

  it("connectsTo: 이끼 옆 흙 몸통은 합성 불필요(null) — 이끼를 연결로 본다", () => {
    const D = 421;
    const map = mapFromRows([
      [D, D, D],
      [D, D, 424],
      [D, D, D],
    ]);
    // 던전 킷이 우선 매칭돼 combined-town 흙길 킷(이끼=모래를 비연결로 봄)을 덮는다.
    expect(chipsetQuarterComposition(map, dungeonTileset(), 1, 1)).toBeNull();
  });

  it("이끼 쪽은 흙 옆에서 자기 테두리를 그린다(비연결) — 역방향 아님", () => {
    const M = 424;
    const map = mapFromRows([
      [421, 421, 421],
      [421, M, M],
      [421, M, M],
    ]);
    const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
    expect(composition).not.toBeNull();
    expect(quarterTile(composition?.sources, "nw")).toBe(393); // 이끼 NW 볼록 코너 쿼터
  });
});
