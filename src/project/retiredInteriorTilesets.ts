// 폐기된 실내 칩셋(2026-09-29 사용자 결정): 「기존 실내칩들 전부 공격적으로 폐기하고 interior-v5 만 반영, 조수들은 이 실내
// 칩들만 깔 수 있게」. 조수에게 보이는 목록(참고문서·공용 장소/오브젝트·킷)에서 빼고, 새 맵·가져오기·찍기는 거부한다.
// 번들·저장본의 타일셋 정의와 그 칩셋으로 이미 깐 맵은 그대로 둔다(편집기·옛 맵 재생 호환). 실내는 손 도트 v5
// (atlas_biome_interior, build_hand_interior_room)만 쓴다. 조수 칩셋 정책 전체(생성 칩셋 전용)는 atlas-policy 가 실행기에서 맡는다 —
// 여기는 실내 칩셋만 다루는 최소 판정이다.
import type { TilesetDef } from "./types";

export const HAND_INTERIOR_TILESET_ID = "atlas_biome_interior";

const RETIRED_IDS: ReadonlySet<string> = new Set([
  "easyrpg_chipset_interior",
  "tibo_interior_expanded",
  "opengameart_lpc_wooden_furniture",
  "opengameart_lpc_wooden_furniture_16",
]);
const RETIRED_TEXTURES: ReadonlySet<string> = new Set([
  "tex_easyrpg_chipset_interior",
  "tex_tibo_interior_expanded",
  "tex_opengameart_lpc_wooden_furniture",
  "tex_opengameart_lpc_wooden_furniture_16",
]);

/** 폐기된 실내 칩셋인가 — id 또는(타일셋이 있으면) 번들 그림으로 가른다. 옛 칸 번호를 이어받은 사본도 걸린다. */
export function isRetiredInteriorTileset(tilesetId: string | null | undefined, tileset?: Pick<TilesetDef, "image" | "referenceSourceTilesetId">): boolean {
  if (tilesetId && RETIRED_IDS.has(tilesetId)) return true;
  if (tileset?.image.type === "bundled" && RETIRED_TEXTURES.has(tileset.image.id)) return true;
  return tileset?.referenceSourceTilesetId !== undefined && RETIRED_IDS.has(tileset.referenceSourceTilesetId);
}

export function retiredInteriorMessage(tilesetId: string): string {
  return `실내 칩셋 "${tilesetId}" 는 폐기됐다 — 실내는 손 도트 v5 칩셋 ${HAND_INTERIOR_TILESET_ID} 하나만 쓴다. `
    + `새 실내는 build_hand_interior_room(plan·floor·wall·objects) 한 번으로 짓고, 부품 id 는 list_hand_interior_parts, 조립법은 list_tileset_references({tilesetId:"${HAND_INTERIOR_TILESET_ID}"}).`;
}

/** 공용 장소 행이 옛 실내인가 — 폐기 칩셋 위이거나, 실내 태그(건물 내부·실내·그림체:Tibo 실내)인데 손 도트 실내 칩셋이 아닌 것. */
export function isRetiredInteriorPlace(entry: { readonly tilesetId?: string | null; readonly tags?: readonly string[] }): boolean {
  if (isRetiredInteriorTileset(entry.tilesetId)) return true;
  const tags = entry.tags ?? [];
  const interior = tags.some((t) => t === "공간형태:건물 내부" || t === "실내" || t === "공간형태:실내");
  return interior && entry.tilesetId !== HAND_INTERIOR_TILESET_ID;
}
