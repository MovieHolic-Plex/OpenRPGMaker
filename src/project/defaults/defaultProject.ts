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
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { normalizeCropRecord } from "@/project/farmModel";
import { DEFAULT_ACTOR_ID, DEFAULT_EASYRPG_CHARSET_ID, DEFAULT_ITEM_ID } from "./constants";
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
import { configureScarloxyDemoProject, createScarloxyDemoMaps } from "./scarloxyDemoGame";
import { configureScarloxyPokemonDemoProject, createScarloxyPokemonDemoMaps } from "./scarloxyPokemonDemoGame";
import { createTrainingExampleMaps } from "./trainingExampleMaps";
import {
  createBlankMap,
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
  createMarketTownMap,
  marketTownStartPos,
  type SmallHouseVariantIndex,
  type TownHouseShowcaseStyle,
  singleNodeTree,
} from "./defaultMaps";
// Editor-authored sample demo export (blankProject → editor modules → fixture).
// Regenerate: npx playwright test test/e2e/author-dew-village-editor-demo.spec.ts
import dewVillageDemoFixture from "./fixtures/dew-village-demo.json" with { type: "json" };
const SHOP_SHOWCASE_GOLD_SWITCH_ID = "switch_shop_showcase_gold";
const BLANK_PROJECT_START_MAP_ID = "map_blank_start";
const BLANK_PROJECT_MAP_WIDTH = 20;
const BLANK_PROJECT_MAP_HEIGHT = 15;

export function createBlankProject(): Project {
  const map = createBlankMap("빈 맵", BLANK_PROJECT_MAP_WIDTH, BLANK_PROJECT_MAP_HEIGHT);
  map.id = BLANK_PROJECT_START_MAP_ID;
  const project = createProjectWithMaps([map], 0);
  project.system = { ...project.system, startActorIds: [DEFAULT_ACTOR_ID] };
  project.session = { ...project.session, partyActorIds: [DEFAULT_ACTOR_ID] };
  return project;
}

/** 예제 데모: 《이슬 마을의 종》 — 에디터 작성 export fixture. 별등 마을 코드 생성기는 제거됨. */
export function createSampleAdventureProject(): Project {
  const project = structuredClone(dewVillageDemoFixture as Project);
  // Fixture는 blank 시드에서 왔으므로 시작 파티가 1명일 수 있다. DB에 배우가 더 있으면 2인 파티로 맞춘다.
  const actorIds = project.database.actors.map((actor) => actor.id).filter(Boolean);
  if (actorIds.length >= 2 && project.system.startActorIds.length < 2) {
    project.system = { ...project.system, startActorIds: actorIds.slice(0, 2) };
    project.session = { ...project.session, partyActorIds: actorIds.slice(0, 2) };
  }
  ensureSwitchVariableSlots(project);
  return project;
}

// Scarloxy MPWSP01 팩 데모 — 팩 칩셋/캐릭셋/몬스터/전투 배경/이펙트를 조합한 예시.
export function createScarloxyDemoProject(): Project {
  const project = createProjectWithMaps(createScarloxyDemoMaps(), 0);
  configureScarloxyDemoProject(project);
  return project;
}

// Scarloxy 포켓몬풍 데모 — 스타터 선택/야생 포획/진화 등 몬스터 수집 시스템 예시.
export function createScarloxyPokemonDemoProject(): Project {
  const project = createProjectWithMaps(createScarloxyPokemonDemoMaps(), 0);
  configureScarloxyPokemonDemoProject(project);
  return project;
}

// 학습 예시 12맵 — 지붕/집/마을 구성을 사람이 채워넣어 AI 학습 정답 데이터로 쓰는 캔버스 프로젝트.
export function createTrainingExamplesProject(): Project {
  const project = createProjectWithMaps(createTrainingExampleMaps(), 0);
  project.meta = { ...project.meta, title: "학습 예시 12맵" };
  return project;
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

export function createMarketTownProject(): Project {
  const project = createProjectWithStarterMap(createMarketTownMap());
  // 시장 광장 입구에서 시작하도록 시작 위치 조정.
  project.startPos = marketTownStartPos();
  return project;
}

export function createVillageShoppingStreetProject(): Project {
  // Lazy import — villageShoppingStreetBuild → toolRunner/store 순환을 defaultProject 초기화에서 끊음
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    buildVillageShoppingStreetProject,
    villageShoppingStreetStartPos,
  } = require("./villageShoppingStreetBuild") as typeof import("./villageShoppingStreetBuild");
  // build_village 슬롯·HOUSE_MARGIN 알고리즘 + 동쪽 상점가 (하드코딩 집 origin 금지)
  const built = buildVillageShoppingStreetProject({ seed: 11, houses: 6 });
  const project = built.project;
  if (!project.startPos || project.startPos.x < 0) {
    project.startPos = villageShoppingStreetStartPos();
  }
  return project;
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

export function createFarmingDemoProject(): Project {
  const map = createBlankMap("봄 밭", 20, 20);
  map.id = "map_farming_demo";
  map.farmableArea = [{ x: 4, y: 5, w: 6, h: 4 }];
  const project = createProjectWithMaps([map], 0);
  project.meta = { ...project.meta, title: "농사 데모" };
  project.startPos = { x: 4, y: 4 };
  project.system = {
    ...project.system,
    startActorIds: [DEFAULT_ACTOR_ID],
    timeSystem: { enabled: true, dayStartHour: 6, dayEndHour: 26, forceSleep: false },
  };
  project.session = {
    ...project.session,
    partyActorIds: [DEFAULT_ACTOR_ID],
    inventory: {
      item_hoe: 1,
      item_watering_can: 1,
      item_potato_seed: 3,
      item_strawberry_seed: 2,
    },
  };
  project.database.items.push(
    normalizeItemRecord({ id: "item_hoe", name: "괭이", scope: "none", price: 50, type: "normalGoods", farmTool: "hoe" }),
    normalizeItemRecord({ id: "item_watering_can", name: "물뿌리개", scope: "none", price: 80, type: "normalGoods", farmTool: "wateringCan" }),
    normalizeItemRecord({ id: "item_potato_seed", name: "감자 씨앗", scope: "none", price: 20, type: "seed", consumable: true }),
    normalizeItemRecord({ id: "item_potato", name: "감자", scope: "none", price: 40, type: "normalGoods" }),
    normalizeItemRecord({ id: "item_strawberry_seed", name: "딸기 씨앗", scope: "none", price: 40, type: "seed", consumable: true }),
    normalizeItemRecord({ id: "item_strawberry", name: "딸기", scope: "none", price: 80, type: "normalGoods" })
  );
  project.database.crops = [
    normalizeCropRecord({
      id: "crop_potato",
      name: "감자",
      seedItemId: "item_potato_seed",
      harvestItemId: "item_potato",
      harvestCount: 1,
      stages: [{ days: 1 }, { days: 1 }],
      seasons: ["spring"],
    }),
    normalizeCropRecord({
      id: "crop_strawberry",
      name: "딸기",
      seedItemId: "item_strawberry_seed",
      harvestItemId: "item_strawberry",
      harvestCount: 2,
      stages: [{ days: 1 }, { days: 1 }],
      seasons: ["spring"],
      regrow: { days: 1 },
    }),
  ];
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
          sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID },
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
  const project: Project = {
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
    mapConnections: [],
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
    villageInfoDocuments: [],
  };
  ensureSwitchVariableSlots(project);
  return project;
}

const DEFAULT_SWITCH_VARIABLE_SLOT_COUNT = 1000;

export function ensureSwitchVariableSlots(project: Project): boolean {
  const switchesChanged = ensureDefinitionSlots({
    defs: project.switches,
    session: project.session.switches,
    prefix: "sw",
    defaultValue: false,
  });
  const variablesChanged = ensureDefinitionSlots({
    defs: project.variables,
    session: project.session.variables,
    prefix: "var",
    defaultValue: 0,
  });
  return switchesChanged || variablesChanged;
}

function ensureDefinitionSlots<TValue>(options: {
  readonly defs: { id: string; name: string }[];
  readonly session: Record<string, TValue>;
  readonly prefix: "sw" | "var";
  readonly defaultValue: TValue;
}): boolean {
  const { defs, session, prefix, defaultValue } = options;
  let changed = false;
  const ids = new Set(defs.map((entry) => entry.id));
  for (const id of Object.keys(session).sort()) {
    if (ids.has(id)) continue;
    defs.push({ id, name: "" });
    ids.add(id);
    changed = true;
  }

  let slot = 1;
  while (defs.length < DEFAULT_SWITCH_VARIABLE_SLOT_COUNT) {
    const id = `${prefix}_${String(slot).padStart(4, "0")}`;
    slot += 1;
    if (ids.has(id)) continue;
    defs.push({ id, name: "" });
    ids.add(id);
    changed = true;
  }

  for (const { id } of defs) {
    if (Object.prototype.hasOwnProperty.call(session, id)) continue;
    session[id] = defaultValue;
    changed = true;
  }

  return changed;
}
