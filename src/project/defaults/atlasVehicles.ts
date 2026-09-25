import saved from "@/assets/atlasVehiclesTileset.json";
import type { TilesetDef } from "../types";

// 탈것·장면 조각(2026-09-25) — 배(범선 셋·돛 폄/접음·뱃머리 양쪽)·비공정·마차·포장마차·손수레·뗏목·나룻배·교수대·형틀·
// 줄무늬 천막·마상 창시합 칸막이·관람석·꽃 아치·붉은 융단·초롱 줄·마법진·옥좌·검문 차단봉·초소·등대·하늘·구름·떠 있는 돌섬.
// EasyRPG 배 시트(CC0)의 결·색으로 손 도트를 찍고 16px 로 잘라 겹치는 칸을 합쳤다.
// 원본: scripts/content/atlas-scenes/build_vehicles.py → public/assets/atlas-scenes/vehicles.png,
// register-vehicles.mjs → src/assets/atlasVehiclesTileset.json. 장소·지역(tiledata/atlas-scenes)과 공용 오브젝트가 쓴다.
// 숲마을 맵은 이 시트를 tileGrafts 로 3611~ 에 붙여 쓴다(파이프라인 사본만 — 번들 forest_harmony 는 건드리지 않는다).

export const ATLAS_VEHICLES_TEXTURE = "tex_oprn_atlas_vehicles";
export const ATLAS_VEHICLES_ID = "oprn_atlas_vehicles";
export const ATLAS_VEHICLES_COUNT: number = saved.count;

export function createAtlasVehiclesTileset(): TilesetDef {
  return structuredClone(saved) as unknown as TilesetDef;
}

/** Add shipped guidance to older copies without replacing authored documents. */
export function ensureAtlasVehiclesReferences(tileset: TilesetDef): boolean {
  if (tileset.image.type !== "bundled" || tileset.image.id !== ATLAS_VEHICLES_TEXTURE || tileset.referenceSourceTilesetId) return false;
  const shipped = (saved as unknown as { referenceDocuments?: NonNullable<TilesetDef["referenceDocuments"]> }).referenceDocuments ?? [];
  const missing = shipped.filter(category => !(tileset.referenceDocuments ?? []).some(existing => existing.id === category.id));
  if (!missing.length) return false;
  tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), ...structuredClone(missing)];
  return true;
}
