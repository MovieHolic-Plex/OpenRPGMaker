import type { Command, EventPage, GameEvent, GameMap, Project } from "../types";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { DEFAULT_EASYRPG_CHARSET_ID, DEFAULT_ITEM_ID, DEFAULT_TILESET_ID, DEFAULT_TILE_SIZE, TILE } from "./constants";
import { defaultTitleScreenSettings } from "./defaultDatabase";
import { createBlankMap, singleNodeTree } from "./defaultMaps";
import { addStarterHouseDoor, createStarterHouseInteriorMap, STARTER_HOUSE_INTERIOR_MAP_ID } from "./starterHouseTransfer";
import { ADVENTURE_MAP, ADVENTURE_SWITCH, ADVENTURE_TITLE, ADVENTURE_TITLE_SHORT, ADVENTURE_VARIABLE } from "./defaultAdventureGameIds";

type Point = {
  readonly x: number;
  readonly y: number;
};

const PASSIVE_MOVEMENT = { type: "fixed", speed: 3, frequency: 3 } as const;
const WANDER_MOVEMENT = { type: "random", speed: 2, frequency: 3 } as const;
const PEOPLE_2_CHARSET_ID = "tex_easyrpg_charset_people2";
const PEOPLE_3_CHARSET_ID = "tex_easyrpg_charset_people3";
const OBJECT_1_CHARSET_ID = "tex_easyrpg_charset_object1";
const SMALL_HARBOR_HOUSE_PATTERN = [
  [374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404],
  [102, 103, 103, 103, 104],
  [132, 133, 329, 133, 134],
  [162, 163, 359, 163, 164],
] as const;
const MARKET_CANOPY_PATTERN = [
  [411, 412, 413],
  [441, 442, 443],
] as const;
const DEFAULT_GRAPHIC = {
  sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID },
  direction: "down",
  pattern: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }),
} as const;
const NO_GRAPHIC = { transparent: true } as const satisfies EventPage["graphic"];
const EVENT_GRAPHICS = {
  dockChild: charsetGraphic(PEOPLE_3_CHARSET_ID, 2),
  healer: charsetGraphic(PEOPLE_2_CHARSET_ID, 4),
  historian: charsetGraphic(PEOPLE_2_CHARSET_ID, 6),
  lighthouseKeeper: charsetGraphic(PEOPLE_2_CHARSET_ID, 0),
  scout: charsetGraphic(PEOPLE_3_CHARSET_ID, 5),
  seal: charsetGraphic(OBJECT_1_CHARSET_ID, 1),
  shrine: charsetGraphic(OBJECT_1_CHARSET_ID, 3),
  trader: charsetGraphic(PEOPLE_2_CHARSET_ID, 2),
  trainer: charsetGraphic(PEOPLE_3_CHARSET_ID, 0),
} as const;

export function createAdventureMaps(): readonly GameMap[] {
  const village = villageMap();
  addStarterHouseDoor(village);
  return [
    village,
    branchMap(ADVENTURE_MAP.forest, "달샘 숲", "troop_forest_hornets", ADVENTURE_SWITCH.forestSeal, { x: 14, y: 27 }, { x: 14, y: 2 }),
    branchMap(ADVENTURE_MAP.mine, "낡은 구리 광산", "troop_golem_guard", ADVENTURE_SWITCH.mineSeal, { x: 2, y: 14 }, { x: 27, y: 14 }),
    shrineMap(),
    createStarterHouseInteriorMap(ADVENTURE_MAP.village),
  ];
}

export function configureAdventureProject(project: Project): void {
  project.meta = { ...project.meta, title: ADVENTURE_TITLE, author: "RPG ZZU" };
  project.system = {
    ...project.system,
    titleScreen: {
      ...(project.system.titleScreen ?? defaultTitleScreenSettings()),
      title: ADVENTURE_TITLE_SHORT,
      menuLabels: { newGame: "봉인 조사 시작", continueGame: "이어 하기", quit: "그만두기" },
    },
  };
  project.startPos = { x: 14, y: 18 };
  project.mapTree = {
    mapId: ADVENTURE_MAP.village,
    children: [
      singleNodeTree(ADVENTURE_MAP.forest),
      singleNodeTree(ADVENTURE_MAP.mine),
      singleNodeTree(ADVENTURE_MAP.shrine),
      singleNodeTree(STARTER_HOUSE_INTERIOR_MAP_ID),
    ],
  };
  project.villageInfoDocuments = adventureVillageInfoDocuments();
  nameSwitch(project, ADVENTURE_SWITCH.started, "별등 의뢰 수락");
  nameSwitch(project, ADVENTURE_SWITCH.forestSeal, "달샘 숲 봉인 해제");
  nameSwitch(project, ADVENTURE_SWITCH.mineSeal, "구리 광산 봉인 해제");
  nameSwitch(project, ADVENTURE_SWITCH.bossClear, "하늘등 최종 봉인");
  nameVariable(project, ADVENTURE_VARIABLE.shards, "회수한 별조각");
}

function villageMap(): GameMap {
  const map = makeMap(ADVENTURE_MAP.village, "별등 마을", 30, 30);
  decorateHarborVillage(map);
  road(map, { x: 4, y: 14 }, { x: 25, y: 16 });
  road(map, { x: 13, y: 4 }, { x: 15, y: 25 });
  map.events.push(
    elderEvent(),
    talker("ev_lantern_guard", 14, 4, "수문장", [
      "장로님은 하루 종일 북쪽 사당의 빛을 살핍니다.",
      "정찰병이 말한 대로 숲과 광산을 먼저 다녀오면 길이 밝아질 거예요.",
    ], [], EVENT_GRAPHICS.trader),
    talker("ev_lantern_healer", 10, 18, "치유사", [
      "훈련 교관과 정찰병은 늘 무리하니, 다녀오면 제게 먼저 들르라고 전해주세요.",
      "장로님이 부탁한 별조각을 얻으면 변수에 기록되고, 저는 회복으로 흐름을 받쳐줍니다.",
    ], [{ kind: "recoverAll" }], EVENT_GRAPHICS.healer),
    talker("ev_lantern_scout", 18, 18, "정찰병", [
      "수문장은 사당 문만 보고 있지만, 저는 달샘 숲과 광산 길을 모두 확인했습니다.",
      "치유사에게 회복받고 훈련 교관에게 손을 풀면 30분짜리 첫 여정이 훨씬 부드럽습니다.",
    ], [], EVENT_GRAPHICS.scout),
    trainingEvent(),
    transferEvent("ev_to_forest", 14, 25, ADVENTURE_MAP.forest, 14, 3, "숲길"),
    transferEvent("ev_to_mine", 25, 15, ADVENTURE_MAP.mine, 3, 14, "광산길"),
    shrineGateEvent(),
  );
  return map;
}

function decorateHarborVillage(map: GameMap): void {
  rect(map, { x: 23, y: 1 }, { x: 28, y: 28 }, TILE.WATER);
  rect(map, { x: 21, y: 1 }, { x: 22, y: 28 }, TILE.SAND);
  rect(map, { x: 20, y: 13 }, { x: 28, y: 17 }, TILE.FLOOR);
  rect(map, { x: 24, y: 5 }, { x: 28, y: 7 }, TILE.WATER);
  rect(map, { x: 24, y: 21 }, { x: 28, y: 24 }, TILE.WATER);
  stampLower(map, { x: 3, y: 3 }, SMALL_HARBOR_HOUSE_PATTERN);
  stampLower(map, { x: 17, y: 4 }, SMALL_HARBOR_HOUSE_PATTERN);
  stampLower(map, { x: 4, y: 20 }, SMALL_HARBOR_HOUSE_PATTERN);
  stampUpper(map, { x: 9, y: 10 }, MARKET_CANOPY_PATTERN);
  stampUpper(map, { x: 17, y: 18 }, [[327, 328], [288, -1]]);
  stampUpper(map, { x: 21, y: 11 }, [[260, -1, 288]]);
}

function trainingEvent(): GameEvent {
  return event("ev_lantern_training", 20, 14, [
    page("training_page", "훈련 교관", [], [
      { kind: "text", speaker: "훈련 교관", body: "실전 전에 짧은 모의전을 해볼까요?" },
      { kind: "battleProcessing", troopId: "troop_slime_pair", canEscape: true, canLose: false },
      { kind: "text", speaker: "훈련 교관", body: "좋습니다. 정찰병에게 길을 듣고, 다치면 치유사를 찾아가세요." },
    ], EVENT_GRAPHICS.trainer, WANDER_MOVEMENT),
  ]);
}

function branchMap(mapId: string, name: string, troopId: string, sealSwitchId: string, entry: Point, exit: Point): GameMap {
  const map = makeMap(mapId, name, 30, 30);
  map.encounterRate = 5;
  map.troopIds = [troopId];
  road(map, { x: 3, y: 14 }, { x: 26, y: 16 });
  road(map, { x: 13, y: 3 }, { x: 15, y: 26 });
  map.events.push(
    transferEvent(`ev_${mapId}_return`, entry.x, entry.y, ADVENTURE_MAP.village, mapId === ADVENTURE_MAP.forest ? 14 : 24, mapId === ADVENTURE_MAP.forest ? 24 : 15, "마을로"),
    sealEvent(`ev_${mapId}_seal`, exit.x, exit.y, name, troopId, sealSwitchId),
    talker(`ev_${mapId}_hint_1`, 9, 12, "탐험가", [
      `${name}의 길은 일부러 빙 돌아가게 설계되어 있습니다.`,
      "마을 정찰병에게 들은 대로 랜덤 인카운트와 고정 전투를 모두 겪으며 성장 속도를 느껴보세요.",
    ], [], EVENT_GRAPHICS.scout),
    talker(`ev_${mapId}_hint_2`, 19, 18, "기록자", [
      "전투가 부담되면 치유사가 챙겨준 회복과 방어를 섞으세요.",
      "별조각을 얻은 뒤 마을로 돌아가 장로와 수문장에게 보고하면 다음 목표가 또렷해집니다.",
    ], [], EVENT_GRAPHICS.historian),
    talker(`ev_${mapId}_chest`, 16, 10, "낡은 상자", [
      "상자 안에서 물약 하나를 찾았습니다.",
      "필드 보상은 changeItem 명령으로 처리됩니다.",
    ], [{ kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 1 }], EVENT_GRAPHICS.shrine),
  );
  return map;
}

function shrineMap(): GameMap {
  const map = makeMap(ADVENTURE_MAP.shrine, "하늘등 사당", 24, 24);
  road(map, { x: 5, y: 11 }, { x: 18, y: 13 });
  map.events.push(
    transferEvent("ev_shrine_return", 12, 20, ADVENTURE_MAP.village, 14, 6, "마을로"),
    talker("ev_shrine_memory", 8, 12, "사당 기록", [
      "두 별조각이 합쳐지면 오래된 등불이 다시 숨을 쉽니다.",
      "마지막 전투는 짧지만, 앞선 준비가 승패를 가릅니다.",
    ], [], EVENT_GRAPHICS.historian),
    finalBossEvent(),
    talker("ev_shrine_side_altar", 16, 12, "작은 제단", [
      "돌 표면에 이전 수호자들의 이름이 새겨져 있습니다.",
      "이런 선택형 조사 이벤트가 플레이 시간을 자연스럽게 늘립니다.",
    ], [], EVENT_GRAPHICS.shrine),
  );
  return map;
}

function elderEvent(): GameEvent {
  return event("ev_lantern_elder", 14, 15, [
    page("elder_offer", "장로", [], [
      { kind: "text", speaker: "장로", body: "별등 마을의 등불이 셋으로 갈라졌네." },
      { kind: "text", speaker: "장로", body: "수문장, 치유사, 정찰병이 각자 길의 단서를 알고 있으니 말을 들어보게." },
      { kind: "text", speaker: "장로", body: "숲과 광산의 봉인을 풀고 별조각 두 개를 모아주게." },
      {
        kind: "choices",
        prompt: "별등 의뢰를 받을까요?",
        options: [
          { text: "받는다", branch: [{ kind: "setSwitch", switchId: ADVENTURE_SWITCH.started, value: true }, { kind: "setVariable", variableId: ADVENTURE_VARIABLE.shards, op: "=", value: 0 }, { kind: "text", speaker: "장로", body: "좋네. 두 갈래 길을 자유롭게 선택하게." }] },
          { text: "조금 더 준비한다", branch: [{ kind: "text", speaker: "장로", body: "준비도 모험의 일부지. 훈련 교관과 치유사를 먼저 찾아가게." }] },
        ],
        cancelBehavior: "choice2",
      },
    ], EVENT_GRAPHICS.lighthouseKeeper),
    page("elder_active", "장로", [{ kind: "switch", switchId: ADVENTURE_SWITCH.started, value: true }], [
      { kind: "text", speaker: "장로", body: "별조각은 두 곳에 있네. 길을 잃으면 북쪽 수문장을 찾아가게." },
      { kind: "text", speaker: "장로", body: "정찰병은 위험을, 치유사는 회복을, 수문장은 사당 조건을 알고 있다네." },
    ], EVENT_GRAPHICS.lighthouseKeeper),
    page("elder_ready", "장로", [{ kind: "variable", variableId: ADVENTURE_VARIABLE.shards, op: ">=", value: 2 }], [
      { kind: "text", speaker: "장로", body: "두 별조각이 모였군. 북쪽 사당으로 가 마지막 등불을 켜게." },
    ], EVENT_GRAPHICS.lighthouseKeeper),
    page("elder_done", "장로", [{ kind: "switch", switchId: ADVENTURE_SWITCH.bossClear, value: true }], [
      { kind: "text", speaker: "장로", body: "마을의 밤이 다시 길을 비추네. 훌륭한 완주였어." },
    ], EVENT_GRAPHICS.lighthouseKeeper),
  ]);
}

function shrineGateEvent(): GameEvent {
  return event("ev_to_shrine", 14, 5, [
    page("shrine_locked", "사당길", [], [{ kind: "text", speaker: "수문장", body: "두 별조각이 모이기 전에는 사당 문이 열리지 않습니다." }]),
    page("shrine_open", "사당길", [{ kind: "variable", variableId: ADVENTURE_VARIABLE.shards, op: ">=", value: 2 }], [
      { kind: "text", speaker: "수문장", body: "별빛이 길을 열었습니다. 마지막 봉인으로 가세요." },
      { kind: "transfer", mapId: ADVENTURE_MAP.shrine, x: 12, y: 19, fade: "black" },
    ]),
  ], "playerTouch", "below");
}

function sealEvent(id: string, x: number, y: number, placeName: string, troopId: string, switchId: string): GameEvent {
  return event(id, x, y, [
    page(`${id}_fight`, "봉인", [], [
      { kind: "text", speaker: "봉인석", body: `${placeName}의 봉인이 흔들립니다.` },
      { kind: "battleProcessing", troopId, canEscape: true, canLose: false },
      { kind: "setSwitch", switchId, value: true },
      { kind: "setVariable", variableId: ADVENTURE_VARIABLE.shards, op: "+=", value: 1 },
      { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 1 },
      { kind: "text", speaker: "봉인석", body: "별조각 하나와 물약 하나를 얻었습니다." },
    ], EVENT_GRAPHICS.seal),
    page(`${id}_done`, "해제된 봉인", [{ kind: "switch", switchId, value: true }], [
      { kind: "text", speaker: "봉인석", body: "이미 빛을 되찾은 봉인입니다." },
    ], EVENT_GRAPHICS.seal),
  ]);
}

function finalBossEvent(): GameEvent {
  return event("ev_final_dragon", 12, 8, [
    page("final_dragon_wait", "하늘등", [], [{ kind: "text", speaker: "하늘등", body: "두 별조각을 모은 뒤 다시 오세요." }], EVENT_GRAPHICS.seal),
    page("final_dragon_ready", "하늘등", [{ kind: "variable", variableId: ADVENTURE_VARIABLE.shards, op: ">=", value: 2 }], [
      { kind: "text", speaker: "하늘등", body: "마지막 봉인이 붉은 용의 형상으로 깨어납니다." },
      { kind: "battleProcessing", troopId: "troop_dragon", canEscape: false, canLose: false },
      { kind: "setSwitch", switchId: ADVENTURE_SWITCH.bossClear, value: true },
      { kind: "text", speaker: "하늘등", body: "세 봉인이 하나로 이어지고 마을의 별등이 켜집니다." },
      { kind: "ending", title: "별등 마을", message: "세 개의 봉인이 풀리고, 작은 마을은 다시 밤길을 비추기 시작했다." },
    ], EVENT_GRAPHICS.seal),
    page("final_dragon_done", "하늘등", [{ kind: "switch", switchId: ADVENTURE_SWITCH.bossClear, value: true }], [
      { kind: "text", speaker: "하늘등", body: "맑은 빛이 조용히 흔들립니다." },
    ], EVENT_GRAPHICS.seal),
  ]);
}

function talker(
  id: string,
  x: number,
  y: number,
  speaker: string,
  lines: readonly string[],
  extraCommands: readonly Command[] = [],
  graphic: EventPage["graphic"] = DEFAULT_GRAPHIC,
  movement: EventPage["movement"] = WANDER_MOVEMENT,
): GameEvent {
  return event(id, x, y, [page(`${id}_page`, speaker, [], [...lines.map((body) => ({ kind: "text", speaker, body }) satisfies Command), ...extraCommands], graphic, movement)]);
}

function transferEvent(id: string, x: number, y: number, mapId: string, toX: number, toY: number, name: string): GameEvent {
  return event(id, x, y, [page(`${id}_page`, name, [], [{ kind: "transfer", mapId, x: toX, y: toY, fade: "black" }], NO_GRAPHIC)], "playerTouch", "below");
}

function event(id: string, x: number, y: number, pages: readonly EventPage[], trigger: GameEvent["trigger"]["kind"] = "action", priority: EventPage["priority"] = "same"): GameEvent {
  return { id, x, y, trigger: { kind: trigger }, commands: [], pages: pages.map((entry) => ({ ...entry, trigger: { kind: trigger }, priority })) };
}

function page(
  id: string,
  name: string,
  conditions: EventPage["conditions"],
  commands: readonly Command[],
  graphic: EventPage["graphic"] = DEFAULT_GRAPHIC,
  movement: EventPage["movement"] = PASSIVE_MOVEMENT,
): EventPage {
  return { id, name, conditions, graphic, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement, commands: [...commands] };
}

function adventureVillageInfoDocuments(): Project["villageInfoDocuments"] {
  return [
    {
      id: "village_info_map_lantern_village",
      mapId: ADVENTURE_MAP.village,
      title: "별등 마을.md",
      markdown: [
        "# 별등 마을",
        "",
        "## 역할",
        "- 항구와 사당을 잇는 시작 마을. 장로가 메인 퀘스트를 열고, 수문장이 사당 조건을 설명한다.",
        "",
        "## 주요 인물",
        "- 장로: 별조각 퀘스트를 시작하고 마을 사람들에게 단서가 흩어져 있음을 알려준다.",
        "- 수문장: 장로의 부탁을 받아 북쪽 사당 문을 지키며 숲과 광산의 선행 조건을 안다.",
        "- 치유사: 훈련 교관과 정찰병을 알고 있으며 전투 뒤 회복을 맡는다.",
        "- 정찰병: 수문장과 치유사의 역할을 알고 숲과 광산의 위험을 설명한다.",
        "- 훈련 교관: 정찰병과 치유사를 언급하며 모의전을 제공한다.",
        "",
        "## 퀘스트 단서",
        "- 플레이어는 장로의 선택지로 의뢰를 받고 숲/광산에서 별조각을 모은다.",
        "- 두 별조각이 모이면 수문장의 사당길 페이지가 열리고 최종 맵으로 이동한다.",
        "",
        "## AI 생성 메모",
        "- 새 NPC를 추가할 때는 기존 인물 중 최소 한 명의 이름이나 역할을 언급하게 한다.",
        "- 마을 NPC는 고정 배치만 하지 말고 랜덤 보행이나 생활 이동을 사용한다.",
      ].join("\n"),
    },
    {
      id: "village_info_map_moonwell_forest",
      mapId: ADVENTURE_MAP.forest,
      title: "달샘 숲.md",
      markdown: [
        "# 달샘 숲",
        "",
        "## 역할",
        "- 첫 번째 별조각을 얻는 야외 전투 구역.",
        "",
        "## 주요 인물",
        "- 탐험가: 마을 정찰병의 정보를 이어받아 숲의 동선을 설명한다.",
        "- 기록자: 치유사와 장로를 언급하며 전투 후 복귀 흐름을 알려준다.",
        "",
        "## 퀘스트 단서",
        "- 봉인 전투 후 별조각과 물약을 지급한다.",
      ].join("\n"),
    },
    {
      id: "village_info_map_old_copper_mine",
      mapId: ADVENTURE_MAP.mine,
      title: "낡은 구리 광산.md",
      markdown: [
        "# 낡은 구리 광산",
        "",
        "## 역할",
        "- 두 번째 별조각을 얻는 단단한 적 중심의 전투 구역.",
        "",
        "## 주요 인물",
        "- 탐험가: 정찰병의 조사 결과를 언급한다.",
        "- 기록자: 치유사와 장로에게 돌아가는 루프를 알려준다.",
        "",
        "## 퀘스트 단서",
        "- 광산 봉인이 풀리면 사당으로 갈 조건이 완성된다.",
      ].join("\n"),
    },
    {
      id: "village_info_map_sky_lantern_shrine",
      mapId: ADVENTURE_MAP.shrine,
      title: "하늘등 사당.md",
      markdown: [
        "# 하늘등 사당",
        "",
        "## 역할",
        "- 별등 마을 퀘스트의 결말을 처리하는 최종 구역.",
        "",
        "## 주요 인물",
        "- 사당 기록: 장로가 말한 세 봉인의 의미를 보강한다.",
        "- 하늘등: 두 별조각을 확인한 뒤 최종 전투와 엔딩을 실행한다.",
        "",
        "## 퀘스트 단서",
        "- 변수 조건이 충족된 뒤 최종 전투와 ending 명령으로 이어진다.",
      ].join("\n"),
    },
    {
      id: "village_info_map_starter_house_interior",
      mapId: STARTER_HOUSE_INTERIOR_MAP_ID,
      title: "시작 집 내부.md",
      markdown: [
        "# 시작 집 내부",
        "",
        "## 역할",
        "- 별등 마을의 첫 번째 집 문으로 들어갈 수 있는 작은 실내 테스트 맵.",
        "",
        "## 퀘스트 단서",
        "- 플레이어 터치 전이와 실내/실외 왕복 동선을 검증한다.",
      ].join("\n"),
    },
  ];
}

function charsetGraphic(spriteId: string, characterIndex: number, direction: "down" | "left" | "right" | "up" = "down"): EventPage["graphic"] {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction,
    pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
  };
}

function makeMap(id: string, name: string, width: number, height: number): GameMap {
  const map = createBlankMap(name, width, height, DEFAULT_TILESET_ID, DEFAULT_TILE_SIZE);
  map.id = id;
  for (let x = 0; x < width; x += 1) {
    setLower(map, x, 0, TILE.WALL);
    setLower(map, x, height - 1, TILE.WALL);
  }
  for (let y = 0; y < height; y += 1) {
    setLower(map, 0, y, TILE.WALL);
    setLower(map, width - 1, y, TILE.WALL);
  }
  return map;
}

function road(map: GameMap, from: Point, to: Point): void {
  for (let y = from.y; y <= to.y; y += 1) {
    for (let x = from.x; x <= to.x; x += 1) setLower(map, x, y, TILE.PATH);
  }
}

function rect(map: GameMap, from: Point, to: Point, tile: number): void {
  for (let y = from.y; y <= to.y; y += 1) {
    for (let x = from.x; x <= to.x; x += 1) setLower(map, x, y, tile);
  }
}

function stampLower(map: GameMap, origin: Point, pattern: readonly (readonly number[])[]): void {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0) setLower(map, origin.x + x, origin.y + y, tile);
    }
  }
}

function stampUpper(map: GameMap, origin: Point, pattern: readonly (readonly number[])[]): void {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0) setUpper(map, origin.x + x, origin.y + y, tile);
    }
  }
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.lowerTiles[y * map.width + x] = tile;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.upperTiles[y * map.width + x] = tile;
}

function nameSwitch(project: Project, id: string, name: string): void {
  const record = project.switches.find((entry) => entry.id === id);
  if (record) {
    record.name = name;
  } else {
    project.switches.push({ id, name });
  }
  project.session.switches[id] ??= false;
}

function nameVariable(project: Project, id: string, name: string): void {
  const record = project.variables.find((entry) => entry.id === id);
  if (record) {
    record.name = name;
  } else {
    project.variables.push({ id, name });
  }
  project.session.variables[id] ??= 0;
}
