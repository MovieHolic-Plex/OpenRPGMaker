import { describe, expect, it } from "vitest";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import type { TilesetDef } from "@/project/types";

/**
 * requireAutotileGroup 경로가 고른 그룹 id — isAutotileGroup 의 유일한 공개 관측창이다.
 * 오토타일이 아니라고 판정되면 "missing" 이 돌아온다.
 */
function autotileGroupIdFor(tileset: TilesetDef, query: string): string {
  const result = resolveMaterialByLabel(tileset, query, { requireAutotileGroup: true });
  if (result.status === "missing") return "missing";
  return result.kind === "group" ? result.group.id : "tile";
}

/** 기본 타일셋의 water 그룹은 문법도 갖고 있다 — 역할 분기를 보려면 문법을 떼야 한다. */
function tilesetWithoutWaterGrammar(): TilesetDef {
  const tileset = defaultTileset();
  tileset.tileGroups = (tileset.tileGroups ?? []).map((group) =>
    group.role === "water" ? { ...group, patternGrammar: undefined } : group
  );
  return tileset;
}

describe("오토타일 역할 (특성화)", () => {
  it("water 만 문법 없이도 오토타일로 취급된다", () => {
    const tileset = defaultTileset();
    expect(roleCapabilities(tileset, "water").autotile).toBe(true);
    for (const role of ["terrain", "wall", "roof", "prop", "fence", "building", "castle"]) {
      expect(roleCapabilities(tileset, role).autotile, role).toBe(false);
    }
  });

  // 위 테스트는 능력 표만 본다 — isAutotileGroup 을 한 번도 부르지 않는다.
  // 아래가 실제 판정을 두 분기로 갈라 통과시킨다.
  it("문법이 역할을 이긴다 — 문법 있는 terrain 은 오토타일, 문법 없는 fence 는 아니다", () => {
    const tileset = defaultTileset();
    // 잔디: role=terrain(autotile=false) 이지만 autotile_3x3 문법이 있어 오토타일이다.
    expect(autotileGroupIdFor(tileset, "잔디")).toBe("harness-combined-town-grass-autotile");
    // 울타리: role=fence + 문법 없음 → 오토타일이 아니다.
    expect(autotileGroupIdFor(tileset, "울타리")).toBe("missing");
  });

  it("문법을 잃은 water 그룹은 역할 능력만으로 오토타일을 유지한다", () => {
    expect(autotileGroupIdFor(tilesetWithoutWaterGrammar(), "애니메이션 물 오토타일")).toBe(
      "harness-combined-town-lake-water-autotile"
    );
  });
});
