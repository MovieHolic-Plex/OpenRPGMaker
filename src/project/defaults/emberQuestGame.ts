// emberQuestGame.ts — 《잿불의 유산》: 에디터 기능 시연용 소형 완성 RPG.
// 구성: 맵 5개 / 주인공 1명 / NPC 12명 / 몬스터 5종 / 아이템 8종 / 퀘스트 3개 / 고정 전투 5회 + 엔딩.
import type { ActorParameterCurves, Command, EnemyStats, EventPage, GameEvent, GameMap, Project } from "../types";
import { SCHEMA_VERSION } from "../types";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { normalizeItemRecord } from "../databaseRecordModel";
import {
  DEFAULT_ACTOR_ID,
  DEFAULT_CLASS_ID,
  DEFAULT_EQUIPMENT_ID,
  DEFAULT_ITEM_ID,
  DEFAULT_TILE_SIZE,
  DEFAULT_TILESET_ID,
  TILE,
} from "./constants";
import {
  EQUIPMENT_FOCUS_CHARM_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_OAK_SHIELD_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
} from "./defaultDatabaseRecordIds";
import { defaultAssetSet, defaultResourceProfiles, defaultTilesets } from "./defaultAssets";
import { defaultDatabase, defaultSession, defaultSystem, defaultTerms, defaultTitleScreenSettings } from "./defaultDatabase";
import { createBlankMap, singleNodeTree } from "./defaultMaps";
import { ensureSwitchVariableSlots } from "./defaultProject";

export const EMBER_TITLE = "잿불의 유산";

export const EMBER_MAP = {
  village: "map_ember_village",
  forest: "map_mist_forest",
  mine: "map_dry_mine",
  pass: "map_ash_pass",
  sanctum: "map_flame_sanctum",
} as const;

export const EMBER_SWITCH = {
  q1Started: "sw_ember_q1_started",
  q1Clear: "sw_ember_q1_clear",
  q2Started: "sw_ember_q2_started",
  q2Done: "sw_ember_q2_done",
  q3Started: "sw_ember_q3_started",
  q3Done: "sw_ember_q3_done",
  battleSlime: "sw_ember_b1_slime",
  battleHornet: "sw_ember_b2_hornet",
  battleBats: "sw_ember_b3_bats",
  battleGolem: "sw_ember_b4_golem",
  battleDragon: "sw_ember_b5_dragon",
} as const;

export const EMBER_VARIABLE = {
  moonHerbs: "var_ember_moon_herbs",
} as const;

export const EMBER_ITEM = {
  potion: DEFAULT_ITEM_ID,
  ether: "item_ether",
  antidote: "item_antidote",
  hiPotion: "item_hi_potion",
  oldKey: "item_old_key",
  guardTalisman: "item_guard_talisman",
  moonHerb: "item_ember_moon_herb",
  golemCore: "item_ember_golem_core",
} as const;

const EMBER_TROOP = {
  slimes: "troop_slime_pair",
  hornets: "troop_forest_hornets",
  bats: "troop_bat_swarm",
  golem: "troop_golem_guard",
  dragon: "troop_dragon",
} as const;

const EMBER_ENEMY_IDS = ["enemy_slime", "enemy_meadow_slime", "enemy_cave_bat", "enemy_stone_golem", "enemy_dragon"] as const;

/**
 * 성장 곡선 — 실측으로 설계했다(2026-07-26).
 *
 * 고치기 전 상태: 기본 expCurve 가 `{ base: 1, extra: 677, acceleration: 40 }` 라 **레벨 2 에
 * 678 경험치**가 필요했다. 그런데 이 게임에서 얻을 수 있는 경험치 총량은
 * 슬라임 44 + 말벌 70 + 박쥐 78 + 골렘 142 + 드래곤 160 = **494** 다.
 * 즉 주인공은 이 게임에서 **레벨 2 에 도달할 수 없었다** — 성장이 구조적으로 불가능했다.
 * 게다가 능력치 곡선도 평평해서(L1 공격 45 → L20 59) 레벨업이 체감되지 않았다.
 *
 * 아래 값으로 플레이어는 박쥐 떼를 L4, 골렘 호위를 L6, 드래곤을 L8 로 맞이한다
 * (누적 경험치 114 / 192 / 334 지점을 totalExpForLevel 로 역산한 결과).
 * 공격 곡선은 L8 에서 80 을 넘도록 잡았다 — 드래곤 승률이 공격 60 에서 20%, 80 에서 100% 로
 * 갈리는 것을 스윕으로 측정했다.
 */
const EMBER_EXP_CURVE = { base: 6, extra: 10, acceleration: 2 } as const;

/** 레벨당 선형 성장을 덮어씌운다. 기존 배열 길이(최대 레벨)는 유지한다. */
function emberHeroCurves(base: ActorParameterCurves): ActorParameterCurves {
  const ramp = (start: number, perLevel: number): number[] =>
    base.maxHp.map((_value, index) => start + Math.round(index * perLevel));
  return {
    // HP·방어는 이미 초반 전투를 안전하게 만드는 값이라 기울기만 준다.
    maxHp: ramp(base.maxHp[0] ?? 514, 30),
    maxMp: ramp(base.maxMp[0] ?? 43, 4),
    // 드래곤(HP 190·방어 30)을 L8 에 잡을 수 있어야 한다 → L8 에서 80 (45 + 7×5).
    attack: ramp(base.attack[0] ?? 45, 5),
    defense: ramp(base.defense[0] ?? 59, 2),
    mind: ramp(base.mind[0] ?? 45, 3),
    agility: ramp(base.agility[0] ?? 43, 2),
  };
}

const PEOPLE_1 = "tex_easyrpg_charset_people1";
const PEOPLE_2 = "tex_easyrpg_charset_people2";
const PEOPLE_3 = "tex_easyrpg_charset_people3";
const MONSTER_1 = "tex_easyrpg_charset_monster1";
const MONSTER_2 = "tex_easyrpg_charset_monster2";
const MONSTER_3 = "tex_easyrpg_charset_monster3";

const PASSIVE = { type: "fixed", speed: 3, frequency: 3 } as const satisfies EventPage["movement"];
const WANDER = { type: "random", speed: 2, frequency: 3 } as const satisfies EventPage["movement"];
const NO_GRAPHIC = { transparent: true } as const satisfies EventPage["graphic"];

const HOUSE_PATTERN = [
  [374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404],
  [102, 103, 103, 103, 104],
  [132, 133, 329, 133, 134],
  [162, 163, 359, 163, 164],
] as const;

type Point = { readonly x: number; readonly y: number };

// 통행 가능 지면 타일(기본 칩셋 passability 기준). TILE.FLOOR(342)/STAIRS(246)는 통행 불가라 지면으로 쓰지 않는다.
const GROUND = {
  PLAZA: TILE.SAND, // 423 밝은 모래 — 마을 광장/성소 바닥
  GRAVEL: 421, // 자갈 흙바닥 — 광산 내부
} as const;

export function createEmberQuestProject(): Project {
  const maps = [villageMap(), forestMap(), mineMap(), passMap(), sanctumMap()];
  const database = emberDatabase();
  const session = defaultSession();
  session.partyActorIds = [DEFAULT_ACTOR_ID];
  session.inventory = { [EMBER_ITEM.potion]: 2 };
  session.gold = 100;

  const system = defaultSystem();
  system.startActorIds = [DEFAULT_ACTOR_ID];
  system.initialTroopId = EMBER_TROOP.slimes;
  system.titleScreen = {
    ...(system.titleScreen ?? defaultTitleScreenSettings()),
    title: EMBER_TITLE,
    menuLabels: { newGame: "모험 시작", continueGame: "이어 하기", quit: "그만두기" },
  };

  const project: Project = {
    version: SCHEMA_VERSION,
    meta: { title: EMBER_TITLE, author: "RPG ZZU", terms: defaultTerms() },
    assets: defaultAssetSet(),
    resourceProfiles: defaultResourceProfiles(),
    tilesets: defaultTilesets(),
    switches: [],
    variables: [],
    commonEvents: [],
    database,
    system,
    session,
    maps: Object.fromEntries(maps.map((map) => [map.id, map])),
    mapConnections: [],
    mapTree: {
      mapId: EMBER_MAP.village,
      children: [
        singleNodeTree(EMBER_MAP.forest),
        singleNodeTree(EMBER_MAP.mine),
        singleNodeTree(EMBER_MAP.pass),
        singleNodeTree(EMBER_MAP.sanctum),
      ],
    },
    startMapId: EMBER_MAP.village,
    startPos: { x: 16, y: 14 },
    flags: {},
  };

  nameSwitch(project, EMBER_SWITCH.q1Started, "Q1 꺼진 화로 시작");
  nameSwitch(project, EMBER_SWITCH.q1Clear, "Q1 꺼진 화로 완료");
  nameSwitch(project, EMBER_SWITCH.q2Started, "Q2 달빛 약초 시작");
  nameSwitch(project, EMBER_SWITCH.q2Done, "Q2 달빛 약초 완료");
  nameSwitch(project, EMBER_SWITCH.q3Started, "Q3 대장장이의 의뢰 시작");
  nameSwitch(project, EMBER_SWITCH.q3Done, "Q3 대장장이의 의뢰 완료");
  nameSwitch(project, EMBER_SWITCH.battleSlime, "전투1 숲 슬라임 처치");
  nameSwitch(project, EMBER_SWITCH.battleHornet, "전투2 말벌 둥지 처치");
  nameSwitch(project, EMBER_SWITCH.battleBats, "전투3 박쥐 떼 처치");
  nameSwitch(project, EMBER_SWITCH.battleGolem, "전투4 돌 골렘 처치");
  nameSwitch(project, EMBER_SWITCH.battleDragon, "전투5 드래곤 처치");
  nameVariable(project, EMBER_VARIABLE.moonHerbs, "모은 달빛 약초");
  clearBundledClusterRules(project);
  ensureSwitchVariableSlots(project);
  return project;
}

function clearBundledClusterRules(project: Project): void {
  for (const tileset of Object.values(project.tilesets)) {
    for (const group of tileset.tileGroups ?? []) {
      if (group.id.startsWith("harness-combined-town-")) group.rules = [];
    }
  }
}

function emberDatabase(): Project["database"] {
  const db = defaultDatabase();
  const keepItems = new Set<string>([
    EMBER_ITEM.potion,
    EMBER_ITEM.ether,
    EMBER_ITEM.antidote,
    EMBER_ITEM.hiPotion,
    EMBER_ITEM.oldKey,
    EMBER_ITEM.guardTalisman,
  ]);
  const keepEnemies = new Set<string>(EMBER_ENEMY_IDS);
  const keepTroops = new Set<string>(Object.values(EMBER_TROOP));
  const keepEquipment = new Set<string>([
    DEFAULT_EQUIPMENT_ID,
    EQUIPMENT_OAK_SHIELD_ID,
    EQUIPMENT_LEATHER_ARMOR_ID,
    EQUIPMENT_TRAVELER_HAT_ID,
    EQUIPMENT_FOCUS_CHARM_ID,
  ]);

  db.items = [
    ...db.items.filter((item) => keepItems.has(item.id)),
    normalizeItemRecord({
      id: EMBER_ITEM.moonHerb,
      name: "달빛 약초",
      scope: "none",
      price: 0,
      description: "안개 숲에서만 자라는 은은히 빛나는 약초. 약초꾼 세라가 찾고 있다.",
      imageResourceId: "cc0-jetrel-wake-herb",
      iconResourceId: "cc0-jetrel-wake-herb",
      type: "normalGoods",
      occasion: "never",
      consumable: false,
    }),
    normalizeItemRecord({
      id: EMBER_ITEM.golemCore,
      name: "골렘의 핵",
      scope: "none",
      price: 0,
      description: "메마른 광산의 돌 골렘이 품고 있던 뜨거운 핵. 대장장이 무겐이 탐낸다.",
      imageResourceId: "cc0-jetrel-focus-charm",
      iconResourceId: "cc0-jetrel-focus-charm",
      type: "normalGoods",
      occasion: "never",
      consumable: false,
    }),
  ];
  // 기본 몬스터 스탯은 저레벨 스케일이라 영웅 파라미터 곡선(레벨1 HP 514/공 45/방 59)과 맞지 않는다.
  // 데미지 공식(power + stat/2 - def/2) 기준으로 전투가 2~8합이 되도록 재보정한다.
  const enemyTuning: Record<string, { stats: Partial<EnemyStats>; exp: number; gold: number }> = {
    enemy_slime: { stats: { maxHp: 55, attack: 82, defense: 16, agility: 36 }, exp: 25, gold: 10 }, // 슬라임
    enemy_meadow_slime: { stats: { maxHp: 60, attack: 75, defense: 20, agility: 12 }, exp: 22, gold: 12 },
    enemy_cave_bat: { stats: { maxHp: 48, attack: 79, defense: 12, agility: 46, mind: 70 }, exp: 26, gold: 9 },
    enemy_stone_golem: { stats: { maxHp: 95, attack: 108, defense: 40, agility: 10 }, exp: 90, gold: 45 },
    enemy_dragon: { stats: { maxHp: 190, attack: 168, defense: 30, mind: 118, agility: 40, maxMp: 60 }, exp: 160, gold: 120 },
  };
  db.enemies = db.enemies
    .filter((enemy) => keepEnemies.has(enemy.id))
    .map((enemy) => {
      const tuning = enemyTuning[enemy.id];
      if (!tuning) return enemy;
      return {
        ...enemy,
        stats: { ...enemy.stats, ...tuning.stats },
        rewards: { ...enemy.rewards, exp: tuning.exp, gold: tuning.gold },
      };
    });
  db.troops = db.troops.filter((troop) => keepTroops.has(troop.id));
  db.actors = db.actors
    .filter((actor) => actor.id === DEFAULT_ACTOR_ID)
    .map((actor) => ({
      ...actor,
      name: "아린",
      nickname: "잿불지기",
      expCurve: EMBER_EXP_CURVE,
      parameterCurves: emberHeroCurves(actor.parameterCurves),
    }));
  db.classes = db.classes
    .filter((cls) => cls.id === DEFAULT_CLASS_ID)
    .map((cls) => ({
      ...cls,
      equipmentPermissions: {
        actorIds: cls.equipmentPermissions.actorIds.filter((id) => id === DEFAULT_ACTOR_ID),
        classIds: cls.equipmentPermissions.classIds.filter((id) => id === DEFAULT_CLASS_ID),
        equipmentIds: cls.equipmentPermissions.equipmentIds.filter((id) => keepEquipment.has(id)),
      },
    }));
  db.equipment = db.equipment
    .filter((equip) => keepEquipment.has(equip.id))
    .map((equip) => ({
      ...equip,
      equippableActorIds: equip.equippableActorIds.filter((id) => id === DEFAULT_ACTOR_ID),
      equippableClassIds: equip.equippableClassIds.filter((id) => id === DEFAULT_CLASS_ID),
    }));
  db.items = db.items.map((item) => ({
    ...item,
    usableActorIds: item.usableActorIds.filter((id) => id === DEFAULT_ACTOR_ID),
    usableClassIds: item.usableClassIds.filter((id) => id === DEFAULT_CLASS_ID),
    equipmentProfile: {
      ...item.equipmentProfile,
      equippableActorIds: item.equipmentProfile.equippableActorIds.filter((id) => id === DEFAULT_ACTOR_ID),
      equippableClassIds: item.equipmentProfile.equippableClassIds.filter((id) => id === DEFAULT_CLASS_ID),
    },
  }));
  return db;
}

// ── 맵 1: 잿불 마을 (시작) ──────────────────────────────────────────────
function villageMap(): GameMap {
  const map = makeMap(EMBER_MAP.village, "잿불 마을", 32, 26);
  // 도로: 동서 대로 + 남북 골목.
  rect(map, { x: 1, y: 12 }, { x: 30, y: 13 }, TILE.PATH);
  rect(map, { x: 15, y: 4 }, { x: 16, y: 21 }, TILE.PATH);
  // 중앙 광장.
  rect(map, { x: 12, y: 10 }, { x: 19, y: 15 }, GROUND.PLAZA);
  // 집: 여관(4,3) / 상점(12,3) / 촌장집(20,3) / 대장간(5,16) / 민가(19,16).
  stampLower(map, { x: 4, y: 3 }, HOUSE_PATTERN);
  stampLower(map, { x: 12, y: 3 }, HOUSE_PATTERN);
  stampLower(map, { x: 20, y: 3 }, HOUSE_PATTERN);
  stampLower(map, { x: 5, y: 16 }, HOUSE_PATTERN);
  stampLower(map, { x: 19, y: 16 }, HOUSE_PATTERN);
  // 집 문 앞 골목.
  rect(map, { x: 6, y: 8 }, { x: 6, y: 11 }, TILE.PATH);
  rect(map, { x: 14, y: 8 }, { x: 14, y: 11 }, TILE.PATH);
  rect(map, { x: 22, y: 8 }, { x: 22, y: 11 }, TILE.PATH);
  // 연못과 꽃.
  rect(map, { x: 25, y: 18 }, { x: 29, y: 22 }, TILE.WATER);
  setUpper(map, 10, 15, TILE.FLOWERS);
  setUpper(map, 21, 15, TILE.FLOWERS);
  setUpper(map, 3, 12, TILE.FLOWERS);
  setLower(map, 2, 20, TILE.TREE);
  setLower(map, 3, 22, TILE.TREE);
  setLower(map, 28, 3, TILE.TREE);
  setLower(map, 29, 5, TILE.TREE);

  map.events.push(
    chiefEvent(),
    gateGuardEvent(),
    shopkeeperEvent(),
    innkeeperEvent(),
    blacksmithEvent(),
    childEvent(),
    villageEastGate("ev_ember_gate_a", 30, 12),
    villageEastGate("ev_ember_gate_b", 30, 13),
  );
  return map;
}

function chiefEvent(): GameEvent {
  const graphic = charsetGraphic(PEOPLE_1, 6);
  return event("ev_ember_chief", 18, 10, [
    page("chief_intro", "촌장 로안", [], [
      say("촌장 로안", "아린, 마을의 화로가 완전히 꺼져 버렸네. 백 년 만에 처음 있는 일이야."),
      say("촌장 로안", "전설에 따르면 불씨의 근원은 동쪽 숲 너머, 화염 성소에 잠들어 있다고 하네."),
      say("촌장 로안", "부탁하네. 안개 숲과 메마른 광산을 지나 성소의 화로에 다시 불을 붙여 주게."),
      {
        kind: "choices",
        prompt: "의뢰 '꺼진 화로'를 수락할까요?",
        options: [
          {
            text: "수락한다",
            branch: [
              { kind: "setSwitch", switchId: EMBER_SWITCH.q1Started, value: true },
              say("촌장 로안", "고맙네! 파수꾼에게 동문을 열라고 일러두겠네. 여관 주인과 상점 주인 리코도 자네를 도울 걸세."),
            ],
          },
          {
            text: "조금 더 준비한다",
            branch: [say("촌장 로안", "서두르지 않아도 좋아. 준비가 되면 다시 말을 걸어 주게.")],
          },
        ],
        cancelBehavior: "choice2",
      },
    ], graphic),
    page("chief_active", "촌장 로안", [switchOn(EMBER_SWITCH.q1Started)], [
      say("촌장 로안", "숲의 북쪽 광산 문은 잠겨 있다고 들었네. 열쇠는 숲 어딘가의 말벌 둥지가 지키고 있다더군."),
      say("촌장 로안", "광산을 지나면 잿빛 고개, 그 너머가 화염 성소일세. 은둔자가 고개에 산다니 인사해 두게."),
    ], graphic),
    page("chief_after_golem", "촌장 로안", [switchOn(EMBER_SWITCH.battleGolem)], [
      say("촌장 로안", "광산의 골렘을 쓰러뜨렸다지! 이제 잿빛 고개를 넘어 성소로 가게. 무운을 비네."),
    ], graphic),
    page("chief_clear", "촌장 로안", [switchOn(EMBER_SWITCH.q1Clear)], [
      say("촌장 로안", "화로에 다시 불이 붙었어! 잿불 마을은 자네의 이름을 오래 기억할 걸세, 아린."),
    ], graphic),
  ]);
}

function gateGuardEvent(): GameEvent {
  const graphic = charsetGraphic(PEOPLE_2, 2);
  return event("ev_ember_guard", 28, 11, [
    page("guard_closed", "파수꾼 데릭", [], [
      say("파수꾼 데릭", "동문 밖 안개 숲은 요즘 마물이 들끓어서 함부로 내보낼 수 없어."),
      say("파수꾼 데릭", "촌장 로안 님의 허락을 받아 오면 문을 열어 주지."),
    ], graphic),
    page("guard_open", "파수꾼 데릭", [switchOn(EMBER_SWITCH.q1Started)], [
      say("파수꾼 데릭", "촌장님께 이야기는 들었다. 동문은 열어 두었어."),
      say("파수꾼 데릭", "숲의 사냥꾼 브란이 지리를 잘 아니 길을 물어봐. 다치면 여관에서 쉬고."),
    ], graphic),
    page("guard_clear", "파수꾼 데릭", [switchOn(EMBER_SWITCH.q1Clear)], [
      say("파수꾼 데릭", "네가 성소의 불을 되살렸다니... 파수꾼으로서 경례를 보내지."),
    ], graphic),
  ]);
}

function shopkeeperEvent(): GameEvent {
  const graphic = charsetGraphic(PEOPLE_2, 4);
  return event("ev_ember_shop", 14, 9, [
    page("shop_page", "상점 주인 리코", [], [
      say("상점 주인 리코", "어서 와요! 모험에 필요한 물건은 다 있어요."),
      {
        kind: "shop",
        itemIds: [EMBER_ITEM.potion, EMBER_ITEM.ether, EMBER_ITEM.antidote, EMBER_ITEM.hiPotion],
        allowSell: true,
        quantityMode: "single",
        shopType: "normal",
        messageType: "welcome",
      },
    ], graphic),
  ]);
}

function innkeeperEvent(): GameEvent {
  const graphic = charsetGraphic(PEOPLE_1, 4);
  return event("ev_ember_inn", 6, 9, [
    page("inn_page", "여관 주인 마사", [], [
      say("여관 주인 마사", "여행자는 쉬어야 멀리 가는 법이죠. 하룻밤 15G입니다."),
      { kind: "inn", price: 15 },
    ], graphic),
  ]);
}

function blacksmithEvent(): GameEvent {
  const graphic = charsetGraphic(PEOPLE_3, 0);
  return event("ev_ember_smith", 7, 15, [
    page("smith_intro", "대장장이 무겐", [], [
      say("대장장이 무겐", "화로가 꺼진 뒤로 망치질도 신통치 않아. ...그런데 자네, 광산에 갈 생각인가?"),
      say("대장장이 무겐", "광산 깊은 곳의 돌 골렘은 뜨거운 핵을 품고 있지. 그것만 있으면 최고의 부적을 만들 수 있는데."),
      {
        kind: "choices",
        prompt: "의뢰 '대장장이의 의뢰'를 수락할까요?",
        options: [
          {
            text: "수락한다",
            branch: [
              { kind: "setSwitch", switchId: EMBER_SWITCH.q3Started, value: true },
              say("대장장이 무겐", "좋아! 골렘의 핵을 가져오면 수호 부적과 사례금을 주지."),
            ],
          },
          { text: "다음에 하겠다", branch: [say("대장장이 무겐", "마음이 바뀌면 언제든 오게.")] },
        ],
        cancelBehavior: "choice2",
      },
    ], graphic),
    page("smith_waiting", "대장장이 무겐", [switchOn(EMBER_SWITCH.q3Started)], [
      {
        kind: "fork",
        condition: { kind: "item", itemId: EMBER_ITEM.golemCore, present: true },
        then: [
          say("대장장이 무겐", "오오, 이게 바로 골렘의 핵이군! 약속대로 수호 부적과 사례금 100G일세."),
          { kind: "changeItem", itemId: EMBER_ITEM.golemCore, op: "-=", amount: 1 },
          { kind: "changeItem", itemId: EMBER_ITEM.guardTalisman, op: "+=", amount: 1 },
          { kind: "changeGold", op: "+=", amount: 100 },
          { kind: "setSwitch", switchId: EMBER_SWITCH.q3Done, value: true },
          say("대장장이 무겐", "수호 부적은 전투 중에 쓰면 공격이 오르지. 성소의 주인에게 꼭 챙겨 가게."),
        ],
        else: [say("대장장이 무겐", "골렘의 핵은 광산 가장 깊은 곳, 뒷문을 지키는 돌 골렘이 품고 있네.")],
      },
    ], graphic),
    page("smith_done", "대장장이 무겐", [switchOn(EMBER_SWITCH.q3Done)], [
      say("대장장이 무겐", "핵 덕분에 화덕이 다시 달아올랐어. 자네 부적, 잘 쓰고 있나?"),
    ], graphic),
  ]);
}

function childEvent(): GameEvent {
  const graphic = charsetGraphic(PEOPLE_3, 2);
  return event("ev_ember_child", 13, 14, [
    page("child_page", "꼬마 미루", [], [
      say("꼬마 미루", "숲의 약초꾼 세라 누나가 반짝이는 풀을 찾고 있대! 나도 보고 싶다~"),
      say("꼬마 미루", "파수꾼 아저씨는 무서워 보여도 마을에서 제일 착해."),
    ], graphic, WANDER),
    page("child_clear", "꼬마 미루", [switchOn(EMBER_SWITCH.q1Clear)], [
      say("꼬마 미루", "화로에 불이 돌아왔어! 아린 누나(형)? 최고야!"),
    ], graphic, WANDER),
  ]);
}

function villageEastGate(id: string, x: number, y: number): GameEvent {
  return event(id, x, y, [
    page(`${id}_closed`, "동문", [], [
      say("파수꾼 데릭", "잠깐! 촌장님의 허락 없이는 내보낼 수 없어."),
    ], NO_GRAPHIC, PASSIVE, "below"),
    page(`${id}_open`, "동문", [switchOn(EMBER_SWITCH.q1Started)], [
      transfer(EMBER_MAP.forest, 2, 14),
    ], NO_GRAPHIC, PASSIVE, "below"),
  ], "playerTouch");
}

// ── 맵 2: 안개 숲 ──────────────────────────────────────────────────────
function forestMap(): GameMap {
  const map = makeMap(EMBER_MAP.forest, "안개 숲", 30, 30);
  // 어두운 풀 바탕에 숲길을 낸다.
  rect(map, { x: 1, y: 1 }, { x: 28, y: 28 }, TILE.DARK_GRASS);
  rect(map, { x: 1, y: 13 }, { x: 27, y: 15 }, TILE.GRASS);
  rect(map, { x: 14, y: 1 }, { x: 16, y: 15 }, TILE.GRASS);
  rect(map, { x: 23, y: 6 }, { x: 25, y: 15 }, TILE.GRASS);
  rect(map, { x: 11, y: 15 }, { x: 13, y: 21 }, TILE.GRASS);
  rect(map, { x: 3, y: 5 }, { x: 8, y: 13 }, TILE.GRASS);
  road(map, { x: 1, y: 14 }, { x: 26, y: 14 });
  road(map, { x: 15, y: 2 }, { x: 15, y: 14 });
  road(map, { x: 24, y: 7 }, { x: 24, y: 14 });
  road(map, { x: 12, y: 15 }, { x: 12, y: 20 });
  road(map, { x: 5, y: 7 }, { x: 5, y: 13 });
  // 어두운 풀 지대는 전부 나무로 채워 숲 미로를 만든다(경로 밖 우회 차단).
  fillTrees(map);
  // 슬라임 전투 초크포인트: 서쪽 회랑을 폭 1로 좁힌다.
  setLower(map, 10, 13, TILE.TREE);
  setLower(map, 10, 15, TILE.TREE);
  setLower(map, 15, 1, TILE.PATH);
  // 달빛 약초 지점 표시.
  setUpper(map, 5, 6, TILE.FLOWERS);
  setUpper(map, 12, 21, TILE.FLOWERS);
  setUpper(map, 25, 12, TILE.FLOWERS);

  map.events.push(
    talker("ev_forest_herbalist", 6, 12, "약초꾼 세라", herbalistPages()),
    talker("ev_forest_hunter", 19, 13, "사냥꾼 브란", [
      page("hunter_page", "사냥꾼 브란", [], [
        say("사냥꾼 브란", "북쪽 광산 문은 오래전부터 잠겨 있어. 열쇠는 동쪽 말벌 둥지 근처에서 잃어버렸다는 소문이야."),
        say("사냥꾼 브란", "길을 막은 슬라임은 방심하면 귀찮아. 세라의 약초 일도 도와주면 좋을 텐데."),
      ], charsetGraphic(PEOPLE_3, 5)),
      page("hunter_after_key", "사냥꾼 브란", [itemHeld(EMBER_ITEM.oldKey)], [
        say("사냥꾼 브란", "열쇠를 찾았군! 북쪽 계단을 오르면 광산 문이야. 조심해서 가."),
      ], charsetGraphic(PEOPLE_3, 5)),
    ]),
    battleBlockerEvent("ev_forest_slime", 10, 14, EMBER_SWITCH.battleSlime, {
      intro: ["끈적한 초원 슬라임들이 길을 막아섰다!"],
      troopId: EMBER_TROOP.slimes,
      victory: ["길이 다시 열렸다."],
      graphic: charsetGraphic(MONSTER_1, 0),
    }),
    battleBlockerEvent("ev_forest_hornets", 24, 7, EMBER_SWITCH.battleHornet, {
      intro: ["말벌 둥지다! 둥지 아래에 낡은 상자가 깔려 있다.", "말벌 떼가 성난 날갯소리를 내며 달려든다!"],
      troopId: EMBER_TROOP.hornets,
      victory: ["상자 속에서 낡은 열쇠를 손에 넣었다!"],
      victoryCommands: [{ kind: "changeItem", itemId: EMBER_ITEM.oldKey, op: "+=", amount: 1 }],
      graphic: charsetGraphic(MONSTER_1, 2),
    }),
    herbEvent("ev_forest_herb_1", 5, 6),
    herbEvent("ev_forest_herb_2", 12, 21),
    herbEvent("ev_forest_herb_3", 25, 12),
    mineDoorEvent(),
    event("ev_forest_return", 1, 14, [
      page("forest_return_page", "마을로", [], [transfer(EMBER_MAP.village, 29, 12)], NO_GRAPHIC, PASSIVE, "below"),
    ], "playerTouch"),
  );
  return map;
}

function herbalistPages(): EventPage[] {
  const graphic = charsetGraphic(PEOPLE_2, 6);
  return [
    page("herbalist_intro", "약초꾼 세라", [], [
      say("약초꾼 세라", "안개 숲에는 달빛을 머금은 약초가 세 뿌리 자라요. 반짝이는 꽃을 찾아 주실래요?"),
      {
        kind: "choices",
        prompt: "의뢰 '달빛 약초'를 수락할까요?",
        options: [
          {
            text: "수락한다",
            branch: [
              { kind: "setSwitch", switchId: EMBER_SWITCH.q2Started, value: true },
              say("약초꾼 세라", "고마워요! 세 뿌리를 모두 모으면 상급 회복약으로 보답할게요."),
            ],
          },
          { text: "지금은 바쁘다", branch: [say("약초꾼 세라", "바쁜 일이 끝나면 부탁드려요.")] },
        ],
        cancelBehavior: "choice2",
      },
    ], graphic),
    page("herbalist_progress", "약초꾼 세라", [switchOn(EMBER_SWITCH.q2Started)], [
      {
        kind: "fork",
        condition: { kind: "variable", variableId: EMBER_VARIABLE.moonHerbs, op: ">=", value: 3 },
        then: [
          say("약초꾼 세라", "세 뿌리 전부 모아 오셨네요! 약속한 상급 회복약 세 병과 감사의 마음이에요."),
          { kind: "changeItem", itemId: EMBER_ITEM.moonHerb, op: "-=", amount: 3 },
          { kind: "changeItem", itemId: EMBER_ITEM.hiPotion, op: "+=", amount: 3 },
          { kind: "changeGold", op: "+=", amount: 80 },
          { kind: "setSwitch", switchId: EMBER_SWITCH.q2Done, value: true },
        ],
        else: [say("약초꾼 세라", "반짝이는 꽃이 보이면 그 앞에서 조사해 보세요. 숲 곳곳에 세 뿌리가 있어요.")],
      },
    ], graphic),
    page("herbalist_done", "약초꾼 세라", [switchOn(EMBER_SWITCH.q2Done)], [
      say("약초꾼 세라", "달빛 약초 덕분에 좋은 약을 잔뜩 만들었어요. 성소로 가는 길, 부디 무사하시길."),
    ], graphic),
  ];
}

function herbEvent(id: string, x: number, y: number): GameEvent {
  return event(id, x, y, [
    page(`${id}_look`, "빛나는 풀", [], [
      say(undefined, "은은하게 빛나는 풀이다. 약초꾼 세라라면 뭔가 알 것 같다."),
    ], NO_GRAPHIC, PASSIVE, "below"),
    page(`${id}_pick`, "달빛 약초", [switchOn(EMBER_SWITCH.q2Started)], [
      say(undefined, "달빛 약초를 조심스럽게 캐냈다."),
      { kind: "changeItem", itemId: EMBER_ITEM.moonHerb, op: "+=", amount: 1 },
      { kind: "setVariable", variableId: EMBER_VARIABLE.moonHerbs, op: "+=", value: 1 },
      { kind: "changeTile", mapId: EMBER_MAP.forest, layer: "upper", x, y, tile: -1 },
      { kind: "setSelfSwitch", key: "A", value: true },
    ], NO_GRAPHIC, PASSIVE, "below"),
    page(`${id}_empty`, "빈 자리", [selfSwitchOn("A")], [], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

function mineDoorEvent(): GameEvent {
  return event("ev_forest_mine_door", 15, 1, [
    page("mine_door_locked", "광산 문", [], [
      say(undefined, "광산으로 이어지는 철문이 굳게 잠겨 있다. 열쇠 구멍이 낡아 있다."),
    ], NO_GRAPHIC, PASSIVE, "below"),
    page("mine_door_open", "광산 문", [itemHeld(EMBER_ITEM.oldKey)], [
      say(undefined, "낡은 열쇠가 맞아 들어갔다. 문이 무겁게 열린다."),
      transfer(EMBER_MAP.mine, 13, 18),
    ], NO_GRAPHIC, PASSIVE, "below"),
  ], "playerTouch");
}

function fillTrees(map: GameMap): void {
  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x < map.width - 1; x += 1) {
      const index = y * map.width + x;
      if (map.lowerTiles[index] === TILE.DARK_GRASS) map.lowerTiles[index] = TILE.TREE;
    }
  }
}

// ── 맵 3: 메마른 광산 ─────────────────────────────────────────────────
function mineMap(): GameMap {
  const map = makeMap(EMBER_MAP.mine, "메마른 광산", 26, 22);
  rect(map, { x: 1, y: 1 }, { x: 24, y: 20 }, TILE.WALL);
  // 방과 통로를 깎아 낸다(자갈 바닥).
  rect(map, { x: 10, y: 16 }, { x: 16, y: 20 }, GROUND.GRAVEL); // 입구 홀
  rect(map, { x: 13, y: 8 }, { x: 13, y: 16 }, GROUND.GRAVEL); // 중앙 갱도(폭 1)
  rect(map, { x: 4, y: 14 }, { x: 11, y: 18 }, GROUND.GRAVEL); // 서쪽 막장
  rect(map, { x: 11, y: 16 }, { x: 13, y: 16 }, GROUND.GRAVEL);
  rect(map, { x: 15, y: 6 }, { x: 21, y: 10 }, GROUND.GRAVEL); // 동쪽 쉼터
  rect(map, { x: 13, y: 8 }, { x: 15, y: 8 }, GROUND.GRAVEL);
  rect(map, { x: 10, y: 4 }, { x: 16, y: 7 }, GROUND.GRAVEL); // 골렘의 방
  rect(map, { x: 13, y: 2 }, { x: 13, y: 4 }, GROUND.GRAVEL); // 뒷문 통로(폭 1)
  // 지하수 웅덩이.
  rect(map, { x: 5, y: 17 }, { x: 6, y: 18 }, TILE.WATER);

  map.events.push(
    talker("ev_mine_miner", 8, 15, "광부 톨크", [
      page("miner_page", "광부 톨크", [], [
        say("광부 톨크", "갱도가 마른 뒤로 박쥐 떼가 둥지를 틀었어. 중앙 갱도는 조심하게."),
        say("광부 톨크", "가장 깊은 곳의 돌 골렘은 뒷문을 지키고 서 있지. 대장장이 무겐이 그 녀석 핵을 노린다던데."),
      ], charsetGraphic(PEOPLE_2, 0)),
    ]),
    talker("ev_mine_worker", 18, 8, "겁먹은 인부 피오", [
      page("worker_page", "겁먹은 인부 피오", [], [
        say("겁먹은 인부 피오", "히익! ...사, 사람이구나. 여기 샘물이라도 마시고 가요. 몸이 한결 나아질 거예요."),
        { kind: "recoverAll" },
        say("겁먹은 인부 피오", "톨크 아저씨는 골렘 얘기만 하면 신이 나요. 난 무서워서 여기 숨어 있는데."),
      ], charsetGraphic(PEOPLE_3, 4)),
    ]),
    battleBlockerEvent("ev_mine_bats", 13, 12, EMBER_SWITCH.battleBats, {
      intro: ["천장에서 박쥐 떼가 쏟아져 내린다!"],
      troopId: EMBER_TROOP.bats,
      victory: ["박쥐 떼가 흩어졌다. 갱도가 조용해졌다."],
      graphic: charsetGraphic(MONSTER_3, 0),
    }),
    battleBlockerEvent("ev_mine_golem", 13, 3, EMBER_SWITCH.battleGolem, {
      intro: ["뒷문 앞, 거대한 돌 골렘이 천천히 몸을 일으킨다!"],
      troopId: EMBER_TROOP.golem,
      victory: ["무너진 골렘의 가슴에서 뜨거운 핵을 꺼냈다.", "뒷문 너머로 잿빛 고개가 보인다."],
      victoryCommands: [{ kind: "changeItem", itemId: EMBER_ITEM.golemCore, op: "+=", amount: 1 }],
      graphic: charsetGraphic(MONSTER_2, 4),
    }),
    event("ev_mine_back_exit", 13, 2, [
      page("mine_back_exit_page", "뒷문", [], [transfer(EMBER_MAP.pass, 2, 9)], NO_GRAPHIC, PASSIVE, "below"),
    ], "playerTouch"),
    event("ev_mine_return", 13, 20, [
      page("mine_return_page", "숲으로", [], [transfer(EMBER_MAP.forest, 15, 2)], NO_GRAPHIC, PASSIVE, "below"),
    ], "playerTouch"),
  );
  return map;
}

// ── 맵 4: 잿빛 고개 ────────────────────────────────────────────────────
function passMap(): GameMap {
  const map = makeMap(EMBER_MAP.pass, "잿빛 고개", 24, 18);
  rect(map, { x: 1, y: 1 }, { x: 22, y: 16 }, TILE.SAND);
  road(map, { x: 1, y: 9 }, { x: 8, y: 9 });
  road(map, { x: 8, y: 6 }, { x: 8, y: 9 });
  road(map, { x: 8, y: 6 }, { x: 16, y: 6 });
  road(map, { x: 16, y: 6 }, { x: 16, y: 9 });
  road(map, { x: 16, y: 9 }, { x: 22, y: 9 });
  // 바위와 마른 나무.
  rect(map, { x: 4, y: 3 }, { x: 6, y: 4 }, TILE.WALL);
  rect(map, { x: 12, y: 12 }, { x: 15, y: 13 }, TILE.WALL);
  rect(map, { x: 18, y: 2 }, { x: 20, y: 3 }, TILE.WALL);
  setLower(map, 3, 13, TILE.TREE);
  setLower(map, 10, 3, TILE.TREE);
  setLower(map, 20, 13, TILE.TREE);

  map.events.push(
    talker("ev_pass_hermit", 12, 5, "은둔자 오웬", [
      page("hermit_page", "은둔자 오웬", [], [
        say("은둔자 오웬", "이 고개를 넘는 사람은 오랜만이군. 로안이 보냈나? 그 친구도 참 사람을 부려먹는단 말이야."),
        say("은둔자 오웬", "성소의 주인은 붉은 비늘의 옛 용이다. 싸우기 전에 이 샘물로 숨을 고르고 가게."),
        { kind: "recoverAll" },
        say("은둔자 오웬", "몸이 가벼워졌을 게야. 부적이나 회복약을 아끼지 말게. 용 앞에서 아끼면 저승에서 후회한다네."),
      ], charsetGraphic(PEOPLE_1, 0)),
      page("hermit_clear", "은둔자 오웬", [switchOn(EMBER_SWITCH.q1Clear)], [
        say("은둔자 오웬", "성소의 빛이 여기서도 보이는군. 잘했네, 잿불지기."),
      ], charsetGraphic(PEOPLE_1, 0)),
    ]),
    event("ev_pass_west", 1, 9, [
      page("pass_west_page", "광산으로", [], [transfer(EMBER_MAP.mine, 13, 3)], NO_GRAPHIC, PASSIVE, "below"),
    ], "playerTouch"),
    event("ev_pass_east", 22, 9, [
      page("pass_east_page", "성소로", [], [transfer(EMBER_MAP.sanctum, 10, 15)], NO_GRAPHIC, PASSIVE, "below"),
    ], "playerTouch"),
  );
  return map;
}

// ── 맵 5: 화염 성소 ────────────────────────────────────────────────────
function sanctumMap(): GameMap {
  const map = makeMap(EMBER_MAP.sanctum, "화염 성소", 20, 18);
  rect(map, { x: 1, y: 1 }, { x: 18, y: 16 }, GROUND.PLAZA);
  // 기둥.
  for (const p of [{ x: 4, y: 4 }, { x: 15, y: 4 }, { x: 4, y: 9 }, { x: 15, y: 9 }, { x: 4, y: 13 }, { x: 15, y: 13 }]) {
    setLower(map, p.x, p.y, TILE.WALL);
  }
  road(map, { x: 9, y: 3 }, { x: 10, y: 16 });

  map.events.push(
    talker("ev_sanctum_keeper", 7, 12, "성소지기의 영혼", [
      page("keeper_page", "성소지기의 영혼", [], [
        say("성소지기의 영혼", "...먼 길을 왔구나, 잿불지기여. 이 성소의 화로는 용의 숨결에 삼켜졌다."),
        say("성소지기의 영혼", "용을 잠재우면 화로는 스스로 타오를 것이다. 싸우기 전, 그대의 상처를 거두어 주마."),
        { kind: "recoverAll" },
        say("성소지기의 영혼", "은둔자 오웬의 말을 기억하라. 아낌없이 싸워야 살아남는다."),
      ], charsetGraphic(PEOPLE_1, 2)),
      page("keeper_clear", "성소지기의 영혼", [switchOn(EMBER_SWITCH.q1Clear)], [
        say("성소지기의 영혼", "화로가 숨을 되찾았다. 고맙다, 아린. 잿불 마을에 이 빛을 전하라."),
      ], charsetGraphic(PEOPLE_1, 2)),
    ]),
    dragonEvent(),
    event("ev_sanctum_return", 10, 16, [
      page("sanctum_return_page", "고개로", [], [transfer(EMBER_MAP.pass, 21, 9)], NO_GRAPHIC, PASSIVE, "below"),
    ], "playerTouch"),
  );
  return map;
}

function dragonEvent(): GameEvent {
  const graphic = charsetGraphic(MONSTER_3, 5);
  return event("ev_sanctum_dragon", 10, 6, [
    page("dragon_fight", "붉은 용", [], [
      say(undefined, "제단 위, 붉은 용이 낮게 으르렁거린다. 화로의 불씨가 그 목구멍 속에서 일렁인다."),
      say("붉은 용", "...작은 불꽃이 또 하나 왔구나. 꺼져 버리기 전에 돌아가라."),
      { kind: "battleProcessing", troopId: EMBER_TROOP.dragon, canEscape: false, canLose: false },
      { kind: "setSwitch", switchId: EMBER_SWITCH.battleDragon, value: true },
      { kind: "setSwitch", switchId: EMBER_SWITCH.q1Clear, value: true },
      { kind: "recoverAll" },
      say(undefined, "용이 잠들자, 화로가 스스로 붉게 타오르기 시작했다!"),
      {
        kind: "ending",
        title: EMBER_TITLE,
        message: "성소의 불씨는 잿불 마을로 이어졌고, 아린의 이름은 '잿불지기'로 오래 기억되었다.",
      },
    ], graphic),
    page("dragon_done", "잠든 용", [switchOn(EMBER_SWITCH.q1Clear)], [
      say(undefined, "용은 깊이 잠들어 있다. 화로의 불꽃이 평화롭게 흔들린다."),
    ], graphic),
  ]);
}

// ── 공통 헬퍼 ──────────────────────────────────────────────────────────
type BattleBlockerSpec = {
  readonly intro: readonly string[];
  readonly troopId: string;
  readonly victory: readonly string[];
  readonly victoryCommands?: readonly Command[];
  readonly graphic: EventPage["graphic"];
};

function battleBlockerEvent(id: string, x: number, y: number, clearSwitchId: string, spec: BattleBlockerSpec): GameEvent {
  return event(id, x, y, [
    page(`${id}_fight`, "전투", [], [
      ...spec.intro.map((body) => say(undefined, body)),
      { kind: "battleProcessing", troopId: spec.troopId, canEscape: true, canLose: false },
      {
        kind: "fork",
        condition: { kind: "battleResult", result: "victory" },
        then: [
          { kind: "setSwitch", switchId: clearSwitchId, value: true },
          { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} },
          ...(spec.victoryCommands ?? []),
          ...spec.victory.map((body) => say(undefined, body)),
        ],
      },
    ], spec.graphic),
    page(`${id}_cleared`, "정리된 자리", [switchOn(clearSwitchId)], [], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

function talker(id: string, x: number, y: number, _name: string, pages: EventPage[]): GameEvent {
  return event(id, x, y, pages);
}

function say(speaker: string | undefined, body: string): Command {
  return speaker === undefined ? { kind: "text", body } : { kind: "text", speaker, body };
}

function switchOn(switchId: string): EventPage["conditions"][number] {
  return { kind: "switch", switchId, value: true };
}

function selfSwitchOn(key: "A" | "B" | "C" | "D"): EventPage["conditions"][number] {
  return { kind: "selfSwitch", key, value: true };
}

function itemHeld(itemId: string): EventPage["conditions"][number] {
  return { kind: "item", itemId, present: true };
}

function transfer(mapId: string, x: number, y: number): Command {
  return { kind: "transfer", mapId, x, y, fade: "black" };
}

function event(id: string, x: number, y: number, pages: readonly EventPage[], trigger: GameEvent["trigger"]["kind"] = "action"): GameEvent {
  return { id, x, y, trigger: { kind: trigger }, commands: [], pages: pages.map((entry) => ({ ...entry, trigger: { kind: trigger } })) };
}

function page(
  id: string,
  name: string,
  conditions: EventPage["conditions"],
  commands: readonly Command[],
  graphic: EventPage["graphic"],
  movement: EventPage["movement"] = PASSIVE,
  priority: EventPage["priority"] = "same",
): EventPage {
  return {
    id,
    name,
    conditions,
    graphic,
    trigger: { kind: "action" },
    priority,
    overlapForbidden: priority === "same",
    movement,
    commands: [...commands],
  };
}

function charsetGraphic(spriteId: string, characterIndex: number): EventPage["graphic"] {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
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
  rect(map, from, to, TILE.PATH);
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
