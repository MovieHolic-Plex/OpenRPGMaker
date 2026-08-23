// modernNocturneGame.ts — 《네온의 유언》: Modern Exteriors v42.3로 만든 단편 도시 RPG.
// 구성: 도시 1개 / 옥상 1개 / 고정 전투 2회 / 조사·선택·엔딩 분기.
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { PRODUCT_BRAND } from "@/brand";
import type { Command, EventPage, GameEvent, GameMap, Project, TilesetDef } from "../types";
import { SCHEMA_VERSION } from "../types";
import {
  DEFAULT_ACTOR_ID,
  DEFAULT_CLASS_ID,
  DEFAULT_ITEM_ID,
  DEFAULT_TILE_SIZE,
} from "./constants";
import { defaultAssetSet, defaultResourceProfiles } from "./defaultAssets";
import { defaultDatabase, defaultSession, defaultSystem, defaultTerms, defaultTitleScreenSettings } from "./defaultDatabase";
import { createBlankMap, singleNodeTree } from "./defaultMaps";

export const MODERN_NOCTURNE_TITLE = "네온의 유언";
export const MODERN_NOCTURNE_PROJECT_ID = "modern-nocturne-20260809";

export const MODERN_MAP = {
  city: "map_neon_city",
  rooftop: "map_neon_rooftop",
} as const;

export const MODERN_SWITCH = {
  caseStarted: "sw_neon_case_started",
  clueDumpster: "sw_neon_clue_dumpster",
  clueMemorial: "sw_neon_clue_memorial",
  clueWitness: "sw_neon_clue_witness",
  alleyWon: "sw_neon_alley_won",
  rooftopWon: "sw_neon_rooftop_won",
  endingMercy: "sw_neon_ending_mercy",
  endingExpose: "sw_neon_ending_expose",
} as const;

const TILESET_ID = "tileset_modern_exteriors";
const TILESET_TEXTURE_KEY = "tex_modern_exteriors_nocturne";
const TILESET_COLUMNS = 30;
const TILESET_ROWS = 16;
const TILESET_COUNT = TILESET_COLUMNS * TILESET_ROWS;
const PEOPLE_1 = "tex_easyrpg_charset_people1";
const PEOPLE_2 = "tex_easyrpg_charset_people2";
const PEOPLE_3 = "tex_easyrpg_charset_people3";
const MONSTER_1 = "tex_easyrpg_charset_monster1";
const MONSTER_2 = "tex_easyrpg_charset_monster2";
const PASSIVE = { type: "fixed", speed: 3, frequency: 3 } as const satisfies EventPage["movement"];
const WANDER = { type: "random", speed: 2, frequency: 3 } as const satisfies EventPage["movement"];
const NO_GRAPHIC = { transparent: true } as const satisfies EventPage["graphic"];

const T = {
  asphalt: atlasTile(0, 0),
  sidewalk: atlasTile(1, 0),
  plaza: atlasTile(10, 0),
  roofFloor: atlasTile(3, 0),
  curb: atlasTile(5, 0),
  curbEast: atlasTile(11, 0),
  curbNorth: atlasTile(12, 0),
  curbSouth: atlasTile(13, 0),
  laneMark: atlasTile(6, 0),
  crosswalk: atlasTile(7, 0),
  // Accents at free atlas slots — must not collide with any floor (row-0) alias above.
  plazaStone: atlasTile(8, 0),
  plazaWarm: atlasTile(9, 0),
  westCivic: atlasRect(0, 1, 8, 8),
  nightShops: atlasRect(8, 1, 8, 8),
  archive: atlasRect(16, 1, 8, 8),
  policeBlock: atlasRect(24, 1, 6, 8),
  utility: atlasRect(0, 9, 8, 7),
  greenhouse: atlasRect(8, 9, 8, 7),
  memorial: atlasRect(16, 9, 8, 7),
  industrial: atlasRect(24, 9, 6, 7),
} as const;

export function createModernNocturneProject(): Project {
  const maps = [cityMap(), rooftopMap()];
  const session = defaultSession();
  session.partyActorIds = [DEFAULT_ACTOR_ID];
  session.inventory = { [DEFAULT_ITEM_ID]: 4 };
  session.gold = 80;

  const database = defaultDatabase();
  database.actors = database.actors
    .filter((actor) => actor.id === DEFAULT_ACTOR_ID)
    .map((actor) => ({ ...actor, name: "윤서", nickname: "야간 기록관" }));
  database.classes = database.classes
    .filter((entry) => entry.id === DEFAULT_CLASS_ID)
    .map((entry) => ({
      ...entry,
      equipmentPermissions: {
        actorIds: entry.equipmentPermissions.actorIds.filter((id) => id === DEFAULT_ACTOR_ID),
        classIds: entry.equipmentPermissions.classIds.filter((id) => id === DEFAULT_CLASS_ID),
        equipmentIds: [...entry.equipmentPermissions.equipmentIds],
      },
    }));
  database.equipment = database.equipment.map((entry) => ({
    ...entry,
    equippableActorIds: entry.equippableActorIds.filter((id) => id === DEFAULT_ACTOR_ID),
    equippableClassIds: entry.equippableClassIds.filter((id) => id === DEFAULT_CLASS_ID),
  }));
  database.items = database.items
    .filter((entry) => entry.id === DEFAULT_ITEM_ID)
    .map((entry) => ({
      ...entry,
      usableActorIds: entry.usableActorIds.filter((id) => id === DEFAULT_ACTOR_ID),
      usableClassIds: entry.usableClassIds.filter((id) => id === DEFAULT_CLASS_ID),
      equipmentProfile: {
        ...entry.equipmentProfile,
        equippableActorIds: entry.equipmentProfile.equippableActorIds.filter((id) => id === DEFAULT_ACTOR_ID),
        equippableClassIds: entry.equipmentProfile.equippableClassIds.filter((id) => id === DEFAULT_CLASS_ID),
      },
    }));
  database.enemies = database.enemies.filter((entry) => ["enemy_extra_016", "enemy_extra_038"].includes(entry.id));
  database.enemies = database.enemies.map((enemy) => enemy.id === "enemy_extra_016"
    ? { ...enemy, name: "네온 망령", stats: { ...enemy.stats, maxHp: 48, attack: 18, defense: 10 }, rewards: { ...enemy.rewards, exp: 35, gold: 18 } }
    : { ...enemy, name: "도시 기록수호자", stats: { ...enemy.stats, maxHp: 95, attack: 24, defense: 16 }, rewards: { ...enemy.rewards, exp: 70, gold: 40 } });
  database.troops = [
    {
      id: "troop_neon_wraith",
      name: "네온 망령",
      enemyIds: ["enemy_extra_016"],
      members: [{ enemyId: "enemy_extra_016", x: 112, y: 96 }],
      autoAlign: false,
      previewBackgroundResourceId: "modern-nocturne-battle-city",
      battleEventPages: [],
    },
    {
      id: "troop_archive_custodian",
      name: "도시 기록수호자",
      enemyIds: ["enemy_extra_038"],
      members: [{ enemyId: "enemy_extra_038", x: 112, y: 96 }],
      autoAlign: false,
      previewBackgroundResourceId: "modern-nocturne-battle-rooftop",
      battleEventPages: [],
    },
  ];

  const system = defaultSystem();
  system.startActorIds = [DEFAULT_ACTOR_ID];
  system.initialTroopId = "troop_neon_wraith";
  system.titleScreen = {
    ...(system.titleScreen ?? defaultTitleScreenSettings()),
    title: MODERN_NOCTURNE_TITLE,
    backgroundResourceId: "modern-nocturne-title",
    menuLabels: { newGame: "밤의 기록을 연다", continueGame: "기록 이어보기", quit: "도시를 떠난다" },
    layout: { titleX: 160, titleY: 54, menuX: 160, menuY: 142 },
    titleGraphic: { mode: "graphic", resourceId: "modern-nocturne-logo", x: 160, y: 54 },
    showInputHint: false,
  };

  const project: Project = {
    version: SCHEMA_VERSION,
    meta: { title: MODERN_NOCTURNE_TITLE, author: PRODUCT_BRAND, terms: defaultTerms() },
    assets: defaultAssetSet(),
    resourceProfiles: defaultResourceProfiles(),
    tilesets: { [TILESET_ID]: modernTileset() },
    switches: [],
    variables: [],
    commonEvents: [],
    database,
    system,
    session,
    maps: Object.fromEntries(maps.map((map) => [map.id, map])),
    mapConnections: [],
    mapTree: { mapId: MODERN_MAP.city, children: [singleNodeTree(MODERN_MAP.rooftop)] },
    startMapId: MODERN_MAP.city,
    startPos: { x: 17, y: 18 },
    flags: {},
    endings: [
      { id: "ending_neon_mercy", name: "새벽의 증언", conditions: [{ kind: "switch", switchId: MODERN_SWITCH.endingMercy, value: true }], priority: 10 },
      { id: "ending_neon_expose", name: "꺼지지 않는 간판", conditions: [{ kind: "switch", switchId: MODERN_SWITCH.endingExpose, value: true }], priority: 20 },
    ],
  };
  for (const [id, name] of Object.entries({
    [MODERN_SWITCH.caseStarted]: "사건 조사 시작",
    [MODERN_SWITCH.clueDumpster]: "골목의 카세트 확보",
    [MODERN_SWITCH.clueMemorial]: "추모비 명단 확인",
    [MODERN_SWITCH.clueWitness]: "목격자 진술 확보",
    [MODERN_SWITCH.alleyWon]: "골목 망령 격퇴",
    [MODERN_SWITCH.rooftopWon]: "기록수호자 격퇴",
    [MODERN_SWITCH.endingMercy]: "새벽의 증언 엔딩",
    [MODERN_SWITCH.endingExpose]: "꺼지지 않는 간판 엔딩",
  })) nameSwitch(project, id, name);
  return project;
}
function modernTileset(): TilesetDef {
  // Decorative facade cells render on the upper layer but remain pass-through.
  // This keeps the authored investigation route open while preserving intact source rectangles.
  const passability = Array.from({ length: TILESET_COUNT }, () => ({ up: true, down: true, left: true, right: true }));
  const priority: TilesetDef["priority"] = Array.from({ length: TILESET_COUNT }, () => "lower");
  const terrain = Array.from({ length: TILESET_COUNT }, () => 0);
  return {
    id: TILESET_ID,
    name: "Modern Exteriors — 해오름구 자정",
    image: { type: "bundled", id: TILESET_TEXTURE_KEY },
    kind: "custom",
    tileSize: DEFAULT_TILE_SIZE,
    tilesPerRow: TILESET_COLUMNS,
    count: TILESET_COUNT,
    passability,
    priority,
    terrain,
    grammarProfile: "modern-exteriors",
    palettePresets: [
      { id: "modern-road", name: "도로·보도", origin: "ai", slots: [
        { role: "ground", tileIds: [T.asphalt] },
        { role: "path", tileIds: [T.sidewalk] },
        { role: "boundary", tileIds: [T.curb, T.curbEast, T.curbNorth, T.curbSouth] },
        { role: "decor", tileIds: [T.laneMark, T.crosswalk] },
      ] },
      { id: "modern-plaza", name: "광장·지붕", origin: "ai", slots: [
        { role: "ground", tileIds: [T.plaza] },
        { role: "decor", tileIds: [T.plazaStone, T.plazaWarm] },
        { role: "roof", tileIds: [T.roofFloor] },
      ] },
      { id: "modern-buildings", name: "건물 스탬프", origin: "ai", slots: [
        { role: "wall", tileIds: atlasRect(0, 1, 8, 1) },
        { role: "furniture", tileIds: atlasRect(0, 9, 8, 1) },
      ] },
    ],
    tileGroups: [
      { id: "modern-road-marks", name: "도로 표시", role: "terrain", defaultLayer: "lower", tileIds: [T.laneMark, T.crosswalk], description: "차선·횡단보도: 아스팔트 위에 덮는 도로 마킹.", placementRules: "lower에 아스팔트 바탕 위에 1칸 브러시.", origin: "ai", source: "ai", patternGrammar: { kind: "single", parts: [{ role: "center", tileIds: [T.laneMark, T.crosswalk] }], preserveCaps: false, repeat: "center" } },
      { id: "modern-curb-ns", name: "연석(세로)", role: "wall", defaultLayer: "lower", tileIds: [T.curb, T.curbEast], description: "南北 연석 — 도로와 보도 경계.", placementRules: "하위 레이어 세로 1열.", origin: "ai", source: "ai", patternGrammar: { kind: "vertical_expandable", axis: "vertical", parts: [{ role: "top", tileIds: [T.curb] }, { role: "center", tileIds: [T.curb, T.curbEast] }, { role: "bottom", tileIds: [T.curbEast] }], preserveCaps: false, repeat: "center" } },
      { id: "modern-curb-ew", name: "연석(가로)", role: "wall", defaultLayer: "lower", tileIds: [T.curbNorth, T.curbSouth], description: "東西 연석 — 지붕/광장 테두리.", placementRules: "하위 레이어 가로 1열.", origin: "ai", source: "ai", patternGrammar: { kind: "horizontal_expandable", axis: "horizontal", parts: [{ role: "left", tileIds: [T.curbNorth] }, { role: "center", tileIds: [T.curbNorth, T.curbSouth] }, { role: "right", tileIds: [T.curbSouth] }], preserveCaps: false, repeat: "center" } },
      { id: "modern-west-civic", name: "서부 시민회관 (8×8)", role: "building", defaultLayer: "lower", tileIds: T.westCivic, description: "붉은 벽돌 서부 시민회관 8×8 스탬프 — 원본 배열 유지.", placementRules: "sourceRect 0,1 8×8을 lower/upper 풋프린트로 전개. 외곽은 벽 충돌 있음.", origin: "ai", source: "ai", sourceRect: { x: 0, y: 1, width: 8, height: 8 }, patternGrammar: { kind: "source_rect", parts: [{ role: "center", tileIds: T.westCivic }], preserveCaps: true, repeat: "source_order" } },
      { id: "modern-night-shops", name: "야간 상점가 (8×8)", role: "building", defaultLayer: "lower", tileIds: T.nightShops, description: "네온 상점가 8×8 스탬프.", placementRules: "sourceRect 8,1 8×8.", origin: "ai", source: "ai", sourceRect: { x: 8, y: 1, width: 8, height: 8 }, patternGrammar: { kind: "source_rect", parts: [{ role: "center", tileIds: T.nightShops }], preserveCaps: true, repeat: "source_order" } },
      { id: "modern-archive", name: "시립 기록원 (8×8)", role: "building", defaultLayer: "lower", tileIds: T.archive, description: "시립 기록원 8×8 스탬프.", placementRules: "sourceRect 16,1 8×8.", origin: "ai", source: "ai", sourceRect: { x: 16, y: 1, width: 8, height: 8 }, patternGrammar: { kind: "source_rect", parts: [{ role: "center", tileIds: T.archive }], preserveCaps: true, repeat: "source_order" } },
      { id: "modern-police", name: "경찰 블록 (6×8)", role: "building", defaultLayer: "lower", tileIds: T.policeBlock, description: "경찰 블록 6×8 스탬프.", placementRules: "sourceRect 24,1 6×8.", origin: "ai", source: "ai", sourceRect: { x: 24, y: 1, width: 6, height: 8 }, patternGrammar: { kind: "source_rect", parts: [{ role: "center", tileIds: T.policeBlock }], preserveCaps: true, repeat: "source_order" } },
      { id: "modern-utility", name: "유틸리티 블록 (8×7)", role: "building", defaultLayer: "lower", tileIds: T.utility, description: "유틸리티 8×7 스탬프.", placementRules: "sourceRect 0,9 8×7.", origin: "ai", source: "ai", sourceRect: { x: 0, y: 9, width: 8, height: 7 }, patternGrammar: { kind: "source_rect", parts: [{ role: "center", tileIds: T.utility }], preserveCaps: true, repeat: "source_order" } },
      { id: "modern-greenhouse", name: "온실 블록 (8×7)", role: "building", defaultLayer: "lower", tileIds: T.greenhouse, description: "온실 8×7 스탬프 (옥상용).", placementRules: "sourceRect 8,9 8×7.", origin: "ai", source: "ai", sourceRect: { x: 8, y: 9, width: 8, height: 7 }, patternGrammar: { kind: "source_rect", parts: [{ role: "center", tileIds: T.greenhouse }], preserveCaps: true, repeat: "source_order" } },
      { id: "modern-memorial", name: "추모 시설 (8×7)", role: "building", defaultLayer: "lower", tileIds: T.memorial, description: "추모 시설 8×7 스탬프.", placementRules: "sourceRect 16,9 8×7.", origin: "ai", source: "ai", sourceRect: { x: 16, y: 9, width: 8, height: 7 }, patternGrammar: { kind: "source_rect", parts: [{ role: "center", tileIds: T.memorial }], preserveCaps: true, repeat: "source_order" } },
      { id: "modern-industrial", name: "산업 블록 (6×7)", role: "building", defaultLayer: "lower", tileIds: T.industrial, description: "산업 블록 6×7 스탬프.", placementRules: "sourceRect 24,9 6×7.", origin: "ai", source: "ai", sourceRect: { x: 24, y: 9, width: 6, height: 7 }, patternGrammar: { kind: "source_rect", parts: [{ role: "center", tileIds: T.industrial }], preserveCaps: true, repeat: "source_order" } },
     ],
  };
}

function cityMap(): GameMap {
 const map = makeMap(MODERN_MAP.city, "해오름구 · 자정", 34, 28, T.asphalt);
 // One uninterrupted avenue. Buildings sit in generous civic setbacks, so the
 // first camera reads as a district rather than cropped facade fragments.
 rect(map, 1, 1, 11, 26, T.sidewalk);
 // East district: sidewalk as a frame around the memorial plaza so the two
 // surfaces never overwrite each other in place. Plaza (22,17-31,25) sits in
 // the sidewalk hole with a 1-tile sidewalk border south/east and a full
 // northern block — no overlapping fill.
  rect(map, 22, 1, 32, 16, T.sidewalk);
  rect(map, 32, 17, 32, 25, T.sidewalk);
  rect(map, 22, 26, 32, 26, T.sidewalk);
  for (let y = 1; y < 27; y += 1) {
    setLower(map, 12, y, T.curb);
    setLower(map, 21, y, T.curbEast);
  }
 for (let y = 3; y < 27; y += 6) {
 setLower(map, 16, y, T.laneMark);
 }
 rect(map, 15, 12, 18, 12, T.crosswalk);
 rect(map, 15, 18, 18, 18, T.crosswalk);

 // Stamps preserve native source neighbors; 2+ tile setbacks prevent ordinary
 // 20×15 play framing from amputating the landmark silhouettes.
 stampAtlas(map, 3, 2, T.westCivic, 8, 8);
 stampAtlas(map, 3, 18, T.nightShops, 8, 8);
 stampAtlas(map, 23, 2, T.archive, 8, 8);
 rect(map, 22, 17, 31, 25, T.plaza);
 // Warm/dark accents at plaza edges — must not use roofFloor (3,0).
 for (const [x, y] of [[24, 18], [29, 22]] as const) setLower(map, x, y, T.plazaWarm);
 for (const [x, y] of [[28, 19], [25, 23]] as const) setLower(map, x, y, T.plazaStone);
 stampAtlas(map, 23, 18, T.memorial, 8, 7);
 setLower(map, 27, 21, T.plaza);
 for (const [x, y] of [[27, 20], [27, 21], [26, 9], [28, 24]] as const) {
 setUpper(map, x, y, -1);
 setLower(map, x, y, T.plaza);
 }
 stampAtlasSlice(map, 10, 13, T.utility, 8, 0, 0, 2, 3);
  map.defaultLighting = { ambient: 0.56, color: "#7380a9", sources: [
    { id: "west-neon", at: { x: 10, y: 8 }, radius: 7, intensity: 0.82, color: "#ff5f9e", flicker: true },
    { id: "civic-crosswalk", at: { x: 17, y: 17 }, radius: 9, intensity: 1.08, color: "#dceeff" },
    { id: "archive-blue", at: { x: 22, y: 10 }, radius: 8, intensity: 0.72, color: "#72d8ff" },
    { id: "memorial-warm", at: { x: 27, y: 20 }, radius: 6, intensity: 0.72, color: "#ffd798" },
  ] };
  map.bgm = { mode: "custom", resourceId: "cc0-bgm-field", fadeInMs: 900 };
  map.layoutPlan = { version: 1, kind: "nocturnal-civic-avenue", regions: [
    { id: "west-post", role: "landmark", label: "서부 우편국", x: 3, y: 2, w: 8, h: 8 },
    { id: "service-alley", role: "alley", label: "붉은 벽돌 서비스 골목", x: 3, y: 13, w: 9, h: 13 },
    { id: "archive", role: "landmark", label: "시립기록원", x: 23, y: 2, w: 8, h: 8 },
    { id: "memorial", role: "plaza", label: "17인의 추모 광장", x: 22, y: 17, w: 10, h: 9 },
  ] };

  map.events.push(
    detectiveEvent(),
    witnessEvent(),
    alleyClueEvent(),
    memorialClueEvent(),
    alleyBattleEvent(),
    rooftopDoorEvent(),
    flavorEvent("ev_neon_vendor", 8, 10, "심야 매점 해나", [
      "이 거리의 불빛은 모두 누군가의 이름표예요. 하나가 꺼질 때마다 사람 하나가 없어진 셈이죠.",
      "기록원 옥상에서 파란 섬광이 세 번 났어요. 사고라기엔 너무 정확했죠.",
    ], charsetGraphic(PEOPLE_3, 2)),
    flavorEvent("ev_neon_courier", 19, 19, "심야 배달원 준", [
      "서쪽 골목 쓰레기통에서 오래된 카세트가 굴러 나왔어요. 검은 그림자가 따라와서 놓고 도망쳤죠.",
    ], charsetGraphic(PEOPLE_2, 5), WANDER),
    flavorEvent("ev_neon_mourner", 28, 24, "추모객", [
      "명단의 마지막 이름만 새 글씨예요. 기록원 화재보다 사흘 먼저 죽었다고 적혔죠.",
    ], charsetGraphic(PEOPLE_1, 1)),
  );
  return map;
}

function rooftopMap(): GameMap {
  const map = makeMap(MODERN_MAP.rooftop, "시립기록원 온실 옥상 · 00:47", 22, 18, T.roofFloor);
  // The arrival, greenhouse, and confrontation share one 20×15 camera. The
  rect(map, 0, 0, 21, 17, T.roofFloor);
  for (let x = 0; x < map.width; x += 1) {
    setLower(map, x, 0, T.curbNorth);
    setLower(map, x, 17, T.curbSouth);
  }
  for (let y = 0; y < map.height; y += 1) {
    setLower(map, 0, y, T.curb);
    setLower(map, 21, y, T.curbEast);
  }
  stampAtlas(map, 2, 1, T.greenhouse, 8, 7);
  stampAtlasSlice(map, 14, 1, T.policeBlock, 6, 0, 0, 6, 5);
  stampAtlas(map, 11, 10, T.industrial, 6, 7);
  // Fill broad central arena dead zone (avoid transparent atlas row)
  stampAtlasSlice(map, 5, 11, T.utility, 8, 3, 1, 4, 2);
  // Arrival and boss interaction cells remain on the uninterrupted roof plane.
  for (const [x, y] of [[10, 11], [10, 12], [11, 8], [11, 9]] as const) {
    setUpper(map, x, y, -1);
    setLower(map, x, y, T.roofFloor);
  }
  map.defaultLighting = { ambient: 0.6, color: "#6877a4", sources: [
    { id: "greenhouse-magenta", at: { x: 7, y: 6 }, radius: 7, intensity: 0.92, color: "#ff5f9e", flicker: true },
    { id: "arena-white", at: { x: 11, y: 9 }, radius: 8, intensity: 1.12, color: "#e4efff" },
    { id: "door-blue", at: { x: 10, y: 11 }, radius: 6, intensity: 0.96, color: "#56c9ff" },
  ] };
  map.bgm = { mode: "custom", resourceId: "cc0-bgm-battle", fadeInMs: 600 };
  map.layoutPlan = { version: 1, kind: "greenhouse-rooftop-confrontation", regions: [
    { id: "greenhouse", role: "landmark", label: "기록원 옥상 온실", x: 2, y: 1, w: 8, h: 7 },
    { id: "service-core", role: "landmark", label: "환기 설비와 서비스 코어", x: 14, y: 1, w: 6, h: 5 },
    { id: "arena", role: "plaza", label: "기록수호자 헬리패드", x: 9, y: 7, w: 8, h: 10 },
  ] };
  map.events.push(
    custodianEvent(),
    event("ev_roof_return", 10, 12, [page("roof_return", "계단", [], [transfer(MODERN_MAP.city, 26, 9)], NO_GRAPHIC, PASSIVE, "below")], "playerTouch"),
  );
  return map;
}

function detectiveEvent(): GameEvent {
  const graphic = charsetGraphic(PEOPLE_2, 0);
  return event("ev_neon_detective", 17, 16, [
    page("detective_intro", "형사 지안", [], [
      say("형사 지안", "윤서, 기록원 화재는 사고가 아니야. 불탄 서버보다 먼저 지워진 이름이 있어."),
      say("형사 지안", "골목의 카세트, 추모비 명단, 그리고 파란 우산을 든 목격자. 세 조각이면 옥상 문을 열 증거가 돼."),
      { kind: "choices", prompt: "자정이 지나기 전에 사건을 맡을까요?", options: [
        { text: "기록은 사라지지 않아", branch: [
          { kind: "setSwitch", switchId: MODERN_SWITCH.caseStarted, value: true },
          say("형사 지안", "좋아. 도시는 너무 밝아서 진실이 더 잘 숨지. 간판 뒤의 그림자를 봐."),
        ] },
        { text: "아직 준비가 안 됐어", branch: [say("형사 지안", "시계는 기다려 주지 않지만, 난 여기 있을게.")] },
      ], cancelBehavior: "choice2" },
    ], graphic),
    page("detective_active", "형사 지안", [switchOn(MODERN_SWITCH.caseStarted)], [
      say("형사 지안", "단서는 골목 서쪽, 추모 공원 동쪽, 목격자는 노란 상점 앞이야."),
      { kind: "fork", condition: { kind: "all", conditions: clueConditions() }, then: [
        { kind: "fork", condition: { kind: "switch", switchId: MODERN_SWITCH.alleyWon, value: true }, then: [say("형사 지안", "세 단서와 출입 배지가 맞물렸어. 기록원 정문 오른쪽 계단으로 올라가.")], else: [say("형사 지안", "증거는 모였지만 출입 배지가 없어. 서쪽 골목의 네온 망령이 삼킨 배지를 되찾아.")] },
      ], else: [say("형사 지안", "아직 빈칸이 있어. 도시의 소음을 문장처럼 읽어.")] },
    ], graphic),
  ]);
}

function witnessEvent(): GameEvent {
  const graphic = charsetGraphic(PEOPLE_1, 7);
  return event("ev_neon_witness", 10, 8, [
    page("witness_before", "파란 우산의 여성", [], [say("파란 우산의 여성", "미안해요. 경찰에게 할 말은 없어요.")], graphic),
    page("witness_case", "파란 우산의 여성", [switchOn(MODERN_SWITCH.caseStarted)], [
      say("윤서", "당신을 범인으로 기록하려는 게 아니에요. 누가 기록을 바꿨는지 알고 싶어요."),
      say("파란 우산의 여성", "...옥상에서 검은 코트를 봤어요. 불이 나기 전, 추모비에 없는 이름을 서버에서 지웠죠."),
      { kind: "setSwitch", switchId: MODERN_SWITCH.clueWitness, value: true },
      say(undefined, "단서 획득 — 목격자의 진술"),
    ], graphic),
    page("witness_done", "파란 우산의 여성", [switchOn(MODERN_SWITCH.clueWitness)], [say("파란 우산의 여성", "그 사람은 괴물이 아니었어요. 겁에 질린 사람이었죠.")], graphic),
  ]);
}

function alleyClueEvent(): GameEvent {
  return event("ev_neon_alley_clue", 3, 15, [
    page("alley_clue_locked", "녹슨 쓰레기통", [], [say(undefined, "빗물과 기름 냄새뿐이다. 사건을 맡은 뒤 다시 살펴보자.")], NO_GRAPHIC, PASSIVE, "below"),
    page("alley_clue_find", "녹슨 쓰레기통", [switchOn(MODERN_SWITCH.caseStarted)], [
      say(undefined, "검은 봉투 밑에서 반쯤 녹은 마이크로 카세트를 찾았다."),
      say(undefined, "녹음: ‘프로젝트 새벽, 대상자 17명. 사망 처리 후 도시 재개발 구역으로 이관.’"),
      { kind: "setSwitch", switchId: MODERN_SWITCH.clueDumpster, value: true },
      say(undefined, "단서 획득 — 삭제된 이관 명단"),
    ], NO_GRAPHIC, PASSIVE, "below"),
    page("alley_clue_done", "빈 쓰레기통", [switchOn(MODERN_SWITCH.clueDumpster)], [say(undefined, "카세트를 꺼낸 자리에 분홍 네온만 흔들린다.")], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

function memorialClueEvent(): GameEvent {
  return event("ev_neon_memorial", 27, 20, [
    page("memorial_before", "추모비", [], [say(undefined, "‘해오름구 화재 희생자를 기억하며.’ 몇 글자가 새로 덧칠돼 있다.")], NO_GRAPHIC, PASSIVE, "below"),
    page("memorial_find", "추모비", [switchOn(MODERN_SWITCH.caseStarted)], [
      say("윤서", "추모비의 17명은 공식 명단 어디에도 없어... 살아 있는 사람을 사망자로 만든 거야."),
      { kind: "setSwitch", switchId: MODERN_SWITCH.clueMemorial, value: true },
      say(undefined, "단서 획득 — 조작된 사망자 명단"),
    ], NO_GRAPHIC, PASSIVE, "below"),
    page("memorial_done", "추모비", [switchOn(MODERN_SWITCH.clueMemorial)], [say(undefined, "젖은 돌 위로 17개의 이름이 보이지 않는 잉크처럼 떠오른다.")], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

function alleyBattleEvent(): GameEvent {
  const graphic = charsetGraphic(MONSTER_1, 3);
  return event("ev_neon_alley_ghost", 7, 15, [
    page("ghost_wait", "네온 망령", [switchOn(MODERN_SWITCH.caseStarted)], [
      say(undefined, "골목의 그림자가 간판 빛을 삼키며 일어선다!"),
      { kind: "battleProcessing", troopId: "troop_neon_wraith", canEscape: false, canLose: false },
      { kind: "setSwitch", switchId: MODERN_SWITCH.alleyWon, value: true },
      say(undefined, "망령이 흩어지자 기록원 출입 배지가 바닥에 남았다."),
    ], graphic),
    page("ghost_gone", "꺼진 간판", [switchOn(MODERN_SWITCH.alleyWon)], [say(undefined, "깨진 간판에 ‘진실은 보존 기간이 없다’고 긁혀 있다.")], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

function rooftopDoorEvent(): GameEvent {
  return event("ev_neon_rooftop_door", 26, 9, [
    page("roof_locked", "기록원 옥상 계단", [], [say(undefined, "전자 잠금장치가 붉게 깜박인다. 증거 세 조각과 골목 망령이 삼킨 출입 배지가 필요하다.")], NO_GRAPHIC, PASSIVE, "below"),
    page("roof_open", "기록원 옥상 계단", [{ kind: "all", conditions: [...clueConditions(), switchOn(MODERN_SWITCH.alleyWon)] }], [
      say(undefined, "세 단서의 시간 코드를 겹치자 잠금장치가 파랗게 변한다."),
      transfer(MODERN_MAP.rooftop, 10, 11),
    ], NO_GRAPHIC, PASSIVE, "below"),
  ], "action");
}

function custodianEvent(): GameEvent {
  const graphic = charsetGraphic(MONSTER_2, 2);
  return event("ev_neon_custodian", 11, 8, [
    page("custodian_fight", "기록수호자", [], [
      say("기록수호자", "17명을 지우면 17만 명이 살 수 있었다. 도시는 숫자로 유지된다."),
      say("윤서", "사람을 행으로 만든 기록은 보존할 가치가 없어."),
      { kind: "battleProcessing", troopId: "troop_archive_custodian", canEscape: false, canLose: false },
      { kind: "setSwitch", switchId: MODERN_SWITCH.rooftopWon, value: true },
      say(undefined, "수호자의 가면이 깨지고, 기록원 감사관 서하가 무릎을 꿇는다."),
      { kind: "choices", prompt: "프로젝트 새벽의 원본 기록을 어떻게 할까?", options: [
        { text: "피해자에게 먼저 전달한다", branch: [
          { kind: "setSwitch", switchId: MODERN_SWITCH.endingMercy, value: true },
          say("서하", "내가 증언할게. 지운 이름을 내 목소리로 다시 읽겠어."),
          { kind: "ending", title: "새벽의 증언", message: "윤서는 원본을 17명에게 먼저 돌려주었다. 동이 틀 무렵, 도시의 가장 작은 라디오에서 지워진 이름들이 하나씩 불렸다." },
        ] },
        { text: "도시 전체에 즉시 공개한다", branch: [
          { kind: "setSwitch", switchId: MODERN_SWITCH.endingExpose, value: true },
          say("서하", "그럼 이 도시는 오늘 밤 잠들지 못하겠군."),
          { kind: "ending", title: "꺼지지 않는 간판", message: "모든 전광판이 광고를 멈추고 17명의 기록을 비췄다. 해오름구의 밤은 처음으로 밝음이 아니라 진실 때문에 눈부셨다." },
        ] },
      ] },
    ], graphic),
    page("custodian_done", "깨진 가면", [switchOn(MODERN_SWITCH.rooftopWon)], [say(undefined, "새벽바람이 옥상의 붉은 경고등을 천천히 식힌다.")], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

function makeMap(id: string, name: string, width: number, height: number, fill: number): GameMap {
  const map = createBlankMap(name, width, height, TILESET_ID);
  map.id = id;
  map.tileSize = DEFAULT_TILE_SIZE;
  map.lowerTiles.fill(fill);
  map.upperTiles.fill(-1);
  return map;
}

function stampAtlas(map: GameMap, x: number, y: number, tiles: readonly number[], width: number, height: number): void {
  stampAtlasSlice(map, x, y, tiles, width, 0, 0, width, height);
}

function stampAtlasSlice(
  map: GameMap,
  x: number,
  y: number,
  tiles: readonly number[],
  sourceWidth: number,
  sourceX: number,
  sourceY: number,
  width: number,
  height: number,
): void {
  for (let offsetY = 0; offsetY < height; offsetY += 1) {
    for (let offsetX = 0; offsetX < width; offsetX += 1) {
      const tileId = tiles[(sourceY + offsetY) * sourceWidth + sourceX + offsetX];
      if (tileId !== undefined) setUpper(map, x + offsetX, y + offsetY, tileId);
    }
  }
}

function rect(map: GameMap, x1: number, y1: number, x2: number, y2: number, tileId: number): void {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) setLower(map, x, y, tileId);
}

function setLower(map: GameMap, x: number, y: number, tileId: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.lowerTiles[y * map.width + x] = tileId;
}

function setUpper(map: GameMap, x: number, y: number, tileId: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.upperTiles[y * map.width + x] = tileId;
}

function atlasTile(x: number, y: number): number {
  return y * TILESET_COLUMNS + x;
}

function atlasRect(x: number, y: number, width: number, height: number): number[] {
  const tiles: number[] = [];
  for (let offsetY = 0; offsetY < height; offsetY += 1) {
    for (let offsetX = 0; offsetX < width; offsetX += 1) tiles.push(atlasTile(x + offsetX, y + offsetY));
  }
  return tiles;
}

function event(id: string, x: number, y: number, pages: EventPage[], triggerKind: "action" | "playerTouch" = "action"): GameEvent {
  return { id, x, y, trigger: { kind: triggerKind }, commands: [], pages };
}

function page(id: string, name: string, conditions: EventPage["conditions"], commands: Command[], graphic: EventPage["graphic"], movement: EventPage["movement"] = PASSIVE, priority: EventPage["priority"] = "same"): EventPage {
  return { id, name, conditions, graphic, movement, trigger: { kind: "action" }, priority, animationType: "normal", commands };
}

function flavorEvent(id: string, x: number, y: number, name: string, lines: readonly string[], graphic: EventPage["graphic"], movement: EventPage["movement"] = PASSIVE): GameEvent {
  return event(id, x, y, [page(`${id}_page`, name, [], lines.map((body) => say(name, body)), graphic, movement)]);
}

function charsetGraphic(sprite: string, characterIndex: number): EventPage["graphic"] {
  return { sprite: { id: sprite, type: "bundled" }, pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }), direction: "down" };
}

function say(speaker: string | undefined, body: string): Command {
  return { kind: "text", ...(speaker ? { speaker } : {}), body };
}

function transfer(mapId: string, x: number, y: number): Command {
  return { kind: "transfer", mapId, x, y, direction: "retain", fade: "black", transition: "fade" };
}

function switchOn(switchId: string): EventPage["conditions"][number] {
  return { kind: "switch", switchId, value: true };
}

function clueConditions(): EventPage["conditions"] {
  return [
    switchOn(MODERN_SWITCH.clueDumpster),
    switchOn(MODERN_SWITCH.clueMemorial),
    switchOn(MODERN_SWITCH.clueWitness),
  ];
}

function nameSwitch(project: Project, id: string, name: string): void {
  project.switches.push({ id, name });
  project.session.switches[id] = false;
}
