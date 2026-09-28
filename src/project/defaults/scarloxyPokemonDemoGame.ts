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
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { DEFAULT_ACTOR_ID, DEFAULT_SKILL_ID } from "./constants";
import { createBlankMap, singleNodeTree } from "./defaultMaps";
import { MONSTER_TOWN_KIT_MANIFEST } from "@/assets/scarloxyPack";
import { applyScarloxyBackSprites, createScarloxyExtraSkills, createScarloxyExtraSpeciesRecords } from "./scarloxyExtraSpecies";
import { castFace, castGraphic } from "./scarloxyCastEvents";
import { PKMN_FLAGS, PKMN_LINKS, PKMN_MAPS } from "./scarloxyPokemonWorld";
import { installScarloxyPokemonRegions } from "./scarloxyPokemonRegions";
import {
  G,
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

// 마을·1번 길은 「초원 마을 + 몬스터 마을 부품」 960칸 시트로 그린다. 위 480칸은 초원 마을
// 시트와 번호가 같아 G 상수를 그대로 쓰고, 480~ 의 새 부품(상점·풀숲·울타리·턱…)을 함께 깐다.
const OUTDOOR_TILESET_ID = "scarloxy_chipset_monster_town_kit";

/** 부품 블록의 칸 번호 격자(행 우선). 매니페스트에 없는 이름이면 빌드 스크립트와 어긋난 것이다. */
function kitBlock(name: string): number[][] {
  const block = MONSTER_TOWN_KIT_MANIFEST.blocks.find((entry) => entry.name === name);
  if (!block) throw new Error(`몬스터 마을 부품 매니페스트에 ${name} 블록이 없습니다.`);
  return Array.from({ length: block.h }, (_, dy) =>
    Array.from({ length: block.w }, (_, dx) => (block.row + dy) * 30 + block.col + dx));
}
const K = {
  SHOP: kitBlock("item-shop"),
  CAVE: kitBlock("cave-entrance"),
  SIGNPOST: kitBlock("signpost")[0]![0]!,
  MAILBOX: kitBlock("mailbox")[0]![0]!,
  SHRUB: kitBlock("cuttable-shrub")[0]![0]!,
  PLANTER: kitBlock("flower-planter"),
  BENCH: kitBlock("bench"),
  LAMP: kitBlock("street-lamp"),
  TALL_GRASS: [kitBlock("tall-grass-a")[0]![0]!, kitBlock("tall-grass-b")[0]![0]!] as const,
  FENCE: kitBlock("picket-fence")[0]!,
  FENCE_POST: kitBlock("fence-post")[0]![0]!,
  LEDGE: kitBlock("grass-ledge")[0]!,
} as const;

/** 조우 풀숲을 사각형으로 깐다(두 변형을 체크무늬로 섞어 반복을 숨긴다). 이미 뭔가 있는 칸은 비운다. */
function tallGrass(map: GameMap, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      if (map.upperTiles[y * map.width + x] !== EMPTY) continue;
      setUpper(map, x, y, K.TALL_GRASS[(x + y) % 2]!);
    }
  }
}

/** 가로 울타리: 2칸 조각을 이어 붙이고 끝을 기둥으로 막는다. */
function fenceRow(map: GameMap, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x += 1) setUpper(map, x, y, K.FENCE[(x - x0) % 2]!);
  setUpper(map, x1, y, K.FENCE_POST);
}

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
/** 라이벌이 고를 상성 스타터를 정하는 변수 — 1=불 스파르츄 2=물 핀스타 3=풀 라르베아. */
export const PKMN_STARTER_VARIABLE = "var_pkmn_starter";
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
            menuLabels: { newGame: "모험 시작", continueGame: "불러오기", quit: "그만두기" },
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
    // 기본 주인공 얼굴(갈색 머리띠 용사)은 이 트레이너 소년이 아니다. 공용 대응표에 이 팩의 얼굴이 없어 비운다.
    delete hero.faceResourceId;
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
    // 전기자기파 — Gen1 관례(마비 100%, 땅 타입만 면역). 확률 10% 기술만 있으면
    // 상태이상이 전투에서 사실상 관측되지 않아, 상태기 하나는 확정 부여로 둔다.
    {
      ...normalizeSkillRecord({
        id: "skill_scarloxy_wave",
        name: "전기자기파",
        scope: "enemy",
        power: 0,
        animationId: "anim_magic",
        description: "약한 전류로 상대를 반드시 마비시킵니다.",
        mpCost: { flat: 0, percentMax: 0 },
        successRate: 100,
        effect: { kind: "support" },
        elementId: "electric",
        stateEffects: [{ stateId: "state_paralysis", chance: 100, operation: "add" }],
      }),
    },
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
    skill_scarloxy_wave: { maxPp: 20, elementId: "electric" },
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
    // 새 11종(바위·전기·유령·벌레·독·격투·얼음·땅) — scarloxyExtraSpecies.ts. 도감 30종.
    ...createScarloxyExtraSpeciesRecords(),
  ];
  // 30종 전부 뒷모습 — 포켓몬 스킨은 아군 몬스터를 뒤에서 그린다(graphic.backResourceId).
  applyScarloxyBackSprites(project.database.monsterSpecies);
  project.database.skills.push(...createScarloxyExtraSkills().filter((skill) => !project.database.skills.some((existing) => existing.id === skill.id)));

  // 진행 스위치·변수(scarloxyPokemonWorld.ts PKMN_FLAGS). 지역 맵들이 이 id 로 관문·배지를 판정한다.
  const switchNames: Record<string, string> = {
    [PKMN_FLAGS.gotStarter]: "스타터를 받았다",
    [PKMN_FLAGS.badge1]: "풀 배지",
    [PKMN_FLAGS.badge2]: "물 배지",
    [PKMN_FLAGS.badge3]: "불 배지",
    [PKMN_FLAGS.rival1]: "라이벌전 1",
    [PKMN_FLAGS.rival2]: "라이벌전 2",
    [PKMN_FLAGS.rival3]: "라이벌전 3",
    [PKMN_FLAGS.champion]: "챔피언을 이겼다",
  };
  for (const [id, name] of Object.entries(switchNames)) {
    if (!project.switches.some((entry) => entry.id === id)) project.switches.push({ id, name });
  }
  for (const [id, name] of [[PKMN_FLAGS.badgeCount, "배지 수"], [PKMN_STARTER_VARIABLE, "스타터(1불 2물 3풀)"]] as const) {
    if (!project.variables.some((entry) => entry.id === id)) project.variables.push({ id, name });
  }

  project.database.enemies.push(
    wildEnemy("enemy_pkmn_larvea", "라르베아", "larvea", 3, { maxHp: 40, maxMp: 2, attack: 6, defense: 8, mind: 4, agility: 5 }, { exp: 5, gold: 3 }, [DEFAULT_SKILL_ID, "skill_scarloxy_scratch"]),
    wildEnemy("enemy_pkmn_sparchu", "스파르츄", "sparchu", 4, { maxHp: 42, maxMp: 6, attack: 8, defense: 5, mind: 7, agility: 10 }, { exp: 7, gold: 5 }, [DEFAULT_SKILL_ID, "skill_scarloxy_spark"]),
    wildEnemy("enemy_pkmn_plumette", "플루메트", "plumette", 4, { maxHp: 44, maxMp: 4, attack: 7, defense: 5, mind: 6, agility: 15 }, { exp: 6, gold: 4 }, [DEFAULT_SKILL_ID, "skill_scarloxy_leaf"]),
    wildEnemy("enemy_pkmn_finsta", "핀스타", "finsta", 4, { maxHp: 46, maxMp: 5, attack: 7, defense: 7, mind: 7, agility: 11 }, { exp: 6, gold: 4 }, [DEFAULT_SKILL_ID, "skill_scarloxy_splash"]),
    wildEnemy("enemy_pkmn_jacana", "자카나", "jacana", 5, { maxHp: 52, maxMp: 5, attack: 8, defense: 7, mind: 8, agility: 13 }, { exp: 8, gold: 6 }, [DEFAULT_SKILL_ID, "skill_scarloxy_splash"]),
    wildEnemy("enemy_pkmn_draem", "드림", "draem", 6, { maxHp: 60, maxMp: 8, attack: 9, defense: 8, mind: 11, agility: 9 }, { exp: 10, gold: 8 }, [DEFAULT_SKILL_ID, "skill_scarloxy_leaf"]),
    wildEnemy("enemy_pkmn_mossling", "모슬링", "mossling", 3, { maxHp: 42, maxMp: 3, attack: 6, defense: 9, mind: 5, agility: 6 }, { exp: 5, gold: 3 }, [DEFAULT_SKILL_ID, "skill_scarloxy_leaf"]),
    wildEnemy("enemy_pkmn_emberkit", "엠버킷", "emberkit", 4, { maxHp: 44, maxMp: 5, attack: 8, defense: 6, mind: 7, agility: 13 }, { exp: 7, gold: 5 }, [DEFAULT_SKILL_ID, "skill_scarloxy_ember"]),
    wildEnemy("enemy_pkmn_puddlup", "퍼들업", "puddlup", 4, { maxHp: 46, maxMp: 5, attack: 7, defense: 8, mind: 9, agility: 10 }, { exp: 7, gold: 5 }, [DEFAULT_SKILL_ID, "skill_scarloxy_splash"]),
    wildEnemy("enemy_pkmn_pouch", "파우치", "pouch", 5, { maxHp: 55, maxMp: 5, attack: 8, defense: 9, mind: 6, agility: 7 }, { exp: 8, gold: 6 }, [DEFAULT_SKILL_ID, "skill_scarloxy_scratch"]),
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
    demoTroop("troop_pkmn_new_grass", "풀숲의 모슬링", "scarloxy-backdrop-forest", [
      { enemyId: "enemy_pkmn_mossling", x: 160, y: 132 },
    ]),
    // 야생은 1:1 이 포켓몬 문법이다 — 두 마리 트룹은 더블배틀 시스템이 없는 한 만들지 않는다.
    demoTroop("troop_pkmn_new_pair", "풀숲의 엠버킷", "scarloxy-backdrop-forest", [
      { enemyId: "enemy_pkmn_emberkit", x: 160, y: 132 },
    ]),
    demoTroop("troop_pkmn_pond_pair", "연못가의 퍼들업", "scarloxy-backdrop-sand", [
      { enemyId: "enemy_pkmn_puddlup", x: 160, y: 132 },
    ]),
    demoTroop("troop_pkmn_sparchu", "풀숲의 스파르츄", "scarloxy-backdrop-forest", [
      { enemyId: "enemy_pkmn_sparchu", x: 160, y: 132 },
    ]),
    demoTroop("troop_pkmn_pouch", "물가의 파우치", "scarloxy-backdrop-sand", [
      { enemyId: "enemy_pkmn_pouch", x: 160, y: 132 },
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

  // 지역 A·B(scarloxyPokemonRegionA/B.ts) — 이끼 마을부터 챔피언의 탑까지. 맵·적·무리·아이템·맵 트리를 스스로 넣는다.
  installScarloxyPokemonRegions(project);
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
  mossling: ["grass"],
  emberkit: ["fire"],
  puddlup: ["water"],
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
  mossling: "skill_scarloxy_leaf",
  emberkit: "skill_scarloxy_ember",
  puddlup: "skill_scarloxy_splash",
  ivieron: "skill_scarloxy_leaf",
  plumette: "skill_scarloxy_wing",
  pluma: "skill_scarloxy_quick",
  jacana: "skill_scarloxy_wing",
  pouch: "skill_scarloxy_scratch",
  draem: "skill_scarloxy_shadow",
  friolera: "skill_scarloxy_ice",
  atrox: "skill_scarloxy_dragon",
};

// 레벨업 기술 테이블 — 1레벨 기본기(공격) + 주력기(3레벨)는 scarloxySpeciesRecords 가
// 채우고, 여기엔 주력 뒤에 붙는 상위 습득만 둔다. 15타입 차트가 사장되지 않게
// 종족 타입(SCARLOXY_GEN1_TYPES)에 맞는 기술로만 구성한다.
const SCARLOXY_LEVELUP_MOVES: Readonly<Record<string, readonly { level: number; skillId: string }[]>> = {
  // 원작 피카츄 습득 순서(전기쇼크 → 전광석화 → 전기자기파 lv9)를 따른다.
  sparchu: [{ level: 5, skillId: "skill_scarloxy_quick" }, { level: 9, skillId: "skill_scarloxy_wave" }],
  cindrill: [{ level: 7, skillId: "skill_scarloxy_punch" }, { level: 10, skillId: "skill_scarloxy_ember" }, { level: 14, skillId: "skill_scarloxy_burst" }],
  charmadillo: [{ level: 12, skillId: "skill_pkmn_rock" }, { level: 16, skillId: "skill_scarloxy_burst" }],
  finsta: [{ level: 5, skillId: "skill_scarloxy_ice" }, { level: 9, skillId: "skill_scarloxy_mud" }],
  gulfin: [{ level: 7, skillId: "skill_scarloxy_mud" }, { level: 10, skillId: "skill_scarloxy_ice" }],
  finiette: [{ level: 12, skillId: "skill_scarloxy_ice" }, { level: 16, skillId: "skill_scarloxy_mud" }],
  larvea: [{ level: 5, skillId: "skill_scarloxy_venom" }, { level: 9, skillId: "skill_scarloxy_bug" }],
  cleaf: [{ level: 7, skillId: "skill_scarloxy_bug" }, { level: 10, skillId: "skill_scarloxy_venom" }, { level: 14, skillId: "skill_scarloxy_leaf" }],
  ivieron: [{ level: 12, skillId: "skill_scarloxy_leaf" }, { level: 16, skillId: "skill_scarloxy_venom" }],
  plumette: [{ level: 5, skillId: "skill_scarloxy_wing" }, { level: 9, skillId: "skill_scarloxy_quick" }],
  pluma: [{ level: 8, skillId: "skill_scarloxy_wing" }, { level: 12, skillId: "skill_scarloxy_quick" }],
  mossling: [{ level: 5, skillId: "skill_scarloxy_leaf" }, { level: 8, skillId: "skill_scarloxy_bug" }],
  emberkit: [{ level: 5, skillId: "skill_scarloxy_ember" }, { level: 8, skillId: "skill_scarloxy_burst" }],
  puddlup: [{ level: 5, skillId: "skill_scarloxy_splash" }, { level: 8, skillId: "skill_scarloxy_mud" }],
  jacana: [{ level: 5, skillId: "skill_scarloxy_wing" }, { level: 8, skillId: "skill_scarloxy_splash" }],
  pouch: [{ level: 5, skillId: "skill_scarloxy_scratch" }, { level: 8, skillId: "skill_scarloxy_quick" }],
  draem: [{ level: 5, skillId: "skill_scarloxy_shadow" }, { level: 9, skillId: "skill_scarloxy_mind" }],
  friolera: [{ level: 5, skillId: "skill_scarloxy_ice" }, { level: 9, skillId: "skill_scarloxy_splash" }],
  atrox: [{ level: 10, skillId: "skill_scarloxy_ember" }, { level: 14, skillId: "skill_scarloxy_burst" }, { level: 18, skillId: "skill_scarloxy_dragon" }],
};

const SPECIES_SEEDS: readonly SpeciesSeed[] = [
  { key: "sparchu", name: "스파르츄", type: "fire", stats: { maxHp: 18, maxMp: 8, attack: 11, defense: 7, mind: 10, agility: 13 }, captureRate: 0.45, skillId: "skill_scarloxy_ember", evolvesTo: { key: "cindrill", level: 7 } },
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
  // 생성 자산 3종(2026-08-30) — 1번 길 초반 야생 라인업. 진화 없음, 포획률 높음.
  { key: "mossling", name: "모슬링", type: "grass", stats: { maxHp: 19, maxMp: 7, attack: 9, defense: 12, mind: 9, agility: 8 }, captureRate: 0.55, skillId: "skill_scarloxy_leaf" },
  { key: "emberkit", name: "엠버킷", type: "fire", stats: { maxHp: 18, maxMp: 8, attack: 12, defense: 8, mind: 10, agility: 14 }, captureRate: 0.5, skillId: "skill_scarloxy_ember" },
  { key: "puddlup", name: "퍼들업", type: "water", stats: { maxHp: 20, maxMp: 8, attack: 9, defense: 10, mind: 12, agility: 10 }, captureRate: 0.55, skillId: "skill_scarloxy_splash" },
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
        ...(SCARLOXY_LEVELUP_MOVES[seed.key] ?? []),
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
  const map = createBlankMap("새싹 마을", 26, 18, OUTDOOR_TILESET_ID);
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
  // 몬스터 마을 부품: 집 앞 우체통, 광장 벤치·화단·가로등, 마을 남쪽 울타리(가운데 길목만 열어 둔다).
  setUpper(map, 4, 8, K.MAILBOX);
  setUpper(map, 21, 9, K.MAILBOX);
  stampUpper(map, 8, 11, K.BENCH);
  stampUpper(map, 14, 13, K.PLANTER);
  stampUpper(map, 10, 9, K.LAMP);
  stampUpper(map, 16, 9, K.LAMP);
  setUpper(map, 15, 16, K.SIGNPOST);
  fenceRow(map, 3, 11, 16);
  fenceRow(map, 16, 22, 16);

  map.events.push(
    professorEvent(),
    talker("ev_pkmn_healer", 11, 8, "치유사", [
      "연구소 앞이니 안심하세요. 상처를 치료해 드릴게요.",
    ], [{ kind: "recoverAll" }], castGraphic("nurse")),
    talker("ev_pkmn_guide", 16, 11, "금발 소년", [
      "남쪽 풀숲에는 야생 몬스터가 나와. 전투에서 '포획' 명령으로 구슬을 던져봐!",
      "몬스터의 HP를 깎을수록 잘 잡혀. 잡은 몬스터는 메뉴의 '몬스터'에서 볼 수 있어.",
      "파티에 넣은 몬스터는 전투 경험치를 나눠 받아서 레벨이 오르고, 7레벨이 되면 진화한대!",
    ], [], castGraphic("villagerA")),
    talker("ev_pkmn_merchant", 18, 6, "상인", [
      "포획 구슬이 떨어졌나? 여기 있어. 여행 필수품도 같이 둘게.",
    ], [
      {
        kind: "shop",
        itemIds: ["item_capture_orb", "item_potion", "item_hi_potion", "item_ether", "item_antidote", "item_wake_herb"],
        allowSell: false,
        quantityMode: "select",
        shopType: "normal",
        messageType: "welcome",
      },
    ], castGraphic("clerk")),
    transferEvent("ev_pkmn_to_route", 13, 17, ROUTE_MAP_ID, 15, 2, "초원 1번 길로"),
    talker("ev_pkmn_town_sign", 15, 16, "표지판", [
      "새싹 마을 — 새로운 모험이 싹트는 곳.",
      "남쪽: 초원 1번 길",
    ], [], { transparent: true }, { type: "fixed", speed: 3, frequency: 3 }),
    ...createTownDoorEvents(TOWN_DOORS),
    ...createTownDoorSigns(TOWN_DOORS),
  );
  return map;
}

function professorEvent(): GameEvent {
  const starters = [
    // starterId 는 라이벌 무리 분기용(PKMN_STARTER_VARIABLE: 1=불 스파르츄 2=물 핀스타 3=풀 라르베아).
    { key: "sparchu", name: "스파르츄", flavor: "불꽃을 문 장난꾸러기", starterId: 1 },
    { key: "finsta", name: "핀스타", flavor: "차분한 물고기", starterId: 2 },
    { key: "larvea", name: "라르베아", flavor: "씩씩한 풀 애벌레", starterId: 3 },
  ];
  return event("ev_pkmn_professor", 13, 8, [
    page("ev_pkmn_professor_choose", "박사", [
      ...castFace("professor"),
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
            { kind: "setVariable", variableId: PKMN_STARTER_VARIABLE, op: "=", value: starter.starterId },
            { kind: "setSwitch", switchId: PKMN_FLAGS.gotStarter, value: true },
            { kind: "text", speaker: "박사", body: `${starter.name}와 함께 여행을 시작하렴. 남쪽 풀숲에서 포획을 연습해 보고!` },
            { kind: "setSelfSwitch", key: "A", value: true },
          ],
        })),
        cancelBehavior: "disallow",
      },
    ], castGraphic("professor"), { type: "fixed", speed: 3, frequency: 3 }),
    page("ev_pkmn_professor_after", "박사", [
      ...castFace("professor"),
      { kind: "text", speaker: "박사", body: "몬스터들은 잘 크고 있니? 메뉴의 '몬스터'에서 파티를 확인해 보렴." },
      { kind: "text", speaker: "박사", body: "구슬이 부족하면 좀 더 가져가고." },
      { kind: "changeItem", itemId: CAPTURE_ORB_ITEM_ID, op: "+=", amount: 3 },
    ], castGraphic("professor"), { type: "fixed", speed: 3, frequency: 3 }, [
      { kind: "selfSwitch", key: "A", value: true },
    ]),
  ]);
}

function routeMap(): GameMap {
  const map = createBlankMap("초원 1번 길", 30, 24, OUTDOOR_TILESET_ID);
  map.id = ROUTE_MAP_ID;
  map.lowerTiles = new Array<number>(map.width * map.height).fill(G.GRASS);
  map.upperTiles = new Array<number>(map.width * map.height).fill(EMPTY);
  map.encounterRate = 5;
  map.troopIds = [...ROUTE_TROOPS];
  // 야생은 조우 풀숲 안에서만 나온다(맨 잔디·길은 안전) — 풀숲 사각형마다 같은 조우표를 건다.
  map.encounterTable = ROUTE_GRASS_PATCHES.flatMap((region) =>
    ROUTE_TROOPS.map((troopId) => ({ troopId, weight: 1, conditions: { region: { ...region } } })));

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
  // 턱: 기존 내리막 이벤트 칸(11~13, 15)에 풀밭 턱 그림을 깐다. 이벤트가 점프를 맡는다.
  LEDGE_TILES.forEach(([x, y], index) => setUpper(map, x, y, K.LEDGE[index % K.LEDGE.length]!));
  // 조우 풀숲 — 트리·바위가 있는 칸은 건너뛴다.
  for (const region of ROUTE_GRASS_PATCHES) tallGrass(map, region.x, region.y, region.w, region.h);
  // 길 가장자리 울타리와 동굴 입구(남서쪽). 동굴 안은 아직 없으므로 막힌 입구 안내만 둔다.
  fenceRow(map, 2, 7, 3);
  fenceRow(map, 22, 27, 3);
  stampUpper(map, 1, 11, K.CAVE);
  setUpper(map, 12, 3, K.SIGNPOST);
  setUpper(map, 18, 8, K.SHRUB);

  map.events.push(
    transferEvent("ev_pkmn_to_town", 15, 1, TOWN_MAP_ID, 13, 16, "새싹 마을로"),
    // 남쪽 끝 → 이끼 마을(scarloxyPokemonWorld.ts PKMN_LINKS 의 route1 출구).
    ...PKMN_LINKS.filter((link) => link.from === "route1").map((link, index) =>
      transferEvent(`ev_pkmn_route_exit_${index}`, link.x, link.y, PKMN_MAPS[link.to], link.toX, link.toY, link.name)),
    rivalEvent(),
    atroxEvent(),
    talker("ev_pkmn_route_sign", 12, 3, "표지판", [
      "초원 1번 길 — 풀숲에서는 야생 몬스터가 튀어나옵니다.",
      "남쪽 끝을 지나면 이끼 마을. 길목에서 이상한 울음소리가 들린다는 소문이 있다.",
      "아래로 난 단은 뛰어내릴 수 있지만, 다시 올라올 수는 없습니다.",
    ], [], { transparent: true }, { type: "fixed", speed: 3, frequency: 3 }),
    talker("ev_pkmn_cave_mouth", 3, 14, "동굴 입구", [
      "어두운 동굴이 입을 벌리고 있다. 안쪽에서 찬 바람이 불어온다.",
      "(아직 들어갈 수 없다.)",
    ], [], { transparent: true }, { type: "fixed", speed: 3, frequency: 3 }),
    ...LEDGE_TILES.map(([x, y], index) => ledgeEvent(`ev_pkmn_ledge_${index}`, x, y)),
  );
  return map;
}

/**
 * 내리막(ledge) 칸 — 루트 중단을 가로지르는 단. 위에서 밟으면 아래로 두 칸 뛰어내린다.
 * 아래에서 밟으면 다시 아래로 튕겨 나가므로 "올라올 수 없는 한 방향 지형"이 된다(포켓몬과 같은 동작).
 */
const LEDGE_TILES = [[11, 15], [12, 15], [13, 15]] as const;

const ROUTE_TROOPS = ["troop_pkmn_grass_a", "troop_pkmn_grass_b", "troop_pkmn_new_grass", "troop_pkmn_new_pair", "troop_pkmn_pond_pair", "troop_pkmn_shore", "troop_pkmn_dream", "troop_pkmn_sparchu", "troop_pkmn_pouch"] as const;

/** 조우 풀숲 사각형 — 길(15열 부근)을 비켜 좌우와 남쪽에 둔다. */
const ROUTE_GRASS_PATCHES = [
  { x: 3, y: 5, w: 8, h: 4 },
  { x: 18, y: 5, w: 7, h: 5 },
  { x: 6, y: 17, w: 8, h: 3 },
  { x: 16, y: 13, w: 5, h: 5 },
] as const;

/**
 * 밟으면 주인공을 아래로 두 칸 점프시키는 이벤트.
 *
 * 왜 moveEvent + PLAYER_MOVE_TARGET 인가: 점프는 MoveCommand(`kind:"jump"`)이고, 주인공 경로는
 * playSceneMovement.applyPlayerRouteCommand → startPlayerJump 가 처리한다. 점프는 통행 판정을
 * 건너뛰고 맵 경계만 보므로(RM2K3 규칙) 단 아래에 무엇이 있어도 착지한다.
 * 그래픽이 없는 투명 playerTouch 이벤트라 지형처럼 보인다.
 */
function ledgeEvent(id: string, x: number, y: number): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [{
      id: `${id}_page`,
      name: "내리막",
      conditions: [],
      graphic: { transparent: true },
      trigger: { kind: "playerTouch" },
      priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [
        {
          kind: "moveEvent",
          eventId: PLAYER_MOVE_TARGET,
          route: {
            moves: [{ kind: "jump", dx: 0, dy: 2, heightPx: 14, durationMs: 320 }],
            repeat: false,
            wait: true,
          },
        },
      ],
    }],
  } as GameEvent;
}

function rivalEvent(): GameEvent {
  return event("ev_pkmn_rival", 15, 12, [
    page("ev_pkmn_rival_battle", "라이벌", [
      ...castFace("rival"),
      { kind: "text", speaker: "라이벌", body: "오, 너도 박사님한테 몬스터 받았구나? 내 신드릴이랑 붙어보자!" },
      { kind: "battleProcessing", troopId: "troop_pkmn_rival", canEscape: false, canLose: false },
      { kind: "text", speaker: "라이벌", body: "졌다… 트레이너의 몬스터는 포획할 수 없다는 건 알아둬!" },
      { kind: "setSelfSwitch", key: "A", value: true },
    ], castGraphic("rival"), { type: "fixed", speed: 3, frequency: 3 }),
    page("ev_pkmn_rival_after", "라이벌", [
      ...castFace("rival"),
      { kind: "text", speaker: "라이벌", body: "남쪽 끝에 전설의 몬스터가 있다던데… 난 아직 무리야." },
    ], castGraphic("rival"), { type: "fixed", speed: 3, frequency: 3 }, [
      { kind: "selfSwitch", key: "A", value: true },
    ]),
  ]);
}

function atroxEvent(): GameEvent {
  // 남쪽 출구(15,23) 길목을 막지 않게 동남쪽 연못 아래로 비켜 둔다.
  return event("ev_pkmn_atrox", 24, 21, [
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
