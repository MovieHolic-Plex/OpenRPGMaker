import { describe, expect, it } from "vitest";
import { COMBINED_TOWN_HARNESS_GROUPS } from "@/project/tilesetHarness/combinedTownGroups";
import { applyCombinedTownHarness } from "@/project/tilesetHarness/combinedTown";
import { TERRAIN_TAG } from "@/project/defaults/chipsetMapping";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";

/** terrain 배열을 오염시킨 뒤 하네스를 다시 적용해, 실제로 재기록된 값을 본다. */
function reappliedTerrain(): readonly number[] {
  const tileset = defaultTileset();
  tileset.terrain = tileset.terrain.map(() => 99);
  applyCombinedTownHarness(tileset);
  return tileset.terrain;
}

function groupById(fragment: string) {
  const group = COMBINED_TOWN_HARNESS_GROUPS.find((g) => g.id.includes(fragment));
  if (!group) throw new Error(`기대한 하네스 그룹 없음: ${fragment}`);
  return group;
}

describe("combinedTown terrainTag (특성화)", () => {
  it("하네스 그룹 목록은 비어 있지 않다", () => {
    // 아래 순회 테스트가 공집합을 돌며 통과하는 상황을 막는다.
    expect(COMBINED_TOWN_HARNESS_GROUPS.length).toBeGreaterThan(0);
    expect(COMBINED_TOWN_HARNESS_GROUPS.some((g) => g.role === "water")).toBe(true);
  });

  it("water 역할 그룹만 water 태그를 요구한다", () => {
    const tileset = defaultTileset();
    for (const group of COMBINED_TOWN_HARNESS_GROUPS) {
      const wantsWater = roleCapabilities(tileset, group.role).terrainTag === "water";
      expect(wantsWater, `그룹 ${group.id}`).toBe(group.role === "water");
    }
  });

  it("흙길 그룹은 role 이 terrain 이라 태그를 id 로 판정한다", () => {
    const road = COMBINED_TOWN_HARNESS_GROUPS.find((g) => g.id.includes("dirt-road"));
    expect(road).toBeDefined();
    expect(road!.role).toBe("terrain");
  });

  // 위 두 테스트는 terrainTagForGroup 을 부르지 않는다. 아래가 실제 기록값을 본다.
  // 한계: 기본 타일셋에서는 칩셋 폴백이 이미 강제값과 같아(물 1, 흙길 0) **분기 삭제**는
  // 관측되지 않는다. 이 테스트가 잡는 것은 강제값 자체가 틀어지는 변이다.
  it("물 그룹 타일은 WATER, 흙길 타일은 NORMAL 지형 태그를 받는다", () => {
    const terrain = reappliedTerrain();
    for (const tile of groupById("lake-water").tileIds) {
      expect(terrain[tile], `물 타일 ${tile}`).toBe(TERRAIN_TAG.WATER);
    }
    for (const tile of groupById("dirt-road").tileIds) {
      expect(terrain[tile], `흙길 타일 ${tile}`).toBe(TERRAIN_TAG.NORMAL);
    }
  });
});
