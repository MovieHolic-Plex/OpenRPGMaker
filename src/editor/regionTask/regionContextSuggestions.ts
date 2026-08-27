// 영역 주변 인접 타일 분석 기반 동적 추천.
// nextSuggestedRegionCommands (정적 로테이션) 의 컨텍스트 인식 대체.
// 순수 함수 — store 의존 없음.
//
// 알고리즘:
// 1. 영역 바깥 1타일 두르레이트 수집 (상하좌우 + 대각)
// 2. 각 타일을 categorizeTileForContext 로 5카테고리 분류
// 3. 카테고리 카운트 가중치로 동적 추천 생성
// 4. 영역 크기 필터 (거시 제안은 큰 영역만)
// 5. 빈 결과면 정적 코퍼스에서 충원
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { isPathSurfaceTile } from "@/editor/tools/placementTools";
import { isTreeCanopyTileId, isTreeTrunkTileId } from "@/project/tilesetHarness/combinedTown";
import type { MapId, Project, TilesetDef } from "@/project/types";
import type { RegionRect } from "./clipToRegion";
import {
  SUGGESTED_REGION_COMMANDS,
  type SuggestedRegionCommand,
  type TilesetCategory,
} from "./suggestedCommands";

/** 타일셋 id → 카테고리. 알 수 없으면 outdoor(현재 동작 유지 폴백). */
export function categorizeTileset(tilesetId: string | undefined): TilesetCategory {
  if (!tilesetId) return "outdoor";
  if (tilesetId === "easyrpg_chipset_dungeon") return "dungeon";
  if (tilesetId === "easyrpg_chipset_interior") return "interior";
  return "outdoor"; // combined_town, legacy, 커스텀 — 야외로 간주
}

/** 명령이 현재 타일셋 카테고리에 적합한지. tilesets 생략/빈 배열 = any(true). */
export function commandFitsTileset(
  cmd: Pick<SuggestedRegionCommand, "tilesets">,
  category: TilesetCategory,
): boolean {
  if (!cmd.tilesets || cmd.tilesets.length === 0) return true;
  return cmd.tilesets.includes(category);
}

export type ContextTileCategory = "water" | "road" | "forest" | "building" | "other";

/** 단일 타일 id → 컨텍스트 카테고리. 순수 함수. */
export function categorizeTileForContext(
  tileId: number,
  tileset: TilesetDef | undefined,
): ContextTileCategory {
  void tileset; // 향후 tileset.tileMeta 로 정교화 여지. 현재는 글로벌 타일 의미로 충분.
  if (tileId === TILE.WATER || isWaterChipsetTile(tileId) || isLakeAutotileTile(tileId)) {
    return "water";
  }
  if (isPathSurfaceTile(tileId)) return "road";
  if (isTreeCanopyTileId(tileId) || isTreeTrunkTileId(tileId) || tileId === TILE.TREE) {
    return "forest";
  }
  // 건물: 지붕/벽 휴리스틱 — 구체적 id 세트 대신 통행 불가 + 비물/비길/비나무 solid 타일.
  // 정확도가 떨어지지만, 추천 품질에만 영향(기능 정지 아님). 향후 tileset.tileMeta 보강.
  if (tileId === TILE.WALL) return "building";
  return "other";
}

/** 영역 주변 1타일 두르레이트의 카테고리 카운트. */
export function countAdjacentTileCategories(
  map: { readonly width: number; readonly height: number; readonly lowerTiles: readonly number[] },
  region: RegionRect,
  tileset: TilesetDef | undefined,
): Record<ContextTileCategory, number> {
  const counts: Record<ContextTileCategory, number> = {
    water: 0, road: 0, forest: 0, building: 0, other: 0,
  };
  const { x, y, width: rw, height: rh } = region;
  for (let dy = -1; dy <= rh; dy += 1) {
    for (let dx = -1; dx <= rw; dx += 1) {
      // 영역 내부 셀은 스킵 (외곽만)
      if (dy >= 0 && dy < rh && dx >= 0 && dx < rw) continue;
      const mapX = x + dx;
      const mapY = y + dy;
      if (mapX < 0 || mapY < 0 || mapX >= map.width || mapY >= map.height) continue;
      const idx = mapY * map.width + mapX;
      const tileId = map.lowerTiles[idx] ?? TILE.EMPTY;
      if (tileId === TILE.EMPTY || tileId < 0) {
        counts.other += 1;
        continue;
      }
      counts[categorizeTileForContext(tileId, tileset)] += 1;
    }
  }
  return counts;
}
function buildContextualPool(
  counts: Record<ContextTileCategory, number>,
  regionArea: number,
): SuggestedRegionCommand[] {
  const pool: SuggestedRegionCommand[] = [];
  const addById = (id: string): void => {
    const found = SUGGESTED_REGION_COMMANDS.find((c) => c.id === id);
    if (found && !pool.some((c) => c.id === id)) pool.push(found);
  };
  // 물 인접: 부두/다리 는 야외 전용(실내/던전엔 부적합).
  if (counts.water >= 3) {
    pool.push({
      id: "dock", icon: "structure", label: "부두",
      instruction: "물 옆에 나무 부두를 만들어줘",
      category: "구조물",
      tilesets: ["outdoor"],
    });
    pool.push({
      id: "bridge", icon: "structure", label: "다리",
      instruction: "이 영역에 다리를 놓아줘",
      category: "구조물",
      tilesets: ["outdoor"],
    });
  }
  // 길 인접: 가로수(야외)/상가
  if (counts.road >= 2) {
    pool.push({
      id: "street-trees", icon: "polish", label: "가로수",
      instruction: "길을 따라 가로수를 심어줘",
      category: "다듬기",
      tilesets: ["outdoor"],
    });
    addById("merchant-npc");
  }
  // 숲 인접: 사냥터/캠프파이어 (야외)
  if (counts.forest >= 3) {
    pool.push({
      id: "hunting-ground", icon: "combat", label: "사냥터",
      instruction: "이 영역을 슬라임이 나오는 사냥터로 만들어줘",
      category: "전투",
      tilesets: ["outdoor"],
    });
    pool.push({
      id: "campfire", icon: "mood", label: "캠프파이어",
      instruction: "숲 가장자리에 캠프파이어와 통나무 의자를 만들어줘",
      category: "구조물",
      tilesets: ["outdoor"],
    });
  }
  // 건물 인접: 울타리/정원
  if (counts.building >= 2) {
    addById("pasture-fence");
    addById("garden");
  }

  // 영역 크기 필터 — 거시 제안은 15×15(225셀) 이상만
  if (regionArea >= 225) {
    addById("inn-guests");
    addById("festival");
  } else {
    // 작은 영역(3×3=9 미만)은 구조물 제안 축소 — 소품/다듬기 위주로 폴백에서 채움
    if (regionArea < 9) {
      addById("flower-scatter");
      addById("treasure-chest");
    }
  }
  return pool;
}

/** 컨텍스트 기반 동적 추천. 빈 결과면 정적 코퍼스 로테이션으로 충원.
 *  항상 count 개를 반환. */
export function suggestRegionCommandsByContext(
  project: Project,
  mapId: MapId,
  region: RegionRect,
  count = 4,
): SuggestedRegionCommand[] {
  const map = project.maps[mapId];
  if (!map) return fallbackStatic(count, "outdoor");
  const tileset = project.tilesets[map.tilesetId];
  const category = categorizeTileset(map.tilesetId);
  const counts = countAdjacentTileCategories(map, region, tileset);
  const regionArea = region.width * region.height;
  const pool = buildContextualPool(counts, regionArea).filter((cmd) => commandFitsTileset(cmd, category));
  if (pool.length === 0) return fallbackStatic(count, category);
  // 컨텍스트 풀이 count 미만이면 정적 코퍼스에서 타일셋 적합 + 중복 없이 충원
  if (pool.length < count) {
    for (const cmd of SUGGESTED_REGION_COMMANDS) {
      if (pool.length >= count) break;
      if (!commandFitsTileset(cmd, category)) continue;
      if (!pool.some((c) => c.id === cmd.id)) pool.push(cmd);
    }
  }
  return pool.slice(0, count);
}

function fallbackStatic(count: number, category: TilesetCategory = "outdoor"): SuggestedRegionCommand[] {
  return SUGGESTED_REGION_COMMANDS.filter((cmd) => commandFitsTileset(cmd, category)).slice(0, count);
}
