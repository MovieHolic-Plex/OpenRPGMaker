import { describe, expect, it } from "vitest";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { FARMLAND_TILE } from "@/project/defaults/chipsetMapping";
import { farmlandGroupForTileset, wateredFarmlandGroupForTileset } from "@/project/defaults/farmlandGroup";
import type { AutotileGroup, TilesetDef } from "@/project/types";

// 농사 런타임은 타일셋 정의에서 경작지 그룹을 읽는다. 다른 시트에 EasyRPG 번호(187…)를 그리지 않는다.

describe("farmlandGroupForTileset", () => {
  it("beodeul_city 는 번들 경작지 그룹 `farmland`(27,648번 꼬리)을 쓴다 — 187번(언덕 성벽)은 쓰지 않는다", () => {
    const tileset = createBeodeulCityTileset();
    expect(tileset.autotileGroups?.some((g) => g.id === "builtin_farmland")).toBeFalsy();
    const group = farmlandGroupForTileset(tileset);
    expect(group?.id).toBe("farmland");
    expect(group?.memberTileIds.every((tile) => tile >= 27648)).toBe(true);
    expect(group?.memberTileIds).not.toContain(FARMLAND_TILE.BODY);
  });

  it("beodeul_city 의 물 준 흙 그룹은 마른 흙과 같은 마스크마다 다른(어두운) 칸을 준다", () => {
    const tileset = createBeodeulCityTileset();
    const dry = farmlandGroupForTileset(tileset)!;
    const wet = wateredFarmlandGroupForTileset(tileset);
    expect(wet?.id).toBe("farmland_watered");
    expect(Object.keys(wet!.variantMap).sort()).toEqual(Object.keys(dry.variantMap).sort());
    for (const mask of Object.keys(dry.variantMap)) expect(wet!.variantMap[mask]).not.toBe(dry.variantMap[mask]);
  });

  it("물 준 흙 그룹이 없는 타일셋은 undefined (런타임은 틴트로 폴백)", () => {
    expect(wateredFarmlandGroupForTileset(undefined)).toBeUndefined();
    const tileset = { ...createBeodeulCityTileset(), autotileGroups: [] } as TilesetDef;
    expect(wateredFarmlandGroupForTileset(tileset)).toBeUndefined();
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
