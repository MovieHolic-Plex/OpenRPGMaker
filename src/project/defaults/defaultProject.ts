import type {
  CommonEvent,
  GameEvent,
  GameMap,
  ItemRecord,
  MapId,
  Project,
  SwitchDef,
  VariableDef,
} from "../types";
import { SCHEMA_VERSION } from "../types";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { normalizeCropRecord } from "@/project/farmModel";
import { defaultFeatureCropRecords } from "./defaultFeatureItemRecords";
import { DEFAULT_ACTOR_ID, DEFAULT_EASYRPG_CHARSET_ID, DEFAULT_ITEM_ID, DEFAULT_TILE_SIZE } from "./constants";
import { defaultStarterActorIds } from "./defaultDatabasePartyRecords";
import { placeableKey, type PlaceableObjectState } from "@/project/placeables";
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
import { DUNGEON_TILESET_ID } from "./dungeonThemedLayouts";
import { SNOW_MOUNTAIN_START, buildSnowMountainMap } from "./snowMountain60";
import { ICE_PLAIN_MAP_NAME, ICE_PLAIN_START, buildIcePlainMap } from "./iceGrandPlain64";
import { enlivenDewVillage } from "./dewVillageLiving";
import { layerDewVillageDialogue } from "./dewVillageDialogue";
import { DEFAULT_ROAD_AUTOTILE_GROUP } from "./autotileGroups";
import { shapeAutotileGroupAround } from "./autotileEngine";
import { DIRT_ROAD_TILE } from "./chipsetMapping";
import { repairLegacyRateKeys } from "./legacyRateKeyRepair";
import { repairUnplayableSystemBgm } from "./legacyAudioRepair";
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
  const project = structuredClone(dewVillageDemoFixture as unknown as Project);
  // Fixture는 blank 시드에서 왔으므로 시작 파티가 1명일 수 있다. 정규 스타터 파티
  // (`STARTER_ACTOR_IDS`, 4인)를 DB에 실제로 있는 배우로 걸러 맞춘다. 예전에는 `slice(0, 2)` 로
  // 2인만 채웠는데, 로스터가 6인·정규 파티가 4인이 된 뒤에도 2인에 머물러 데모가 스타터 파티를
  // 절반만 보여줬다(2026-08-30 실측: startActorIds ['actor_hero'] → 2인).
  const actorIds = project.database.actors.map((actor) => actor.id).filter(Boolean);
  const starterParty = defaultStarterActorIds().filter((id) => actorIds.includes(id));
  const desiredParty = starterParty.length > 0 ? starterParty : actorIds.slice(0, 4);
  if (desiredParty.length > project.system.startActorIds.length) {
    project.system = { ...project.system, startActorIds: desiredParty };
    project.session = { ...project.session, partyActorIds: desiredParty };
  }
  ensureSwitchVariableSlots(project);
  // 낡은 export 잔재 정리 — 적 elementRates 의 state_death 등(legacyRateKeyRepair.ts 주석 참조).
  repairLegacyRateKeys(project);
  // 재생 불가 BGM(MIDI) 참조 교체 — 픽스처는 defaultSystem() 변경이 닿지 않는다.
  repairUnplayableSystemBgm(project);
  // 시간 시스템 + 주민 하루 일과. fixture 자체는 시간표 0개·timeSystem 미설정이라
  // 주민 전원이 제자리에 얼어 있었다(2026-07-26 실측). 자세한 이유는 dewVillageLiving.ts 주석.
  enlivenDewVillage(project);
  // 주민 대사에 시간대·활동·호감·퀘스트 진행을 반영한다(dewVillageDialogue.ts 주석 참조).
  layerDewVillageDialogue(project);
  return project;
}

// Scarloxy MPWSP01 팩 데모 — 팩 타일 그림판/캐릭셋/몬스터/전투 배경/이펙트를 조합한 예시.
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

/**
 * 설산 60×60 — 절벽과 계단만 깔린 지형 캔버스. 감독이 여기에 직접 타일을 얹는다.
 *
 * 선반 위가 비어 있는 것은 **의도한 상태**다("절벽이랑 계단 정도만 가지고" 지시).
 * 소품·이벤트를 코드로 채우지 않으므로 편집기에서 바로 칠할 수 있다.
 */
export function createSnowMountain60Project(): Project {
  const project = createProjectWithStarterMap(buildSnowMountainMap({
    tilesetId: DUNGEON_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
  }));
  project.meta = { ...project.meta, title: "설산 · 절벽 다섯 겹 (60×60)" };
  /**
   * **시작 위치를 반드시 덮어쓴다.** `createProjectWithMaps` 의 기본값은 맵 중앙
   * (30, 31)인데, 이 맵의 (30, 31)은 가운데 절벽 겹의 몸통 한복판이다 —
   * 그대로 두면 주인공이 절벽에 박혀 한 칸도 못 움직인다. 산 발치에 세운다.
   */
  project.startPos = { ...SNOW_MOUNTAIN_START };
  return project;
}

/**
 * 얼음 대평원 64×64 — 결정시트 q8 의 재건판(`iceGrandPlain64.ts`).
 * 절벽 네 겹 · 계단 네 덩어리 · 얼음 바닥 패치만 깔린 지형 캔버스다. 물은 놓지 않는다.
 * 이벤트와 원정 배선은 아직 없다 — 감독이 룩을 승인한 뒤 128×128 의 봉인/보스를 옮긴다.
 */
export function createIcePlain64Project(): Project {
  const project = createProjectWithStarterMap(buildIcePlainMap({
    tilesetId: DUNGEON_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
  }));
  project.meta = { ...project.meta, title: ICE_PLAIN_MAP_NAME };
  /**
   * **시작 위치를 반드시 덮어쓴다.** 기본값인 맵 중앙 (32, 32)은 대지2 한복판이라
   * 어두운 못과 부빙이 화면에 안 들어온다. 못의 남안에 세운다.
   */
  project.startPos = { ...ICE_PLAIN_START };
  return project;
}

export function createMarketTownProject(): Project {
  const project = createProjectWithStarterMap(createMarketTownMap());
  // 시장 광장 입구에서 시작하도록 시작 위치 조정.
  project.startPos = marketTownStartPos();
  return project;
}

declare const require: (id: string) => unknown;

export function createVillageShoppingStreetProject(): Project {
  // Lazy import — villageShoppingStreetBuild → toolRunner/store 순환을 defaultProject 초기화에서 끊음
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    buildVillageShoppingStreetProject,
    villageShoppingStreetStartPos,
  } = require("@/editor/content/villageShoppingStreetBuild") as typeof import("@/editor/content/villageShoppingStreetBuild");
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

/**
 * 밭 가능 영역을 맨흙으로 깔아 **괭이를 대기 전에도 어디가 밭인지 보이게** 한다.
 * 브라우저 실측에서 데모의 밭은 주변과 똑같은 풀밭이라, 어디를 갈 수 있는지 화면에 단서가
 * 하나도 없었다(`farmableArea` 는 저작 데이터일 뿐 그려지지 않는다).
 *
 * 흙은 `builtin_dirt_road`(맨흙)를 쓴다. 갈린 흙 오버레이가 `builtin_farmland` 를 그리므로
 * 바닥에 같은 그룹을 깔면 갈기 전과 후가 같은 그림이 되어 경작 여부를 구별할 수 없다.
 */
function paintFarmableGround(map: GameMap): void {
  const points: { readonly x: number; readonly y: number }[] = [];
  for (const rect of map.farmableArea ?? []) {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        map.lowerTiles[y * map.width + x] = DIRT_ROAD_TILE.BODY;
        points.push({ x, y });
      }
    }
  }
  if (points.length === 0) return;
  // 몸통 타일만 깔면 경계가 각지므로 그룹 셰이핑으로 테두리를 정리한다.
  shapeAutotileGroupAround(map, DEFAULT_ROAD_AUTOTILE_GROUP, points);
}

export function createFarmingDemoProject(): Project {
  const map = createBlankMap("봄 밭", 20, 20);
  map.id = "map_farming_demo";
  map.farmableArea = [{ x: 4, y: 5, w: 6, h: 4 }];
  paintFarmableGround(map);
  const project = createProjectWithMaps([map, createFarmMineMap()], 0);
  sealFarmMineWalls(project);
  project.meta = { ...project.meta, title: "별빛 농장 마을" };
  project.startPos = { x: 4, y: 4 };
  project.system = {
    ...project.system,
    startActorIds: [DEFAULT_ACTOR_ID],
    timeSystem: { enabled: true, dayStartHour: 6, dayEndHour: 26, forceSleep: false },
    giftSystem: true,
    // 맵 플래그만으로는 필드 접촉이 턴제로 간다 — 시스템 스위치도 같이 켜야 액션으로 라우팅된다
    // (`projectLint` 의 opt-in:action-combat-map-without-system 규칙과 같은 계약).
    actionCombat: { enabled: true },
  };
  project.session = {
    ...project.session,
    partyActorIds: [DEFAULT_ACTOR_ID],
    inventory: {
      item_hoe: 1,
      item_watering_can: 1,
      item_pickaxe: 1,
      item_potato_seed: 3,
      item_strawberry_seed: 2,
      item_tomato_seed: 2,
      item_corn_seed: 2,
      item_hay: 8,
    },
    placeables: farmMineRockPlaceables(),
  };
  // 기본 CC0 카탈로그에 이미 세 도구와 주요 수확물이 있고, 세 도구 모두 farmTool까지 갖춘다.
  // 아래 도구 행은 데모 인벤토리와 가격을 한곳에서 명시하려는 중복 저작이다. push 대신 교체(upsert)해
  // 같은 id가 둘 생기거나 데모 전용 값이 기본 카탈로그보다 뒤에서 무시되지 않도록 한다.
  /**
   * **수확물 가격은 씨앗값의 2배를 넘어야 한다.** 상점 매도가는 정가의 절반이므로
   * (`playSceneShopDom.ts` 의 `floor(price/2)`), 정가가 씨앗값의 정확히 2배면 순이익이 0 이다.
   * 이전 데모가 그 상태였다 — 감자 씨앗 20G → 수확 1개 40G → 매도 20G → 본전. 네 작물 중
   * 셋이 수학적으로 손익분기라 농사를 지어도 돈이 늘지 않았다.
   * 여기서는 매도가 ≈ 씨앗값 × 1.7 이 되도록 정가를 씨앗값의 3.4배 근처로 잡는다.
   * 재수확 작물(딸기·블루베리·가지)은 씨앗값을 한 번만 내고 계속 거두므로 배수를 낮게 둔다.
   */
  upsertDemoItems(project, [
    { id: "item_hoe", name: "괭이", scope: "none", price: 50, type: "normalGoods", farmTool: "hoe" },
    { id: "item_watering_can", name: "물뿌리개", scope: "none", price: 80, type: "normalGoods", farmTool: "wateringCan" },
    { id: "item_pickaxe", name: "곡괭이", scope: "none", price: 100, type: "normalGoods", farmTool: "pickaxe" },
    // 광산 산출물. 파는 곳이 없으면 채굴이 인벤토리만 채우고 끝나므로 씨앗 상인이 사들인다.
    { id: "item_stone", name: "돌", scope: "none", price: 30, type: "normalGoods", iconResourceId: "cc0-jetrel-earth-ore", imageResourceId: "cc0-jetrel-earth-ore" },
    { id: "item_iron_ore", name: "철 광석", scope: "none", price: 120, type: "normalGoods", iconResourceId: "cc0-jetrel-iron-ore", imageResourceId: "cc0-jetrel-iron-ore" },
    { id: "item_iron_bar", name: "철 주괴", scope: "none", price: 360, type: "normalGoods", iconResourceId: "cc0-jetrel-iron-ore", imageResourceId: "cc0-jetrel-iron-ore" },
    { id: "item_pickled_potato", name: "감자 피클", scope: "none", price: 240, type: "normalGoods" },
    { id: "item_preserves_jar", name: "절임통", scope: "none", price: 300, type: "normalGoods" },
    { id: "item_furnace", name: "용광로", scope: "none", price: 450, type: "normalGoods" },
    { id: "item_copper_hoe", name: "구리 괭이", scope: "none", price: 600, type: "normalGoods", farmTool: "hoe" },
    { id: "item_copper_watering_can", name: "구리 물뿌리개", scope: "none", price: 650, type: "normalGoods", farmTool: "wateringCan" },
    { id: "item_copper_pickaxe", name: "구리 곡괭이", scope: "none", price: 700, type: "normalGoods", farmTool: "pickaxe" },
    { id: "item_hay", name: "건초", scope: "none", price: 20, type: "normalGoods", consumable: true, careProfile: { kind: "feed", friendshipDelta: 0 } },
    { id: "item_egg", name: "달걀", scope: "none", price: 100, type: "normalGoods" },
    { id: "item_milk", name: "우유", scope: "none", price: 180, type: "normalGoods" },
    // 봄 — 씨앗 20 → 매도 35
    { id: "item_potato_seed", name: "감자 씨앗", scope: "none", price: 20, type: "seed", consumable: true },
    { id: "item_potato", name: "감자", scope: "none", price: 70, type: "normalGoods" },
    // 봄 재수확 — 한 번에 2개, 매도 합 60
    { id: "item_strawberry_seed", name: "딸기 씨앗", scope: "none", price: 40, type: "seed", consumable: true },
    { id: "item_strawberry", name: "딸기", scope: "none", price: 60, type: "normalGoods" },
    // 봄 — 씨앗 30 → 매도 50
    { id: "item_tomato_seed", name: "토마토 씨앗", scope: "none", price: 30, type: "seed", consumable: true },
    { id: "item_tomato", name: "토마토", scope: "none", price: 100, type: "normalGoods" },
    // 봄 3단계 — 씨앗 35 → 매도 60
    { id: "item_corn_seed", name: "옥수수 씨앗", scope: "none", price: 35, type: "seed", consumable: true },
    { id: "item_corn", name: "옥수수", scope: "none", price: 120, type: "normalGoods" },
    // 여름 재수확 — 한 번에 3개, 매도 합 75
    { id: "item_blueberry_seed", name: "블루베리 씨앗", scope: "none", price: 50, type: "seed", consumable: true },
    { id: "item_blueberry", name: "블루베리", scope: "none", price: 50, type: "normalGoods" },
    // 여름 3단계 고가 작물 — 씨앗 60 → 매도 100
    { id: "item_melon_seed", name: "멜론 씨앗", scope: "none", price: 60, type: "seed", consumable: true },
    { id: "item_melon", name: "멜론", scope: "none", price: 200, type: "normalGoods" },
    // 가을 3단계 고가 작물 — 씨앗 70 → 매도 120
    { id: "item_pumpkin_seed", name: "호박 씨앗", scope: "none", price: 70, type: "seed", consumable: true },
    { id: "item_pumpkin", name: "호박", scope: "none", price: 240, type: "normalGoods" },
    // 가을 재수확 — 씨앗 30 → 매도 40
    { id: "item_eggplant_seed", name: "가지 씨앗", scope: "none", price: 30, type: "seed", consumable: true },
    { id: "item_eggplant", name: "가지", scope: "none", price: 80, type: "normalGoods" },
  ]);
  attachFarmMonsterRewards(project);
  project.database.crops = [
    normalizeCropRecord({
      id: "crop_potato",
      name: "감자",
      seedItemId: "item_potato_seed",
      harvestItemId: "item_potato",
      harvestCount: 1,
      stages: [{ days: 1 }, { days: 1 }],
      seasons: ["spring"],
      graphicStages: [
        { resourceId: "farming-crop-potato", frame: 0, label: "감자 새싹" },
        { resourceId: "farming-crop-potato", frame: 1, label: "감자 수확기" },
      ],
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
      graphicStages: [
        { resourceId: "farming-crop-strawberry", frame: 0, label: "딸기 새싹" },
        { resourceId: "farming-crop-strawberry", frame: 1, label: "딸기 수확기" },
      ],
    }),
    normalizeCropRecord({
      id: "crop_tomato",
      name: "토마토",
      seedItemId: "item_tomato_seed",
      harvestItemId: "item_tomato",
      harvestCount: 1,
      stages: [{ days: 1 }, { days: 1 }, { days: 1 }],
      seasons: ["spring"],
      graphicStages: [
        { resourceId: "farming-crop-tomato", frame: 0, label: "토마토 새싹" },
        { resourceId: "farming-crop-tomato", frame: 1, label: "토마토 줄기" },
        { resourceId: "farming-crop-tomato", frame: 2, label: "토마토 수확기" },
      ],
    }),
    normalizeCropRecord({
      id: "crop_corn",
      name: "옥수수",
      seedItemId: "item_corn_seed",
      harvestItemId: "item_corn",
      harvestCount: 1,
      stages: [{ days: 1 }, { days: 1 }, { days: 1 }],
      seasons: ["spring"],
      graphicStages: [
        { resourceId: "farming-crop-corn", frame: 0, label: "옥수수 새싹" },
        { resourceId: "farming-crop-corn", frame: 1, label: "옥수수 줄기" },
        { resourceId: "farming-crop-corn", frame: 2, label: "옥수수 수확기" },
      ],
    }),
    // 여름 — 봄 작물은 계절이 바뀌면 전부 고사한다(farming.ts 의 제철 외 판정). 여름·가을 작물이
    // 없으면 봄 28일이 끝나는 순간 밭이 전멸하고 세 계절 동안 심을 것이 없다.
    // 스프라이트는 이미 출하돼 있었다(farmingSprites.ts) — 저작만 비어 있었다.
    normalizeCropRecord({
      id: "crop_blueberry",
      name: "블루베리",
      seedItemId: "item_blueberry_seed",
      harvestItemId: "item_blueberry",
      harvestCount: 3,
      stages: [{ days: 1 }, { days: 1 }],
      seasons: ["summer"],
      regrow: { days: 1 },
      graphicStages: [
        { resourceId: "farming-crop-blueberry", frame: 0, label: "블루베리 새싹" },
        { resourceId: "farming-crop-blueberry", frame: 1, label: "블루베리 수확기" },
      ],
    }),
    normalizeCropRecord({
      id: "crop_melon",
      name: "멜론",
      seedItemId: "item_melon_seed",
      harvestItemId: "item_melon",
      harvestCount: 1,
      stages: [{ days: 1 }, { days: 1 }, { days: 1 }],
      seasons: ["summer"],
      graphicStages: [
        { resourceId: "farming-crop-melon", frame: 0, label: "멜론 새싹" },
        { resourceId: "farming-crop-melon", frame: 1, label: "멜론 덩굴" },
        { resourceId: "farming-crop-melon", frame: 2, label: "멜론 수확기" },
      ],
    }),
    // 가을
    normalizeCropRecord({
      id: "crop_pumpkin",
      name: "호박",
      seedItemId: "item_pumpkin_seed",
      harvestItemId: "item_pumpkin",
      harvestCount: 1,
      stages: [{ days: 1 }, { days: 1 }, { days: 1 }],
      seasons: ["fall"],
      graphicStages: [
        { resourceId: "farming-crop-pumpkin", frame: 0, label: "호박 새싹" },
        { resourceId: "farming-crop-pumpkin", frame: 1, label: "호박 덩굴" },
        { resourceId: "farming-crop-pumpkin", frame: 2, label: "호박 수확기" },
      ],
    }),
    normalizeCropRecord({
      id: "crop_eggplant",
      name: "가지",
      seedItemId: "item_eggplant_seed",
      harvestItemId: "item_eggplant",
      harvestCount: 1,
      stages: [{ days: 1 }, { days: 1 }],
      seasons: ["fall"],
      regrow: { days: 1 },
      graphicStages: [
        { resourceId: "farming-crop-eggplant", frame: 0, label: "가지 새싹" },
        { resourceId: "farming-crop-eggplant", frame: 1, label: "가지 수확기" },
      ],
    }),
    // gen2 씨앗 4종이 실제로 심어지는 종자밭. 기존 밭 순서를 흔들지 않도록 뒤에 붙인다.
    ...defaultFeatureCropRecords(),
  ];
  map.events.push(
    createFarmAnimalEvent("ev_farm_chicken", "닭", "tex_farming_charset_chicken", 11, 6),
    createFarmAnimalEvent("ev_farm_cow", "젖소", "tex_farming_charset_cow", 13, 8),
    // 침대와 씨앗 상인이 없으면 농사 루프가 닫히지 않는다: 하루를 넘길 방법도(작물은 하루가
    // 지나야 자란다), 수확물을 골드로 바꿀 방법도 없다. 실측으로 데모에서 감자 하나를 거두려면
    // 실시간 40분을 걸어다녀야 했다(하루 = 실시간 20분).
    createFarmBedEvent(3, 3),
    createSeedShopEvent(12, 3),
    createFarmMayorEvent(14, 5),
    createFarmResidentEvent({
      id: "ev_npc_miner",
      characterId: FARM_MINER_CHARACTER_ID,
      name: "광부 도윤",
      x: 2,
      y: 9,
      spriteId: "tex_easyrpg_charset_people1",
      characterIndex: 2,
      dialogue: "광산의 돌빛을 보면 오늘 캘 만한 곳을 알 수 있지.",
      heartDialogue: "자네 몫으로 좋은 철 광맥 하나를 남겨 뒀어.",
    }),
    createFarmResidentEvent({
      id: "ev_npc_carpenter",
      characterId: FARM_CARPENTER_CHARACTER_ID,
      name: "목수 리아",
      x: 3,
      y: 14,
      spriteId: "tex_easyrpg_charset_people2",
      characterIndex: 3,
      dialogue: "튼튼한 농장은 좋은 흙과 좋은 손에서 시작해.",
      heartDialogue: "네 농장이라면 오래 남을 헛간을 지어 보고 싶어.",
    }),
    createFarmResidentEvent({
      id: "ev_npc_herbalist",
      characterId: FARM_HERBALIST_CHARACTER_ID,
      name: "약초사 세나",
      x: 13,
      y: 14,
      spriteId: "tex_easyrpg_charset_people3",
      characterIndex: 1,
      dialogue: "제철 열매는 향만 맡아도 어느 밭에서 왔는지 알 수 있어.",
      heartDialogue: "네가 키운 열매로 마을 사람들을 위한 차를 만들었어.",
    }),
    createSpringFestivalEvent(8, 2),
    createMineEntranceEvent(17, 10)
  );
  attachFarmStaminaScaffolding(project);
  attachFarmSocialProfiles(project);
  attachFarmLifeEconomy(project);
  attachFarmP1WorldLife(project);
  attachFarmP2ExplorationAndSpaces(project);
  if (!project.switches.some((entry) => entry.id === FARM_FESTIVAL_SPRING_SWITCH_ID)) {
    project.switches.push({ id: FARM_FESTIVAL_SPRING_SWITCH_ID, name: "봄 축제 관람" });
  }
  return project;
}

const FARM_MAYOR_CHARACTER_ID = "char_mayor";
const FARM_SEED_MERCHANT_CHARACTER_ID = "char_seed_merchant";
const FARM_MINER_CHARACTER_ID = "char_miner";
const FARM_CARPENTER_CHARACTER_ID = "char_carpenter";
const FARM_HERBALIST_CHARACTER_ID = "char_herbalist";
const FARM_FESTIVAL_SPRING_SWITCH_ID = "sw_festival_spring_done";
const FARM_QUARRY_UNLOCK_SWITCH_ID = "sw_quarry_path_unlocked";

function attachFarmLifeEconomy(project: Project): void {
  if (!project.switches.some((entry) => entry.id === FARM_QUARRY_UNLOCK_SWITCH_ID)) {
    project.switches.push({ id: FARM_QUARRY_UNLOCK_SWITCH_ID, name: "채석장 길 복구" });
  }
  project.system.energy = { max: 100, initial: 100, restorePerDay: 100 };
  project.system.skillSystem = { enabled: true };
  project.system.sellPrices = [
    { itemId: "item_potato", price: 35 },
    { itemId: "item_strawberry", price: 30 },
    { itemId: "item_tomato", price: 50 },
    { itemId: "item_corn", price: 60 },
    { itemId: "item_blueberry", price: 25 },
    { itemId: "item_melon", price: 100 },
    { itemId: "item_pumpkin", price: 120 },
    { itemId: "item_eggplant", price: 40 },
    { itemId: "item_stone", price: 15 },
    { itemId: "item_iron_ore", price: 60 },
    { itemId: "item_iron_bar", price: 180 },
    { itemId: "item_pickled_potato", price: 120 },
    { itemId: "item_egg", price: 50 },
    { itemId: "item_milk", price: 90 },
  ];
  project.system.shipping = {
    enabled: true,
    historyLimit: 14,
    allowedItemIds: project.system.sellPrices.map((entry) => entry.itemId),
  };
  project.system.worldUnlocks = [{
    id: "unlock_quarry_path",
    name: "채석장 길",
    switchId: FARM_QUARRY_UNLOCK_SWITCH_ID,
  }];
  project.system.craftRecipes = [
    {
      id: "recipe_preserves_jar",
      name: "절임통",
      ingredients: [{ itemId: "item_wood", count: 20 }, { itemId: "item_stone", count: 10 }],
      outputItemId: "item_preserves_jar",
      outputCount: 1,
      requiresUnlock: true,
    },
    {
      id: "recipe_furnace",
      name: "용광로",
      ingredients: [{ itemId: "item_stone", count: 20 }, { itemId: "item_iron_ore", count: 5 }],
      outputItemId: "item_furnace",
      outputCount: 1,
      requiresUnlock: true,
    },
  ];
  project.system.itemUpgrades = [
    {
      id: "upgrade_copper_hoe",
      fromItemId: "item_hoe",
      toItemId: "item_copper_hoe",
      goldCost: 500,
      ingredients: [{ itemId: "item_iron_bar", count: 2 }],
      capability: { areaWidth: 3, areaHeight: 1, energyMultiplier: 1.5 },
    },
    {
      id: "upgrade_copper_watering_can",
      fromItemId: "item_watering_can",
      toItemId: "item_copper_watering_can",
      goldCost: 500,
      ingredients: [{ itemId: "item_iron_bar", count: 2 }],
      capability: { areaWidth: 3, areaHeight: 1, energyMultiplier: 1.5 },
    },
    {
      id: "upgrade_copper_pickaxe",
      fromItemId: "item_pickaxe",
      toItemId: "item_copper_pickaxe",
      goldCost: 500,
      ingredients: [{ itemId: "item_iron_bar", count: 2 }],
      capability: { areaWidth: 1, areaHeight: 1, energyMultiplier: 0.75 },
    },
  ];
  project.system.makers = [
    {
      id: "maker_preserves_jar",
      name: "절임통",
      inputs: [{ itemId: "item_potato", count: 1 }],
      outputs: [{ itemId: "item_pickled_potato", count: 1 }],
      durationMinutes: 120,
    },
    {
      id: "maker_furnace",
      name: "용광로",
      inputs: [{ itemId: "item_iron_ore", count: 2 }],
      outputs: [{ itemId: "item_iron_bar", count: 1 }],
      durationMinutes: 180,
    },
  ];
  project.system.bundles = [
    {
      id: "bundle_spring_harvest",
      name: "봄 수확 꾸러미",
      requirements: [
        { itemId: "item_potato", count: 1 },
        { itemId: "item_strawberry", count: 1 },
        { itemId: "item_tomato", count: 1 },
      ],
      reward: { gold: 250, recipeIds: ["recipe_preserves_jar"] },
    },
    {
      id: "bundle_mine_starter",
      name: "광산 입문 꾸러미",
      requirements: [{ itemId: "item_stone", count: 5 }, { itemId: "item_iron_ore", count: 2 }],
      reward: {
        gold: 400,
        switchId: FARM_QUARRY_UNLOCK_SWITCH_ID,
        worldUnlockIds: ["unlock_quarry_path"],
        recipeIds: ["recipe_furnace"],
      },
    },
  ];
  project.database.lifeSkills = [
    { id: "life_farming", name: "농사", skillType: "farming", maxLevel: 5, levelUpRewards: [{ level: 2, recipeId: "recipe_preserves_jar" }] },
    { id: "life_mining", name: "채광", skillType: "mining", maxLevel: 5, levelUpRewards: [{ level: 2, recipeId: "recipe_furnace" }] },
    { id: "life_foraging", name: "채집", skillType: "foraging", maxLevel: 5, levelUpRewards: [] },
    { id: "life_fishing", name: "낚시", skillType: "fishing", maxLevel: 5, levelUpRewards: [] },
    { id: "life_combat", name: "전투", skillType: "combat", maxLevel: 5, levelUpRewards: [] },
  ];
}

function attachFarmP1WorldLife(project: Project): void {
  project.system.dailyWeather = {
    enabled: true,
    forecastDays: 3,
    seasons: {
      spring: [
        { kind: "none", weight: 70, intensity: 0 },
        { kind: "rain", weight: 25, intensity: 0.65 },
        { kind: "storm", weight: 5, intensity: 0.9 },
      ],
      summer: [
        { kind: "none", weight: 74, intensity: 0 },
        { kind: "rain", weight: 18, intensity: 0.6 },
        { kind: "storm", weight: 8, intensity: 0.95 },
      ],
      fall: [
        { kind: "none", weight: 63, intensity: 0 },
        { kind: "rain", weight: 30, intensity: 0.7 },
        { kind: "fog", weight: 7, intensity: 0.45 },
      ],
      winter: [
        { kind: "none", weight: 60, intensity: 0 },
        { kind: "snow", weight: 34, intensity: 0.7 },
        { kind: "fog", weight: 6, intensity: 0.45 },
      ],
    },
  };
  project.database.farmAnimalSpecies = [
    {
      id: "animal_chicken",
      name: "닭",
      graphic: { sprite: { type: "bundled", id: "tex_farming_charset_chicken" }, direction: "down", pattern: 0 },
      feedItemId: "item_hay",
      productItemId: "item_egg",
      productCount: 1,
      productEveryDays: 1,
      petFriendship: 15,
    },
    {
      id: "animal_cow",
      name: "소",
      graphic: { sprite: { type: "bundled", id: "tex_farming_charset_cow" }, direction: "down", pattern: 0 },
      feedItemId: "item_hay",
      productItemId: "item_milk",
      productCount: 1,
      productEveryDays: 2,
      petFriendship: 18,
    },
  ];
  project.system.farmAnimalBuildings = [{
    id: "building_sunrise_barn",
    name: "햇살 축사",
    mapId: project.startMapId,
    x: 12,
    y: 10,
    capacity: 4,
    allowedSpeciesIds: ["animal_chicken", "animal_cow"],
  }];
  project.session.farmAnimals = [
    {
      instanceId: "farm_animal_bori",
      speciesId: "animal_chicken",
      name: "보리",
      eventId: "ev_farm_chicken",
      buildingId: "building_sunrise_barn",
    },
    {
      instanceId: "farm_animal_dubu",
      speciesId: "animal_cow",
      name: "두부",
      eventId: "ev_farm_cow",
      buildingId: "building_sunrise_barn",
    },
  ];
}

/**
 * P2의 탐색·수집·공간 확장 콘텐츠. 스키마 예시만 두지 않고 낚시/채집/박물관과
 * 범용 건물/집 장식을 하나의 저장 가능한 데모 프로젝트 안에서 서로 연결한다.
 */
function attachFarmP2ExplorationAndSpaces(project: Project): void {
  upsertDemoItems(project, [
    { id: "item_river_carp", name: "강 잉어", scope: "none", price: 90, type: "normalGoods" },
    { id: "item_moon_trout", name: "달빛 송어", scope: "none", price: 220, type: "normalGoods" },
    { id: "item_wild_leek", name: "야생 부추", scope: "none", price: 55, type: "normalGoods" },
    { id: "item_summer_berry", name: "여름 산딸기", scope: "none", price: 75, type: "normalGoods" },
    { id: "item_fall_mushroom", name: "가을 버섯", scope: "none", price: 130, type: "normalGoods" },
    { id: "item_winter_root", name: "겨울 뿌리", scope: "none", price: 105, type: "normalGoods" },
    { id: "item_cave_mushroom", name: "동굴 버섯", scope: "none", price: 145, type: "normalGoods" },
    { id: "item_museum_token", name: "박물관 기념 주화", scope: "none", price: 300, type: "normalGoods" },
    { id: "item_sun_rug", name: "해님 러그", scope: "none", price: 180, type: "normalGoods" },
    { id: "item_wood_table", name: "원목 탁자", scope: "none", price: 240, type: "normalGoods" },
  ]);

  project.database.fishSpecies = [
    { id: "fish_river_carp", name: "강 잉어", itemId: "item_river_carp", skillXp: 12 },
    { id: "fish_moon_trout", name: "달빛 송어", itemId: "item_moon_trout", skillXp: 30 },
  ];
  project.system.fishing = {
    enabled: true,
    energyCost: 4,
    spots: [{
      id: "fishing_spot_farm_pond",
      name: "농장 연못",
      mapId: project.startMapId,
      area: { x: 0, y: 15, w: 4, h: 4 },
      catches: [
        { fishId: "fish_river_carp", weight: 75, seasons: ["spring", "summer", "fall"], timePhases: ["morning", "day", "evening"] },
        { fishId: "fish_moon_trout", weight: 25, seasons: ["fall", "winter"], timePhases: ["evening", "night"], weatherKinds: ["rain", "storm", "snow"], minSkillLevel: 2 },
      ],
    }],
  };
  project.system.seasonalForage = {
    enabled: true,
    areas: [
      {
        id: "forage_farm_meadow",
        name: "농장 남쪽 풀밭",
        mapId: project.startMapId,
        area: { x: 10, y: 15, w: 8, h: 4 },
        dailySpawnCount: 2,
        maxActive: 4,
        despawnAfterDays: 2,
        entries: [{
          id: "forage_turning_seasons",
          weight: 3,
          seasonalDrops: {
            spring: "item_wild_leek",
            summer: "item_summer_berry",
            fall: "item_fall_mushroom",
            winter: "item_winter_root",
          },
        }],
      },
      {
        id: "forage_mine_cavern",
        name: "광산 버섯 군락",
        mapId: FARM_MINE_MAP_ID,
        area: { x: 3, y: 5, w: 6, h: 4 },
        dailySpawnCount: 1,
        maxActive: 2,
        spawnEveryDays: 2,
        despawnAfterDays: 3,
        entries: [{ id: "forage_cave_mushroom", weight: 1, itemId: "item_cave_mushroom" }],
      },
    ],
  };
  const trackedItemIds = [
    "item_river_carp",
    "item_moon_trout",
    "item_wild_leek",
    "item_summer_berry",
    "item_fall_mushroom",
    "item_winter_root",
    "item_cave_mushroom",
    "item_stone",
    "item_iron_ore",
  ];
  project.system.collections = { enabled: true, trackedItemIds };
  project.system.museum = {
    enabled: true,
    eligibleItemIds: trackedItemIds,
    rewards: [
      {
        id: "museum_reward_first_find",
        name: "첫 발견 보상",
        minDonations: 1,
        reward: { gold: 150, itemRewards: [{ itemId: "item_museum_token", count: 1 }] },
      },
      {
        id: "museum_reward_field_scholar",
        name: "들판 연구가 보상",
        minDonations: 5,
        requiredItemIds: ["item_river_carp", "item_wild_leek", "item_cave_mushroom"],
        reward: { gold: 650, itemRewards: [{ itemId: "item_museum_token", count: 2 }] },
      },
    ],
  };

  project.database.farmBuildingTypes = [{
    id: "farm_building_workshop",
    name: "농장 작업실",
    allowedMapIds: [project.startMapId],
    levels: [
      {
        level: 1,
        name: "작은 작업실",
        footprint: { width: 2, height: 2 },
        capacity: 2,
        cost: { gold: 500, items: [{ itemId: "item_wood", count: 20 }, { itemId: "item_stone", count: 10 }] },
        graphicResourceId: "tex_easyrpg_charset_object1",
      },
      {
        level: 2,
        name: "장인 작업실",
        footprint: { width: 3, height: 2 },
        capacity: 5,
        cost: { gold: 1200, items: [{ itemId: "item_wood", count: 40 }, { itemId: "item_iron_bar", count: 4 }] },
        graphicResourceId: "tex_easyrpg_charset_object1",
      },
    ],
  }];
  project.database.homeDecorationTypes = [
    {
      id: "home_decor_sun_rug",
      name: "해님 러그",
      placementItemId: "item_sun_rug",
      footprint: { width: 2, height: 1 },
      blocksMovement: false,
      allowedOrientations: ["down", "left", "right", "up"],
      graphicResourceId: "tex_easyrpg_charset_object1",
      allowedMapIds: [project.startMapId],
    },
    {
      id: "home_decor_wood_table",
      name: "원목 탁자",
      placementItemId: "item_wood_table",
      footprint: { width: 1, height: 2 },
      blocksMovement: true,
      allowedOrientations: ["down", "right"],
      graphicResourceId: "tex_easyrpg_charset_object1",
      allowedMapIds: [project.startMapId],
    },
  ];
  project.session = {
    ...project.session,
    inventory: { ...project.session.inventory, item_wild_leek: 1, item_sun_rug: 1, item_wood_table: 1 },
    farmBuildingPlacements: [{
      instanceId: "farm_building_workshop_1",
      typeId: "farm_building_workshop",
      level: 1,
      mapId: project.startMapId,
      x: 14,
      y: 11,
      orientation: "down",
    }],
    homeDecorationPlacements: [
      { instanceId: "home_decor_sun_rug_1", typeId: "home_decor_sun_rug", mapId: project.startMapId, x: 0, y: 1, orientation: "down" },
      { instanceId: "home_decor_wood_table_1", typeId: "home_decor_wood_table", mapId: project.startMapId, x: 10, y: 2, orientation: "right" },
    ],
  };
  const p2SellPrices = [
    ["item_river_carp", 45], ["item_moon_trout", 110], ["item_wild_leek", 28],
    ["item_summer_berry", 38], ["item_fall_mushroom", 65], ["item_winter_root", 53],
    ["item_cave_mushroom", 73],
  ] as const;
  project.system.sellPrices = [
    ...(project.system.sellPrices ?? []),
    ...p2SellPrices.map(([itemId, price]) => ({ itemId, price })),
  ];
  if (project.system.shipping) {
    project.system.shipping = {
      ...project.system.shipping,
      allowedItemIds: [...(project.system.shipping.allowedItemIds ?? []), ...p2SellPrices.map(([itemId]) => itemId)],
    };
  }
}

/**
 * 촌장의 선물 취향. **`characterId` 없이는 호감도가 전부 차단된다** —
 * `resolveSocialKey` 는 `event.id` 로 폴백하지 않고 null 을 돌려준다(의도된 하드 게이트).
 * 그래서 이벤트에 `characterId` 를 달고 여기에 프로필을 등록한다.
 */
function attachFarmSocialProfiles(project: Project): void {
  project.characters = {
    ...project.characters,
    [FARM_MAYOR_CHARACTER_ID]: {
      displayName: "촌장",
      birthday: { season: "spring", day: 14 },
      giftPrefs: {
        loved: ["item_melon", "item_pumpkin"],
        liked: ["item_strawberry", "item_blueberry"],
        disliked: ["item_hoe"],
      },
      giftResponses: {
        loved: "이런 걸 나에게? 올해 최고의 작물이야!",
        liked: "잘 키웠구먼. 고맙네.",
        neutral: "음, 받아 두지.",
        disliked: "…이걸 나더러 어쩌라고?",
      },
    },
    [FARM_SEED_MERCHANT_CHARACTER_ID]: {
      displayName: "씨앗 상인 미오",
      birthday: { season: "summer", day: 8 },
      giftPrefs: {
        loved: ["item_blueberry", "item_pumpkin"],
        liked: ["item_corn", "item_eggplant"],
        disliked: ["item_stone"],
      },
      giftResponses: {
        loved: "이 품질이면 내 가게 진열대 맨 앞자리야!",
        liked: "좋은 물건이네. 다음 장날에도 가져와 줘.",
        neutral: "고마워. 쓸 곳을 찾아볼게.",
        disliked: "가게 창고에도 이건 넘쳐나는데…",
      },
    },
    [FARM_MINER_CHARACTER_ID]: {
      displayName: "광부 도윤",
      birthday: { season: "fall", day: 3 },
      giftPrefs: {
        loved: ["item_iron_ore"],
        liked: ["item_stone", "item_potato"],
        disliked: ["item_strawberry"],
      },
      giftResponses: {
        loved: "결이 좋은 광석이군. 정말 고마워!",
        liked: "광산에서 요긴하게 쓰겠어.",
        neutral: "챙겨 줘서 고맙네.",
        disliked: "광산 안에서는 금방 상할 텐데.",
      },
    },
    [FARM_CARPENTER_CHARACTER_ID]: {
      displayName: "목수 리아",
      birthday: { season: "spring", day: 22 },
      giftPrefs: {
        loved: ["item_corn", "item_pumpkin"],
        liked: ["item_iron_ore", "item_potato"],
        disliked: ["item_watering_can"],
      },
      giftResponses: {
        loved: "일 끝나고 먹으면 힘이 나겠어. 고마워!",
        liked: "튼튼하고 쓸모 있는 선물이네.",
        neutral: "잘 간직할게.",
        disliked: "도구는 내 손에 맞는 걸 직접 고르는 편이야.",
      },
    },
    [FARM_HERBALIST_CHARACTER_ID]: {
      displayName: "약초사 세나",
      birthday: { season: "summer", day: 19 },
      giftPrefs: {
        loved: ["item_strawberry", "item_blueberry"],
        liked: ["item_melon", "item_eggplant"],
        disliked: ["item_iron_ore"],
      },
      giftResponses: {
        loved: "향이 정말 맑아. 좋은 차가 되겠어!",
        liked: "제철 기운이 가득하네. 고마워.",
        neutral: "약방 한쪽에 잘 두어야겠다.",
        disliked: "이건 약탕기보다 대장간에 어울리겠어.",
      },
    },
  };
}

/** 촌장 — 말을 걸면 호감이 오르고, 호감이 쌓이면 다른 대사 페이지가 열린다. */
function createFarmMayorEvent(x: number, y: number): GameEvent {
  const graphic = { sprite: { type: "bundled" as const, id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down" as const, pattern: 0 };
  const movement = { type: "fixed" as const, speed: 3, frequency: 3 };
  return {
    id: "ev_npc_mayor",
    x,
    y,
    characterId: FARM_MAYOR_CHARACTER_ID,
    trigger: { kind: "action" },
    commands: [],
    schedule: farmResidentSchedule(x, y, "마을 순찰"),
    pages: [
      {
        id: "page_mayor_default",
        name: "촌장 · 기본",
        conditions: [],
        graphic,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement,
        commands: [
          { kind: "text", speaker: "촌장", body: "밭은 잘 돌아가나? 철에 맞는 걸 심는 게 제일 중요하네." },
          { kind: "changeFriendship", delta: 10 },
        ],
      },
      {
        // 호감이 쌓이면 열리는 페이지. 엔진에 하트 이벤트 런타임은 없고, 이 조건 페이지가
        // 그 자리를 대신한다(friendshipAtLeast + 페이지 우선순위).
        id: "page_mayor_heart",
        name: "촌장 · 친밀",
        conditions: [{ kind: "friendshipAtLeast", value: 200 }],
        graphic,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement,
        commands: [
          { kind: "text", speaker: "촌장", body: "자네라면 이 마을을 맡겨도 되겠어. 멜론이 익으면 하나 가져오게." },
          { kind: "changeFriendship", delta: 10 },
        ],
      },
    ],
  };
}

function createFarmResidentEvent(input: {
  readonly id: string;
  readonly characterId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly spriteId: string;
  readonly characterIndex: number;
  readonly dialogue: string;
  readonly heartDialogue: string;
}): GameEvent {
  const graphic = {
    sprite: { type: "bundled" as const, id: input.spriteId },
    direction: "down" as const,
    pattern: charsetFrameIndex({ characterIndex: input.characterIndex, direction: "down", pattern: 1 }),
  };
  const movement = { type: "random" as const, speed: 2, frequency: 3 };
  const page = (
    id: string,
    name: string,
    conditions: NonNullable<GameEvent["pages"]>[number]["conditions"],
    body: string,
  ): NonNullable<GameEvent["pages"]>[number] => ({
    id,
    name,
    conditions,
    graphic,
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement,
    commands: [
      { kind: "text", speaker: input.name, body },
      { kind: "changeFriendship", delta: 10 },
    ],
  });
  return {
    id: input.id,
    x: input.x,
    y: input.y,
    characterId: input.characterId,
    trigger: { kind: "action" },
    commands: [],
    schedule: farmResidentSchedule(input.x, input.y, `${input.name}의 일과`),
    pages: [
      page(`page_${input.id}_default`, `${input.name} · 기본`, [], input.dialogue),
      page(`page_${input.id}_heart`, `${input.name} · 친밀`, [{ kind: "friendshipAtLeast", value: 200 }], input.heartDialogue),
    ],
  };
}

/** 봄 축제 — 계절 조건 페이지. 한 번 보면 스위치가 켜진다. */
function createSpringFestivalEvent(x: number, y: number): GameEvent {
  return {
    id: "ev_festival_spring",
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_festival_spring",
        name: "봄 축제 게시판",
        conditions: [{ kind: "season", season: "spring" }],
        graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", body: "봄 축제 안내 — 광장에서 씨앗을 나눠 준다고 적혀 있다." },
          { kind: "setSwitch", switchId: FARM_FESTIVAL_SPRING_SWITCH_ID, value: true },
        ],
      },
    ],
  };
}

/** 기력 변수와 증감 공통 이벤트. 침대가 이 변수를 되돌린다. */
const FARM_STAMINA_VARIABLE_ID = "var_stamina";
const FARM_STAMINA_FULL = 100;

const FARM_MINE_MAP_ID: MapId = "map_mine_1f";
/**
 * 광산은 **던전 칩셋**을 쓴다. 마을 칩셋(combined_town)의 421 은 흙길 오토타일 몸통이라
 * 렌더 시점 쿼터 합성(`chipsetQuarterComposition`)이 갱도 경계마다 **잔디 프린지**를 깐다 —
 * 실측(2026-08-23 스크린샷)으로 갱도 테두리에 초록 풀이 돋아 있었다. 던전 칩셋의 같은
 * 블록(390~452)은 테두리까지 갈색 암반이라 프린지가 없다.
 */
const FARM_MINE_GROUND_TILE = 421;
/**
 * 52 = 던전 칩셋 동굴 암벽 블록(21~23/51~53) 몸통 — 회색 암반.
 * 같은 블록의 22 는 평균색이 (89,74,64) 로 흙바닥 421(97,71,57) 과 거의 같아 실측 화면에서
 * 벽과 바닥이 구분되지 않았다. 52 는 (67,56,50) 으로 확실히 어둡다.
 * 던전 칩셋은 통행 플래그가 없어 `sealFarmMineWalls` 가 이 타일만 solid 로 못 박는다.
 */
const FARM_MINE_WALL_TILE = 52;
const FARM_MINE_ENTRANCE = { x: 17, y: 10 } as const;
const FARM_MINE_ARRIVAL = { x: 9, y: 13 } as const;

/**
 * 광산 1층 — 벽으로 채운 들 갱도를 깎아 낸다(emberQuest 광산과 같은 방식).
 * `actionCombat` 은 맵 옵트인이고, 시스템 스위치는 `createFarmingDemoProject` 가 켜다.
 */
function createFarmMineMap(): GameMap {
  const mine = createBlankMap("광산 1층", 20, 16, DUNGEON_TILESET_ID);
  mine.id = FARM_MINE_MAP_ID;
  fillMapRect(mine, 0, 0, mine.width - 1, mine.height - 1, FARM_MINE_WALL_TILE);
  fillMapRect(mine, 7, 11, 12, 15, FARM_MINE_GROUND_TILE); // 입구 홀
  fillMapRect(mine, 9, 5, 10, 10, FARM_MINE_GROUND_TILE); // 중앙 갱도
  fillMapRect(mine, 3, 5, 8, 8, FARM_MINE_GROUND_TILE); // 서쪽 막장
  mine.actionCombat = true;
  mine.fieldSpawns = [
    {
      id: "spawn_mine_bats",
      troopId: "troop_bat_swarm",
      area: { x: 9, y: 5, w: 2, h: 6 },
      maxAlive: 2,
      respawnSec: 30,
      chase: true,
      graphic: {
        // 던전 박쥐 자리 — monster3#0 은 실측 결과 **붉은 머리 하피**였다(잘못된 라벨).
        // monster2#1 이 동굴 날짐승으로 읽히는 유익 마물이다.
        sprite: { type: "bundled", id: "tex_easyrpg_charset_monster2" },
        direction: "down",
        pattern: charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 }),
      },
    },
    {
      // 갱도 서쪽 막장의 원거리 견제 — 투사체 사격. 액션 전투에서 접근을 강요한다.
      id: "spawn_mine_archers",
      troopId: "troop_mine_archers",
      area: { x: 3, y: 5, w: 2, h: 2 },
      maxAlive: 1,
      respawnSec: 40,
      chase: true,
      graphic: {
        sprite: { type: "bundled", id: "tex_easyrpg_charset_monster2" },
        direction: "down",
        pattern: charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 1 }),
      },
    },
    {
      id: "spawn_mine_golems",
      troopId: "troop_golem_guard",
      area: { x: 3, y: 5, w: 6, h: 4 },
      maxAlive: 1,
      respawnSec: 45,
      chase: true,
      graphic: {
        sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" },
        direction: "down",
        pattern: charsetFrameIndex({ characterIndex: 4, direction: "down", pattern: 1 }),
      },
    },
  ];
  mine.events.push({
    id: "ev_mine_exit",
    x: 9,
    y: 15,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: "page_mine_exit",
        name: "갱도 밖으로",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "transfer", mapId: "map_farming_demo", x: FARM_MINE_ENTRANCE.x, y: FARM_MINE_ENTRANCE.y + 1 },
        ],
      },
    ],
  });
  return mine;
}

/**
 * 던전 칩셋은 `defaultAssets` 가 통행 플래그를 저작하지 않아 **모든 타일이 통행 가능**하다
 * (기본 마을 칩셋만 `isSolidChipsetTile` 기본값을 받는다). 그대로 두면 광산 암벽을
 * 그대로 걸어 지나가므로, 이 데모가 쓰는 암벽 타일만 solid 로 못 박는다.
 */
function sealFarmMineWalls(project: Project): void {
  const tileset = project.tilesets[DUNGEON_TILESET_ID];
  if (!tileset || FARM_MINE_WALL_TILE >= tileset.passability.length) return;
  tileset.passability[FARM_MINE_WALL_TILE] = { up: false, down: false, left: false, right: false };
}

function fillMapRect(map: GameMap, x0: number, y0: number, x1: number, y1: number, tile: number): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      map.lowerTiles[y * map.width + x] = tile;
    }
  }
}

/** 농장 → 광산 입구. */
function createMineEntranceEvent(x: number, y: number): GameEvent {
  return {
    id: "ev_mine_entrance",
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_mine_entrance",
        name: "광산 입구",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 1 }),
        },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", body: "버려진 갱도 입구다. 박쥐 울음이 들린다. 들어갈까?" },
          { kind: "transfer", mapId: FARM_MINE_MAP_ID, x: FARM_MINE_ARRIVAL.x, y: FARM_MINE_ARRIVAL.y },
        ],
      },
    ],
  };
}

/**
 * 광산의 돌. **맵 타일이 아니라 시작 상태의 설치물**이다 — 캐면 사라지기 때문이다.
 * 곡괭이 판정은 기본 도구 규칙(`legacy-pick-mine`)이 `kind: "rock"` 을 targetPlaceableKind 로
 * 잡아 저작만으로 동작하고, 화면에는 `renderPlaceableOverlays` 가 그린다.
 */
function farmMineRockPlaceables(): Record<string, PlaceableObjectState> {
  const rocks: readonly { readonly x: number; readonly y: number; readonly itemId: string }[] = [
    { x: 4, y: 6, itemId: "item_stone" },
    { x: 6, y: 7, itemId: "item_stone" },
    { x: 7, y: 6, itemId: "item_iron_ore" },
    { x: 9, y: 8, itemId: "item_stone" },
    { x: 10, y: 9, itemId: "item_iron_ore" },
  ];
  const placeables: Record<string, PlaceableObjectState> = {};
  for (const [index, rock] of rocks.entries()) {
    placeables[placeableKey(FARM_MINE_MAP_ID, rock.x, rock.y)] = {
      id: `rock_mine_${index + 1}`,
      mapId: FARM_MINE_MAP_ID,
      x: rock.x,
      y: rock.y,
      kind: "rock",
      itemId: rock.itemId,
    };
  }
  return placeables;
}

function attachFarmMonsterRewards(project: Project): void {
  const rewards = [
    { enemyId: "enemy_cave_bat", dropItemId: "item_stone", dropRatePercent: 45 },
    { enemyId: "enemy_stone_golem", dropItemId: "item_iron_ore", dropRatePercent: 65 },
  ] as const;
  for (const reward of rewards) {
    const enemy = project.database.enemies.find((entry) => entry.id === reward.enemyId);
    if (!enemy) continue;
    enemy.rewards = {
      ...enemy.rewards,
      dropItemId: reward.dropItemId,
      dropRatePercent: reward.dropRatePercent,
    };
  }
}

/**
 * 기력 **저작 뼈대**를 붙인다. 엔진은 농사 행동에서 기력을 깎지 않는다 —
 * `interactWithFarmPlot` 은 어떤 자원도 소모하지 않고 공통 이벤트를 부르는 훅도 없다.
 * 그래서 이것은 "기력 시스템"이 아니라 저작자가 자기 이벤트에서 호출할 부품이다.
 * 진짜 기력을 만들려면 농사 행동이 공통 이벤트를 부를 수 있어야 하고, 그건 엔진 작업이다.
 */
function attachFarmStaminaScaffolding(project: Project): void {
  if (!project.variables.some((variable) => variable.id === FARM_STAMINA_VARIABLE_ID)) {
    project.variables.push({ id: FARM_STAMINA_VARIABLE_ID, name: "기력" });
  }
  project.session = {
    ...project.session,
    variables: { ...project.session.variables, [FARM_STAMINA_VARIABLE_ID]: FARM_STAMINA_FULL },
  };
  project.commonEvents.push(
    {
      id: "ce_stamina_decrease",
      name: "기력 소모",
      trigger: "none",
      commands: [
        { kind: "setVariable", variableId: FARM_STAMINA_VARIABLE_ID, op: "-=", value: 5 },
        {
          kind: "fork",
          condition: { kind: "variable", variableId: FARM_STAMINA_VARIABLE_ID, op: "<=", value: 0 },
          then: [
            { kind: "setVariable", variableId: FARM_STAMINA_VARIABLE_ID, op: "=", value: 0 },
            { kind: "text", body: "너무 지쳤다. 침대에서 쉬어야 한다." },
          ],
          else: [],
        },
      ],
    },
    {
      id: "ce_stamina_recover",
      name: "기력 회복",
      trigger: "none",
      commands: [
        { kind: "setVariable", variableId: FARM_STAMINA_VARIABLE_ID, op: "=", value: FARM_STAMINA_FULL },
      ],
    }
  );
}

/** 잠자리 — 하루를 넘기고 기력을 되돌린다. 작물 성장은 날짜가 바뀔 때만 일어난다. */
function createFarmBedEvent(x: number, y: number): GameEvent {
  return {
    id: "ev_bed",
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_bed",
        name: "잠자리",
        conditions: [],
        graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", body: "잠자리에 눕는다. 아침까지 잘까?" },
          { kind: "sleepUntilMorning" },
          { kind: "setVariable", variableId: FARM_STAMINA_VARIABLE_ID, op: "=", value: FARM_STAMINA_FULL },
        ],
      },
    ],
  };
}

/**
 * 씨앗 상인 — 여덟 작물의 씨앗을 팔고 수확물을 사들인다.
 *
 * 수확물을 `itemIds` 에 함께 넣어야 한다. 상점은 **매수 목록과 매도 목록이 같은 배열**이라
 * (`playSceneShop.ts`), 작물을 넣지 않으면 플레이어가 수확물을 팔 수 없다.
 * `merchantGold` 도 올린다 — 런타임 기본 100G 는 밭 24칸 한 판(감자만 해도 매도 합 840G)에
 * 두 자릿수로 못 미치고, 부분 판매가 없어 초과분은 전량 거절된다.
 */
function createSeedShopEvent(x: number, y: number): GameEvent {
  const seeds = [
    "item_potato_seed", "item_strawberry_seed", "item_tomato_seed", "item_corn_seed",
    "item_blueberry_seed", "item_melon_seed", "item_pumpkin_seed", "item_eggplant_seed",
  ];
  const harvests = [
    "item_potato", "item_strawberry", "item_tomato", "item_corn",
    "item_blueberry", "item_melon", "item_pumpkin", "item_eggplant",
  ];
  // 광산 산출물도 여기서 현금화한다 — 상인이 하나라 목록에 없으면 캔 돌이 인벤토리에 쌓이기만 한다.
  const minerals = ["item_stone", "item_iron_ore"];
  const shopCommand = {
    kind: "shop" as const,
    itemIds: [...seeds, ...harvests, ...minerals],
    allowSell: true,
    quantityMode: "select" as const,
    shopType: "normal" as const,
    messageType: "welcome" as const,
    merchantGold: 5000,
    branchOnTransaction: false,
    transactionBranch: [],
  };
  const page = (
    id: string,
    name: string,
    conditions: NonNullable<GameEvent["pages"]>[number]["conditions"],
    body: string,
  ): NonNullable<GameEvent["pages"]>[number] => ({
    id,
    name,
    conditions,
    graphic: {
      sprite: { type: "bundled", id: "tex_easyrpg_charset_people2" },
      direction: "down",
      pattern: charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 }),
    },
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [
      { kind: "text", speaker: "씨앗 상인 미오", body },
      shopCommand,
      { kind: "changeFriendship", delta: 5 },
    ],
  });
  return {
    id: "ev_seed_shop",
    x,
    y,
    characterId: FARM_SEED_MERCHANT_CHARACTER_ID,
    trigger: { kind: "action" },
    commands: [],
    schedule: farmResidentSchedule(x, y, "씨앗 가게 영업"),
    pages: [
      page("page_seed_shop", "씨앗 상인 · 기본", [], "씨앗도 팔고 수확물도 사들여. 철에 맞는 걸 심어야 해."),
      page(
        "page_seed_shop_heart",
        "씨앗 상인 · 친밀",
        [{ kind: "friendshipAtLeast", value: 200 }],
        "좋은 농부가 오면 장사가 즐거워져. 오늘은 가장 싱싱한 씨앗을 골라 뒀어.",
      ),
    ],
  };
}

function farmResidentSchedule(x: number, y: number, activity: string): NonNullable<GameEvent["schedule"]> {
  return [
    { when: { timePhase: "morning" }, at: { mapId: "map_farming_demo", x, y }, facing: "down", activity },
    { when: { timePhase: "evening" }, at: { mapId: "map_farming_demo", x: Math.min(18, x + 1), y }, facing: "left", activity: "저녁 장터" },
    { when: { timePhase: "night" }, at: { mapId: "map_farming_demo", x, y }, facing: "up", activity: "귀가" },
  ];
}

/**
 * 같은 id 가 이미 있으면 패치를 덮어쓰고, 없으면 추가한다.
 * 통째로 교체하면 CC0 카탈로그가 가진 아이콘·이미지·설명이 날아가 상점과 인벤토리가 빈 칸이 된다
 * (item_hoe → cc0-jetrel-hoe). 데모가 명시한 필드만 이기고 나머지는 카탈로그에서 상속한다.
 */
function upsertDemoItems(
  project: Project,
  patches: readonly (Partial<ItemRecord> & Pick<ItemRecord, "id" | "name">)[]
): void {
  for (const patch of patches) {
    const index = project.database.items.findIndex((entry) => entry.id === patch.id);
    const existing = index < 0 ? undefined : project.database.items[index];
    const record = normalizeItemRecord(existing ? { ...existing, ...patch } : patch);
    if (index < 0) project.database.items.push(record);
    else project.database.items[index] = record;
  }
}

// 농장 동물 — 밭 근처를 배회하는 장식 이벤트 (대화 없음).
function createFarmAnimalEvent(id: string, name: string, charsetTextureKey: string, x: number, y: number): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `page_${id}`,
        name,
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: charsetTextureKey },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }),
        },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "random", speed: 2, frequency: 3 },
        commands: [],
      },
    ],
  };
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
  const switches: SwitchDef[] = initialDefinitionSlots("sw");
  const variables: VariableDef[] = initialDefinitionSlots("var");
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
  // 낡은 export 잔재 정리 — 적 elementRates 의 state_death 등(legacyRateKeyRepair.ts 주석 참조).
  repairLegacyRateKeys(project);
  // 재생 불가 BGM(MIDI) 참조 교체 — 픽스처는 defaultSystem() 변경이 닿지 않는다.
  repairUnplayableSystemBgm(project);
  return project;
}

// One classic picker block keeps first-use command forms immediately usable. This is
// starter capacity, not a maximum: add/range actions grow the arrays on demand.
const INITIAL_SWITCH_VARIABLE_SLOT_COUNT = 20;

function initialDefinitionSlots(prefix: "sw" | "var"): { id: string; name: string }[] {
  return Array.from({ length: INITIAL_SWITCH_VARIABLE_SLOT_COUNT }, (_, index) => ({
    id: `${prefix}_${String(index + 1).padStart(4, "0")}`,
    name: "",
  }));
}

export function ensureSwitchVariableSlots(project: Project): boolean {
  const switchesChanged = ensureDefinitionSlots({
    defs: project.switches,
    session: project.session.switches,
    defaultValue: false,
  });
  const variablesChanged = ensureDefinitionSlots({
    defs: project.variables,
    session: project.session.variables,
    defaultValue: 0,
  });
  return switchesChanged || variablesChanged;
}

function ensureDefinitionSlots<TValue>(options: {
  readonly defs: { id: string; name: string }[];
  readonly session: Record<string, TValue>;
  readonly defaultValue: TValue;
}): boolean {
  const { defs, session, defaultValue } = options;
  let changed = false;
  const ids = new Set(defs.map((entry) => entry.id));
  for (const id of Object.keys(session).sort()) {
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
