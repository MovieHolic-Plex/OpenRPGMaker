import { describe, expect, it } from "vitest";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { FARMLAND_TILE } from "@/project/defaults/chipsetMapping";
import { farmlandGroupForTileset } from "@/project/defaults/farmlandGroup";
import type { AutotileGroup, TilesetDef } from "@/project/types";

// 농사 런타임은 타일셋 정의에서 경작지 그룹을 읽는다. 다른 시트에 EasyRPG 번호(187…)를 그리지 않는다.

describe("farmlandGroupForTileset", () => {
  it("beodeul_city 는 경작지 그룹이 없어 undefined (187번은 언덕 성벽 칸이다)", () => {
    const tileset = createBeodeulCityTileset();
    expect(tileset.autotileGroups?.some((g) => g.id === "builtin_farmland")).toBeFalsy();
    expect(farmlandGroupForTileset(tileset)).toBeUndefined();
  });

  it("레거시 기본 타일셋(미지정)은 내장 경작지 그룹을 쓴다", () => {
    const group = farmlandGroupForTileset(undefined);
    expect(group?.id).toBe("builtin_farmland");
    expect(group?.variantMap["255"]).toBe(FARMLAND_TILE.BODY);
  });

  it("타일셋이 정의한 경작지 그룹을 번호 하드코딩 없이 그대로 쓴다", () => {
    const custom: AutotileGroup = {
      id: "farmland",
      name: "밭",
      memberTileIds: [9000, 9001],
      variantMap: { "255": 9001, "0": 9000 },
    };
    const tileset = { ...createBeodeulCityTileset(), autotileGroups: [custom] } as TilesetDef;
    expect(farmlandGroupForTileset(tileset)).toBe(custom);
  });

  it("멤버나 변형 지도가 비어 있는 그룹은 무시한다", () => {
    const empty: AutotileGroup = { id: "farmland", name: "밭", memberTileIds: [], variantMap: {} };
    const tileset = { ...createBeodeulCityTileset(), autotileGroups: [empty] } as TilesetDef;
    expect(farmlandGroupForTileset(tileset)).toBeUndefined();
  });
});
