/**
 * 『폴른 스타』 지역별 전투 배경(2026-11-04, 오너 「전투 배경도 만들고 배포까지해라」). JSON 은 battle-backdrop `build --emit` 산출물 그대로이고,
 * 그림은 Opus 검수 최고점(`pick --best`, 오너 「이제 사람이 고르지 않아. AI 가 해야함」)이다.
 * 트룹 배경이 맵 배경보다 먼저 잡히므로(src/battle/battleBackdrop.ts) 같은 지역 트룹의 바이옴 기본 배경도 바꾼다.
 */
import type { Project } from "@/project/types";
import ashField from "./backdrops/area/ash-field.json";
import dawnwell from "./backdrops/area/dawnwell.json";
import forest from "./backdrops/area/forest.json";
import fortCourt from "./backdrops/area/fort-court.json";
import fortress from "./backdrops/area/fortress.json";
import iceLake from "./backdrops/area/ice-lake.json";
import northForest from "./backdrops/area/north-forest.json";
import prison from "./backdrops/area/prison.json";
import skyTower from "./backdrops/area/sky-tower.json";
import snowPass from "./backdrops/area/snow-pass.json";
import snowRoad from "./backdrops/area/snow-road.json";
import townNight from "./backdrops/area/town-night.json";
import vault from "./backdrops/area/vault.json";

type Emitted = { readonly resource: { readonly id: string; readonly name: string; readonly kind: "backdrop"; readonly dataUrl: string } };
type Exec = (tool: string, args: Record<string, unknown>) => unknown;

export const FS_AREA_BACKDROPS: readonly { readonly art: Emitted; readonly maps: readonly string[] }[] = [
  { art: forest, maps: ["fs_forest", "fs_forest_edge", "fs_forest_stream", "fs_forest_thicket", "fs_forest_glade", "fs_forest_shrine"] },
  { art: northForest, maps: ["map_field_north_1"] },
  { art: vault, maps: ["fs_vault", "fs_vault_gate", "fs_vault_b3", "fs_vault_b4"] },
  { art: townNight, maps: ["fs2_hub_night"] },
  { art: prison, maps: ["fs2_barracks", "fs2_cell"] },
  { art: dawnwell, maps: ["fs2_dawnwell"] },
  { art: ashField, maps: ["map_field_north_2"] },
  { art: fortCourt, maps: ["fs2_fort_court"] },
  { art: fortress, maps: ["fs2_fortress", "fs2_fortress_f2"] },
  { art: snowRoad, maps: ["map_snow_north_1"] },
  { art: snowPass, maps: ["map_snow_north_2"] },
  { art: iceLake, maps: ["fs2_ice_lake"] },
  { art: skyTower, maps: ["fs2_sky_tower", "fs2_sky_tower_f2", "fs2_sky_tower_f3", "fs2_sky_tower_f4"] },
];

const BIOME = /^battle-scenery-/u;

function troopMaps(project: Project): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [mapId, map] of Object.entries(project.maps)) {
    for (const m of JSON.stringify(map.events ?? []).matchAll(/"troopId":"([^"]+)"/gu)) {
      const set = out.get(m[1]!) ?? new Set<string>();
      set.add(mapId);
      out.set(m[1]!, set);
    }
  }
  return out;
}

export function applyFallenAreaBackdrops(project: Project, exec: Exec): void {
  const areaOf = new Map<string, string>();
  for (const { art, maps } of FS_AREA_BACKDROPS) {
    exec("upsert_resource", { resource: art.resource });
    for (const mapId of maps) {
      if (!project.maps[mapId]) { console.warn(`[fallen-star backdrop] 맵 ${mapId} 이 없다`); continue; }
      exec("set_map_properties", { mapId, battleBackground: art.resource.id });
      areaOf.set(mapId, art.resource.id);
    }
  }
  for (const [troopId, maps] of troopMaps(project)) {
    const troop = project.database.troops.find((t) => t.id === troopId);
    if (!troop?.previewBackgroundResourceId || !BIOME.test(troop.previewBackgroundResourceId)) continue;
    const ids = new Set([...maps].map((m) => areaOf.get(m)).filter((id): id is string => !!id));
    if (ids.size === 1) troop.previewBackgroundResourceId = [...ids][0]!;
    else if (ids.size > 1) delete troop.previewBackgroundResourceId;
  }
}
