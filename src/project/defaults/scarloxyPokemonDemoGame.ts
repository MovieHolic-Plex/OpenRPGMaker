// Scarloxy MPWSP01 팩 포켓몬풍 데모 — "몬스터 테이머" 예시 프로젝트.
//
// 엔진 내장 몬스터 수집 시스템(system.monsterCollection)을 팩 몬스터 16종으로 시연한다:
//   - 박사에게 스타터 3택 (giveMonster)
//   - 야생 전투에서 포획 구슬로 포획 (전투 '포획' 명령, HP가 낮을수록 성공률 상승)
//   - 파티 몬스터는 전투 경험치를 나눠 받아 레벨업·기술 습득·진화 (스파르츄→신드릴→차마딜로 등)
//   - 상태 메뉴 '몬스터'에서 파티/보관함 관리
// 알려진 엔진 제약: 잡은 몬스터가 전투에 직접 나서지는 않는다(전투는 트레이너가 수행).
// 지형/이벤트 헬퍼는 scarloxyDemoGame.ts 의 것을 재사용한다.

import { PRODUCT_BRAND } from "@/brand";
import type { GameEvent, GameMap, Project } from "../types";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { normalizeStateRecord } from "@/project/databaseRecordModel";
import { DEFAULT_ACTOR_ID, DEFAULT_SKILL_ID } from "./constants";
import { createBlankMap, singleNodeTree } from "./defaultMaps";
import {
  G,
  GRASSLAND_TILESET_ID,
  PEOPLE1_CHARSET_ID,
  PEOPLE2_CHARSET_ID,
  charsetGraphic,
  demoEnemy,
  demoSkill,
  demoTroop,
  event,
  page,
  setUpper,
  stampLower,
  stampUpper,
  talker,
  transferEvent,
} from "./scarloxyDemoGame";
import {
  CENTER_MAP_ID,
  HOME_MAP_ID,
  LAB_MAP_ID,
  createCenterInteriorMap,
  createHomeInteriorMap,
  createLabInteriorMap,
  createTownDoorEvents,
  createTownDoorSigns,
} from "./scarloxyPokemonInteriors";

const TOWN_MAP_ID = "map_pkmn_town";
const ROUTE_MAP_ID = "map_pkmn_route";

// 마을 건물 문 앞 칸 — 건물 스프라이트의 문 타일 바로 아래.
//   연구소  = hospital 블록(10,1) 6×6, 문 = 블록 (2..3, 5) → 마을 (12..13, 6), 접근 (12,7)
//   우리 집 = house-small 블록(2,3) 5×5, 문 = 블록 (1, 4) → 마을 (3, 7), 접근 (3,8)
//   센터    = house-small-alt 블록(19,3) 5×5, 문 = 블록 (1, 4) → 마을 (20, 7), 접근 (20,8)
const TOWN_DOORS = {
  lab: { x: 12, y: 7 },
  home: { x: 3, y: 8 },
  center: { x: 20, y: 8 },
} as const;
const CAPTURE_ORB_ITEM_ID = "item_capture_orb";
const EMPTY = -1;

const GEN1_TYPE_DEFINITIONS = [
  ["normal", "노말", "physical"],
  ["fighting", "격투", "physical"],
  ["flying", "비행", "physical"],
  ["poison", "독", "physical"],
  ["ground", "땅", "physical"],
  ["rock", "바위", "physical"],
  ["bug", "벌레", "physical"],
  ["ghost", "고스트", "physical"],
  ["fire", "불꽃", "magical"],
  ["water", "물", "magical"],
  ["grass", "풀", "magical"],
  ["electric", "전기", "magical"],
  ["psychic", "에스퍼", "magical"],
  ["ice", "얼음", "magical"],
  ["dragon", "드래곤", "magical"],
] as const;

type Gen1Type = typeof GEN1_TYPE_DEFINITIONS[number][0];

const GEN1_TYPE_EFFECTS: readonly [Gen1Type, Gen1Type, 0 | 0.5 | 2][] = [
  ["water", "fire", 2], ["fire", "grass", 2], ["fire", "ice", 2],
  ["grass", "water", 2], ["electric", "water", 2], ["water", "rock", 2],
  ["ground", "flying", 0], ["water", "water", 0.5], ["fire", "fire", 0.5],
  ["electric", "electric", 0.5], ["ice", "ice", 0.5], ["grass", "grass", 0.5],
  ["psychic", "psychic", 0.5], ["fire", "water", 0.5], ["grass", "fire", 0.5],
  ["water", "grass", 0.5], ["electric", "grass", 0.5], ["normal", "rock", 0.5],
  ["normal", "ghost", 0], ["ghost", "ghost", 2], ["fire", "bug", 2],
  ["fire", "rock", 0.5], ["water", "ground", 2], ["electric", "ground", 0],
  ["electric", "flying", 2], ["grass", "ground", 2], ["grass", "bug", 0.5],
  ["grass", "poison", 0.5], ["grass", "rock", 2], ["grass", "flying", 0.5],
  ["ice", "water", 0.5], ["ice", "grass", 2], ["ice", "ground", 2],
  ["ice", "flying", 2], ["fighting", "normal", 2], ["fighting", "poison", 0.5],
  ["fighting", "flying", 0.5], ["fighting", "psychic", 0.5], ["fighting", "bug", 0.5],
  ["fighting", "rock", 2], ["fighting", "ice", 2], ["fighting", "ghost", 0],
  ["poison", "grass", 2], ["poison", "poison", 0.5], ["poison", "ground", 0.5],
  ["poison", "bug", 2], ["poison", "rock", 0.5], ["poison", "ghost", 0.5],
  ["ground", "fire", 2], ["ground", "electric", 2], ["ground", "grass", 0.5],
  ["ground", "bug", 0.5], ["ground", "rock", 2], ["ground", "poison", 2],
  ["flying", "electric", 0.5], ["flying", "fighting", 2], ["flying", "bug", 2],
  ["flying", "grass", 2], ["flying", "rock", 0.5], ["psychic", "fighting", 2],
  ["psychic", "poison", 2], ["bug", "fire", 0.5], ["bug", "grass", 2],
  ["bug", "fighting", 0.5], ["bug", "flying", 0.5], ["bug", "psychic", 2],
  ["bug", "ghost", 0.5], ["bug", "poison", 2], ["rock", "fire", 2],
  ["rock", "fighting", 0.5], ["rock", "ground", 0.5], ["rock", "flying", 2],
  ["rock", "bug", 2], ["rock", "ice", 2], ["ghost", "normal", 0],
  ["ghost", "psychic", 0], ["fire", "dragon", 0.5], ["water", "dragon", 0.5],
  ["electric", "dragon", 0.5], ["grass", "dragon", 0.5], ["ice", "dragon", 2],
  ["dragon", "dragon", 2],
];

function gen1TypeChart() {
  const types = GEN1_TYPE_DEFINITIONS.map(([id]) => id);
  const multipliers = Object.fromEntries(types.map((attackType) => [
    attackType,
    Object.fromEntries(types.map((defenderType) => [defenderType, 1])),
  ])) as Record<Gen1Type, Record<Gen1Type, number>>;
  for (const [attackType, defenderType, multiplier] of GEN1_TYPE_EFFECTS) {
    multipliers[attackType][defenderType] = multiplier;
  }
  return { types: [...types], multipliers };
}

export function createScarloxyPokemonDemoMaps(): readonly GameMap[] {
  return [
    townMap(),
    routeMap(),
    createLabInteriorMap(TOWN_MAP_ID, TOWN_DOORS.lab.x, TOWN_DOORS.lab.y + 1),
    createHomeInteriorMap(TOWN_MAP_ID, TOWN_DOORS.home.x, TOWN_DOORS.home.y + 1),
    createCenterInteriorMap(TOWN_MAP_ID, TOWN_DOORS.center.x, TOWN_DOORS.center.y + 1),
  ];
}

export function configureScarloxyPokemonDemoProject(project: Project): void {
  project.meta = { ...project.meta, title: "Scarloxy 포켓몬풍 데모", author: PRODUCT_BRAND };
  const titleScreen = project.system.titleScreen;
  project.system = {
    ...project.system,
    monsterCollection: true,
    battleUiStyle: "pokemon",
    // 전투 규칙 엔진도 Gen1 로 켠다. battleUiStyle 은 스킨(코스메틱)만 바꾸므로
    // 이것이 없으면 포켓몬 스킨을 쓰면서 RM2k3 규칙으로 싸운다 — applyGenrePreset
    // ("monster-collect") 은 이미 둘을 함께 켜는데, 출하 데모만 빠져 있었다.
    battleModel: "gen1",
    // Gen1 은 게이지(ATB)가 아니라 속도 기반 단일 턴이다. strict 흐름은 이미 구현돼
    // 있었고(runtime.ts battleFlow), 기본값(gauge)만 꺼져 있었다. 이 데모의 테스트들도
    // 처음부터 battleFlow: "strict" 를 명시해 왔다(scarloxyPokemonDemo.test.ts).
    battleFlow: "strict",
    // 잡은 파티 몬스터가 필드에 나서 싸운다(트레이너 대신). 1:1 대치.
    battleParty: "monsters",
    activeSlots: 1,
    typeChart: gen1TypeChart(),
    startActorIds: [DEFAULT_ACTOR_ID],
    ...(titleScreen
      ? {
          titleScreen: {
            ...titleScreen,
            title: "몬스터 테이머",
            menuLabels: { newGame: "모험 시작", continueGame: "이어 하기", quit: "그만두기" },
          },
        }
      : {}),
  };
  project.startPos = { x: 13, y: 12 };
  project.mapTree = {
    mapId: TOWN_MAP_ID,
    children: [
      singleNodeTree(ROUTE_MAP_ID),
      singleNodeTree(LAB_MAP_ID),
      singleNodeTree(HOME_MAP_ID),
      singleNodeTree(CENTER_MAP_ID),
    ],
  };
  project.session = {
    ...project.session,
    partyActorIds: [DEFAULT_ACTOR_ID],
    inventory: { ...project.session.inventory, [CAPTURE_ORB_ITEM_ID]: 3 },
  };

  const hero = project.database.actors.find((actor) => actor.id === DEFAULT_ACTOR_ID);
  if (hero) {
    hero.name = "트레이너";
    hero.characterResourceId = "scarloxy-charset-people1";
    hero.characterIndex = 0;
    // 포켓몬풍 밸런스: 기본 용사 스탯(HP 500+, 공격 원킬)을 데모 규모로 낮춘다.
    hero.parameterCurves = {
      ...hero.parameterCurves,
      maxHp: flatCurve(130, 6),
      maxMp: flatCurve(20, 1),
      attack: flatCurve(30, 2),
      defense: flatCurve(14, 1),
      mind: flatCurve(9, 1),
      agility: flatCurve(9, 1),
    };
    // 기술 목록에서 용사 스킬(집중·검격)을 걷어내고 트레이너다운 기술만 남긴다.
    hero.learnedSkills = [{ level: 1, skillId: "skill_pkmn_rock" }];
  }

  const captureOrb = project.database.items.find((item) => item.id === CAPTURE_ORB_ITEM_ID);
  if (captureOrb?.captureProfile) {
    captureOrb.captureProfile = { ...captureOrb.captureProfile, ballClass: "poke" };
  }

  project.database.skills.push(
    // Gen1 관례: 불꽃 기본기는 10% 화상. state_burn 은 아래에서 이 데모 DB 에만 저작한다.
    { ...demoSkill("skill_scarloxy_ember", "불씨 뿜기", 26, "anim_scarloxy_fire", "불씨를 뿜어 적을 태웁니다.", "fire"), stateEffects: [{ stateId: "state_burn", chance: 10, operation: "add" as const }] },
    demoSkill("skill_scarloxy_leaf", "잎날리기", 24, "anim_scarloxy_green", "날카로운 잎을 날립니다.", "grass"),
    demoSkill("skill_scarloxy_splash", "물장구", 24, "anim_scarloxy_splash", "물보라를 일으켜 공격합니다.", "water"),
    demoSkill("skill_scarloxy_scratch", "할퀴기", 18, "anim_scarloxy_scratch", "발톱으로 할큅니다."),
    demoSkill("skill_scarloxy_ice", "얼음 조각", 28, "anim_scarloxy_ice", "얼음 조각을 날립니다.", "water"),
    demoSkill("skill_scarloxy_burst", "대폭발", 36, "anim_scarloxy_explosion", "거대한 폭발을 일으킵니다.", "fire"),
    demoSkill("skill_pkmn_rock", "돌팔매", 16, "anim_scarloxy_scratch", "트레이너가 돌을 던져 견제합니다."),
    // 전광석화 — movePriority +1 은 strict 턴제에서 속도보다 먼저 비교된다(느려도 선공).
    { ...demoSkill("skill_scarloxy_quick", "전광석화", 18, "anim_scarloxy_scratch", "번개처럼 빠르게 몸통박치기합니다. 반드시 선공합니다."), movePriority: 1 },
    demoSkill("skill_scarloxy_punch", "Karate Strike", 25, "anim_scarloxy_scratch", "A focused Fighting-type strike.", "fighting"),
    demoSkill("skill_scarloxy_wing", "Gale Wing", 25, "anim_scarloxy_scratch", "A swift Flying-type strike.", "flying"),
    { ...demoSkill("skill_scarloxy_venom", "Venom Sting", 20, "anim_poison", "A Poison-type sting.", "poison"), stateEffects: [{ stateId: "state_poison", chance: 20, operation: "add" as const }] },
    demoSkill("skill_scarloxy_mud", "Mud Quake", 25, "anim_scarloxy_explosion", "A Ground-type shock.", "ground"),
    demoSkill("skill_scarloxy_bug", "Mandible Cut", 25, "anim_scarloxy_scratch", "A Bug-type bite.", "bug"),
    demoSkill("skill_scarloxy_shadow", "Night Shade", 25, "anim_magic", "A Ghost-type shade.", "ghost"),
    demoSkill("skill_scarloxy_spark", "Thunder Jolt", 25, "anim_magic", "An Electric-type jolt.", "electric"),
    { ...demoSkill("skill_scarloxy_mind", "Dream Pulse", 30, "anim_magic", "A Psychic-type pulse.", "psychic"), stateEffects: [{ stateId: "state_sleep", chance: 10, operation: "add" as const }] },
    demoSkill("skill_scarloxy_dragon", "Dragon Rage", 40, "anim_scarloxy_explosion", "A Dragon-type blast.", "dragon")
  );

  const gen1MoveMetadata: Readonly<Record<string, { maxPp: number; elementId: Gen1Type; critical?: "normal" | "high" }>> = {
    [DEFAULT_SKILL_ID]: { maxPp: 35, elementId: "normal" },
    skill_scarloxy_ember: { maxPp: 25, elementId: "fire" },
    skill_scarloxy_leaf: { maxPp: 25, elementId: "grass", critical: "high" },
    skill_scarloxy_splash: { maxPp: 25, elementId: "water" },
    skill_scarloxy_scratch: { maxPp: 35, elementId: "normal" },
    skill_scarloxy_ice: { maxPp: 10, elementId: "ice" },
    skill_scarloxy_burst: { maxPp: 5, elementId: "fire" },
    skill_pkmn_rock: { maxPp: 15, elementId: "rock" },
    skill_scarloxy_quick: { maxPp: 30, elementId: "normal" },
    skill_scarloxy_punch: { maxPp: 25, elementId: "fighting" },
    skill_scarloxy_wing: { maxPp: 35, elementId: "flying" },
    skill_scarloxy_venom: { maxPp: 35, elementId: "poison" },
    skill_scarloxy_mud: { maxPp: 30, elementId: "ground" },
    skill_scarloxy_bug: { maxPp: 35, elementId: "bug" },
    skill_scarloxy_shadow: { maxPp: 15, elementId: "ghost" },
    skill_scarloxy_spark: { maxPp: 30, elementId: "electric" },
    skill_scarloxy_mind: { maxPp: 10, elementId: "psychic" },
    skill_scarloxy_dragon: { maxPp: 10, elementId: "dragon" },
  };
  for (const [skillId, metadata] of Object.entries(gen1MoveMetadata)) {
    const skill = project.database.skills.find((record) => record.id === skillId);
    if (!skill) continue;
    skill.maxPp = metadata.maxPp;
    skill.elementId = metadata.elementId;
    skill.gen1CriticalRate = metadata.critical ?? "normal";
  }
  const iceMove = project.database.skills.find((record) => record.id === "skill_scarloxy_ice");
  if (iceMove) iceMove.stateEffects = [{ stateId: "state_freeze", chance: 10, operation: "add" }];
  const sparkMove = project.database.skills.find((record) => record.id === "skill_scarloxy_spark");
  if (sparkMove) sparkMove.stateEffects = [{ stateId: "state_paralysis", chance: 10, operation: "add" }];

  // Gen1 major status is persistent and mutually exclusive at runtime. The
  // metadata, rather than localized ids/names, is the semantic source of truth.
  const gen1States = [
    normalizeStateRecord({
      id: "state_poison", name: "독", gen1MajorStatus: "poison", restriction: "없음",
      removalCondition: "치료할 때까지 유지", recoverNaturallyFromTurn: 0, recoverNaturallyChance: 0,
      runtimeEffects: { hpDamagePercentPerTurn: 6.25, removeOnBattleEnd: false },
    }),
    normalizeStateRecord({
      id: "state_burn", name: "화상", gen1MajorStatus: "burn", restriction: "없음",
      removalCondition: "치료할 때까지 유지", recoverNaturallyFromTurn: 0, recoverNaturallyChance: 0,
      runtimeEffects: { attackMultiplier: 0.5, hpDamagePercentPerTurn: 6.25, removeOnBattleEnd: false },
    }),
    normalizeStateRecord({
      id: "state_sleep", name: "수면", gen1MajorStatus: "sleep", restriction: "행동 불가",
      removalCondition: "잠에서 깰 때까지 유지", recoverNaturallyFromTurn: 0, recoverNaturallyChance: 0,
      recoverWhenHitChance: 0, runtimeEffects: { restrictsAction: true, removeOnBattleEnd: false },
    }),
    normalizeStateRecord({
      id: "state_freeze", name: "얼음", gen1MajorStatus: "freeze", restriction: "행동 불가",
      removalCondition: "치료할 때까지 유지", recoverNaturallyFromTurn: 0, recoverNaturallyChance: 0,
      runtimeEffects: { restrictsAction: true, removeOnBattleEnd: false },
    }),
    normalizeStateRecord({
      id: "state_paralysis", name: "마비", gen1MajorStatus: "paralysis", restriction: "없음",
      removalCondition: "치료할 때까지 유지", recoverNaturallyFromTurn: 0, recoverNaturallyChance: 0,
      runtimeEffects: { removeOnBattleEnd: false },
    }),
  ];
  for (const state of gen1States) {
    const index = project.database.states.findIndex((record) => record.id === state.id);
    if (index >= 0) project.database.states[index] = state;
    else project.database.states.push(state);
  }

  const elements = project.database.elements ?? [];
  const elementTemplate = elements.find((record) => record.id === "fire") ?? elements[0];
  if (elementTemplate) {
    const gen1TypeIds = new Set(GEN1_TYPE_DEFINITIONS.map(([id]) => id));
    project.database.elements = [
      ...elements.filter((record) => !gen1TypeIds.has(record.id as Gen1Type)),
      ...GEN1_TYPE_DEFINITIONS.map(([id, name, kind]) => ({
        ...elementTemplate,
        id,
        name,
        kind,
        rateLabels: [...elementTemplate.rateLabels],
        damageMultipliers: { ...elementTemplate.damageMultipliers },
      })),
    ];
  }

  project.database.monsterSpecies = [
    ...(project.database.monsterSpecies ?? []),
    ...scarloxySpeciesRecords(),
  ];

  project.database.enemies.push(
    wildEnemy("enemy_pkmn_larvea", "라르베아", "larvea", 3, { maxHp: 40, maxMp: 2, attack: 6, defense: 8, mind: 4, agility: 5 }, { exp: 5, gold: 3 }, [DEFAULT_SKILL_ID, "skill_scarloxy_scratch"]),
    wildEnemy("enemy_pkmn_plumette", "플루메트", "plumette", 4, { maxHp: 44, maxMp: 4, attack: 7, defense: 5, mind: 6, agility: 15 }, { exp: 6, gold: 4 }, [DEFAULT_SKILL_ID, "skill_scarloxy_leaf"]),
    wildEnemy("enemy_pkmn_finsta", "핀스타", "finsta", 4, { maxHp: 46, maxMp: 5, attack: 7, defense: 7, mind: 7, agility: 11 }, { exp: 6, gold: 4 }, [DEFAULT_SKILL_ID, "skill_scarloxy_splash"]),
    wildEnemy("enemy_pkmn_jacana", "자카나", "jacana", 5, { maxHp: 52, maxMp: 5, attack: 8, defense: 7, mind: 8, agility: 13 }, { exp: 8, gold: 6 }, [DEFAULT_SKILL_ID, "skill_scarloxy_splash"]),
    wildEnemy("enemy_pkmn_draem", "드림", "draem", 6, { maxHp: 60, maxMp: 8, attack: 9, defense: 8, mind: 11, agility: 9 }, { exp: 10, gold: 8 }, [DEFAULT_SKILL_ID, "skill_scarloxy_leaf"]),
    wildEnemy("enemy_pkmn_rival_cindrill", "라이벌의 신드릴", "cindrill", 8, { maxHp: 90, maxMp: 8, attack: 12, defense: 10, mind: 9, agility: 12 }, { exp: 20, gold: 20 }, [DEFAULT_SKILL_ID, "skill_scarloxy_ember"]),
    wildEnemy("enemy_pkmn_atrox", "전설의 아트록스", "atrox", 15, { maxHp: 170, maxMp: 16, attack: 17, defense: 13, mind: 13, agility: 12 }, { exp: 50, gold: 60 }, [DEFAULT_SKILL_ID, "skill_scarloxy_ember", "skill_scarloxy_burst"])
  );

  project.database.troops.push(
    demoTroop("troop_pkmn_grass_a", "풀숲의 라르베아", "scarloxy-backdrop-forest", [
      { enemyId: "enemy_pkmn_larvea", x: 168, y: 132 },
    ]),
    demoTroop("troop_pkmn_grass_b", "풀숲의 몬스터들", "scarloxy-backdrop-forest", [
      { enemyId: "enemy_pkmn_larvea", x: 128, y: 136 },
    ]),
    demoTroop("troop_pkmn_shore", "물가의 몬스터들", "scarloxy-backdrop-sand", [
      { enemyId: "enemy_pkmn_finsta", x: 136, y: 132 },
    ]),
    demoTroop("troop_pkmn_dream", "떠도는 드림", "scarloxy-backdrop-forest", [
      { enemyId: "enemy_pkmn_draem", x: 168, y: 128 },
    ]),
    // 트레이너 소유 몬스터는 포획 금지 — 포켓몬 규칙.
    demoTroop("troop_pkmn_rival", "라이벌 배틀", "scarloxy-backdrop-forest", [
      { enemyId: "enemy_pkmn_rival_cindrill", x: 168, y: 128 },
    ], { uncapturable: true, trainerBattle: true }),
    demoTroop("troop_pkmn_atrox", "전설의 아트록스", "scarloxy-backdrop-ice", [
      { enemyId: "enemy_pkmn_atrox", x: 168, y: 124 },
    ])
  );
}

// --- 종(도감) 정의: 팩 몬스터 16종 전부 --------------------------------------
// 진화 라인: 스파르츄→신드릴→차마딜로(불) / 핀스타→걸핀→피니에트(물) /
//            라르베아→클리프→아이비론(풀) / 플루메트→플루마(풀)

type SpeciesSeed = {
  readonly key: string;
  readonly name: string;
  readonly type: "fire" | "water" | "grass";
  readonly stats: { maxHp: number; maxMp: number; attack: number; defense: number; mind: number; agility: number };
  readonly captureRate: number;
  readonly skillId?: string;
  readonly extraSkills?: readonly { level: number; skillId: string }[];
  readonly evolvesTo?: { key: string; level: number };
};

const SCARLOXY_GEN1_TYPES: Readonly<Record<string, readonly Gen1Type[]>> = {
  sparchu: ["electric"],
  cindrill: ["fire", "fighting"],
  charmadillo: ["fire", "rock"],
  finsta: ["water"],
  gulfin: ["water", "ground"],
  finiette: ["water", "ice"],
  larvea: ["bug", "poison"],
  cleaf: ["bug", "grass"],
  ivieron: ["grass"],
  plumette: ["flying"],
  pluma: ["normal", "flying"],
  jacana: ["water", "flying"],
  pouch: ["normal"],
  draem: ["psychic", "ghost"],
  friolera: ["ice"],
  atrox: ["dragon"],
};

const SCARLOXY_GEN1_PRIMARY_SKILLS: Readonly<Record<string, string>> = {
  sparchu: "skill_scarloxy_spark",
  cindrill: "skill_scarloxy_punch",
  charmadillo: "skill_pkmn_rock",
  finsta: "skill_scarloxy_splash",
  gulfin: "skill_scarloxy_mud",
  finiette: "skill_scarloxy_ice",
  larvea: "skill_scarloxy_venom",
  cleaf: "skill_scarloxy_bug",
  ivieron: "skill_scarloxy_leaf",
  plumette: "skill_scarloxy_wing",
  pluma: "skill_scarloxy_quick",
  jacana: "skill_scarloxy_wing",
  pouch: "skill_scarloxy_scratch",
  draem: "skill_scarloxy_shadow",
  friolera: "skill_scarloxy_ice",
  atrox: "skill_scarloxy_dragon",
};

const SPECIES_SEEDS: readonly SpeciesSeed[] = [
  { key: "sparchu", name: "스파르츄", type: "fire", stats: { maxHp: 18, maxMp: 8, attack: 11, defense: 7, mind: 10, agility: 13 }, captureRate: 0.45, skillId: "skill_scarloxy_ember", extraSkills: [{ level: 5, skillId: "skill_scarloxy_quick" }], evolvesTo: { key: "cindrill", level: 7 } },
  { key: "cindrill", name: "신드릴", type: "fire", stats: { maxHp: 30, maxMp: 10, attack: 15, defense: 11, mind: 12, agility: 14 }, captureRate: 0.25, skillId: "skill_scarloxy_ember", evolvesTo: { key: "charmadillo", level: 12 } },
  { key: "charmadillo", name: "차마딜로", type: "fire", stats: { maxHp: 46, maxMp: 12, attack: 20, defense: 18, mind: 13, agility: 12 }, captureRate: 0.12, skillId: "skill_scarloxy_burst" },
  { key: "finsta", name: "핀스타", type: "water", stats: { maxHp: 20, maxMp: 8, attack: 9, defense: 9, mind: 11, agility: 11 }, captureRate: 0.5, skillId: "skill_scarloxy_splash", evolvesTo: { key: "gulfin", level: 7 } },
  { key: "gulfin", name: "걸핀", type: "water", stats: { maxHp: 32, maxMp: 10, attack: 14, defense: 12, mind: 13, agility: 13 }, captureRate: 0.25, skillId: "skill_scarloxy_splash", evolvesTo: { key: "finiette", level: 12 } },
  { key: "finiette", name: "피니에트", type: "water", stats: { maxHp: 48, maxMp: 14, attack: 18, defense: 15, mind: 19, agility: 16 }, captureRate: 0.12, skillId: "skill_scarloxy_ice" },
  { key: "larvea", name: "라르베아", type: "grass", stats: { maxHp: 17, maxMp: 6, attack: 8, defense: 11, mind: 8, agility: 7 }, captureRate: 0.6, skillId: "skill_scarloxy_scratch", evolvesTo: { key: "cleaf", level: 7 } },
  { key: "cleaf", name: "클리프", type: "grass", stats: { maxHp: 30, maxMp: 9, attack: 13, defense: 14, mind: 11, agility: 10 }, captureRate: 0.3, skillId: "skill_scarloxy_leaf", evolvesTo: { key: "ivieron", level: 12 } },
  { key: "ivieron", name: "아이비론", type: "grass", stats: { maxHp: 46, maxMp: 12, attack: 17, defense: 18, mind: 14, agility: 12 }, captureRate: 0.12, skillId: "skill_scarloxy_leaf" },
  { key: "plumette", name: "플루메트", type: "grass", stats: { maxHp: 16, maxMp: 5, attack: 8, defense: 6, mind: 7, agility: 16 }, captureRate: 0.6, skillId: "skill_scarloxy_leaf", evolvesTo: { key: "pluma", level: 8 } },
  { key: "pluma", name: "플루마", type: "grass", stats: { maxHp: 34, maxMp: 9, attack: 14, defense: 10, mind: 11, agility: 20 }, captureRate: 0.25, skillId: "skill_scarloxy_leaf" },
  { key: "jacana", name: "자카나", type: "water", stats: { maxHp: 21, maxMp: 6, attack: 9, defense: 8, mind: 9, agility: 15 }, captureRate: 0.55, skillId: "skill_scarloxy_splash" },
  { key: "pouch", name: "파우치", type: "water", stats: { maxHp: 26, maxMp: 6, attack: 10, defense: 11, mind: 8, agility: 8 }, captureRate: 0.5, skillId: "skill_scarloxy_splash" },
  { key: "draem", name: "드림", type: "grass", stats: { maxHp: 24, maxMp: 10, attack: 10, defense: 9, mind: 14, agility: 10 }, captureRate: 0.35, skillId: "skill_scarloxy_leaf" },
  { key: "friolera", name: "프리올레라", type: "water", stats: { maxHp: 34, maxMp: 12, attack: 12, defense: 11, mind: 15, agility: 11 }, captureRate: 0.3, skillId: "skill_scarloxy_ice" },
  { key: "atrox", name: "아트록스", type: "fire", stats: { maxHp: 60, maxMp: 16, attack: 19, defense: 14, mind: 15, agility: 14 }, captureRate: 0.15, skillId: "skill_scarloxy_burst" },
];

export function scarloxySpeciesId(key: string): string {
  return `species_scarloxy_${key}`;
}

function scarloxySpeciesRecords() {
  return SPECIES_SEEDS.map((seed) =>
    normalizeMonsterSpeciesRecord({
      id: scarloxySpeciesId(seed.key),
      name: seed.name,
      types: [...(SCARLOXY_GEN1_TYPES[seed.key] ?? [seed.type])],
      graphic: { monsterResourceId: `scarloxy-monster-${seed.key}`, graphicHue: 0, transparent: false, flying: false },
      baseStats: seed.stats,
      captureRate: Math.round(seed.captureRate * 255) / 255,
      // 데모용 저속 곡선 — 야생전 몇 번이면 스타터가 7레벨 진화에 도달한다.
      expCurve: { base: 2, extra: 1, acceleration: 1 },
      skillsByLevel: [
        { level: 1, skillId: DEFAULT_SKILL_ID },
        ...((SCARLOXY_GEN1_PRIMARY_SKILLS[seed.key] ?? seed.skillId)
          ? [{ level: 3, skillId: SCARLOXY_GEN1_PRIMARY_SKILLS[seed.key] ?? seed.skillId! }]
          : []),
        ...(seed.extraSkills ?? []),
      ],
      evolutions: seed.evolvesTo
        ? [{ toSpeciesId: scarloxySpeciesId(seed.evolvesTo.key), requires: { level: seed.evolvesTo.level } }]
        : [],
    })
  );
}

function flatCurve(base: number, perLevel: number): number[] {
  return Array.from({ length: 99 }, (_, index) => base + index * perLevel);
}

function wildEnemy(
  id: string,
  name: string,
  speciesKey: string,
  level: number,
  stats: { maxHp: number; maxMp: number; attack: number; defense: number; mind: number; agility: number },
  rewards: { exp: number; gold: number },
  skillIds: readonly string[],
) {
  return demoEnemy(id, name, `scarloxy-monster-${speciesKey}`, stats, rewards, skillIds, {
    level,
    speciesId: scarloxySpeciesId(speciesKey),
  });
}

// --- 맵 -----------------------------------------------------------------------

function townMap(): GameMap {
  const map = createBlankMap("새싹 마을", 26, 18, GRASSLAND_TILESET_ID);
  map.id = TOWN_MAP_ID;
  map.lowerTiles = new Array<number>(map.width * map.height).fill(G.GRASS);
  map.upperTiles = new Array<number>(map.width * map.height).fill(EMPTY);

  stampUpper(map, 10, 1, G.HOSPITAL); // 몬스터 연구소
  stampUpper(map, 2, 3, G.HOUSE_SMALL);
  stampUpper(map, 19, 3, G.HOUSE_SMALL_ALT);
  for (const [x, y] of [[0, 0], [7, 0], [17, 0], [24, 0], [0, 14], [24, 14]] as const) {
    stampUpper(map, x, y, G.GREEN_TREE);
  }
  stampUpper(map, 5, 10, G.TEAL_TREE);
  stampUpper(map, 20, 10, G.GREEN_TREE_SMALL);
  setUpper(map, 8, 13, G.GRASS_TUFT);
  setUpper(map, 17, 13, G.GRASS_TUFT);
  setUpper(map, 22, 15, G.ROCK_1);

  map.events.push(
    professorEvent(),
    talker("ev_pkmn_healer", 11, 8, "치유사", [
      "연구소 앞이니 안심하세요. 상처를 치료해 드릴게요.",
    ], [{ kind: "recoverAll" }], charsetGraphic(PEOPLE1_CHARSET_ID, 3)),
    talker("ev_pkmn_guide", 16, 11, "금발 소년", [
      "남쪽 풀숲에는 야생 몬스터가 나와. 전투에서 '포획' 명령으로 구슬을 던져봐!",
      "몬스터의 HP를 깎을수록 잘 잡혀. 잡은 몬스터는 메뉴의 '몬스터'에서 볼 수 있어.",
      "파티에 넣은 몬스터는 전투 경험치를 나눠 받아서 레벨이 오르고, 7레벨이 되면 진화한대!",
    ], [], charsetGraphic(PEOPLE1_CHARSET_ID, 1)),
    transferEvent("ev_pkmn_to_route", 13, 17, ROUTE_MAP_ID, 15, 2, "초원 1번 길로"),
    ...createTownDoorEvents(TOWN_DOORS),
    ...createTownDoorSigns(TOWN_DOORS),
  );
  return map;
}

function professorEvent(): GameEvent {
  const starters = [
    { key: "sparchu", name: "스파르츄", flavor: "불꽃을 문 장난꾸러기" },
    { key: "finsta", name: "핀스타", flavor: "차분한 물고기" },
    { key: "larvea", name: "라르베아", flavor: "씩씩한 풀 애벌레" },
  ];
  return event("ev_pkmn_professor", 13, 8, [
    page("ev_pkmn_professor_choose", "박사", [
      { kind: "text", speaker: "박사", body: "왔구나! 몬스터 테이머가 되려면 동료가 필요하지." },
      { kind: "text", speaker: "박사", body: "셋 중 하나를 고르렴. 포획 구슬 5개도 챙겨주마." },
      {
        kind: "choices",
        prompt: "처음 함께할 몬스터를 고르세요.",
        options: starters.map((starter) => ({
          text: `${starter.name} (${starter.flavor})`,
          branch: [
            { kind: "giveMonster", speciesId: scarloxySpeciesId(starter.key), level: 5, nickname: starter.name },
            { kind: "changeItem", itemId: CAPTURE_ORB_ITEM_ID, op: "+=", amount: 5 },
            { kind: "text", speaker: "박사", body: `${starter.name}와 함께 여행을 시작하렴. 남쪽 풀숲에서 포획을 연습해 보고!` },
            { kind: "setSelfSwitch", key: "A", value: true },
          ],
        })),
        cancelBehavior: "disallow",
      },
    ], charsetGraphic(PEOPLE2_CHARSET_ID, 1), { type: "fixed", speed: 3, frequency: 3 }),
    page("ev_pkmn_professor_after", "박사", [
      { kind: "text", speaker: "박사", body: "몬스터들은 잘 크고 있니? 메뉴의 '몬스터'에서 파티를 확인해 보렴." },
      { kind: "text", speaker: "박사", body: "구슬이 부족하면 좀 더 가져가고." },
      { kind: "changeItem", itemId: CAPTURE_ORB_ITEM_ID, op: "+=", amount: 3 },
    ], charsetGraphic(PEOPLE2_CHARSET_ID, 1), { type: "fixed", speed: 3, frequency: 3 }, [
      { kind: "selfSwitch", key: "A", value: true },
    ]),
  ]);
}

function routeMap(): GameMap {
  const map = createBlankMap("초원 1번 길", 30, 24, GRASSLAND_TILESET_ID);
  map.id = ROUTE_MAP_ID;
  map.lowerTiles = new Array<number>(map.width * map.height).fill(G.GRASS);
  map.upperTiles = new Array<number>(map.width * map.height).fill(EMPTY);
  map.encounterRate = 5;
  map.troopIds = ["troop_pkmn_grass_a", "troop_pkmn_grass_b", "troop_pkmn_shore", "troop_pkmn_dream"];

  stampLower(map, 22, 16, G.POND);
  stampLower(map, 4, 18, G.SAND_PATCH);
  for (const [x, y] of [[0, 0], [9, 0], [20, 0], [28, 0], [0, 8], [28, 8], [0, 16], [9, 20], [19, 20], [27, 20]] as const) {
    stampUpper(map, x, y, G.GREEN_TREE);
  }
  for (const [x, y] of [[5, 5], [24, 5], [14, 9]] as const) {
    stampUpper(map, x, y, G.TEAL_TREE);
  }
  for (const [x, y] of [[3, 12], [12, 6], [22, 12], [8, 15], [17, 17]] as const) {
    setUpper(map, x, y, G.GRASS_TUFT);
  }
  setUpper(map, 26, 13, G.ROCK_1);
  setUpper(map, 6, 9, G.ROCK_2);

  map.events.push(
    transferEvent("ev_pkmn_to_town", 15, 1, TOWN_MAP_ID, 13, 16, "새싹 마을로"),
    rivalEvent(),
    atroxEvent(),
    talker("ev_pkmn_route_sign", 12, 3, "표지판", [
      "초원 1번 길 — 풀숲에서는 야생 몬스터가 튀어나옵니다.",
      "남쪽 끝에서 이상한 울음소리가 들린다는 소문이 있다.",
    ], [], { transparent: true }, { type: "fixed", speed: 3, frequency: 3 }),
  );
  return map;
}

function rivalEvent(): GameEvent {
  return event("ev_pkmn_rival", 15, 12, [
    page("ev_pkmn_rival_battle", "라이벌", [
      { kind: "text", speaker: "라이벌", body: "오, 너도 박사님한테 몬스터 받았구나? 내 신드릴이랑 붙어보자!" },
      { kind: "battleProcessing", troopId: "troop_pkmn_rival", canEscape: false, canLose: false },
      { kind: "text", speaker: "라이벌", body: "졌다… 트레이너의 몬스터는 포획할 수 없다는 건 알아둬!" },
      { kind: "setSelfSwitch", key: "A", value: true },
    ], charsetGraphic(PEOPLE1_CHARSET_ID, 1), { type: "fixed", speed: 3, frequency: 3 }),
    page("ev_pkmn_rival_after", "라이벌", [
      { kind: "text", speaker: "라이벌", body: "남쪽 끝에 전설의 몬스터가 있다던데… 난 아직 무리야." },
    ], charsetGraphic(PEOPLE1_CHARSET_ID, 1), { type: "fixed", speed: 3, frequency: 3 }, [
      { kind: "selfSwitch", key: "A", value: true },
    ]),
  ]);
}

function atroxEvent(): GameEvent {
  return event("ev_pkmn_atrox", 15, 22, [
    page("ev_pkmn_atrox_battle", "전설의 아트록스", [
      { kind: "text", body: "타오르는 기척… 전설의 아트록스가 모습을 드러냈다!" },
      { kind: "text", body: "(포획하려면 HP를 충분히 깎고 구슬을 던지자. 포획률이 낮으니 여러 개 필요할지도.)" },
      { kind: "battleProcessing", troopId: "troop_pkmn_atrox", canEscape: true, canLose: false },
      { kind: "setSelfSwitch", key: "A", value: true },
    ], charsetGraphic(PEOPLE2_CHARSET_ID, 0), { type: "fixed", speed: 3, frequency: 3 }),
    page("ev_pkmn_atrox_after", "잦아든 기척", [
      { kind: "text", body: "아트록스가 있던 자리에는 그을린 흔적만 남아 있다." },
    ], { transparent: true }, { type: "fixed", speed: 3, frequency: 3 }, [
      { kind: "selfSwitch", key: "A", value: true },
    ]),
  ]);
}
