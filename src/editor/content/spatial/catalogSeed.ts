// editor/content/spatial/catalogSeed.ts
// 배송 카탈로그 → 실제 공간 설계 라이브러리. 편집기 쪽 씨앗 빌더다.
//
// 방향 규약: src/project/** 는 src/editor/** 를 import 하지 않는다. 그래서 데이터(정본)는
// project/defaults/spatial 에 두고, 그것을 설계로 조립하는 이 코드가 editor 에 있다.
//
// 이 파일은 라이브러리 레코드를 **만들기만** 한다. 저장·발행·프로젝트 변경은 하지 않는다.
// 실제 채택은 기존 저작 컨트롤러(preview → apply)가 담당한다.

import { spatialId } from "@/project/spatial/domain";
import type {
  ObjectDesign,
  PlaceDesign,
  RegionDesign,
  SpaceDesign,
  SpatialFloorArea,
  SpatialLibrary,
  SpatialObjectSlot,
  SpatialPort,
  WorldDesign,
} from "@/project/spatial/types";
import type { SectionStructureKitDef } from "@/project/types";
import { bakeCellsToRows } from "@/editor/harnessSuggestion/structureKitRasterModel";
import { OUTDOOR_OBJECT_CATALOG, type OutdoorObjectDef } from "@/project/defaults/spatial/outdoorObjectCatalog";
import { SPACE_CATALOG } from "@/project/defaults/spatial/spaceCatalog";
import { PLACE_CATALOG } from "@/project/defaults/spatial/placeCatalog";
import { GEOGRAPHY_TERRAIN, REGION_CATALOG, WORLD_CATALOG } from "@/project/defaults/spatial/geographyCatalog";

/** 배송 카탈로그에서 온 설계임을 밝힌다. 사용자 저작물과 섞이지 않게 한다. */
const PROVENANCE = { origin: "builtin" } as const;
const base = (id: string, name: string) => ({
  id: spatialId(id),
  name,
  revision: 1,
  tags: [] as readonly string[],
  provenance: PROVENANCE,
});

export const OUTDOOR_KIT_TILESET_ID = "easyrpg_chipset_combined_town";

/** 실외 오브젝트의 래스터를 구조 킷으로 굽는다. 그림의 정본은 카탈로그 셀이다. */
export function bakeOutdoorObjectKit(object: OutdoorObjectDef): SectionStructureKitDef {
  return {
    id: object.id,
    kind: "section",
    name: object.label,
    width: object.width,
    height: object.height,
    rows: bakeCellsToRows(object.cells.map((cell) => ({ ...cell })), object.width, object.height),
    learnedFrom: "db-authored",
    ai: {
      description: object.description,
      placementRules: `근거 ${object.authority} · 통행 ${object.passage}`,
      snap: "floor",
      themes: [...object.families],
    },
  };
}

function objectDesign(object: OutdoorObjectDef): ObjectDesign {
  return {
    ...base(object.id, object.label),
    graphic: { tilesetId: OUTDOOR_KIT_TILESET_ID, kitId: object.id },
    anchors: [],
    chips: [...object.families],
  };
}

function slotsOf(spaceId: string): readonly SpatialObjectSlot[] {
  const space = SPACE_CATALOG.find((entry) => entry.id === spaceId);
  if (!space) throw new TypeError(`Unknown catalog space: ${spaceId}`);
  return space.slots.map((slot) => ({
    id: spatialId(slot.id),
    objectDesignId: spatialId(slot.objectId),
    quantity: slot.quantity,
    required: slot.required,
    placement: slot.at ? { mode: "fixed" as const, x: slot.at.x, y: slot.at.y } : { mode: "auto" as const },
  }));
}

function portsOf(ports: readonly { id: string; name: string; x: number; y: number }[]): readonly SpatialPort[] {
  return ports.map((port) => ({ id: spatialId(port.id), name: port.name, x: port.x, y: port.y }));
}

function spaceDesign(spaceId: string): SpaceDesign {
  const space = SPACE_CATALOG.find((entry) => entry.id === spaceId);
  if (!space) throw new TypeError(`Unknown catalog space: ${spaceId}`);
  if (space.environment !== "outdoor") throw new TypeError(`Catalog space ${spaceId} must be outdoor`);
  const floorAreas: readonly SpatialFloorArea[] = space.areas.map((area) =>
    area.kind === "rect"
      ? { kind: "rect", material: area.material, x: area.x, y: area.y, width: area.width, height: area.height }
      : { kind: "polygon", material: area.material, points: area.points.map((point) => ({ ...point })) });
  return {
    ...base(space.id, space.label),
    environment: "outdoor",
    tilesetId: space.tilesetId,
    shape: space.shape,
    width: space.width,
    height: space.height,
    floor: space.floor,
    wall: "",
    objectSlots: slotsOf(space.id),
    ports: portsOf(space.ports),
    floorAreas,
  };
}

function placeDesign(placeId: string): PlaceDesign {
  const place = PLACE_CATALOG.find((entry) => entry.id === placeId);
  if (!place) throw new TypeError(`Unknown catalog place: ${placeId}`);
  return {
    ...base(place.id, place.label),
    kind: place.kind,
    // 자식 좌표와 평면은 카탈로그가 정한다. 같은 설계를 두 자리에 놓으면 occurrence 가 둘 생긴다.
    children: place.children.map((child) => ({
      id: spatialId(child.id),
      source: { kind: child.kind, id: spatialId(child.designId) },
      x: child.x,
      y: child.y,
      level: child.level,
    })),
    layout: "manual",
    ports: portsOf(place.ports),
    connections: place.links.map((link) => ({
      id: spatialId(link.id),
      from: { childId: link.from.childId === null ? null : spatialId(link.from.childId), portId: spatialId(link.from.portId) },
      to: { childId: link.to.childId === null ? null : spatialId(link.to.childId), portId: spatialId(link.to.portId) },
      bidirectional: true,
    })),
  };
}

// 카탈로그 지형 재료는 공간 카탈로그와 같은 슬롯 이름을 쓰지만, 지리 컴파일러는
// 월드 칩셋 어휘(ground/water + WORLD_TERRAIN_BLOCKS 키)만 안다. 시드가 번역한다.
const WORLD_TERRAIN_MATERIAL: Readonly<Record<string, string>> = {
  ground: "ground",
  water: "water",
  groundAlt: "forest",
  cliff: "mountain",
  path: "dirt",
};

function worldTerrainMaterial(material: string): string {
  return WORLD_TERRAIN_MATERIAL[material] ?? material;
}

function regionDesign(regionId: string): RegionDesign {
  const region = REGION_CATALOG.find((entry) => entry.id === regionId);
  if (!region) throw new TypeError(`Unknown catalog region: ${regionId}`);
  return {
    ...base(region.id, region.label),
    terrain: {
      tilesetId: GEOGRAPHY_TERRAIN.tilesetId,
      width: GEOGRAPHY_TERRAIN.width,
      height: GEOGRAPHY_TERRAIN.height,
      floor: worldTerrainMaterial(region.floor),
      areas: region.areas.map((area) => ({ kind: "rect", material: worldTerrainMaterial(area.material), x: area.x, y: area.y, width: area.width, height: area.height })),
    },
    places: region.places.map((child) => ({
      id: spatialId(child.id),
      source: { kind: "place", id: spatialId(child.designId) },
      x: child.x,
      y: child.y,
      level: 0,
    })),
    ports: portsOf(region.ports),
    // 경로 폴리라인의 양끝은 카탈로그에서 이미 마커와 맞춰져 있다.
    routes: region.routes.map((path) => ({
      id: spatialId(path.id),
      from: { childId: spatialId(path.from), portId: spatialId(path.from) },
      to: { childId: spatialId(path.to), portId: spatialId(path.to) },
      bidirectional: true,
      points: path.points.map((point) => ({ ...point })),
    })),
  };
}

function worldDesign(worldId: string): WorldDesign {
  const world = WORLD_CATALOG.find((entry) => entry.id === worldId);
  if (!world) throw new TypeError(`Unknown catalog world: ${worldId}`);
  const entry = world.regions.find((child) => child.designId === world.entryRegion);
  if (!entry) throw new TypeError(`World ${worldId} does not contain its entry region ${world.entryRegion}`);
  return {
    ...base(world.id, world.label),
    terrain: {
      tilesetId: GEOGRAPHY_TERRAIN.tilesetId,
      width: GEOGRAPHY_TERRAIN.width,
      height: GEOGRAPHY_TERRAIN.height,
      floor: worldTerrainMaterial(world.floor),
      areas: [],
    },
    regions: world.regions.map((child) => ({
      id: spatialId(child.id),
      source: { kind: "region", id: spatialId(child.designId) },
      x: child.x,
      y: child.y,
      level: 0,
    })),
    ports: portsOf(world.ports),
    connections: world.connections.map((connection) => ({
      id: spatialId(connection.id),
      from: { childId: spatialId(connection.from), portId: spatialId(connection.from) },
      to: { childId: spatialId(connection.to), portId: spatialId(connection.to) },
      bidirectional: true,
    })),
    // 시작 지역은 계획서가 지정한 그 지역이다.
    entryPort: { childId: spatialId(entry.id), portId: spatialId(entry.id) },
  };
}

// 카탈로그 설계는 불변 정본이라 같은 id 는 한 번만 조립한다 — 갤러리·스테이지가
// 렌더마다 부르므로 메모하지 않으면 카드 수만큼 재생성된다.
const catalogDesignCache = new Map<string, RegionDesign | WorldDesign>();

/** 카탈로그 지역을 설계로 조립한다(읽기 전용 프리뷰용 — 라이브러리 upsert 없음). */
export function catalogRegionDesign(id: string): RegionDesign | undefined {
  if (!REGION_CATALOG.some((entry) => entry.id === id)) return undefined;
  const key = `region:${id}`;
  let design = catalogDesignCache.get(key);
  if (!design) {
    design = regionDesign(id);
    catalogDesignCache.set(key, design);
  }
  return design as RegionDesign;
}

/** 카탈로그 세계를 설계로 조립한다(읽기 전용 프리뷰용). */
export function catalogWorldDesign(id: string): WorldDesign | undefined {
  if (!WORLD_CATALOG.some((entry) => entry.id === id)) return undefined;
  const key = `world:${id}`;
  let design = catalogDesignCache.get(key);
  if (!design) {
    design = worldDesign(id);
    catalogDesignCache.set(key, design);
  }
  return design as WorldDesign;
}

/** 배송 카탈로그 전부를 라이브러리 레코드로 조립한다. 저장하지 않는다. */
export function buildSpatialCatalogLibrary(): SpatialLibrary {
  const record = <T extends { readonly id: string }>(entries: readonly T[]): Readonly<Record<string, T>> =>
    Object.fromEntries(entries.map((entry) => [entry.id, entry]));
  return {
    objects: record(OUTDOOR_OBJECT_CATALOG.map(objectDesign)),
    spaces: record(SPACE_CATALOG.map((space) => spaceDesign(space.id))),
    places: record(PLACE_CATALOG.map((place) => placeDesign(place.id))),
    regions: record(REGION_CATALOG.map((region) => regionDesign(region.id))),
    worlds: record(WORLD_CATALOG.map((world) => worldDesign(world.id))),
  };
}

/** 실외 오브젝트 그림을 담는 구조 킷 묶음. 타일셋에 꽂아 쓴다. */
export function buildOutdoorObjectKits(): readonly SectionStructureKitDef[] {
  return OUTDOOR_OBJECT_CATALOG.map(bakeOutdoorObjectKit);
}
