import { describe, expect, it } from "vitest";
import { HOUSE_KITS, stampFootprintHouseKit, windowPlacementProblem, type HouseKitId } from "@/editor/houseKit";
import { DEFAULT_MIX_EXCLUDED_TEMPLATE_IDS, villageFormTemplates } from "@/editor/tools/village/authoringData";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";

// 2026-09-25 사용자 규칙:
//  · 자동 추첨에 나오는 날개 형태는 바깥에 면한 벽 면이 모두 3칸 이상이고 창이 하나 이상 있다(창 없는 창고 제외).
//  · 창은 민벽 칸에만(끝 모서리·기둥·문 칸 금지), 좌우 이웃은 벽(끝 모서리 가능)이고 문 옆이 아니다.
const WINDOWLESS_SHEDS = new Set(["hut-low"]);
const KITS: readonly HouseKitId[] = ["blue-stone", "timber-hall", "charcoal-timber", "bright-plaster", "amber-wood"];

describe("날개 형태 벽 면 ≥3칸 · 창 규칙", () => {
  for (const def of HOUSE_TEMPLATE_DEFS.filter((template) => !DEFAULT_MIX_EXCLUDED_TEMPLATE_IDS.has(template.id))) {
    it(def.id, () => {
      for (const kitId of KITS) {
        const kit = HOUSE_KITS[kitId];
        const walls = new Set<number>([...kit.wall.top, ...kit.wall.mid, ...kit.wall.bottom, ...(kit.postColumn?.tiles ?? [])]);
        const bottoms = new Set<number>([kit.wall.bottom[0], kit.wall.bottom[1], kit.wall.bottom[2], ...(kit.postColumn ? [kit.postColumn.tiles[2]] : [])]);
        const map = createBlankMap("t", 20, 20, "forest_harmony");
        const result = stampFootprintHouseKit(map, {
          kitId,
          stories: def.stories,
          ...(def.lowWall ? { lowWall: true } : {}),
          wings: def.wings.map((wing) => ({ ...wing, x: wing.x + 2, y: wing.y + 2 })),
        });
        expect(result.ok).toBe(true);
        const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= map.width || y >= map.height ? -1 : map.lowerTiles[y * map.width + x] ?? -1);
        const narrow: string[] = [];
        for (let y = 0; y < map.height - 1; y += 1) {
          for (let x = 0; x < map.width; x += 1) {
            if (!bottoms.has(at(x, y)) || walls.has(at(x, y + 1)) || bottoms.has(at(x - 1, y))) continue;
            let x1 = x;
            while (bottoms.has(at(x1 + 1, y))) x1 += 1;
            if (x1 - x + 1 < 3) narrow.push(`${x - 2},${y - 2}:${x1 - x + 1}`);
          }
        }
        expect(narrow, `${def.id} × ${kitId}`).toEqual([]);
        const problems: string[] = [];
        let windows = 0;
        map.upperTiles.forEach((tile, index) => {
          if (tile !== kit.windowTile) return;
          windows += 1;
          const problem = windowPlacementProblem(kit, at, index % map.width, Math.floor(index / map.width), result.doorAt);
          if (problem) problems.push(`${index % map.width},${Math.floor(index / map.width)} ${problem}`);
        });
        expect(problems, `${def.id} × ${kitId}`).toEqual([]);
        if (!WINDOWLESS_SHEDS.has(def.id)) expect(windows, `${def.id} × ${kitId} 창`).toBeGreaterThan(0);
      }
    });
  }
});

describe("고정 레시피(ref-*·저택) 창 규칙", () => {
  for (const template of villageFormTemplates()) {
    it(template.id, () => {
      const form = template.form!;
      const kit = HOUSE_KITS[form.kitId as HouseKitId];
      const at = (x: number, y: number): number => (y < 0 || y >= form.h || x < 0 || x >= form.w ? -1 : form.rows[y]!.tiles[x] ?? -1);
      let windows = 0;
      form.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
        if (tile !== 85 && tile !== 87) return;
        windows += 1;
        expect(windowPlacementProblem(kit, at, x, y, form.doorAt), `${template.id} ${x},${y}`).toBeUndefined();
      }));
      // 창이 없는 레시피는 자동 추첨에서 빠져 있어야 한다.
      if (windows === 0) expect(template.excludeFromDefaultMix).toBe(true);
    });
  }
});
