// EasyRPG 번들 칩셋 6종(retro_dungeon/retro_exterior/retro_house/retro_world/ship/world)의
// 시맨틱 테이블이 **칩셋별로 정확히 배선**되는지 단정한다.
//
// 왜 이 테스트가 존재하는가: resourceSearch.ts 의 폴백이
//   if (tileset?.image.type === "bundled") return COMBINED_TOWN_TILE_SEMANTICS;
// 였기 때문에, interior/dungeon 이 아닌 모든 번들 칩셋(배·월드맵·레트로 4종)이 **마을 라벨을
// 오답으로** 받아 갔다. AI 검색과 타일 라벨 조회가 전부 다른 칩셋의 사실을 인용하게 된다.
// 이 테스트는 그 오답을 재발 시 즉시 빨간불로 만든다.

import { describe, expect, it } from "vitest";
import { bundledTileSemantics } from "@/assets/resourceSearch";
import { bundledTileLabels } from "@/editor/tools/tileMetadataTools";
import { COMBINED_TOWN_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsCombinedTown";
import { DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsDungeon";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import { RETRO_DUNGEON_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroDungeon";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroExterior";
import { RETRO_HOUSE_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroHouse";
import { RETRO_WORLD_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroWorld";
import { SHIP_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsShip";
import { WORLD_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsWorld";
import type { TilesetDef } from "@/project/types";

function bundledTileset(textureKey: string): TilesetDef {
  return {
    id: `test-${textureKey}`,
    name: textureKey,
    image: { type: "bundled", id: textureKey },
    tileSize: 16,
    columns: 30,
    rows: 16,
  } as unknown as TilesetDef;
}

/** 6종 + 기존 3종 = 배선이 정확히 9갈래로 갈라져야 한다. */
const WIRING = [
  { textureKey: "tex_easyrpg_chipset_retro_dungeon", table: RETRO_DUNGEON_TILE_SEMANTICS, drawable: 478 },
  { textureKey: "tex_easyrpg_chipset_retro_exterior", table: RETRO_EXTERIOR_TILE_SEMANTICS, drawable: 478 },
  { textureKey: "tex_easyrpg_chipset_retro_house", table: RETRO_HOUSE_TILE_SEMANTICS, drawable: 478 },
  { textureKey: "tex_easyrpg_chipset_retro_world", table: RETRO_WORLD_TILE_SEMANTICS, drawable: 480 },
  { textureKey: "tex_easyrpg_chipset_ship", table: SHIP_TILE_SEMANTICS, drawable: 464 },
  { textureKey: "tex_easyrpg_chipset_world", table: WORLD_TILE_SEMANTICS, drawable: 478 },
] as const;

describe("6종 번들 칩셋 시맨틱 배선", () => {
  it.each(WIRING)("$textureKey 는 자기 전용 테이블을 돌려준다", ({ textureKey, table }) => {
    const resolved = bundledTileSemantics(bundledTileset(textureKey));
    expect(resolved).toBe(table);
  });

  it.each(WIRING)("$textureKey 는 마을 테이블을 돌려주지 않는다", ({ textureKey }) => {
    const resolved = bundledTileSemantics(bundledTileset(textureKey));
    expect(resolved).not.toBe(COMBINED_TOWN_TILE_SEMANTICS);
    expect(resolved).not.toBe(INTERIOR_TILE_SEMANTICS);
    expect(resolved).not.toBe(DUNGEON_TILE_SEMANTICS);
  });

  it.each(WIRING)("$textureKey 는 도화 가능 칸 전수를 라벨로 노출한다", ({ textureKey, drawable }) => {
    const labels = bundledTileLabels(bundledTileset(textureKey));
    expect(labels.size).toBe(drawable);
  });

  it("기존 3종 배선은 그대로다", () => {
    expect(bundledTileSemantics(bundledTileset("tex_easyrpg_chipset_interior"))).toBe(INTERIOR_TILE_SEMANTICS);
    expect(bundledTileSemantics(bundledTileset("tex_easyrpg_chipset_dungeon"))).toBe(DUNGEON_TILE_SEMANTICS);
    expect(bundledTileSemantics(bundledTileset("tex_easyrpg_chipset_combined_town"))).toBe(COMBINED_TOWN_TILE_SEMANTICS);
  });
});
