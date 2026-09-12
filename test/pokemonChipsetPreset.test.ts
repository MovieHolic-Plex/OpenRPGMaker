// test/pokemonChipsetPreset.test.ts
// 배치 5 — 포켓몬풍 칩셋 큐레이션 프리셋 계약 테스트.
// 고정하는 것: (1) 프리셋 role→group id 가 전부 실재하는 번들(bundled-default) 하네스 그룹을 가리키고
// isTrustedGroupSource 로 승인 취급된다 (2) 키큰 풀(DARK_GRASS)은 통행 가능한 별도 시맨틱이다
// (3) 신규 tall-grass 그룹으로 "잔디 맵 + 흙길 + 키큰풀 구역" 한 장면을 실제로 조립할 수 있다.

import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import {
  POKEMON_OVERWORLD_PRESET,
  pokemonPresetGroupIds,
  pokemonPresetRole,
  pokemonPresetRoleLabels,
} from "@/project/defaults/pokemonChipsetPreset";
import { CHIPSET_TILE_GROUPS, describeChipsetTile } from "@/project/defaults/chipsetMapping";
import { COMBINED_TOWN_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsCombinedTown";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { isTrustedGroupSource } from "@/project/tileVocabulary";
import type { TilesetDef } from "@/project/types";

const MAP_ID = "map_blank_start";

function defaultTilesetOf(): TilesetDef {
  return createBlankProject().tilesets[DEFAULT_TILESET_ID];
}

describe("포켓몬풍 오버월드 프리셋 — role 노출", () => {
  it("잔디·키큰풀·흙길·물·나무·꽃·마을건물 role 을 한국어 라벨과 함께 노출한다", () => {
    const roles = POKEMON_OVERWORLD_PRESET.roles.map((entry) => entry.role);
    expect(roles).toEqual([
      "grass_field",
      "tall_grass",
      "dirt_route",
      "water",
      "trees",
      "flowers",
      "village_buildings",
    ]);
    for (const entry of POKEMON_OVERWORLD_PRESET.roles) {
      expect(entry.label.length, entry.role).toBeGreaterThan(0);
      expect(entry.summary.length, entry.role).toBeGreaterThan(0);
      expect(entry.groupIds.length, entry.role).toBeGreaterThan(0);
      expect(entry.tools.length, entry.role).toBeGreaterThan(0);
    }
    // 한국어 라벨(사람이 읽는) 부여 확인.
    expect(pokemonPresetRole("tall_grass")?.label).toContain("키큰 풀");
    expect(pokemonPresetRoleLabels().find((r) => r.role === "grass_field")?.label).toBe("잔디 벌판");
    expect(POKEMON_OVERWORLD_PRESET.tilesetId).toBe(DEFAULT_TILESET_ID);
  });

  it("참조하는 group id 는 전부 실재하는 bundled-default 하네스 그룹이고 승인 취급된다", () => {
    const tileset = defaultTilesetOf();
    const byId = new Map((tileset.tileGroups ?? []).map((group) => [group.id, group]));
    for (const groupId of pokemonPresetGroupIds()) {
      const group = byId.get(groupId);
      expect(group, `그룹 미존재: ${groupId}`).toBeDefined();
      expect(group!.source, groupId).toBe("bundled-default");
      // 번들 그룹은 isTrustedGroupSource=true 라 시공 프리미티브가 soft-confirm 없이 소비한다.
      expect(isTrustedGroupSource(group!), groupId).toBe(true);
    }
  });

  it("키큰 풀 role 은 신규 tall-grass 그룹을, 마을건물 role 은 벽/지붕/문 그룹을 가리킨다", () => {
    expect(pokemonPresetRole("tall_grass")?.groupIds).toEqual([`${COMBINED_TOWN_HARNESS_PREFIX}tall-grass-autotile`]);
    const village = pokemonPresetRole("village_buildings");
    expect(village?.groupIds).toEqual(expect.arrayContaining([
      `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`,
      `${COMBINED_TOWN_HARNESS_PREFIX}roof-body`,
      `${COMBINED_TOWN_HARNESS_PREFIX}roof-overlays`,
      `${COMBINED_TOWN_HARNESS_PREFIX}doors`,
    ]));
    expect(village?.tools).toEqual(expect.arrayContaining(["build_wall", "build_roof", "place_door"]));
  });
});

describe("키큰 풀(DARK_GRASS) 시맨틱 — 통행 가능 유지", () => {
  it("describeChipsetTile 이 DARK_GRASS 대역을 tall_grass/통행가능/하위로 분류한다", () => {
    for (const index of CHIPSET_TILE_GROUPS.tallGrass) {
      const tile = describeChipsetTile(index);
      expect(tile.key, `tile ${index}`).toBe("tall_grass");
      expect(tile.usage, `tile ${index}`).toBe("terrain");
      expect(tile.passage, `tile ${index}`).toBe("passable"); // 인카운터는 별도 배선, 타일은 통행 가능.
      expect(tile.layer, `tile ${index}`).toBe("lower");
      expect(tile.terrainTag, `tile ${index}`).toBe(0); // NORMAL — 잔디와 동일.
      expect(tile.tags).toContain("encounter");
    }
    // 대표 DARK_GRASS 타일.
    expect(describeChipsetTile(TILE.DARK_GRASS).key).toBe("tall_grass");
  });

  it("검색 시맨틱에 키큰 풀/인카운터 태그가 통행 가능으로 등록된다", () => {
    const entry = COMBINED_TOWN_TILE_SEMANTICS.find((e) => e.index === TILE.DARK_GRASS);
    expect(entry).toBeDefined();
    expect(entry!.passage).toBe("passable");
    expect(entry!.label).toBe("키큰 풀");
    expect(entry!.tags).toEqual(expect.arrayContaining(["인카운터", "tall grass"]));
  });
});

describe("헤드리스 장면 조립 — 잔디 맵 + 흙길 + 키큰풀 구역", () => {
  it("프리셋 material 라벨로 fill_region 을 태워 잔디/흙길/키큰풀을 실제 배치한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };

    // 1) 잔디 벌판으로 맵 전체 바닥을 깐다.
    const grass = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 0, y: 0, w: 20, h: 15 }, material: "잔디" });
    expect(grass.ok, grass.summary).toBe(true);
    // 번들 시드라 목업 확인 대기(soft) 경고가 붙지 않는다.
    expect((grass.diff?.warnings ?? []).some((w) => w.includes("목업 확인 대기")), "grass").toBe(false);

    // 2) 가로 흙길 루트(3칸 폭 — 가운데 줄은 오토타일 바디).
    const dirt = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 0, y: 7, w: 20, h: 3 }, material: "흙길" });
    expect(dirt.ok, dirt.summary).toBe(true);

    // 3) 키큰 풀 구역(인카운터 풀숲).
    const tall = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 5, h: 3 }, material: "키큰 풀" });
    expect(tall.ok, tall.summary).toBe(true);
    expect((tall.diff?.warnings ?? []).some((w) => w.includes("목업 확인 대기")), "tall").toBe(false);

    const map = ctx.project.maps[MAP_ID];
    const at = (x: number, y: number) => map.lowerTiles[y * map.width + x];

    // Auto-connect selects the interior variant, not the palette's representative tile.
    expect(at(4, 3)).toBe(304);
    expect(CHIPSET_TILE_GROUPS.tallGrass).toContain(at(4, 3));
    expect(isPassable(ctx.project, map, 4, 3)).toBe(true);

    // 흙길 루트: 가운데 줄(내부 칸)은 오토타일 바디 타일.
    expect(CHIPSET_TILE_GROUPS.dirtRoadBody as readonly number[]).toContain(at(10, 8));

    // 잔디 벌판이 남은 곳: 기본 잔디.
    expect(at(18, 13)).toBe(TILE.GRASS);
  });
});
