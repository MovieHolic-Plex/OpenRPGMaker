// interiorObjectCatalog.test.ts
// 실내 오브젝트 카탈로그(선언형 어휘)의 형태 계약 — 셀 좌표·역할 타일·테마 커버리지·id 규약.
// 렌더러(kitRender)의 셀 규약 {dx,dy,layer,tile}과 구조가 같아야 '구조물' DB 탭이 그대로 그린다.
import { describe, expect, it } from "vitest";

import {
  INTERIOR_OBJECT_CATALOG,
  interiorObjectById,
  interiorObjectsForTheme,
  type InteriorObjectDef,
} from "@/editor/interiorObjectCatalog";
import {
  INTERIOR_ROOM_THEME_CATALOG,
  INTERIOR_ROOM_THEMES,
  INTERIOR_SEMANTIC_TILE_CATALOG,
  VR,
  type InteriorSemanticTileRole,
} from "@/editor/interiorRoomPipeline";

/**
 * 역할 타일 세트 밖이지만 그 오브젝트가 정당하게 선언하는 타일:
 * - bookshelf 3×3의 가운데 열(19/49/79)은 가로로 반복되는 '몸통'.
 * - table_chairs의 의자(297/298)는 사각 탁자 짝 규칙의 동반 타일.
 */
const DECLARED_COMPANION_TILES: Readonly<Record<string, readonly number[]>> = {
  bookshelf: [19, 49, 79],
  table_chairs: [VR.CHAIR_LEFT, VR.CHAIR_RIGHT],
  study_desk: [VR.STOOL],
  care_bed: [VR.STOOL],
  table_wood: [156,157,158,186,187,188,198,199,200],
  table_white: [159,160,161,189,190,191,228,229,230],
  tea_table: [156,157,158,186,187,188,198,199,200,235,204,297,298],
  reading_table: [156,157,158,186,187,188,198,199,200,145,204,297,298],
  dining_table: [156,157,158,186,187,188,198,199,200,207,238,208,297,298],
  consultation_table: [159,160,161,189,190,191,228,229,230,145,204,297,298],
  altar_table: [159,160,161,189,190,191,228,229,230,204],
  work_table: [156,157,158,186,187,188,198,199,200,261,414],
  teacher_desk: [156,157,158,198,199,200,145],
};

const cellKey = (cell: { dx: number; dy: number; layer: string }): string =>
  `${cell.dx},${cell.dy},${cell.layer}`;

describe("INTERIOR_OBJECT_CATALOG 형태 계약", () => {
  it("카탈로그가 비어 있지 않다", () => {
    expect(INTERIOR_OBJECT_CATALOG.length).toBeGreaterThan(0);
  });

  it("모든 정의의 셀이 width×height 격자 안에 중복 없이 들어간다", () => {
    for (const def of INTERIOR_OBJECT_CATALOG) {
      expect(def.cells.length, `${def.id} cells`).toBeGreaterThan(0);
      expect(def.width, `${def.id} width`).toBeGreaterThan(0);
      expect(def.height, `${def.id} height`).toBeGreaterThan(0);
      expect(def.cells.length, `${def.id} 셀 수 ≤ width*height`).toBeLessThanOrEqual(def.width * def.height * 2);
      const seen = new Set<string>();
      for (const cell of def.cells) {
        expect(cell.dx, `${def.id} dx`).toBeGreaterThanOrEqual(0);
        expect(cell.dx, `${def.id} dx`).toBeLessThan(def.width);
        expect(cell.dy, `${def.id} dy`).toBeGreaterThanOrEqual(0);
        expect(cell.dy, `${def.id} dy`).toBeLessThan(def.height);
        expect(cell.tile, `${def.id} tile`).toBeGreaterThanOrEqual(0);
        expect(["lower", "upper"]).toContain(cell.layer);
        const key = cellKey(cell);
        expect(seen.has(key), `${def.id} 중복 셀 ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("id는 유일하고 소문자+밑줄 규약을 지킨다", () => {
    const ids = INTERIOR_OBJECT_CATALOG.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.length, `${id} 비어 있지 않은 id`).toBeGreaterThan(0);
      expect(id, `${id} 소문자+밑줄`).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("모든 정의에 한국어 라벨과 유효한 스냅·레이어가 있다", () => {
    for (const def of INTERIOR_OBJECT_CATALOG) {
      expect(def.label.trim().length, `${def.id} label`).toBeGreaterThan(0);
      expect(["wall-north", "wall-any", "floor", "free"]).toContain(def.snap);
      expect(["lower", "upper"]).toContain(def.layer);
      for (const theme of def.themes) expect(INTERIOR_ROOM_THEMES).toContain(theme);
    }
  });

  it("role이 있는 정의의 타일은 역할 타일 세트 ∪ 선언된 동반 타일의 부분집합이다", () => {
    for (const def of INTERIOR_OBJECT_CATALOG) {
      if (def.role === null) continue;
      const allowed = new Set<number>([
        ...INTERIOR_SEMANTIC_TILE_CATALOG[def.role].tileIds,
        ...(DECLARED_COMPANION_TILES[def.id] ?? []),
      ]);
      for (const cell of def.cells) {
        expect(allowed.has(cell.tile), `${def.id} 타일 ${cell.tile}이 role=${def.role} 어휘 밖`).toBe(true);
      }
    }
  });

  it("역할별 타일 세트의 모든 타일이 그 역할 오브젝트 어딘가에 등장한다", () => {
    const roles = Object.keys(INTERIOR_SEMANTIC_TILE_CATALOG) as InteriorSemanticTileRole[];
    for (const role of roles) {
      const covered = new Set<number>();
      for (const def of INTERIOR_OBJECT_CATALOG) {
        if (def.role !== role) continue;
        for (const cell of def.cells) covered.add(cell.tile);
      }
      for (const tile of INTERIOR_SEMANTIC_TILE_CATALOG[role].tileIds) {
        expect(covered.has(tile), `role=${role} 타일 ${tile} 미커버`).toBe(true);
      }
    }
  });

  it("requiredRoles가 있는 테마마다 필수 역할 오브젝트가 최소 1개 있다", () => {
    for (const theme of INTERIOR_ROOM_THEMES) {
      const required = INTERIOR_ROOM_THEME_CATALOG[theme].requiredRoles;
      if (required.length === 0) continue;
      const forTheme = interiorObjectsForTheme(theme);
      for (const role of required) {
        const match = forTheme.filter((def: InteriorObjectDef) => def.role === role);
        expect(match.length, `theme=${theme} role=${role} 오브젝트 없음`).toBeGreaterThan(0);
      }
    }
  });

  it("interiorObjectsForTheme는 해당 테마를 선언한 정의만 돌려준다", () => {
    for (const theme of INTERIOR_ROOM_THEMES) {
      for (const def of interiorObjectsForTheme(theme)) {
        expect(def.themes, `${def.id} themes`).toContain(theme);
      }
    }
  });

  it("interiorObjectById는 id로 정의를 찾고 없는 id에는 undefined를 준다", () => {
    for (const def of INTERIOR_OBJECT_CATALOG) {
      expect(interiorObjectById(def.id)).toBe(def);
    }
    expect(interiorObjectById("no_such_object")).toBeUndefined();
  });

  it("파이프라인이 소비하는 다중 타일 세트가 카탈로그에 선언되어 있다", () => {
    const expected: Readonly<Record<string, readonly number[]>> = {
      bed_h: [VR.BED_L, VR.BED_R],
      bed_v: [VR.BED_V_HEAD, VR.BED_V_FOOT],
      stove: [VR.STOVE_TOP, VR.STOVE_BOT],
      table_long: [VR.TABLE_L, VR.TABLE_R, VR.TABLE_R3],
      counter: [VR.COUNTER_L, VR.COUNTER_M, VR.COUNTER_R],
      piano: [VR.PIANO_L, VR.PIANO_M, VR.PIANO_R],
      bookshelf: [VR.BOOK_TL, 19, VR.BOOK_TR, VR.BOOK_ML, 49, VR.BOOK_MR, VR.BOOK_BL, 79, VR.BOOK_BR],
    };
    for (const [id, tiles] of Object.entries(expected)) {
      const def = interiorObjectById(id);
      expect(def, `${id} 정의 없음`).toBeDefined();
      expect(def!.cells.map((cell) => cell.tile)).toEqual(tiles);
    }
  });
});
