import { describe, expect, it } from "vitest";
import castleSnapshot from "@/project/regionReferences/castle-town.json";
import walledSnapshot from "@/project/regionReferences/walled-settlement.json";
import { AUTHORED_HOUSE_FORM_DEFS, findAuthoredHouseForm, type AuthoredHouseFormDef } from "@/project/defaults/authoredHouseFormCatalog";
import {
  CASTLE_TOWN_HOUSE_FORMS,
  CASTLE_TOWN_REFERENCE_ID,
  REFERENCE_HOUSE_FORM_DEFS,
  WALLED_SETTLEMENT_HOUSE_FORMS,
  WALLED_SETTLEMENT_REFERENCE_ID,
} from "@/project/defaults/referenceHouseFormCatalog";
import { stampAuthoredHouseForm } from "@/editor/authoredHouseFormStamp";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";

const WALL_TILES = new Set([15, 16, 17, 45, 46, 47, 75, 76, 77, 12, 13, 14, 42, 43, 44, 72, 73, 74, 102, 103, 104, 132, 133, 134, 162, 163, 164, 196, 226, 256]);
const snapshots = { [WALLED_SETTLEMENT_REFERENCE_ID]: walledSnapshot.map, [CASTLE_TOWN_REFERENCE_ID]: castleSnapshot.map };

describe("참고 사례에서 잘라 온 집 형태", () => {
  it("정주지 4종·왕궁 도시 23종이 저작 형태 목록에 들어 있다", () => {
    expect(WALLED_SETTLEMENT_HOUSE_FORMS).toHaveLength(4);
    expect(CASTLE_TOWN_HOUSE_FORMS).toHaveLength(23);
    for (const form of REFERENCE_HOUSE_FORM_DEFS) expect(findAuthoredHouseForm(form.id)).toBe(form);
    const ids = AUTHORED_HOUSE_FORM_DEFS.map((form) => form.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("정주지 형태의 치수·문·층수 기준선", () => {
    expect(WALLED_SETTLEMENT_HOUSE_FORMS.map(({ id, w, h, doorAt, stories, kitId }) => ({ id, w, h, doorAt, stories, kitId }))).toEqual([
      { id: "ref-walled-01", w: 8, h: 11, doorAt: { x: 3, y: 10 }, stories: 2, kitId: "slate-wood" },
      { id: "ref-walled-02", w: 8, h: 9, doorAt: { x: 3, y: 8 }, stories: 2, kitId: "timber-hall" },
      { id: "ref-walled-03", w: 8, h: 11, doorAt: { x: 3, y: 10 }, stories: 2, kitId: "slate-wood" },
      { id: "ref-walled-04", w: 11, h: 9, doorAt: { x: 7, y: 8 }, stories: 2, kitId: "slate-wood" },
    ]);
  });

  it("왕궁 도시 형태는 회벽(15/45/75)만 쓰고 지붕색으로 명목 킷이 갈린다", () => {
    // 참고 규칙: "작은 회벽 주택 34채 … 통나무 벽은 쓰지 않는다". 주황 지붕+회벽은 timber-hall 이 같은 타일을 쓴다.
    const kits = new Set(CASTLE_TOWN_HOUSE_FORMS.map((form) => form.kitId));
    expect([...kits].sort()).toEqual(["blue-stone", "timber-hall"]);
    expect(CASTLE_TOWN_HOUSE_FORMS.filter((form) => form.w <= 8)).toHaveLength(23);
    expect(CASTLE_TOWN_HOUSE_FORMS.some((form) => form.stories === 2)).toBe(true);
  });

  it("레시피 규약을 지킨다 — 행렬 치수, 문 칸은 벽, 상위엔 문 타일 없음", () => {
    for (const form of REFERENCE_HOUSE_FORM_DEFS) {
      expect(form.rows, form.id).toHaveLength(form.h);
      for (const row of form.rows) {
        expect(row.tiles, form.id).toHaveLength(form.w);
        if (row.upperTiles) expect(row.upperTiles, form.id).toHaveLength(form.w);
      }
      expect(form.doorAt.y, form.id).toBeGreaterThanOrEqual(1);
      expect(form.doorAt.y, form.id).toBeLessThan(form.h);
      for (const dy of [form.doorAt.y - 1, form.doorAt.y]) {
        expect(WALL_TILES.has(form.rows[dy]!.tiles[form.doorAt.x]!), `${form.id} 문 칸 (${form.doorAt.x},${dy})`).toBe(true);
        expect(form.rows[dy]!.upperTiles?.[form.doorAt.x] ?? -1, `${form.id} 문 상위 (${form.doorAt.x},${dy})`).toBe(-1);
      }
      expect(form.reference, form.id).toBeDefined();
    }
  });

  it("문 칸을 빼면 스냅샷의 셀과 한 칸도 다르지 않다", () => {
    const check = (form: AuthoredHouseFormDef): void => {
      const source = snapshots[form.reference!.id as keyof typeof snapshots]!;
      const doorCells = new Set([`${form.doorAt.x},${form.doorAt.y - 1}`, `${form.doorAt.x},${form.doorAt.y}`]);
      for (const [dy, row] of form.rows.entries()) {
        for (let dx = 0; dx < form.w; dx += 1) {
          if (doorCells.has(`${dx},${dy}`)) continue;
          const index = (form.reference!.y + dy) * source.width + form.reference!.x + dx;
          const lower = row.tiles[dx]!;
          const upper = row.upperTiles?.[dx] ?? -1;
          if (lower !== -1) expect(source.lowerTiles[index], `${form.id} 하위 (${dx},${dy})`).toBe(lower);
          if (upper !== -1) expect(source.upperTiles[index], `${form.id} 상위 (${dx},${dy})`).toBe(upper);
        }
      }
      const doorIndex = (form.reference!.y + form.doorAt.y) * source.width + form.reference!.x + form.doorAt.x;
      expect([source.lowerTiles[doorIndex], source.upperTiles[doorIndex]], `${form.id} 문 아래 칸`).toContain(146);
    };
    for (const form of REFERENCE_HOUSE_FORM_DEFS) check(form);
  });

  it("빈 맵에 전부 찍힌다", () => {
    for (const form of REFERENCE_HOUSE_FORM_DEFS) {
      const context = { project: createEmptyToolProject("forms") };
      runTool(context, "create_map", { id: "map_f", name: "f", width: form.w + 4, height: form.h + 4 });
      const map = context.project.maps.map_f!;
      const result = stampAuthoredHouseForm(map, form, { x: 2, y: 2 });
      expect(result.ok, form.id).toBe(true);
      expect(result.doorAt, form.id).toEqual({ x: 2 + form.doorAt.x, y: 2 + form.doorAt.y });
    }
  });
});
