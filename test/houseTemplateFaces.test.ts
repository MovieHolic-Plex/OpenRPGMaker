import { describe, expect, it } from "vitest";
import { HOUSE_KITS, stampFootprintHouseKit } from "@/editor/houseKit";
import { DEFAULT_MIX_EXCLUDED_TEMPLATE_IDS } from "@/editor/tools/village/authoringData";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";

// 2026-09-25 사용자 규칙: 자동 추첨에 나오는 날개 형태는 바깥에 면한 벽 면이 모두 3칸 이상이고 창이 하나 이상 있다.
describe("날개 형태 벽 면 ≥3칸 · 창", () => {
  const kit = HOUSE_KITS["blue-stone"];
  const walls = new Set<number>([...kit.wall.top, ...kit.wall.mid, ...kit.wall.bottom]);
  const bottoms = new Set<number>(kit.wall.bottom);
  for (const def of HOUSE_TEMPLATE_DEFS.filter((template) => !DEFAULT_MIX_EXCLUDED_TEMPLATE_IDS.has(template.id))) {
    it(def.id, () => {
      const map = createBlankMap("t", 20, 20, "forest_harmony");
      const result = stampFootprintHouseKit(map, {
        kitId: "blue-stone",
        stories: def.stories,
        ...(def.lowWall ? { lowWall: true } : {}),
        wings: def.wings.map((wing) => ({ ...wing, x: wing.x + 2, y: wing.y + 2 })),
      });
      expect(result.ok).toBe(true);
      const at = (x: number, y: number): number => map.lowerTiles[y * map.width + x] ?? -1;
      const narrow: string[] = [];
      for (let y = 0; y < map.height - 1; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (!bottoms.has(at(x, y)) || walls.has(at(x, y + 1)) || bottoms.has(at(x - 1, y))) continue;
          let x1 = x;
          while (bottoms.has(at(x1 + 1, y))) x1 += 1;
          if (x1 - x + 1 < 3) narrow.push(`${x - 2},${y - 2}:${x1 - x + 1}`);
        }
      }
      expect(narrow).toEqual([]);
      expect(map.upperTiles.some((tile) => tile === kit.windowTile)).toBe(true);
    });
  }
});
