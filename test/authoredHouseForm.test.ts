import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { stampAuthoredHouseForm } from "@/editor/authoredHouseFormStamp";
import { tileLayerPolicy } from "@/editor/tileLayerPolicy";
import {
  AUTHORED_HOUSE_FORM_DEFS,
  findAuthoredHouseForm,
  type AuthoredHouseFormDef,
} from "@/project/defaults/authoredHouseFormCatalog";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { HOUSE_DOOR_BACKGROUND_TILE } from "@/editor/houseInteriors";
import type { MapId, Project } from "@/project/types";

const MAP_ID = "map_form_test";

function formProject(width = 40, height = 40): Project {
  const project = createBlankProject();
  const map = createBlankMap("형태 맵", width, height);
  map.id = MAP_ID;
  project.maps = { [MAP_ID]: map } as Record<MapId, typeof map>;
  project.startMapId = MAP_ID;
  project.startPos = { x: 1, y: 1 };
  project.mapTree = { mapId: MAP_ID, children: [] };
  return project;
}

function lowerAt(project: Project, x: number, y: number): number {
  const map = project.maps[MAP_ID]!;
  return map.lowerTiles[y * map.width + x]!;
}
function upperAt(project: Project, x: number, y: number): number {
  const map = project.maps[MAP_ID]!;
  return map.upperTiles[y * map.width + x]!;
}

const MANOR = findAuthoredHouseForm("manor-balcony") as AuthoredHouseFormDef;

describe("저작 집 형태 카탈로그 계약", () => {
  it("행렬이 선언 치수와 정확히 일치한다", () => {
    for (const def of AUTHORED_HOUSE_FORM_DEFS) {
      expect(def.rows.length, `${def.id} rows`).toBe(def.h);
      for (const [y, row] of def.rows.entries()) {
        expect(row.tiles.length, `${def.id} row ${y} tiles`).toBe(def.w);
        if (row.upperTiles !== undefined) {
          expect(row.upperTiles.length, `${def.id} row ${y} upperTiles`).toBe(def.w);
        }
      }
      expect(def.doorAt.x >= 0 && def.doorAt.x < def.w && def.doorAt.y >= 0 && def.doorAt.y < def.h, `${def.id} doorAt 범위`).toBe(true);
      expect(JSON.parse(JSON.stringify(def)), `${def.id} JSON 왕복`).toEqual(def);
    }
  });

  it("레이어 정책을 지킨다 — 하위는 불투명만, 상위는 상위 홈이거나 의도적 불투명 오버레이", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[DEFAULT_TILESET_ID]!;
    for (const def of AUTHORED_HOUSE_FORM_DEFS) {
      for (const [y, row] of def.rows.entries()) {
        row.tiles.forEach((tile, x) => {
          if (tile === -1) return;
          // 투명 타일은 하위에 못 놓는다. 불투명이면 홈이 upper 여도 하위 배치는 합법
          // (예: manor-balcony (12,3) — 상위 슬롯이 굴뚝이라 트림 377 을 하위에 둔다).
          expect(tileLayerPolicy(tileset, tile).transparent, `${def.id} 하위 (${x},${y}) 타일 ${tile}`).toBe(false);
        });
        row.upperTiles?.forEach((tile, x) => {
          if (tile === -1) return;
          // 상위 홈이 아니어도 불투명 칩은 의도적 오버레이로 상위에 둘 수 있다 —
          // 저작 폼의 셀 배치가 정본이다(예: manor-balcony 의 용마루 374·트림 376/377.
          // 이들의 홈 분류는 하위로 교정됐지만 폼의 상위 겹침 표현은 그대로 유효하다).
          // 투명 칩은 반드시 상위 홈이어야 한다 — 그 외 조합은 분류 회귀다.
          const policy = tileLayerPolicy(tileset, tile);
          expect(
            policy.home === "upper" || !policy.transparent,
            `${def.id} 상위 (${x},${y}) 타일 ${tile}`,
          ).toBe(true);
        });
      }
    }
  });

  it("manor-balcony는 추출된 조립 문법의 표지 셀을 유지한다", () => {
    const lower = (x: number, y: number) => MANOR.rows[y]!.tiles[x]!;
    const upper = (x: number, y: number) => MANOR.rows[y]!.upperTiles?.[x] ?? -1;
    // 탑 용마루 행 — 캡 양끝 + 용마루
    expect([upper(1, 0), upper(2, 0), upper(7, 0)]).toEqual([354, 374, 355]);
    // 계단 행 — 왼쪽 가장자리가 2셀 두께(몸통 404 위에 트림 376 오버레이)
    expect([lower(0, 3), lower(1, 3), upper(0, 3), upper(1, 3)]).toEqual([-1, 404, 376, 376]);
    // 우측 날개 슬라브 — 용마루 행 + 몸통, 우측 트림, 굴뚝 칸은 하위 트림
    expect(upper(8, 2)).toBe(374);
    expect([lower(8, 3), upper(12, 3), lower(12, 3)]).toEqual([404, 326, 377]);
    // 중간 회벽 — 상단 행 없이 중단+하단, x4 발코니 문(367+359)
    expect([lower(1, 5), lower(4, 6), lower(4, 7), lower(1, 7)]).toEqual([45, 367, 359, 75]);
    // 발코니 — 데크 가장자리/바닥/난간 교대
    expect([lower(1, 8), lower(2, 8), lower(1, 9), lower(1, 10), lower(2, 10)]).toEqual([198, 199, 223, 167, 163]);
    // 전폭 스커트 + 처마 캡
    expect([lower(0, 13), lower(12, 13), upper(0, 13), upper(12, 13)]).toEqual([405, 405, 384, 385]);
    // 하단 회벽 3행 + 창문 85 + 문 위치는 벽(문 기계 소관)
    expect([lower(0, 14), lower(12, 14), lower(0, 16), lower(6, 15), lower(6, 16)]).toEqual([15, 17, 75, 46, 76]);
    expect([upper(1, 15), upper(3, 15), upper(9, 15), upper(11, 15)]).toEqual([85, 85, 85, 85]);
  });
});

describe("stampAuthoredHouseForm", () => {
  it("레시피를 원점 평행이동해 셀 그대로 쓰고 절대 doorAt 을 돌려준다", () => {
    const project = formProject();
    const map = project.maps[MAP_ID]!;
    const result = stampAuthoredHouseForm(map, MANOR, { x: 5, y: 2 });
    expect(result.ok).toBe(true);
    expect(result.doorAt).toEqual({ x: 5 + 6, y: 2 + 16 });
    // 탑 용마루 + 스커트 처마 + 하단 벽 하단이 절대 좌표로 찍힌다.
    expect(upperAt(project, 5 + 2, 2 + 0)).toBe(374);
    expect(lowerAt(project, 5 + 0, 2 + 13)).toBe(405);
    expect(lowerAt(project, 5 + 12, 2 + 16)).toBe(77);
    // 레시피 빈칸은 지면을 건드리지 않는다.
    expect(lowerAt(project, 5 + 0, 2 + 0)).toBe(240);
  });

  it("맵 경계를 벗어나면 거부한다", () => {
    const project = formProject(15, 18);
    const map = project.maps[MAP_ID]!;
    expect(stampAuthoredHouseForm(map, MANOR, { x: 5, y: 2 }).ok).toBe(false);
  });
});

describe("author_house 가 저작 형태를 시공한다", () => {
  it("templateId=manor-balcony — 셀 레시피 + 연결 내부 + 문 이벤트가 한 트랜잭션에 나온다", () => {
    const ctx = { project: formProject() };
    const result = runTool(ctx, "author_house", {
      kind: "single", mapId: MAP_ID, kitId: "blue-stone", templateId: "manor-balcony",
      wings: [{ x: 3, y: 2, w: 3, h: 5 }], // 앵커 — 치수는 레시피가 갖는다
      interior: "linked-interior", yard: [],
    });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps[MAP_ID]!;
    // 앵커 (3,2) 기준 시그니처 셀.
    expect(map.upperTiles[(2 + 0) * map.width + (3 + 2)]).toBe(374); // 탑 용마루
    expect(map.lowerTiles[(2 + 10) * map.width + (3 + 1)]).toBe(167); // 발코니 난간 기둥
    expect(map.upperTiles[(2 + 15) * map.width + (3 + 3)]).toBe(85);  // 창문
    expect(map.upperTiles[(2 + 3) * map.width + (3 + 12)]).toBe(326); // 굴뚝
    // 문 — 이벤트 문 배경 359 두 칸 + 문 이벤트 + 내부 맵.
    expect(map.lowerTiles[(2 + 15) * map.width + (3 + 6)]).toBe(HOUSE_DOOR_BACKGROUND_TILE);
    expect(map.lowerTiles[(2 + 16) * map.width + (3 + 6)]).toBe(HOUSE_DOOR_BACKGROUND_TILE);
    const data = result.data as { houses: readonly { doorAt: { x: number; y: number } | null; interior?: { interiorMapId: string } }[] };
    expect(data.houses[0]!.doorAt).toEqual({ x: 3 + 6, y: 2 + 16 });
    const interiorMapId = data.houses[0]!.interior?.interiorMapId;
    expect(interiorMapId).toBeDefined();
    expect(ctx.project.maps[interiorMapId!]).toBeDefined();
    expect(map.events.some((event) => event.x === 3 + 6 && event.y === 2 + 16)).toBe(true);
  });

  it("kitId 생략도 받는다 — 폼 재료는 레시피가 고정한다", () => {
    const ctx = { project: formProject() };
    const result = runTool(ctx, "author_house", {
      kind: "single", mapId: MAP_ID, templateId: "manor-balcony",
      wings: [{ x: 20, y: 2, w: 3, h: 5 }],
      interior: "exterior-only", yard: [],
    });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps[MAP_ID]!;
    expect(map.upperTiles[(2 + 0) * map.width + (20 + 2)]).toBe(374);
  });

  it("폼은 stories 2층 고정 — 계획의 stories 인자를 무시한다", () => {
    const ctx = { project: formProject() };
    const result = runTool(ctx, "author_house", {
      kind: "single", mapId: MAP_ID, kitId: "blue-stone", templateId: "manor-balcony",
      wings: [{ x: 3, y: 2, w: 3, h: 5 }], stories: 1,
      interior: "exterior-only", yard: [],
    });
    expect(result.ok, result.summary).toBe(true);
    // 실내 층수 증거는 없지만 외장은 2층 레시피 그대로다 — 중간 벽+발코니 존재.
    const map = ctx.project.maps[MAP_ID]!;
    expect(map.lowerTiles[(2 + 9) * map.width + (3 + 1)]).toBe(223);
  });
});
