import { createBlankMap, createBlankProject } from "../../src/project/defaults";
import type { GameMap, MapLayoutPlan, Project } from "../../src/project/types";
import { FINAL_MAP_ID, MAP_HEIGHT, MAP_WIDTH, STAGE_MAP_IDS } from "./blueprint";
import { createReferenceVillagers } from "./events";
import { paintReferenceHouses, paintReferenceLife, paintReferenceRoadsAndMarket, paintReferenceTerrain } from "./paint";

const STAGE_NAMES = [
  "01 지형과 개울",
  "02 서로 다른 집들",
  "03 굽은 길과 네 출구",
  "04 숲·시장·생활 흔적",
  "05 주민 일과가 있는 완성 마을",
] as const;

export function buildNaturalVillageReference(): Project {
  const terrain = createStageMap(STAGE_MAP_IDS[0], STAGE_NAMES[0]);
  paintReferenceTerrain(terrain);

  const houses = cloneStageMap(terrain, STAGE_MAP_IDS[1], STAGE_NAMES[1]);
  paintReferenceHouses(houses);

  const roads = cloneStageMap(houses, STAGE_MAP_IDS[2], STAGE_NAMES[2]);
  paintReferenceRoadsAndMarket(roads);

  const livedIn = cloneStageMap(roads, STAGE_MAP_IDS[3], STAGE_NAMES[3]);
  paintReferenceLife(livedIn);

  const finalMap = cloneStageMap(livedIn, FINAL_MAP_ID, STAGE_NAMES[4]);
  finalMap.events = createReferenceVillagers();

  const project = createBlankProject();
  project.meta.title = "굽은개울 마을 - 직접 제작 참조본";
  project.meta.author = "OPRN village reference";
  project.maps = {
    [terrain.id]: terrain,
    [houses.id]: houses,
    [roads.id]: roads,
    [livedIn.id]: livedIn,
    [finalMap.id]: finalMap,
  };
  project.mapTree = {
    mapId: terrain.id,
    children: [{
      mapId: houses.id,
      children: [{
        mapId: roads.id,
        children: [{
          mapId: livedIn.id,
          children: [{ mapId: finalMap.id, children: [] }],
        }],
      }],
    }],
  };
  project.startMapId = FINAL_MAP_ID;
  project.startPos = { x: 31, y: 31 };
  project.system = {
    ...project.system,
    timeSystem: {
      enabled: true,
      minutesPerRealSecond: 2,
      dayStartHour: 6,
      dayEndHour: 24,
      daysPerSeason: 28,
    },
  };
  project.villageInfoDocuments = [{
    id: "village_info_natural_reference",
    mapId: FINAL_MAP_ID,
    title: "굽은개울 마을 제작 원칙",
    markdown: [
      "# 직접 제작 참조 마을",
      "",
      "Combined Town 480칸 아틀라스를 확인한 뒤 집·길·숲·생활 소품을 좌표 단위로 직접 배치했다.",
      "흙길은 네 맵 경계까지 이어지고, 서쪽 개울은 목재 다리로 건넌다.",
      "2층·3층 집은 창 사이에 수평 보를 두어 층을 구분하며, 모든 집은 문 한 쌍만 가진다.",
      "주민은 집·일터·공터를 오가는 아침/낮/저녁 일과와 활동명을 가진다.",
    ].join("\n"),
  }];
  return project;
}

function createStageMap(id: string, name: string): GameMap {
  const map = createBlankMap(name, MAP_WIDTH, MAP_HEIGHT, "easyrpg_chipset_combined_town");
  map.id = id;
  return map;
}

function cloneStageMap(source: GameMap, id: string, name: string): GameMap {
  return {
    ...source,
    id,
    name,
    lowerTiles: [...source.lowerTiles],
    upperTiles: [...source.upperTiles],
    events: [...source.events],
    ...(source.layoutPlan ? { layoutPlan: cloneLayoutPlan(source.layoutPlan) } : {}),
  };
}

function cloneLayoutPlan(plan: MapLayoutPlan): MapLayoutPlan {
  return {
    ...plan,
    regions: plan.regions.map((region) => ({
      ...region,
      ...(region.tags ? { tags: [...region.tags] } : {}),
      ...(region.doorAt ? { doorAt: { ...region.doorAt } } : {}),
      ...(region.front ? { front: { ...region.front } } : {}),
    })),
    ...(plan.roadAnchors ? { roadAnchors: plan.roadAnchors.map((anchor) => ({ ...anchor })) } : {}),
  };
}
