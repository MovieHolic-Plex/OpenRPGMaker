// test/regionStampCreate.test.ts
// 영역 → SectionStructureKitDef 순수 변환 + 보조 판정 함수 단위 테스트.
// 스펙 docs/superpowers/specs/2026-07-20-region-task-stamp-design.md.

import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import {
  defaultStampName,
  extractSectionKitFromRegion,
  isRegionEmpty,
  STAMP_SIZE_WARN_LIMIT,
} from "@/editor/regionStampCreate";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import type { GameMap, Project } from "@/project/types";

// createBlankProject() → 20×15 맵, lowerTiles=GITLESS? 아니 GRASS(240)로 채워짐.
// 빈 칸(EMPTY=-1)이 필요하면 테스트에서 명시적으로 칠해야 한다.
function makeProject(): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  return { project, map };
}

/** 영역에 lower/upper 타일을 쓴다. 기본 맵은 GRASS로 채워져 있어 덮어쓴다. */
function paintRegion(map: GameMap, region: RegionRect, lower: number[], upper: number[] = []): void {
  for (let r = 0; r < region.height; r += 1) {
    for (let c = 0; c < region.width; c += 1) {
      const idx = (region.y + r) * map.width + (region.x + c);
      const src = r * region.width + c;
      map.lowerTiles[idx] = lower[src] ?? TILE.EMPTY;
      map.upperTiles[idx] = upper[src] ?? TILE.EMPTY;
    }
  }
}

describe("extractSectionKitFromRegion", () => {
  it("3×3 잔디+울타리 영역을 양 레이어 행렬로 변환한다", () => {
    const { project, map } = makeProject();
    const region = { x: 2, y: 3, width: 3, height: 3 };
    paintRegion(
      map,
      region,
      [
        TILE.GRASS, TILE.GRASS, TILE.GRASS,
        TILE.GRASS, TILE.GRASS, TILE.GRASS,
        TILE.GRASS, TILE.GRASS, TILE.GRASS,
      ],
      [
        101, 102, 103,
        104, TILE.EMPTY, 105,
        106, 107, 108,
      ],
    );

    const kit = extractSectionKitFromRegion(project, project.startMapId, region, { name: "캠프" });

    expect(kit).not.toBeNull();
    expect(kit!.kind).toBe("section");
    expect(kit!.name).toBe("캠프");
    expect(kit!.width).toBe(3);
    expect(kit!.height).toBe(3);
    expect(kit!.learnedFrom).toBe("user-paint");
    expect(kit!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(kit!.rows).toHaveLength(3);
    expect(kit!.rows[0].tiles).toEqual([TILE.GRASS, TILE.GRASS, TILE.GRASS]);
    expect(kit!.rows[0].upperTiles).toEqual([101, 102, 103]);
    expect(kit!.rows[1].upperTiles).toEqual([104, TILE.EMPTY, 105]);
    expect(kit!.rows[2].upperTiles).toEqual([106, 107, 108]);
  });

  it("upper가 전혀 없는 행은 upperTiles 필드를 생략한다 (직렬화 최소화)", () => {
    const { project, map } = makeProject();
    const region = { x: 0, y: 0, width: 2, height: 2 };
    paintRegion(
      map,
      region,
      [TILE.GRASS, TILE.GRASS, TILE.GRASS, TILE.GRASS],
    );

    const kit = extractSectionKitFromRegion(project, project.startMapId, region);

    expect(kit!.rows).toHaveLength(2);
    for (const row of kit!.rows) {
      expect(row.upperTiles).toBeUndefined();
    }
  });

  it("영역이 맵 밖으로 나가면 null", () => {
    const { project } = makeProject(); // 20×15
    expect(extractSectionKitFromRegion(project, project.startMapId, { x: -1, y: 0, width: 2, height: 2 })).toBeNull();
    expect(extractSectionKitFromRegion(project, project.startMapId, { x: 19, y: 0, width: 3, height: 1 })).toBeNull();
    expect(extractSectionKitFromRegion(project, project.startMapId, { x: 0, y: 14, width: 1, height: 2 })).toBeNull();
  });

  it("존재하지 않는 맵 id면 null", () => {
    const { project } = makeProject();
    expect(
      extractSectionKitFromRegion(project, "no-such-map" as never, { x: 0, y: 0, width: 1, height: 1 }),
    ).toBeNull();
  });

  it("너비/높이가 0 이하면 null", () => {
    const { project } = makeProject();
    expect(extractSectionKitFromRegion(project, project.startMapId, { x: 0, y: 0, width: 0, height: 2 })).toBeNull();
    expect(extractSectionKitFromRegion(project, project.startMapId, { x: 0, y: 0, width: 2, height: 0 })).toBeNull();
  });

  it("id 를 명시하지 않으면 고유 문자열을 생성한다", () => {
    const { project, map } = makeProject();
    paintRegion(map, { x: 0, y: 0, width: 1, height: 1 }, [TILE.GRASS]);
    const kit = extractSectionKitFromRegion(project, project.startMapId, { x: 0, y: 0, width: 1, height: 1 });
    expect(typeof kit!.id).toBe("string");
    expect(kit!.id.length).toBeGreaterThan(0);
  });
});

describe("isRegionEmpty", () => {
  it("기본 맵(GRASS로 채워짐)은 비어있지 않다", () => {
    const { map } = makeProject();
    expect(isRegionEmpty(map, { x: 0, y: 0, width: 3, height: 3 })).toBe(false);
  });

  it("명시적으로 모든 셀을 EMPTY(-1)로 지우면 true", () => {
    const { map } = makeProject();
    const region = { x: 0, y: 0, width: 2, height: 2 };
    paintRegion(
      map,
      region,
      [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
      [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
    );
    expect(isRegionEmpty(map, region)).toBe(true);
  });

  it("한 셀이라도 lower에 타일이 있으면 false", () => {
    const { map } = makeProject();
    const region = { x: 0, y: 0, width: 2, height: 1 };
    paintRegion(map, region, [TILE.EMPTY, TILE.GRASS]);
    expect(isRegionEmpty(map, region)).toBe(false);
  });

  it("upper에만 타일이 있어도 false", () => {
    const { map } = makeProject();
    const region = { x: 5, y: 5, width: 1, height: 1 };
    paintRegion(map, region, [TILE.EMPTY], [101]);
    expect(isRegionEmpty(map, region)).toBe(false);
  });

  it("영역이 맵 밖이면 true", () => {
    const { map } = makeProject();
    expect(isRegionEmpty(map, { x: 50, y: 50, width: 2, height: 2 })).toBe(true);
  });
});

describe("defaultStampName", () => {
  it("user-paint 킷이 없으면 #1", () => {
    const { project, map } = makeProject();
    const tileset = project.tilesets[map.tilesetId];
    expect(defaultStampName(tileset, { x: 0, y: 0, width: 3, height: 3 })).toBe("스탬프 3×3 #1");
  });

  it("user-paint 킷 2개 있으면 #3 (builtin-parametric은 카운트 제외)", () => {
    const { project, map } = makeProject();
    const tileset = project.tilesets[map.tilesetId];
    tileset.structureKits = [
      { id: "k1", kind: "section", width: 1, height: 1, rows: [{ tiles: [1] }], learnedFrom: "user-paint" },
      { id: "k2", kind: "section", width: 1, height: 1, rows: [{ tiles: [2] }], learnedFrom: "user-paint" },
      { id: "k3", kind: "section", width: 1, height: 1, rows: [{ tiles: [3] }], learnedFrom: "builtin-parametric" },
    ];
    expect(defaultStampName(tileset, { x: 0, y: 0, width: 2, height: 2 })).toBe("스탬프 2×2 #3");
  });

  it("타일셋이 undefined여도 폴백", () => {
    expect(defaultStampName(undefined, { x: 0, y: 0, width: 4, height: 1 })).toBe("스탬프 4×1 #1");
  });
});

describe("STAMP_SIZE_WARN_LIMIT", () => {
  it("32×32 임계값", () => {
    expect(STAMP_SIZE_WARN_LIMIT).toBe(32);
  });
});
