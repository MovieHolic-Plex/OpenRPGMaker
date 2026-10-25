import { retiredEasyRpgChipsetTileset } from "../../src/project/defaults/defaultAssets";
import { ensureInteriorRoomHarness } from "../../src/editor/interiorRoomPipeline";
import type { Project, TilesetDef } from "../../src/project/types";

/**
 * 2026-10-07 저작권 정리 전에 저장한 프로젝트를 재현한다 — 그 프로젝트들은 EasyRPG 실내·합본 마을 타일셋 정의를 그대로 들고 있다.
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
];

export function withRetiredEasyRpgTilesets<T extends { tilesets: Record<string, TilesetDef> }>(project: T): T {
  const addedInterior = !project.tilesets[RETIRED_INTERIOR_TILESET_ID];
  for (const sheet of RETIRED_SHEETS) {
    if (project.tilesets[sheet.id]) continue;
    const tileset = retiredEasyRpgChipsetTileset(sheet.textureKey, sheet.name);
    if (tileset.id !== sheet.id) throw new Error(`retired tileset id drift: ${tileset.id} != ${sheet.id}`);
    project.tilesets[sheet.id] = tileset;
  }
  if (addedInterior) ensureInteriorRoomHarness(project as unknown as Project);
  return project;
}
