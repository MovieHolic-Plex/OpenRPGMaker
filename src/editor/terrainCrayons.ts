// editor/terrainCrayons.ts
// 맥락 적응형 5-크레용 지형 개략도 엔진.
// 어떤 타일셋(자연 야외 · 현대/일본 도시 · 실내 · 던전)에서든
// 「5가지 크레용 + 좌드래그 칠하기 + 우드래그 지우기 + 자동 연결(경사로·다리·연석·횡단보도·벽)」
// 단일 모델로 30초 안에 맵 뼈대를 스케치한다.

import { autotileEditTriggersGroup, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { store } from "@/project/store";
import { terrainLocked } from "@/project/terrainDesign";
import type { AutotileGroup, GameMap, MapId, TileGroupMetadata, TilesetDef } from "@/project/types";
import { paintTilesBulk } from "./tileActions";
import { paintFlatHillOrGroundCells, paintFlatWaterCells } from "./flatGridTerrain";
import { reliefTopGrassTile } from "./reliefActions";
import { reliefDoodadCatalog } from "./reliefDoodads";
import { planTerrainCluster } from "./terrainClusters";
import type { TerrainLand } from "./terrainLandBrush";
import { terrainMaterialTile, terrainRoadTile } from "./terrainMaterials";

export type TerrainContextKind = "outdoor" | "city" | "interior" | "dungeon";

export type TerrainCrayonId =
  | "water" | "ground" | "hill" | "road" | "forest"
  | "asphalt" | "sidewalk" | "plaza" | "park" | "city_water"
  | "room_floor" | "room_wall" | "room_accent" | "room_hall" | "room_void"
  | "dg_floor" | "dg_wall" | "dg_hazard" | "dg_hill" | "dg_path";

export type TerrainCrayonActionKind = "water" | "ground" | "hill" | "road" | "forest" | "tile";

export type TerrainCrayonIconKind =
  | "water" | "ground" | "hill" | "road" | "forest"
  | "asphalt" | "sidewalk" | "plaza" | "park"
  | "floor" | "wall" | "accent" | "void" | "hazard";

export interface TerrainCrayonDef {
  readonly id: TerrainCrayonId;
  readonly label: string;
  readonly hotkey: "1" | "2" | "3" | "4" | "5";
  readonly hint: string;
  readonly badge: string;
  readonly color: string;
  readonly kind: TerrainCrayonActionKind;
  readonly iconKind: TerrainCrayonIconKind;
  readonly previewTile: number | null;
  readonly tileId: number | null;
  readonly isWater?: boolean;
  readonly isVoid?: boolean;
  readonly isSidewalk?: boolean;
  readonly isRoomFloor?: boolean;
}

export const TERRAIN_CONTEXT_META: Readonly<Record<TerrainContextKind, { readonly label: string; readonly icon: string; readonly eraserLabel: string }>> = {
  outdoor: { label: "자연 야외", icon: "🌿", eraserLabel: "평지 땅" },
  city: { label: "도시 거리", icon: "🏙️", eraserLabel: "보도" },
  interior: { label: "실내", icon: "🏠", eraserLabel: "비우기" },
  dungeon: { label: "던전·동굴", icon: "🪨", eraserLabel: "바위벽" },
};

export const TERRAIN_CONTEXT_ORDER: readonly TerrainContextKind[] = ["outdoor", "city", "interior", "dungeon"];

function findAutotileCenter(tileset: TilesetDef | undefined, pattern: RegExp, exclude?: RegExp): { tile: number; group: AutotileGroup } | null {
  if (!tileset) return null;
  for (const group of autotileGroupsForTileset(tileset)) {
    if ((group.layer ?? "lower") !== "lower") continue;
    const text = `${group.id} ${group.name}`;
    if (!pattern.test(text)) continue;
    if (exclude && exclude.test(text)) continue;
    const center = group.variantMap[group.neighborhood === 8 ? "255" : "15"] ?? group.memberTileIds[0];
    if (center !== undefined && center >= 0) return { tile: center, group };
  }
  return null;
}

function findTileGroupTile(tileset: TilesetDef | undefined, pattern: RegExp, tileIndex = 0, exclude?: RegExp): number | null {
  if (!tileset?.tileGroups?.length) return null;
  for (const g of tileset.tileGroups as readonly TileGroupMetadata[]) {
    const text = `${g.id} ${g.name}`;
    if (!pattern.test(text)) continue;
    if (exclude && exclude.test(text)) continue;
    const ids = g.tileIds ?? [];
    const pick = ids[tileIndex] ?? ids[0];
    if (pick !== undefined && pick >= 0) return pick;
  }
  return null;
}

function findMetaTile(tileset: TilesetDef | undefined, pattern: RegExp, exclude?: RegExp): number | null {
  if (!tileset?.tileMeta?.length) return null;
  for (let i = 0; i < tileset.tileMeta.length; i += 1) {
    const meta = tileset.tileMeta[i];
    if (!meta || meta.defaultLayer === "upper") continue;
    const text = `${meta.role ?? ""} ${meta.label ?? ""} ${(meta.tags ?? []).join(" ")}`;
    if (!pattern.test(text)) continue;
    if (exclude && exclude.test(text)) continue;
    return i;
  }
  return null;
}

function isCityTileset(tileset: TilesetDef | undefined): boolean {
  if (!tileset) return false;
  if (["oprn-modern", "oprn-jp", "oprn-campus", "oprn-steampunk"].includes(tileset.family ?? "")) return true;
  if (/modern_city|jp_city|modern_campus|steampunk/i.test(`${tileset.id} ${tileset.name}`)) return true;
  return Boolean(findAutotileCenter(tileset, /sidewalk|보도/i) || findTileGroupTile(tileset, /mc:road|jp:street:road/i) !== null);
}

function isInteriorOnlyTileset(tileset: TilesetDef | undefined): boolean {
  if (!tileset) return false;
  if (/interior|실내/i.test(`${tileset.id} ${tileset.name}`) && !isCityTileset(tileset)) return true;
  return Boolean(
    tileset.tileGroups?.some((g) => /^hand-interior:floor:/i.test(g.id)) &&
    !tileset.tileGroups?.some((g) => /grass|잔디|풀밭/i.test(`${g.id} ${g.name}`)),
  );
}

function isDungeonOnlyTileset(tileset: TilesetDef | undefined): boolean {
  if (!tileset) return false;
  return /dungeon|cave|동굴|던전/i.test(`${tileset.id} ${tileset.name}`) && !/beodeul_city/i.test(tileset.id);
}

/** 현재 맵의 타일셋과 실제 깔린 바닥 타일을 보고 4가지 맥락 중 하나를 자동 판별한다. */
export function detectTerrainContext(map: GameMap | undefined, tileset: TilesetDef | undefined): TerrainContextKind {
  if (!tileset) return "outdoor";
  if (isInteriorOnlyTileset(tileset)) return "interior";
  if (isDungeonOnlyTileset(tileset)) return "dungeon";

  // 겸용 칩셋(modern_city, beodeul_city 등)은 맵 이름과 깔린 바닥 타일로 실내·던전을 먼저 확인한다.
  if (map) {
    let interiorCount = 0;
    let dungeonCount = 0;
    let outdoorCount = 0;
    const step = Math.max(1, Math.floor((map.width * map.height) / 180));
    for (let i = 0; i < map.lowerTiles.length; i += step) {
      const tile = map.lowerTiles[i] ?? -1;
      if (tile < 0) continue;
      const meta = tileset.tileMeta?.[tile];
      const text = `${meta?.label ?? ""} ${(meta?.tags ?? []).join(" ")}`;
      if (/실내|마루|카펫|로비|주방|욕실|비닐 타일|양탄자|interior/i.test(text)) interiorCount += 1;
      else if (/던전|동굴|용암|얼음굴|바위 채움|dungeon|cave/i.test(text)) dungeonCount += 1;
      else outdoorCount += 1;
    }
    if (interiorCount >= 6 && interiorCount > outdoorCount) return "interior";
    if (dungeonCount >= 6 && dungeonCount > outdoorCount) return "dungeon";
    if (map.lowerTiles.every((t) => t < 0) && /실내|방|집 안|카페|병원|상점|여관|로비|복도|interior|room/i.test(map.name)) {
      return "interior";
    }
    if (map.lowerTiles.every((t) => t < 0) && /던전|동굴|지하|미궁|유적|dungeon|cave/i.test(map.name)) {
      return "dungeon";
    }
  }

  if (isCityTileset(tileset)) return "city";
  return "outdoor";
}

function resolveCityTiles(tileset: TilesetDef | undefined): {
  asphalt: number | null;
  sidewalk: number | null;
  plaza: number | null;
  park: number | null;
  water: number | null;
  crosswalkH: number | null;
  crosswalkV: number | null;
  asphaltSet: Set<number>;
} {
  const asphalt =
    findTileGroupTile(tileset, /^mc:road$/i, 0) ??
    findAutotileCenter(tileset, /lane-road|생활도로/i)?.tile ??
    findTileGroupTile(tileset, /jp:street:road/i, 1) ??
    findMetaTile(tileset, /아스팔트|asphalt|차도/i, /횡단보도|정지선/i) ??
    (tileset ? terrainRoadTile(tileset) : undefined) ??
    null;

  const sidewalk =
    findAutotileCenter(tileset, /sidewalk|보도/i)?.tile ??
    findTileGroupTile(tileset, /mc:sidewalk|jp:street:sidewalk/i, 0) ??
    findMetaTile(tileset, /보도 포석|sidewalk/i) ??
    terrainMaterialTile(tileset, "stone") ??
    null;

  const plaza =
    findAutotileCenter(tileset, /plaza|광장|판석/i)?.tile ??
    findTileGroupTile(tileset, /mc:plaza/i, 0) ??
    findMetaTile(tileset, /벽돌 포장|판석|광장|plaza/i) ??
    terrainMaterialTile(tileset, "dirt") ??
    null;

  const park =
    findAutotileCenter(tileset, /lawn|잔디/i)?.tile ??
    findTileGroupTile(tileset, /mc:green|mc:lawn/i, 0) ??
    findMetaTile(tileset, /공원 잔디|잔디|녹지|lawn|grass/i) ??
    terrainMaterialTile(tileset, "grass") ??
    null;

  const water =
    findAutotileCenter(tileset, /water-canal|water-pond|수로|연못/i)?.tile ??
    findTileGroupTile(tileset, /mc:water|jp:street:water/i, 0) ??
    terrainMaterialTile(tileset, "water") ??
    null;

  const crosswalkH =
    findTileGroupTile(tileset, /^mc:crosswalk$/i, 0) ??
    findAutotileCenter(tileset, /crosswalk-ew/i)?.tile ??
    findTileGroupTile(tileset, /jp:street:crosswalk/i, 2) ??
    findMetaTile(tileset, /횡단보도.*가로|crosswalk/i) ??
    null;

  const crosswalkV =
    findTileGroupTile(tileset, /^mc:crosswalk$/i, 1) ??
    findAutotileCenter(tileset, /crosswalk-ns/i)?.tile ??
    crosswalkH;

  const asphaltSet = new Set<number>();
  if (asphalt !== null) asphaltSet.add(asphalt);
  if (crosswalkH !== null) asphaltSet.add(crosswalkH);
  if (crosswalkV !== null) asphaltSet.add(crosswalkV);
  if (tileset) {
    for (const g of autotileGroupsForTileset(tileset)) {
      if (/lane-road|생활도로|road|차도/i.test(`${g.id} ${g.name}`)) {
        for (const id of g.memberTileIds) asphaltSet.add(id);
      }
    }
    for (const g of (tileset.tileGroups ?? []) as readonly TileGroupMetadata[]) {
      if (/^mc:road$|^mc:crosswalk$|^jp:street:road$|^jp:street:lane$|^jp:street:crosswalk$/i.test(g.id)) {
        for (const id of g.tileIds ?? []) asphaltSet.add(id);
      }
    }
  }

  return { asphalt, sidewalk, plaza, park, water, crosswalkH, crosswalkV, asphaltSet };
}

function resolveInteriorTiles(tileset: TilesetDef | undefined): {
  floor: number | null;
  wall: number | null;
  accent: number | null;
  hall: number | null;
} {
  const floor =
    findTileGroupTile(tileset, /interior-floor-mci-wood-oak|hand-interior:floor:boards/i, 0) ??
    findTileGroupTile(tileset, /interior-floor|hand-interior:floor:/i, 0) ??
    findMetaTile(tileset, /마루|널마루|실내 바닥|wood.*floor/i, /그늘|벽/i) ??
    terrainMaterialTile(tileset, "dirt") ??
    null;

  const wall =
    findAutotileCenter(tileset, /hand-interior:ceiling:|dungeon_ceiling/i)?.tile ??
    findMetaTile(tileset, /천장|실내 벽|벽면|ceiling/i) ??
    findTileGroupTile(tileset, /ceiling|wall/i, 0) ??
    null;

  const accent =
    findTileGroupTile(tileset, /interior-floor-mci-carpet|hand-interior:floor:casino|hand-interior:floor:wood-dark|interior-floor-mci-wood-dark/i, 0) ??
    findMetaTile(tileset, /카펫|짙은 마루|양탄자|carpet/i, /그늘/i) ??
    findTileGroupTile(tileset, /interior-floor|hand-interior:floor:/i, 0, /wood-oak|boards/i) ??
    null;

  const hall =
    findTileGroupTile(tileset, /interior-floor-mci-stone-lobby|interior-floor-mci-tile-concourse|hand-interior:floor:marble|hand-interior:floor:flag/i, 0) ??
    findMetaTile(tileset, /대리석|화강암|판석|비닐 타일|marble|tile/i, /그늘/i) ??
    terrainMaterialTile(tileset, "stone") ??
    null;

  return { floor, wall, accent, hall };
}

function resolveDungeonTiles(tileset: TilesetDef | undefined): {
  floor: number | null;
  wall: number | null;
  hazard: number | null;
  path: number | null;
} {
  const floor =
    findAutotileCenter(tileset, /dungeon_theme_tower_floor|dungeon_ice_ground/i)?.tile ??
    findTileGroupTile(tileset, /dungeon.*floor|hand-interior:floor:cave|hand-interior:floor:dungeon/i, 0) ??
    findMetaTile(tileset, /동굴 바닥|던전.*바닥|돌 바닥|cave floor/i) ??
    terrainMaterialTile(tileset, "stone") ??
    terrainMaterialTile(tileset, "dirt") ??
    null;

  const wall =
    findAutotileCenter(tileset, /dungeon_ceiling|dungeon_rock/i)?.tile ??
    findMetaTile(tileset, /던전 천장|바위 채움|동굴 벽/i) ??
    null;

  const hazard =
    findAutotileCenter(tileset, /dungeon_theme_lava|dungeon_water/i)?.tile ??
    terrainMaterialTile(tileset, "water") ??
    null;

  const path =
    (tileset ? terrainRoadTile(tileset) : undefined) ??
    findAutotileCenter(tileset, /yard_flag|plaza|cobble/i)?.tile ??
    terrainMaterialTile(tileset, "dirt") ??
    null;

  return { floor, wall, hazard, path };
}

/** 현재 맥락과 타일셋에 딱 맞는 5가지 크레용 목록을 돌려준다. */
export function crayonsForContext(context: TerrainContextKind, tileset: TilesetDef | undefined): readonly TerrainCrayonDef[] {
  if (context === "city") {
    const c = resolveCityTiles(tileset);
    return [
      {
        id: "asphalt", label: "차도", hotkey: "1", color: "#545b66",
        kind: "tile", iconKind: "asphalt", previewTile: c.asphalt, tileId: c.asphalt,
        badge: "연석 자동", hint: "차도 · 끄는 곳마다 아스팔트 도로가 깔리고 인접 보도에 연석이 자동 생성됩니다",
      },
      {
        id: "sidewalk", label: "보도", hotkey: "2", color: "#c0bdb4",
        kind: "tile", iconKind: "sidewalk", previewTile: c.sidewalk, tileId: c.sidewalk, isSidewalk: true,
        badge: "횡단보도 자동", hint: "보도 · 기본 인도 · 차도를 가로질러 끌면 횡단보도가 자동으로 그려집니다",
      },
      {
        id: "plaza", label: "광장", hotkey: "3", color: "#b08e73",
        kind: "tile", iconKind: "plaza", previewTile: c.plaza, tileId: c.plaza,
        badge: "구역 분리", hint: "광장 · 벽돌/판석 포장 구역 · 공원 광장이나 건물 앞마당을 잡습니다",
      },
      {
        id: "park", label: "공원", hotkey: "4", color: "#68a84f",
        kind: "tile", iconKind: "park", previewTile: c.park, tileId: c.park,
        badge: "녹지", hint: "공원 · 잔디 녹지 구역을 칠합니다",
      },
      {
        id: "city_water", label: "물", hotkey: "5", color: "#3b83c6",
        kind: "tile", iconKind: "water", previewTile: c.water, tileId: c.water, isWater: true,
        badge: "연못·수로", hint: "물 · 공원 연못이나 천변 수로를 그립니다",
      },
    ];
  }

  if (context === "interior") {
    const ic = resolveInteriorTiles(tileset);
    return [
      {
        id: "room_floor", label: "방 바닥", hotkey: "1", color: "#c29963",
        kind: "tile", iconKind: "floor", previewTile: ic.floor, tileId: ic.floor, isRoomFloor: true,
        badge: "벽 테두리 자동", hint: "방 바닥 · 빈 공간에 끌면 방 바닥이 깔리고 바깥 테두리에 벽이 자동 생깁니다",
      },
      {
        id: "room_wall", label: "벽", hotkey: "2", color: "#6d7480",
        kind: "tile", iconKind: "wall", previewTile: ic.wall, tileId: ic.wall,
        badge: "구획 나누기", hint: "벽 · 방과 방 사이를 벽으로 나눕니다",
      },
      {
        id: "room_accent", label: "카펫·구역", hotkey: "3", color: "#9c5e54",
        kind: "tile", iconKind: "accent", previewTile: ic.accent, tileId: ic.accent,
        badge: "공간 구분", hint: "카펫·구역 · 거실·객석·침실 같은 보조 바닥을 칠합니다",
      },
      {
        id: "room_hall", label: "복도·타일", hotkey: "4", color: "#a5aab2",
        kind: "tile", iconKind: "plaza", previewTile: ic.hall, tileId: ic.hall,
        badge: "로비·복도", hint: "복도·타일 · 대리석·돌 타일 바닥을 칠합니다",
      },
      {
        id: "room_void", label: "비우기", hotkey: "5", color: "#2d323b",
        kind: "tile", iconKind: "void", previewTile: null, tileId: null, isVoid: true,
        badge: "지우개", hint: "비우기 · 방 바깥 빈 공간으로 깔끔히 지웁니다",
      },
    ];
  }

  if (context === "dungeon") {
    const dg = resolveDungeonTiles(tileset);
    return [
      {
        id: "dg_floor", label: "동굴 바닥", hotkey: "1", color: "#8e877b",
        kind: "tile", iconKind: "floor", previewTile: dg.floor, tileId: dg.floor,
        badge: "통로 파기", hint: "동굴 바닥 · 바위벽 속을 끌어서 방과 통로를 파냅니다",
      },
      {
        id: "dg_wall", label: "바위벽", hotkey: "2", color: "#4b4e57",
        kind: "tile", iconKind: "wall", previewTile: dg.wall, tileId: dg.wall,
        badge: "막힌 벽", hint: "바위벽 · 막힌 동굴 벽과 천장을 채웁니다",
      },
      {
        id: "dg_hazard", label: "물·용암", hotkey: "3", color: "#d46a34",
        kind: "tile", iconKind: "hazard", previewTile: dg.hazard, tileId: dg.hazard, isWater: true,
        badge: "위험 구역", hint: "물·용암 · 동굴 지하수나 용암 지대를 칠합니다",
      },
      {
        id: "dg_hill", label: "단차", hotkey: "4", color: "#a68553",
        kind: "hill", iconKind: "hill", previewTile: null, tileId: null,
        badge: "1:1 단차 자동", hint: "단차 · 끌면 격자에 바로 바위 단차가 생깁니다 · 우클릭으로 깎기 · 돌길로 계단 자동",
      },
      {
        id: "dg_path", label: "돌길", hotkey: "5", color: "#c2a170",
        kind: "road", iconKind: "road", previewTile: dg.path, tileId: dg.path,
        badge: "계단·다리 자동", hint: "돌길 · 끌고 놓으면 길 완성 · 단차를 넘으면 돌계단, 물을 건너면 다리가 자동 연결됩니다",
      },
    ];
  }

  // Default: outdoor (자연·판타지·조선·설원·사막·포켓몬)
  const grass = reliefTopGrassTile(tileset) ?? terrainMaterialTile(tileset, "grass") ?? null;
  const water = terrainMaterialTile(tileset, "water") ?? null;
  const road = tileset ? (terrainRoadTile(tileset) ?? terrainMaterialTile(tileset, "dirt") ?? null) : null;

  return [
    {
      id: "water", label: "물", hotkey: "1", color: "#3f86c9",
      kind: "water", iconKind: "water", previewTile: water, tileId: water, isWater: true,
      badge: "언덕도 파기", hint: "물 · 어디에 끌든 물과 물가가 생깁니다 · 언덕을 가로질러도 절벽 계곡 강으로 파줍니다",
    },
    {
      id: "ground", label: "땅", hotkey: "2", color: "#79ad55",
      kind: "ground", iconKind: "ground", previewTile: grass, tileId: grass,
      badge: "평지·한단 깎기", hint: "땅 · 다중 언덕을 한 단씩 깎아 내리거나 물을 메워 평지로 되돌립니다 (우클릭과 동일)",
    },
    {
      id: "hill", label: "언덕", hotkey: "3", color: "#a7864f",
      kind: "hill", iconKind: "hill", previewTile: null, tileId: null,
      badge: "1~3단 적층", hint: "언덕 · 평지에선 1단, 언덕 윗면에선 2·3단 다중 언덕으로 쌓입니다 · 우클릭 한 단씩 깎기",
    },
    {
      id: "road", label: "길", hotkey: "4", color: "#c79e65",
      kind: "road", iconKind: "road", previewTile: road, tileId: road,
      badge: "계단·다리 자동", hint: "길 · 끌고 놓으면 길 완성 · 절벽을 넘으면 돌계단, 물을 건너면 나무다리가 자동 생성됩니다",
    },
    {
      id: "forest", label: "숲", hotkey: "5", color: "#3b8236",
      kind: "forest", iconKind: "forest", previewTile: null, tileId: null,
      badge: "길·물 회피", hint: "숲 · 끌면서 문지르면 길과 물을 피해 자연스럽게 나무 무리를 심습니다",
    },
  ];
}

export function resolveActiveCrayon(
  context: TerrainContextKind,
  tileset: TilesetDef | undefined,
  preferredId: TerrainCrayonId | null,
): TerrainCrayonDef {
  const list = crayonsForContext(context, tileset);
  const found = preferredId ? list.find((item) => item.id === preferredId) : undefined;
  if (found) return found;
  // 기본 선택은 각 맥락에서 첫 스케치로 가장 자주 쓰는 크레용
  const defaultId: Record<TerrainContextKind, TerrainCrayonId> = {
    outdoor: "hill",
    city: "asphalt",
    interior: "room_floor",
    dungeon: "dg_floor",
  };
  return list.find((item) => item.id === defaultId[context]) ?? list[0]!;
}

export function eraserCrayonForContext(context: TerrainContextKind, tileset: TilesetDef | undefined): TerrainCrayonDef {
  const list = crayonsForContext(context, tileset);
  const targetId: Record<TerrainContextKind, TerrainCrayonId> = {
    outdoor: "ground",
    city: "sidewalk",
    interior: "room_void",
    dungeon: "dg_wall",
  };
  return list.find((item) => item.id === targetId[context]) ?? list[0]!;
}

function neighbourhood(map: Pick<GameMap, "width" | "height">, cells: readonly number[]): { x: number; y: number; layer: "lower" }[] {
  const dirty = new Map<number, { x: number; y: number; layer: "lower" }>();
  for (const i of cells) {
    const cx = i % map.width;
    const cy = Math.floor(i / map.width);
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < map.width && y < map.height) {
          dirty.set(y * map.width + x, { x, y, layer: "lower" });
        }
      }
    }
  }
  return [...dirty.values()];
}

/**
 * 타일 기반 크레용(도시·실내·던전) 칠하기.
 * - 도시 보도 × 차도 교차 시 횡단보도 자동 배치
 * - 도시 보도/차도 경계 연석 오토타일 자동 성형
 * - 실내 방 바닥 칠할 때 빈 외곽에 자동 벽 테두리
 */
export function paintTileCrayonCells(
  mapId: MapId,
  crayon: TerrainCrayonDef,
  cells: readonly number[],
  opts: {
    readonly context: TerrainContextKind;
    readonly isEraser?: boolean;
    readonly startedOnAsphalt?: boolean;
    readonly strokeAxis?: "horizontal" | "vertical" | null;
  },
): boolean {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map || !cells.length) return false;
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return false;

  const editable = cells.filter((i) => i >= 0 && i < map.width * map.height && !terrainLocked(map.terrainDesign, i));
  if (!editable.length) return false;

  const cityTiles = opts.context === "city" ? resolveCityTiles(tileset) : null;
  const interiorTiles = opts.context === "interior" ? resolveInteriorTiles(tileset) : null;

  // 도시 보도 크레용이 차도를 가로지를 때 (지우개가 아니고, 차도 위에서 시작한 게 아닐 때) → 횡단보도 자동!
  const allowAutoCrosswalk =
    opts.context === "city" &&
    crayon.isSidewalk === true &&
    !opts.isEraser &&
    !opts.startedOnAsphalt &&
    cityTiles !== null &&
    (cityTiles.crosswalkH !== null || cityTiles.crosswalkV !== null);

  const edits: { index: number; tile: number; prev: number }[] = [];
  const wallBorderCells: number[] = [];

  for (const i of editable) {
    const prev = layerTileAt(map, 1, i);
    if (crayon.isVoid) {
      if (prev >= 0 || layerTileAt(map, 2, i) >= 0 || layerTileAt(map, 3, i) >= 0) {
        edits.push({ index: i, tile: -1, prev });
      }
      continue;
    }
    if (crayon.tileId === null || crayon.tileId < 0) continue;

    let nextTile = crayon.tileId;
    if (allowAutoCrosswalk && cityTiles && cityTiles.asphaltSet.has(prev)) {
      // 도로 방향 추정: 좌우에 아스팔트가 많으면 가로 도로 → 세로 건너기(crosswalkH), 위아래가 많으면 세로 도로 → crosswalkV
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      const horizRoad =
        (x > 0 && cityTiles.asphaltSet.has(layerTileAt(map, 1, i - 1)) ? 1 : 0) +
        (x + 1 < map.width && cityTiles.asphaltSet.has(layerTileAt(map, 1, i + 1)) ? 1 : 0);
      const vertRoad =
        (y > 0 && cityTiles.asphaltSet.has(layerTileAt(map, 1, i - map.width)) ? 1 : 0) +
        (y + 1 < map.height && cityTiles.asphaltSet.has(layerTileAt(map, 1, i + map.width)) ? 1 : 0);
      const useVerticalRoadCrosswalk = vertRoad > horizRoad || (vertRoad === horizRoad && opts.strokeAxis === "horizontal");
      nextTile = (useVerticalRoadCrosswalk ? cityTiles.crosswalkV : cityTiles.crosswalkH) ?? crayon.tileId;
    }

    if (prev !== nextTile || layerTileAt(map, 2, i) >= 0 || (crayon.isWater && (map.terrainDesign?.waterDepth?.[i] ?? 0) === 0)) {
      edits.push({ index: i, tile: nextTile, prev });
    }
  }

  // 실내 방 바닥 칠할 때 빈 공간(-1)에 새로 깔린 방 둘레에 벽 자동 생성
  if (crayon.isRoomFloor && interiorTiles?.wall !== null && interiorTiles?.wall !== undefined) {
    const paintedSet = new Set(editable);
    for (const i of editable) {
      const cx = i % map.width;
      const cy = Math.floor(i / map.width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
          const ni = ny * map.width + nx;
          if (paintedSet.has(ni) || terrainLocked(map.terrainDesign, ni)) continue;
          if (layerTileAt(map, 1, ni) < 0) wallBorderCells.push(ni);
        }
      }
    }
  }

  if (!edits.length && !wallBorderCells.length) return false;

  const uniqueBorder = [...new Set(wallBorderCells)];
  const allAffected = [...new Set([...edits.map((e) => e.index), ...uniqueBorder])];
  const points = allAffected.map((i) => ({ x: i % map.width, y: Math.floor(i / map.width) }));
  const groups = autotileGroupsForTileset(tileset).filter((g) => (g.layer ?? "lower") === "lower");

  store.updateMapTiles(
    mapId,
    (draft) => {
      for (const e of edits) {
        clearTileStack(draft, "lower", e.index);
        setLayerTileAt(draft, 1, e.index, e.tile);
        setLayerTileAt(draft, 2, e.index, -1);
        if (crayon.isVoid) {
          clearTileStack(draft, "upper", e.index);
          setLayerTileAt(draft, 3, e.index, -1);
          setLayerTileAt(draft, 4, e.index, -1);
        }
      }
      if (uniqueBorder.length && interiorTiles?.wall !== null && interiorTiles?.wall !== undefined) {
        for (const ni of uniqueBorder) {
          setLayerTileAt(draft, 1, ni, interiorTiles.wall);
        }
      }
      // 물 깊이 갱신
      if (crayon.isWater || draft.terrainDesign?.waterDepth) {
        const depth = draft.terrainDesign?.waterDepth?.slice() ?? new Array<number>(draft.width * draft.height).fill(0);
        for (const e of edits) depth[e.index] = crayon.isWater ? 2 : 0;
        if (depth.some(Boolean)) draft.terrainDesign = { ...draft.terrainDesign, waterDepth: depth };
        else if (draft.terrainDesign) {
          const nextDesign = { ...draft.terrainDesign };
          delete nextDesign.waterDepth;
          draft.terrainDesign = Object.keys(nextDesign).length ? nextDesign : undefined;
        }
      }
      // 영향받은 오토타일(연석·생활도로·잔디·수로·천장 등) 자동 성형
      for (const group of groups) {
        const triggered =
          edits.some((e) => autotileEditTriggersGroup(group, e.prev, e.tile)) ||
          (uniqueBorder.length > 0 && interiorTiles?.wall !== null && interiorTiles?.wall !== undefined && group.memberTileIds.includes(interiorTiles.wall));
        if (triggered) shapeAutotileGroupAround(draft, group, points);
      }
    },
    { label: `지형 · ${crayon.label}`, cells: neighbourhood(map, allAffected) },
  );
  return true;
}

/** 숲 크레용 드래그: 현재 위치에 활엽수 중심의 다양한 나무 무리를 조용히 심는다(길·물·기존 물체 자동 회피). */
export function paintForestCrayonAt(mapId: MapId, x: number, y: number, radius: number, density: number): boolean {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return false;
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return false;
  const allTrees = reliefDoodadCatalog(tileset).filter(
    (d): d is Extract<import("./reliefDoodads").ReliefDoodad, { kind: "prop" }> => d.kind === "prop" && d.tab === "tree",
  );
  if (!allTrees.length) return false;
  // 1칸짜리 얇은 사이프러스만 반복되지 않게 2~3칸 폭 활엽수/풍성한 나무들을 우선 섞는다.
  const lush = allTrees.filter((d) => d.kit.width >= 2 && d.kit.width <= 3 && d.kit.height <= 4);
  const pool = lush.length >= 2 ? lush.slice(0, 6) : allTrees.slice(0, 6);
  const hash = Math.abs((x * 73856093) ^ (y * 19349663));
  const picked = pool[hash % pool.length]!;
  const plan = planTerrainCluster(map, tileset, picked, x, y, Math.max(1, radius), Math.max(40, density));
  if (!plan.ok) return false;
  if (plan.apply) {
    store.updateMapTiles(mapId, plan.apply, { label: "지형 · 숲", relief: true, cells: plan.cells });
    return true;
  }
  if (plan.stamp) {
    paintTilesBulk(mapId, plan.stamp, { autoConnect: false, preservePattern: true, clusterExpand: false });
    return true;
  }
  return false;
}

/** 물/땅/언덕 1:1 격자 크레용 실행 (안 A — 1~3단 다중 언덕 적층 및 한 단씩 깎기 지원). */
export function paintReliefCrayonCells(
  mapId: MapId,
  land: TerrainLand,
  cells: readonly number[],
  _topGrass: boolean,
  softenWater = false,
  context: TerrainContextKind = "outdoor",
  targetTier?: number,
): boolean {
  const mode = context === "dungeon" ? "dungeon" : "outdoor";
  if (land === "water") return paintFlatWaterCells(mapId, cells, softenWater, mode);
  if (land === 0) return paintFlatHillOrGroundCells(mapId, cells, "flatten", mode, targetTier ?? 0);
  return paintFlatHillOrGroundCells(mapId, cells, "raise", mode, targetTier ?? 1);
}

export function isAsphaltCell(map: GameMap, tileset: TilesetDef | undefined, x: number, y: number): boolean {
  if (!tileset || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const city = resolveCityTiles(tileset);
  return city.asphaltSet.has(layerTileAt(map, 1, y * map.width + x));
}
