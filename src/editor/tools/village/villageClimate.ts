// 마을의 기후(눈) — 숲마을 칩셋 마을을 칸 번호가 같은 설원 칩셋으로 옮기고 맵 날씨를 눈으로 둔다.
//
// 2026-09-24 등대지기 3차: 브리프는 「눈보라가 그치지 않는 항구 마을」인데 마을은 초록 여름 강마을,
// 보스 전투 배경은 여름 숲이었다. groundTheme:"snow" 는 합본 마을용 눈 오토타일만 칠하는 설정이라
// 숲마을(기본 칩셋)에서는 아무것도 바꾸지 못했고 맵 기후도 비어 전투 배경(climateBattleBackground)이
// 눈을 몰랐다. 설원 칩셋(forest_harmony_snow)은 숲마을과 칸 번호·통행이 같아(tiledata/climate-villages)
// 지은 뒤 칩셋만 바꾸면 같은 마을이 눈 덮인 마을이 된다.
//
// 기후 칩셋 맵을 다시 지을 때는 숲마을 칩셋으로 잠시 되돌려 짓고(시공기는 숲마을만 안다) 원래 칩셋으로 돌린다.

import type { AuthorVillageRequest } from "@/editor/construction/contracts";
import { CLIMATE_VILLAGE_TEXTURES, climateVillageTilesetId, createClimateVillageTileset, type ClimateVillageKind } from "@/project/defaults/climateVillages";
import { createForestHarmonyTileset, FOREST_HARMONY_ID } from "@/project/defaults/forestHarmony";
import { normalizeMapClimate } from "@/project/mapClimate";
import type { Project } from "@/project/types";
import { dressClimateMap } from "@/project/climateDressing";
import { downgradeHouseParts } from "@/project/defaults/forestHarmonyHouseParts";
import { houseKitForTileset, isHouseKitId } from "@/editor/houseKit";

const CLIMATE_LABEL: Readonly<Record<ClimateVillageKind, string>> = { snow: "설원", desert: "사막", volcano: "화산", autumn: "가을" };

function climateKindOf(project: Project, tilesetId: string | undefined): ClimateVillageKind | undefined {
  const tileset = tilesetId ? project.tilesets[tilesetId] : undefined;
  if (!tileset || tileset.image.type !== "bundled") return undefined;
  const kind = CLIMATE_VILLAGE_TEXTURES[tileset.image.id];
  return kind && climateVillageTilesetId(kind) === tilesetId ? kind : undefined;
}

/**
 * 시공 전에 부른다. 대상이 기후 칩셋이면 숲마을 칩셋으로 바꿔 두고(새 맵은 요청의 tilesetId 를) 원래 기후를 돌려준다.
 * 새 맵 요청은 복사본을 돌려준다 — 파서가 만든 요청은 읽기 전용이다.
 */
export function borrowForestHarmonyForClimateSheet(
  project: Project,
  request: AuthorVillageRequest,
): { readonly request: AuthorVillageRequest; readonly climate?: ClimateVillageKind } {
  const target = request.target;
  if (target.kind === "new") {
    const climate = climateKindOf(project, target.tilesetId);
    if (!climate) return { request };
    project.tilesets[FOREST_HARMONY_ID] ??= createForestHarmonyTileset();
    return { request: { ...request, target: { ...target, tilesetId: FOREST_HARMONY_ID } }, climate };
  }
  const map = project.maps[target.mapId];
  const climate = climateKindOf(project, map?.tilesetId);
  if (!map || !climate) return { request };
  project.tilesets[FOREST_HARMONY_ID] ??= createForestHarmonyTileset();
  map.tilesetId = FOREST_HARMONY_ID;
  return { request, climate };
}

/** 시공 뒤에 부른다. 눈 마을이거나 기후 칩셋에서 빌려 지은 숲마을 맵을 기후 칩셋으로 옮기고 경고 문장을 돌려준다. */
export function applyVillageClimate(project: Project, request: AuthorVillageRequest, borrowed: ClimateVillageKind | undefined): string[] {
  const map = project.maps[request.target.mapId];
  if (!map || map.tilesetId !== FOREST_HARMONY_ID) return [];
  const theme = request.groundTheme;
  const kind: ClimateVillageKind | undefined = theme === "snow" || theme === "desert" || theme === "volcano" || theme === "autumn" ? theme : borrowed;
  if (!kind) return [];
  const tilesetId = climateVillageTilesetId(kind);
  project.tilesets[tilesetId] ??= createClimateVillageTileset(kind);
  map.tilesetId = tilesetId;
  const warnings = borrowed === kind ? [] : [`groundTheme:"${kind}" → 숲마을 칩셋을 칸 번호가 같은 ${CLIMATE_LABEL[kind]} 칩셋(${tilesetId})으로 바꿨습니다.`];
  // 집 부품 칸(3060~: 재료 킷 지붕·벽, 굴뚝·지붕창·차양·꼭대기 장식)은 기후 시트에 없다 — 원본 칸으로 되돌리고 킷 표기도 기본 킷으로.
  const downgraded = downgradeHouseParts(map);
  if (downgraded > 0) {
    for (const region of map.layoutPlan?.regions ?? []) {
      if (region.role === "house" && isHouseKitId(region.kitId)) region.kitId = houseKitForTileset(region.kitId, false);
    }
    warnings.push(`${CLIMATE_LABEL[kind]} 칩셋에는 집 재료·지붕 부품 칸이 없어 ${downgraded}칸을 기본 재료로 되돌렸습니다.`);
  }
  // 사막·화산은 잎 달린 숲을 걷고 잎 없는 고목 덩이로, 셋 다 꽃덤불·화분을 뺀다(2026-09-25 조수 시험 — 사막 마을에 꽃덤불 33칸).
  if (kind !== "snow") {
    const dressed = dressClimateMap(map, project.tilesets[tilesetId]!, kind, request.seed ?? 1);
    warnings.push(`${CLIMATE_LABEL[kind]} 손질: 꽃덤불·화분 ${dressed.gardenRemoved}칸 제거`
      + (kind === "autumn" ? "" : `, 잎 달린 나무 ${dressed.treesCleared}칸 → 고목 덩이 ${dressed.groves}곳(${dressed.bareTrees}그루)${dressed.palms ? `, 물가 야자 ${dressed.palms}그루` : ""}${dressed.grassRemoved ? `, 키큰 풀 ${dressed.grassRemoved}칸 걷음` : ""}`) + ".");
  }
  if (kind === "snow" && (!map.climate || map.climate.mode === "inherit")) {
    map.climate = normalizeMapClimate({ mode: "fixed", weather: "snow", intensity: 0.6 })!;
    warnings.push("맵 날씨를 눈(climate fixed snow)으로 두었습니다 — 이 마을 아래 실내·던전의 전투 배경도 설원을 따릅니다.");
  }
  return warnings;
}
