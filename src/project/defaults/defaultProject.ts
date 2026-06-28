import type {
  CommonEvent,
  GameEvent,
  GameMap,
  MapId,
  Project,
  SwitchDef,
  VariableDef,
} from "../types";
import { SCHEMA_VERSION } from "../types";
import { DEFAULT_ITEM_ID, DEFAULT_SPRITE_NPC } from "./constants";
import {
  defaultAssetSet,
  defaultResourceProfiles,
  defaultTilesets,
} from "./defaultAssets";
import {
  defaultDatabase,
  defaultSession,
  defaultSystem,
  defaultTerms,
} from "./defaultDatabase";
import {
  createLogCabinShowcaseMap,
  createRetroHouseShowcaseMap,
  createDbExtractedHouseTemplateMap,
  createSmallHouseCityMap,
  createSmallHouseVariantMap,
  createStarterMap,
  createTownArchitectureCityMap,
  createTownArchitectureTestMap,
  createTownCityShowcaseMap,
  createTownHouseShowcaseMap,
  type SmallHouseVariantIndex,
  type TownHouseShowcaseStyle,
  singleNodeTree,
} from "./defaultMaps";

const SHOP_SHOWCASE_GOLD_SWITCH_ID = "switch_shop_showcase_gold";

export function createBlankProject(): Project {
  return createProjectWithStarterMap(createStarterMap());
}

export function createLogCabinShowcaseProject(): Project {
  return createProjectWithStarterMap(createLogCabinShowcaseMap());
}

export function createRetroHouseShowcaseProject(): Project {
  return createProjectWithStarterMap(createRetroHouseShowcaseMap());
}

export function createTownHouseShowcaseProject(style: TownHouseShowcaseStyle = "l"): Project {
  return createProjectWithStarterMap(createTownHouseShowcaseMap(style));
}

export function createTownCityShowcaseProject(): Project {
  return createProjectWithStarterMap(createTownCityShowcaseMap());
}

export function createTownArchitectureTestProject(): Project {
  return createProjectWithStarterMap(createTownArchitectureTestMap());
}

export function createTownArchitectureCityProject(): Project {
  return createProjectWithStarterMap(createTownArchitectureCityMap());
}

export function createDbExtractedHouseTemplateProject(): Project {
  return createProjectWithStarterMap(createDbExtractedHouseTemplateMap());
}

export function createSmallHouseVariantProject(selectedVariant: SmallHouseVariantIndex = 1): Project {
  const project = createProjectWithMaps([createSmallHouseVariantMap(selectedVariant)], 0);
  project.startPos = smallHouseVariantStartPos(selectedVariant);
  return project;
}

export function createHouseTemplateGalleryProject(): Project {
  const project = createProjectWithMaps([
    createSmallHouseVariantMap(1),
    createSmallHouseVariantMap(2),
    createSmallHouseVariantMap(3),
    createSmallHouseVariantMap(4),
    createSmallHouseVariantMap(5),
    createSmallHouseCityMap(),
  ], 0);
  project.startPos = smallHouseVariantStartPos(1);
  return project;
}

export function createShopShowcaseProject(): Project {
  const project = createProjectWithStarterMap(createStarterMap());
  project.meta = { ...project.meta, title: "상점 데모" };
  project.switches.push({ id: SHOP_SHOWCASE_GOLD_SWITCH_ID, name: "상점 데모 시작 자금" });
  project.startPos = { x: 14, y: 12 };
  const starter = project.maps[project.startMapId];
  if (!starter) return project;
  starter.events.push(createShopkeeperEvent(project.startPos.x, project.startPos.y + 1));
  return project;
}

function smallHouseVariantStartPos(variant: SmallHouseVariantIndex): Project["startPos"] {
  switch (variant) {
    case 1:
      return { x: 15, y: 16 };
    case 2:
      return { x: 13, y: 15 };
    case 3:
      return { x: 11, y: 16 };
    case 4:
      return { x: 10, y: 16 };
    case 5:
      return { x: 12, y: 16 };
    case 6:
      return { x: 10, y: 15 };
    case 7:
      return { x: 10, y: 17 };
    case 8:
      return { x: 10, y: 17 };
    case 9:
      return { x: 10, y: 17 };
  }
}

function createShopkeeperEvent(x: number, y: number): GameEvent {
  return {
    id: "ev_shopkeeper",
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_shopkeeper",
        name: "도구 상인",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: DEFAULT_SPRITE_NPC },
          direction: "down",
          pattern: 0,
        },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          {
            kind: "fork",
            condition: { kind: "switch", switchId: SHOP_SHOWCASE_GOLD_SWITCH_ID, value: true },
            then: [],
            else: [
              { kind: "changeGold", op: "+=", amount: 150 },
              { kind: "setSwitch", switchId: SHOP_SHOWCASE_GOLD_SWITCH_ID, value: true },
            ],
          },
          {
            kind: "shop",
            itemIds: [DEFAULT_ITEM_ID, "item_ether", "item_antidote"],
            allowSell: true,
            quantityMode: "single",
            shopType: "normal",
            messageType: "welcome",
            branchOnTransaction: false,
            transactionBranch: [],
          },
        ],
      },
    ],
  };
}

function createProjectWithStarterMap(starter: GameMap): Project {
  return createProjectWithMaps([starter], 0);
}

function createProjectWithMaps(starters: readonly GameMap[], selectedIndex: number): Project {
  const starter = starters[Math.max(0, Math.min(selectedIndex, starters.length - 1))] ?? createStarterMap();
  const startMapId: MapId = starter.id;
  const switches: SwitchDef[] = [];
  const variables: VariableDef[] = [];
  const commonEvents: CommonEvent[] = [];
  const maps = Object.fromEntries(starters.map((map) => [map.id, map])) as Record<MapId, GameMap>;
  return {
    version: SCHEMA_VERSION,
    meta: { title: "새 프로젝트", author: "", terms: defaultTerms() },
    assets: defaultAssetSet(),
    resourceProfiles: defaultResourceProfiles(),
    tilesets: defaultTilesets(),
    switches,
    variables,
    commonEvents,
    database: defaultDatabase(),
    system: defaultSystem(),
    session: defaultSession(),
    maps,
    mapTree: {
      mapId: startMapId,
      children: starters.filter((map) => map.id !== startMapId).map((map) => singleNodeTree(map.id)),
    },
    startMapId,
    startPos: {
      x: Math.floor(starter.width / 2),
      y: Math.floor(starter.height / 2) + 1,
    },
    flags: {},
  };
}
