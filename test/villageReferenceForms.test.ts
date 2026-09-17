import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { REFERENCE_HOUSE_FORM_DEFS } from "@/project/defaults/referenceHouseFormCatalog";
import { villageFormTemplates, villageTemplateCatalog } from "@/editor/tools/village/authoringData";
import type { GameMap } from "@/project/types";

interface HouseRegion { readonly id: string; readonly role: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly shape?: string; readonly kitId?: string; readonly tags?: readonly string[]; readonly doorAt?: { x: number; y: number } }

function houseRegions(map: GameMap): HouseRegion[] {
  return ((map.layoutPlan?.regions ?? []) as unknown as HouseRegion[]).filter((region) => region.role === "house");
}

function authored(args: Record<string, unknown>, size = 64): { map: GameMap; ok: boolean; summary: string } {
  const context = { project: createEmptyToolProject("reference forms") };
  runTool(context, "create_map", { id: "map_v", name: "마을", width: size, height: size });
  const result = runTool(context, "author_village", {
    target: { kind: "existing", mapId: "map_v" }, countPolicy: "exact", interior: false, npcCount: 0, ...args,
  });
  return { map: context.project.maps.map_v!, ok: result.ok, summary: result.summary };
}

describe("마을 시공기가 참고 사례 집 형태를 섞어 짓는다", () => {
  it("슬롯 카탈로그에 폭 8 이하 참고 형태가 들어 있다", () => {
    const templates = villageTemplateCatalog(undefined).templates;
    const forms = villageFormTemplates();
    expect(forms.length).toBeGreaterThanOrEqual(26);
    for (const form of forms) {
      expect(form.w).toBeLessThanOrEqual(8);
      expect(templates.find((template) => template.id === form.id)?.form?.id).toBe(form.id);
    }
    // 쌍박공(11칸)은 author_house 전용 — 슬롯 후보엔 없다.
    expect(templates.some((template) => template.id === "ref-walled-04")).toBe(false);
  });

  it.each([1, 2, 3])("기본 시공에 참고 형태 집이 최소 한 채 나오고 셀이 레시피와 같다 — 씨앗 %s", (seed) => {
    const { map, ok, summary } = authored({ houseCount: 12, seed, theme: "평범한 마을" });
    expect(ok, summary).toBe(true);
    const formHouses = houseRegions(map).filter((region) => region.tags?.some((tag) => tag.startsWith("form:")));
    expect(formHouses.length, summary).toBeGreaterThanOrEqual(1);
    for (const region of formHouses) {
      const formId = region.tags!.find((tag) => tag.startsWith("form:"))!.slice("form:".length);
      const form = REFERENCE_HOUSE_FORM_DEFS.find((entry) => entry.id === formId)!;
      expect(form, formId).toBeDefined();
      expect(region.tags, formId).toContain(`reference:${form.reference!.id}`);
      expect(region.shape).toBe(form.id);
      // 레시피의 벽·지붕 셀이 시공 후에도 남아 있어야 한다(길·소품·조경 패스가 덮지 않았다). 문 두 칸은 문 기계가 다시 칠한다.
      for (const [dy, row] of form.rows.entries()) {
        for (let dx = 0; dx < form.w; dx += 1) {
          if (dx === form.doorAt.x && (dy === form.doorAt.y || dy === form.doorAt.y - 1)) continue;
          const index = (region.y + dy) * map.width + region.x + dx;
          if (row.tiles[dx] !== -1) expect(map.lowerTiles[index], `${formId} 하위 (${dx},${dy})`).toBe(row.tiles[dx]);
          const upper = row.upperTiles?.[dx] ?? -1;
          if (upper !== -1) expect(map.upperTiles[index], `${formId} 상위 (${dx},${dy})`).toBe(upper);
        }
      }
      // 문 두 칸 — 실내 없는 시공은 문 타일(116/146)을 깐다.
      const door = region.doorAt!;
      expect(map.lowerTiles[(door.y - 1) * map.width + door.x]).toBe(116);
      expect(map.lowerTiles[door.y * map.width + door.x]).toBe(146);
    }
  });

  it("housePlans.templateId 로 참고 형태를 못박을 수 있다", () => {
    const { map, ok, summary } = authored({
      houseCount: 4, seed: 5, theme: "마을",
      housePlans: [{ templateId: "ref-castle-05" }, { templateId: "ref-walled-02" }, {}, {}],
    });
    expect(ok, summary).toBe(true);
    const shapes = houseRegions(map).map((region) => region.shape);
    expect(shapes.slice(0, 2)).toEqual(["ref-castle-05", "ref-walled-02"]);
  });

  it("재료를 하나로 고정한 마을에는 그 재료의 레시피만 섞인다", () => {
    // '광산' 원형은 kitMix 를 blue-stone 으로 고정한다 — 주황 지붕 레시피(timber-hall 명목)는 나오면 안 된다.
    const { map, ok, summary } = authored({ houseCount: 12, seed: 1, theme: "광산 마을" });
    expect(ok, summary).toBe(true);
    for (const region of houseRegions(map)) expect(region.kitId, region.shape).toBe("blue-stone");
  });
});
