// 폐기된 EasyRPG 계열 칩셋(2026-10-06 사용자 결정): 「대체품이 생기기 전까지 막고」. 조수는 이 칩셋으로 새 맵을 만들거나
// 맵의 칩셋을 이 칩셋으로 바꾸지 못한다(실행기 toolRunner 가 조수 실행에서만 집행한다 — ToolContext.assistantRun).
// - 이미 이 칩셋으로 깐 맵은 그대로 그려지고 사람·조수 모두 계속 고칠 수 있다(사용자 프로젝트 숲마을 맵 30장 등).
// - 등록 장소·공용 오브젝트(라이브러리)는 계속 쓴다(같은 날 결정: 「조수 추천 목록에 넣어놔라」) — import_region_reference 는 막지 않는다.
// - 월드맵은 예외다(2026-09-30 「EasyRPG 월드맵을 개선하는 방향」).
// 계보: family "easyrpg"(EasyRPG 칩셋·숲마을 재칠·Tibo·탈것 시트), 바이옴 시트 atlas_biome_*(0~2729 칸이 숲마을 재칠),
// atlas_biome_dungeon(EasyRPG 배·던전을 다시 묶은 시트), oprn_dungeon_*(EasyRPG 던전 재칠). 실내 손 도트 v5 는 아니다.
import { tilesetFamily } from "./tilesetFamily";
import type { Project, TilesetDef } from "./types";

const WORLD_EXCEPTIONS: ReadonlySet<string> = new Set([
  "easyrpg_chipset_world", "easyrpg_chipset_retro_world", "atlas_biome_world",
]);
const NOT_RETIRED: ReadonlySet<string> = new Set(["atlas_biome_interior"]);
const RETIRED_PREFIXES = ["easyrpg_chipset_", "forest_harmony", "atlas_biome_", "oprn_dungeon_"] as const;

/** 라이브러리에서 등록 장소를 맵째 가져오는 도구 — 폐기 칩셋 위 장소도 가져올 수 있다. */
export const LIBRARY_IMPORT_TOOLS: ReadonlySet<string> = new Set(["import_region_reference"]);

function retiredById(id: string): boolean {
  if (WORLD_EXCEPTIONS.has(id) || NOT_RETIRED.has(id)) return false;
  return RETIRED_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/** 사본 타일셋(장소 가져오기의 copied 등)은 원본을 따라가 판정한다. */
function lineage(project: Pick<Project, "tilesets">, tileset: TilesetDef): string[] {
  const ids = [tileset.id];
  const seen = new Set(ids);
  let current: TilesetDef | undefined = tileset;
  while (current?.referenceSourceTilesetId && !seen.has(current.referenceSourceTilesetId)) {
    ids.push(current.referenceSourceTilesetId);
    seen.add(current.referenceSourceTilesetId);
    current = project.tilesets[current.referenceSourceTilesetId];
  }
  return ids;
}

/** 조수가 새 맵에 쓰면 안 되는 EasyRPG 계열 칩셋인가. 모르는 id(프로젝트에 없는 타일셋)는 id 로만 가른다. */
export function isRetiredEasyRpgTileset(project: Pick<Project, "tilesets">, tilesetId: string): boolean {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return retiredById(tilesetId);
  const ids = lineage(project, tileset);
  if (ids.some((id) => WORLD_EXCEPTIONS.has(id) || NOT_RETIRED.has(id))) return false;
  if (ids.some(retiredById)) return true;
  return tilesetFamily(project, tilesetId) === "easyrpg";
}

export function retiredEasyRpgMessage(tilesetId: string, toolName: string): string {
  return `${toolName} 이 EasyRPG 계열 칩셋 "${tilesetId}" 로 맵을 만들거나 바꾸려 해 거부했다 — EasyRPG 계열(숲마을·바이옴·배·던전 칩셋)은 폐기됐고 대체 생성 칩셋이 아직 없다. `
    + `이미 그 칩셋으로 깐 맵은 계속 고칠 수 있다. 던전·동굴·숲마을·들판이 필요하면 등록 장소를 가져온다: list_spatial_designs({kind:"place"}) 로 찾고 import_region_reference({id}) 한 번으로 맵째 가져온다. `
    + `마을·항구·읍은 버들항(author_beodeul_town), 실내·체육관·작은 홀은 build_hand_interior_room(손 도트 v5)으로 짓는다. 맞는 장소가 없으면 만들지 말고 「아직 이 칩셋으로는 만들 수 없다」고 사용자에게 보고한다.`;
}
