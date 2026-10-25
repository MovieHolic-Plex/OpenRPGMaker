import { retiredEasyRpgChipsetTileset } from "../../src/project/defaults/defaultAssets";
import { TILE } from "../../src/project/defaults/constants";
import { blankFillTileFor } from "../../src/project/defaults/defaultMaps";
import { ensureTilesetHarnesses } from "../../src/project/tilesetHarness";
import { ensureInteriorRoomHarness } from "../../src/editor/interiorRoomPipeline";
import type { Project, TilesetDef } from "../../src/project/types";

/**
 * 2026-10-07 저작권 정리 전에 저장한 프로젝트를 재현한다 — 그 프로젝트들은 EasyRPG 실내·합본 마을·던전·월드 타일셋 정의를 그대로 들고 있다.
 *
 * 왜: 공간 컴파일러·실내 도구 테스트 약 90개가 `createBlankProject().tilesets.easyrpg_chipset_interior` 를 썼는데, 정리 뒤
 * 새 프로젝트에는 그 타일셋이 없어 픽스처가 「Missing shipped interior atlas」로 시작조차 못 했다(ci-full 40165485978).
 * 편집기는 옛 저장본의 이 정의와 그 칩셋으로 깐 맵을 계속 읽는다(retiredInteriorTilesets.ts) — 그 호환을 이 정의로 검증한다.
 * 옛 프로젝트의 실내 정의에는 편집기 정규화(ensureInteriorRoomHarness)가 심은 가구 킷(bed_v·stairs_down…)·벽 오토타일·방 그룹이 있다 — 같이 심는다.
 * 이미 있으면 건드리지 않는다.
 */
export const RETIRED_INTERIOR_TILESET_ID = "easyrpg_chipset_interior";
export const RETIRED_COMBINED_TOWN_TILESET_ID = "easyrpg_chipset_combined_town";

const RETIRED_SHEETS: readonly { readonly id: string; readonly textureKey: string; readonly name: string }[] = [
  { id: RETIRED_INTERIOR_TILESET_ID, textureKey: "tex_easyrpg_chipset_interior", name: "실내" },
  { id: RETIRED_COMBINED_TOWN_TILESET_ID, textureKey: "tex_easyrpg_chipset_combined_town", name: "합본 마을" },
  { id: "easyrpg_chipset_dungeon", textureKey: "tex_easyrpg_chipset_dungeon", name: "던전" },
  { id: "easyrpg_chipset_world", textureKey: "tex_easyrpg_chipset_world", name: "월드" },
  { id: "easyrpg_chipset_retro_world", textureKey: "tex_easyrpg_chipset_retro_world", name: "레트로 월드" },
];

export function withRetiredEasyRpgTilesets<T extends { tilesets: Record<string, TilesetDef> }>(
  project: T,
  options: { readonly interiorHarness?: boolean } = {},
): T {
  const addedInterior = !project.tilesets[RETIRED_INTERIOR_TILESET_ID];
  for (const sheet of RETIRED_SHEETS) {
    if (project.tilesets[sheet.id]) continue;
    const tileset = retiredEasyRpgChipsetTileset(sheet.textureKey, sheet.name);
    if (tileset.id !== sheet.id) throw new Error(`retired tileset id drift: ${tileset.id} != ${sheet.id}`);
    // 옛 저장본을 열면 로드 정규화(ensureTilesetHarnesses)가 합본 마을 하네스 그룹(벽 9분할·나무·꽃 …)을 다시 심는다.
    // 표준 시트 경로는 tileGroups 를 비우므로, 로드 뒤 상태를 재현하려면 같은 정규화를 한 번 돌린다.
    ensureTilesetHarnesses({ tilesets: { [sheet.id]: tileset } });
    project.tilesets[sheet.id] = tileset;
  }
  if (addedInterior && options.interiorHarness !== false) ensureInteriorRoomHarness(project as unknown as Project);
  return project;
}

/** 지운 EasyRPG 시트 하나의 옛 정의(새 사본). `defaultTilesets().easyrpg_chipset_world` 처럼 쓰던 테스트용. */
export function retiredEasyRpgTileset(id: string): TilesetDef {
  const sheet = RETIRED_SHEETS.find((entry) => entry.id === id);
  if (!sheet) throw new Error(`not a retired EasyRPG sheet: ${id}`);
  const holder = withRetiredEasyRpgTilesets({ tilesets: {} as Record<string, TilesetDef> });
  const tileset = holder.tilesets[id];
  if (!tileset) throw new Error(`retired tileset not built: ${id}`);
  return tileset;
}

/**
 * 옛 저장본처럼 시작 맵이 합본 마을 칩셋 위에 있는 프로젝트를 만든다.
 *
 * 왜: tilesetId 를 생략한 타일 도구는 시작 맵의 타일셋(defaultToolTilesetId)을 쓴다. 정리 뒤 새 프로젝트의 시작 맵은
 * beodeul_city 라, 합본 마을 그룹·타일 번호를 겨냥한 시험이 엉뚱한 칩셋에서 「그룹을 찾을 수 없습니다」로 끝났다.
 * 빈 맵 바닥은 createBlankMap 이 그 칩셋에 깔았을 기본 풀로 다시 채운다(버들항 칩 번호가 남지 않게).
 */
export function startOnRetiredCombinedTown<T extends Project>(project: T, options: { readonly interiorHarness?: boolean } = {}): T {
  withRetiredEasyRpgTilesets(project, options);
  const tileset = project.tilesets[RETIRED_COMBINED_TOWN_TILESET_ID];
  const map = project.maps[project.startMapId];
  if (!tileset || !map) throw new Error("startOnRetiredCombinedTown: missing combined town tileset or start map");
  map.tilesetId = tileset.id;
  map.tileSize = tileset.tileSize;
  map.lowerTiles = map.lowerTiles.map(() => blankFillTileFor(tileset.id, TILE.GRASS, tileset));
  return project;
}
