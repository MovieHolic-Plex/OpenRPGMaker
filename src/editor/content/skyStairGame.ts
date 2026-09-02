// skyStairGame.ts — 《천공의 계단》: 비주얼 중심 중형 JRPG.
// 구성: 맵 7개 / 파티 4명 / NPC 30명 / 몬스터 25종 / 아이템 15종 / 퀘스트 5개 / 다수 전투.
//
// ── 설계 원칙: 비주얼이 먼저다 ────────────────────────────────────────────────
// 7개 맵은 "올라가는 순례" 한 줄로 이어지고, 각 층이 **눈으로 구분되는 고유 정체성**을 갖는다.
// 지역마다 다음 다섯 가지를 전부 다르게 준다 — 하나라도 겹치면 같은 곳처럼 보인다.
//   ① 지형 팔레트(타일 구성)  ② defaultLighting(주광 세기·색)  ③ 날씨(setWeather)
//   ④ battleBackground        ⑤ bgm
// 파티를 4명으로 두는 것도 비주얼 결정이다 — 사이드뷰 전투 스킨은 아군 스프라이트를
// 그리므로(showAllySprites) 1인 파티는 화면 절반이 빈다. 4명은 hero-01~04 로 전부 다르게 보인다.
//
// ── 참조 무결성 ──────────────────────────────────────────────────────────────
// 여기서 쓰는 모든 리소스 id 는 **디스크에 파일이 있는 것만** 골랐다(2026-07-27 실측).
// 특히 `battle-skin-vxace-backdrop` 은 id 는 등록돼 있지만
// public/assets/generated/battle-skins/ 에 vxace-backdrop.png 이 **없어서** 쓰지 않았다.
// 몬스터도 enemy_extra_* 재사용을 버렸다 — 그 레코드 다수가 monsterResourceId 로
// generated-enemy-slime-01 을 가리켜(리치·메두사·키메라·발키리…) 이름만 다르고 전부
// 슬라임으로 보인다. 비주얼 중심 게임에서는 치명적이라 25종을 **서로 다른 스프라이트**로
// 새로 정의했다(디스크의 138개 monster-*.png 중에서 골랐다).
import { PRODUCT_BRAND } from "@/brand";
import type { ActorParameterCurves, EnemyRecord, ItemRecord, Project, TroopRecord } from "@/project/types";
import { SCHEMA_VERSION } from "@/project/types";
import { dropCropsWithMissingItems, normalizeItemRecord } from "@/project/databaseRecordModel";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults/constants";
import {
  ACTOR_GUARDIAN_ID,
  ACTOR_MAGE_ID,
  ACTOR_SCOUT_ID,
  STARTER_ACTOR_IDS,
} from "@/project/defaults/defaultDatabaseRecordIds";
import { defaultAssetSet, defaultResourceProfiles, defaultTilesets } from "@/project/defaults/defaultAssets";
import { defaultDatabase, defaultSession, defaultSystem, defaultTerms, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { ensureSwitchVariableSlots } from "@/project/defaults/defaultProject";
import { polishMapTerrain } from "@/editor/tools/v3/terrainPolish";
import { skyStairMaps } from "@/editor/content/skyStairMaps";

export const SKY_TITLE = "천공의 계단";

export const SKY_MAP = {
  harbor: "map_sky_harbor",
  wheat: "map_sky_wheat",
  mistwood: "map_sky_mistwood",
  shrine: "map_sky_shrine",
  mine: "map_sky_mine",
  snowgate: "map_sky_snowgate",
  altar: "map_sky_altar",
} as const;

/** 지역별 BGM — 7층 전부 다른 곡이 아니라, 성격이 같은 층은 묶어 5곡으로 돌린다. */
export const SKY_BGM = {
  harbor: "cc0-bgm-town",
  wheat: "cc0-bgm-field",
  mistwood: "cc0-bgm-field",
  shrine: "cc0-bgm-inn",
  mine: "cc0-bgm-dungeon",
  snowgate: "cc0-bgm-dungeon",
  altar: "cc0-bgm-battle",
} as const;

/** 지역별 전투 배경 — 전부 디스크에 파일이 있는 id 다. 층이 바뀌면 전투 화면도 바뀐다. */
export const SKY_BATTLE_BG = {
  harbor: "easyrpg-backdrop-dawn1",
  wheat: "easyrpg-backdrop-sunset1",
  mistwood: "generated-battle-reference-forest",
  shrine: "easyrpg-backdrop-sky1",
  mine: "battle-skin-dragonquest-backdrop",
  snowgate: "easyrpg-backdrop-night-sky1",
  altar: "easyrpg-backdrop-cosmos1",
} as const;

export const SKY_SWITCH = {
  q1Started: "sw_sky_q1_started",
  q1Done: "sw_sky_q1_done",
  q2Started: "sw_sky_q2_started",
  q2Done: "sw_sky_q2_done",
  q3Started: "sw_sky_q3_started",
  q3Done: "sw_sky_q3_done",
  q4Started: "sw_sky_q4_started",
  q4Done: "sw_sky_q4_done",
  q5Started: "sw_sky_q5_started",
  q5Done: "sw_sky_q5_done",
  seal1: "sw_sky_seal_1",
  seal2: "sw_sky_seal_2",
  seal3: "sw_sky_seal_3",
  gateWheat: "sw_sky_gate_wheat",
  gateMist: "sw_sky_gate_mist",
  gateShrine: "sw_sky_gate_shrine",
  gateMine: "sw_sky_gate_mine",
  gateSnow: "sw_sky_gate_snow",
  gateAltar: "sw_sky_gate_altar",
} as const;

export const SKY_VARIABLE = {
  scarves: "var_sky_scarves",
  seals: "var_sky_seals",
} as const;

export const SKY_ITEM = {
  // 소비품 6종 — 기본 DB 의 회복약을 이어받고 나머지는 새로 만든다.
  potion: DEFAULT_ITEM_ID,
  hiPotion: "item_sky_hi_potion",
  ether: "item_sky_ether",
  antidote: "item_sky_antidote",
  feather: "item_sky_feather",
  bomb: "item_sky_bomb",
  // 퀘스트·열쇠 9종
  lampOil: "item_sky_lamp_oil",
  charm: "item_sky_charm",
  scarf: "item_sky_scarf",
  seal1: "item_sky_seal_1",
  seal2: "item_sky_seal_2",
  seal3: "item_sky_seal_3",
  snowPass: "item_sky_snow_pass",
  skyKey: "item_sky_key",
  starShard: "item_sky_star_shard",
} as const;

export const SKY_TROOP = {
  fieldPests: "troop_sky_field_pests",
  scarecrow: "troop_sky_scarecrow",
  mistThicket: "troop_sky_mist_thicket",
  carnivore: "troop_sky_carnivore",
  sealWater: "troop_sky_seal_water",
  sealStone: "troop_sky_seal_stone",
  sealStorm: "troop_sky_seal_storm",
  mineCrew: "troop_sky_mine_crew",
  snowPack: "troop_sky_snow_pack",
  skyWardens: "troop_sky_wardens",
  demonLord: "troop_sky_demon_lord",
} as const;

/**
 * 몬스터 25종. 층마다 4종 + 천공 5종(보스 포함).
 * `sprite` 는 public/assets/generated/starter/monster-<sprite>.png 에 실제로 있는 파일만 골랐고,
 * **25종이 서로 다른 스프라이트**다 — 이름만 다르고 같아 보이는 적을 만들지 않는다.
 *
 * 스탯 스케일 근거: 주인공 레벨1 이 HP 514 / 공 45 / 방 59 이고 데미지가
 * `power + stat/2 - def/2` 라, 적 공격력 80 이 대략 한 방 50 이다(잿불의 유산 실측 관례).
 * 층이 오를수록 공격력을 20 씩 올려 전투가 계속 3~8합에 머물게 한다.
 */
type EnemySpec = {
  readonly id: string;
  readonly name: string;
  readonly sprite: string;
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly agility: number;
  readonly mind?: number;
  readonly exp: number;
  readonly gold: number;
};

const SKY_ENEMY_SPECS: readonly EnemySpec[] = [
  // ── 2층 황금 밀밭 (첫 전투대) ─────────────────────────────────────────────
  { id: "enemy_sky_rat", name: "들쥐", sprite: "rat-giant", hp: 42, attack: 70, defense: 10, agility: 34, exp: 18, gold: 8 },
  { id: "enemy_sky_moth", name: "가루나방", sprite: "moth-dust", hp: 38, attack: 68, defense: 8, agility: 42, mind: 60, exp: 18, gold: 9 },
  { id: "enemy_sky_mantis", name: "낫사마귀", sprite: "mantis-01", hp: 52, attack: 78, defense: 14, agility: 38, exp: 24, gold: 12 },
  { id: "enemy_sky_scarecrow", name: "일어선 허수아비", sprite: "scarecrow-field", hp: 88, attack: 84, defense: 22, agility: 14, exp: 46, gold: 30 },
  // ── 3층 안개 숲 ──────────────────────────────────────────────────────────
  { id: "enemy_sky_leafling", name: "잎사귀 요정", sprite: "leafling-01", hp: 55, attack: 82, defense: 16, agility: 40, mind: 72, exp: 26, gold: 12 },
  { id: "enemy_sky_wisp", name: "도깨비불", sprite: "wisp-blue", hp: 46, attack: 86, defense: 10, agility: 52, mind: 92, exp: 30, gold: 14 },
  { id: "enemy_sky_spider", name: "굴거미", sprite: "spider-cave", hp: 64, attack: 88, defense: 20, agility: 36, exp: 32, gold: 15 },
  { id: "enemy_sky_carnivore", name: "식충화", sprite: "plant-carnivore", hp: 112, attack: 96, defense: 26, agility: 12, exp: 58, gold: 38 },
  // ── 4층 호수 신전 ────────────────────────────────────────────────────────
  { id: "enemy_sky_kappa", name: "물귀신", sprite: "kappa-01", hp: 72, attack: 94, defense: 24, agility: 34, exp: 36, gold: 18 },
  { id: "enemy_sky_crab", name: "바위게", sprite: "crab-rock", hp: 96, attack: 90, defense: 38, agility: 16, exp: 40, gold: 22 },
  { id: "enemy_sky_eel", name: "번개장어", sprite: "eel-electric", hp: 68, attack: 104, defense: 18, agility: 54, mind: 96, exp: 44, gold: 20 },
  { id: "enemy_sky_undine", name: "운디네", sprite: "undine-sea", hp: 120, attack: 100, defense: 28, agility: 38, mind: 110, exp: 62, gold: 40 },
  // ── 5층 잊힌 폐광 ────────────────────────────────────────────────────────
  { id: "enemy_sky_kobold", name: "굴 코볼트", sprite: "kobold-digger", hp: 84, attack: 106, defense: 26, agility: 40, exp: 46, gold: 24 },
  { id: "enemy_sky_ooze", name: "검은 우즈", sprite: "ooze-black", hp: 110, attack: 102, defense: 34, agility: 12, exp: 50, gold: 26 },
  { id: "enemy_sky_archer", name: "해골 궁수", sprite: "skeleton-archer", hp: 78, attack: 116, defense: 22, agility: 46, exp: 54, gold: 28 },
  { id: "enemy_sky_mimic", name: "미믹", sprite: "mimic-chest", hp: 140, attack: 112, defense: 44, agility: 20, exp: 74, gold: 90 },
  // ── 6층 설산 관문 ────────────────────────────────────────────────────────
  { id: "enemy_sky_goat", name: "설산 산양", sprite: "goat-mountain", hp: 104, attack: 118, defense: 32, agility: 44, exp: 58, gold: 30 },
  { id: "enemy_sky_direwolf", name: "눈이리", sprite: "wolf-dire", hp: 118, attack: 126, defense: 30, agility: 56, exp: 66, gold: 34 },
  { id: "enemy_sky_harpy", name: "절벽 하피", sprite: "harpy-cliff", hp: 96, attack: 122, defense: 26, agility: 62, mind: 100, exp: 64, gold: 32 },
  { id: "enemy_sky_crystal", name: "결정 골렘", sprite: "golem-crystal", hp: 190, attack: 130, defense: 52, agility: 14, exp: 96, gold: 60 },
  // ── 7층 천공 제단 ────────────────────────────────────────────────────────
  { id: "enemy_sky_griffin", name: "그리핀", sprite: "griffin-sky", hp: 150, attack: 138, defense: 38, agility: 58, exp: 88, gold: 44 },
  { id: "enemy_sky_wyvern", name: "와이번", sprite: "wyvern-cliff", hp: 168, attack: 144, defense: 40, agility: 52, exp: 96, gold: 48 },
  { id: "enemy_sky_phoenix", name: "불사조", sprite: "phoenix-rebirth", hp: 176, attack: 148, defense: 36, agility: 60, mind: 130, exp: 104, gold: 52 },
  { id: "enemy_sky_knight", name: "타락한 기사", sprite: "knight-fallen", hp: 210, attack: 152, defense: 56, agility: 34, exp: 118, gold: 66 },
  { id: "enemy_sky_demon", name: "계단의 주인", sprite: "demon-lord", hp: 340, attack: 176, defense: 48, agility: 46, mind: 140, exp: 220, gold: 200 },
];

export const SKY_ENEMY_IDS = SKY_ENEMY_SPECS.map((spec) => spec.id);

/**
 * 성장 곡선 — 실제로 도달 가능한지 역산해서 정했다.
 * 이 게임에서 고정 전투로 얻는 경험치 총합은 SKY_TROOP 전부를 합쳐 약 1,900 이다
 * (test/skyStairGame.test.ts 가 이 값을 실제로 더해서 레벨 도달을 검증한다).
 * `{ base: 8, extra: 12, acceleration: 3 }` 이면 누적 요구량이 L2=20 · L5=180 · L10=760 쯤이라
 * 순례를 마칠 때 파티가 L10 부근에 선다 — 층마다 레벨업이 한 번씩 체감된다.
 * (기본 expCurve 는 L2 에 678 을 요구해서 레벨 2 자체가 불가능했다 — 그 함정을 피한 값이다.)
 */
const SKY_EXP_CURVE = { base: 8, extra: 12, acceleration: 3 } as const;

/** 층마다 성장이 보이도록 레벨당 선형 증가를 덮는다. 배열 길이(최대 레벨)는 유지한다. */
function skyPartyCurves(base: ActorParameterCurves, role: "lead" | "guard" | "mage" | "scout"): ActorParameterCurves {
  const ramp = (start: number, perLevel: number): number[] =>
    base.maxHp.map((_value, index) => start + Math.round(index * perLevel));
  const shape = {
    lead: { hp: 30, mp: 4, atk: 6, def: 3, mind: 3, agi: 3 },
    guard: { hp: 42, mp: 2, atk: 5, def: 5, mind: 2, agi: 2 },
    mage: { hp: 18, mp: 8, atk: 3, def: 2, mind: 7, agi: 3 },
    scout: { hp: 24, mp: 3, atk: 5, def: 2, mind: 3, agi: 6 },
  }[role];
  return {
    maxHp: ramp(base.maxHp[0] ?? 514, shape.hp),
    maxMp: ramp(base.maxMp[0] ?? 43, shape.mp),
    attack: ramp(base.attack[0] ?? 45, shape.atk),
    defense: ramp(base.defense[0] ?? 59, shape.def),
    mind: ramp(base.mind[0] ?? 45, shape.mind),
    agility: ramp(base.agility[0] ?? 43, shape.agi),
  };
}

/** 파티 4명 — 이름은 순례 서사에 맞춰 바꾸고 성장 성격을 역할별로 가른다. */
const SKY_PARTY: readonly { readonly id: string; readonly name: string; readonly nickname: string; readonly role: "lead" | "guard" | "mage" | "scout" }[] = [
  { id: DEFAULT_ACTOR_ID, name: "리안", nickname: "등대의 아이", role: "lead" },
  { id: ACTOR_GUARDIAN_ID, name: "보름", nickname: "방파제", role: "guard" },
  { id: ACTOR_MAGE_ID, name: "세이", nickname: "물결 읽는 이", role: "mage" },
  { id: ACTOR_SCOUT_ID, name: "노아", nickname: "바람잡이", role: "scout" },
];

export function createSkyStairProject(): Project {
  const maps = skyStairMaps();
  const database = skyDatabase();

  const session = defaultSession();
  session.partyActorIds = [...STARTER_ACTOR_IDS];
  session.inventory = { [SKY_ITEM.potion]: 3, [SKY_ITEM.ether]: 1 };
  session.gold = 240;

  const system = defaultSystem();
  system.startActorIds = [...STARTER_ACTOR_IDS];
  system.initialTroopId = SKY_TROOP.fieldPests;
  // 출하 콘텐츠는 지원하는 두 스킨(rm2000 / pokemon)만 저작한다. ff는 지원 종료됐지만 기존 저장 프로젝트에서는 계속 로드된다.
  system.battleUiStyle = "rm2000";
  system.battleBgmResourceId = "cc0-bgm-battle";
  system.defaultBgmResourceId = SKY_BGM.harbor;
  system.titleScreen = {
    ...(system.titleScreen ?? defaultTitleScreenSettings()),
    title: SKY_TITLE,
    menuLabels: { newGame: "계단을 오른다", continueGame: "이어 오르기", quit: "내려가기" },
  };

  const project: Project = {
    version: SCHEMA_VERSION,
    meta: { title: SKY_TITLE, author: PRODUCT_BRAND, terms: defaultTerms() },
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
    // 순례는 한 줄로 올라간다 — 트리도 그 순서대로 중첩해서 맵 목록만 봐도 진행이 읽힌다.
    mapTree: {
      mapId: SKY_MAP.harbor,
      children: [
        {
          mapId: SKY_MAP.wheat,
          children: [
            {
              mapId: SKY_MAP.mistwood,
              children: [
                {
                  mapId: SKY_MAP.shrine,
                  children: [
                    {
                      mapId: SKY_MAP.mine,
                      children: [{ mapId: SKY_MAP.snowgate, children: [{ mapId: SKY_MAP.altar, children: [] }] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    startMapId: SKY_MAP.harbor,
    startPos: { x: 15, y: 19 },
    flags: {},
  };

  // ── 지형 경계 다듬기 ────────────────────────────────────────────────────
  // 모래·흙길·석축은 **저장 시점** 오토타일이다(물/호수만 렌더 시점 쿼터 합성). 즉 rect 로
  // 각지게 깔아 두면 렌더가 고쳐 주지 않고 계단식 직각 그대로 화면에 나온다.
  // 처음엔 이 호출이 없어서 7층 전부가 딱딱한 직사각형 덩어리였다 — 실측 2,676칸이 미성형.
  // (polishMapTerrain 은 이 저장소에 이미 있었는데 쓰는 곳이 없었다.)
  for (const map of Object.values(project.maps)) {
    polishMapTerrain(map, project.tilesets[map.tilesetId]);
  }

  nameSwitch(project, SKY_SWITCH.q1Started, "Q1 등대의 불씨 시작");
  nameSwitch(project, SKY_SWITCH.q1Done, "Q1 등대의 불씨 완료");
  nameSwitch(project, SKY_SWITCH.q2Started, "Q2 밀밭의 허수아비 시작");
  nameSwitch(project, SKY_SWITCH.q2Done, "Q2 밀밭의 허수아비 완료");
  nameSwitch(project, SKY_SWITCH.q3Started, "Q3 안개 속의 아이 시작");
  nameSwitch(project, SKY_SWITCH.q3Done, "Q3 안개 속의 아이 완료");
  nameSwitch(project, SKY_SWITCH.q4Started, "Q4 세 개의 봉인 시작");
  nameSwitch(project, SKY_SWITCH.q4Done, "Q4 세 개의 봉인 완료");
  nameSwitch(project, SKY_SWITCH.q5Started, "Q5 천공의 계단 시작");
  nameSwitch(project, SKY_SWITCH.q5Done, "Q5 천공의 계단 완료");
  nameSwitch(project, SKY_SWITCH.seal1, "봉인1 물의 방 해제");
  nameSwitch(project, SKY_SWITCH.seal2, "봉인2 돌의 방 해제");
  nameSwitch(project, SKY_SWITCH.seal3, "봉인3 바람의 방 해제");
  nameSwitch(project, SKY_SWITCH.gateWheat, "개방 황금 밀밭");
  nameSwitch(project, SKY_SWITCH.gateMist, "개방 안개 숲");
  nameSwitch(project, SKY_SWITCH.gateShrine, "개방 호수 신전");
  nameSwitch(project, SKY_SWITCH.gateMine, "개방 잊힌 폐광");
  nameSwitch(project, SKY_SWITCH.gateSnow, "개방 설산 관문");
  nameSwitch(project, SKY_SWITCH.gateAltar, "개방 천공 제단");
  nameVariable(project, SKY_VARIABLE.scarves, "찾은 목도리 단서");
  nameVariable(project, SKY_VARIABLE.seals, "모은 봉인석");
  ensureSwitchVariableSlots(project);
  return project;
}

// ── 데이터베이스 ─────────────────────────────────────────────────────────────
function skyDatabase(): Project["database"] {
  const db = defaultDatabase();

  db.enemies = SKY_ENEMY_SPECS.map((spec) => skyEnemy(spec));
  db.troops = skyTroops();
  db.items = skyItems(db.items);
  // 좁힌 아이템 목록에 없는 씨앗·수확물을 참조하는 작물 행을 함께 걷어낸다.
  dropCropsWithMissingItems(db);

  // 파티 4명만 남기고 이름·성장 곡선을 이 게임 것으로 덮는다.
  const partyById = new Map(SKY_PARTY.map((member) => [member.id, member]));
  db.actors = db.actors
    .filter((actor) => partyById.has(actor.id))
    .map((actor) => {
      const member = partyById.get(actor.id);
      if (!member) return actor;
      return {
        ...actor,
        name: member.name,
        nickname: member.nickname,
        expCurve: SKY_EXP_CURVE,
        parameterCurves: skyPartyCurves(actor.parameterCurves, member.role),
      };
    });

  // 액터를 지웠으면 **액터를 가리키는 목록도 같이 좁혀야 한다.**
  // 안 하면 클래스·장비·아이템의 권한 목록에 남은 actor_cleric / actor_ranger 때문에
  // projectLint 가 reference-validation error 를 194건 낸다(2026-07-27 실측). 참조 검증은
  // 역직렬화에서 throw 로 이어지므로, 이건 경고가 아니라 프로젝트가 안 열리는 결함이다.
  const keptActorIds = new Set(db.actors.map((actor) => actor.id));
  const keptClassIds = new Set(db.actors.map((actor) => actor.classId));
  db.classes = db.classes
    .filter((cls) => keptClassIds.has(cls.id))
    .map((cls) => ({
      ...cls,
      equipmentPermissions: {
        ...cls.equipmentPermissions,
        actorIds: cls.equipmentPermissions.actorIds.filter((id) => keptActorIds.has(id)),
        classIds: cls.equipmentPermissions.classIds.filter((id) => keptClassIds.has(id)),
      },
    }));
  db.equipment = db.equipment.map((equip) => ({
    ...equip,
    equippableActorIds: equip.equippableActorIds.filter((id) => keptActorIds.has(id)),
    equippableClassIds: equip.equippableClassIds.filter((id) => keptClassIds.has(id)),
  }));
  db.items = db.items.map((item) => ({
    ...item,
    usableActorIds: item.usableActorIds.filter((id) => keptActorIds.has(id)),
    usableClassIds: item.usableClassIds.filter((id) => keptClassIds.has(id)),
    equipmentProfile: {
      ...item.equipmentProfile,
      equippableActorIds: item.equipmentProfile.equippableActorIds.filter((id) => keptActorIds.has(id)),
      equippableClassIds: item.equipmentProfile.equippableClassIds.filter((id) => keptClassIds.has(id)),
    },
  }));
  return db;
}

function skyEnemy(spec: EnemySpec): EnemyRecord {
  return normalizeEnemyRecord({
    id: spec.id,
    name: spec.name,
    monsterResourceId: `generated-enemy-${spec.sprite}`,
    stats: {
      maxHp: spec.hp,
      maxMp: 20,
      attack: spec.attack,
      defense: spec.defense,
      mind: spec.mind ?? 60,
      agility: spec.agility,
    },
    rewards: { exp: spec.exp, gold: spec.gold, dropRatePercent: 15 },
    actions: [{ skillId: "skill_attack", priority: 5, condition: { kind: "always" } }],
  });
}

/**
 * 전투 그룹 11개. 다수 전투가 기본이다 — 11개 중 9개가 3명 이상이고 단독은 보스 하나뿐이다.
 *
 * members 좌표를 손으로 찍지 않는 이유: 엔진은 members 가 없으면 좌안 고전 진형
 * (x = 84 + (i%2)*44, y = 52 + i*36)으로 배치하고 x > 150 인 좌표는 다시 끌어온다
 * (battleBattlers.ts:238-259). 좌표를 직접 주면 그 규칙과 어긋나기만 한다.
 */
function skyTroops(): TroopRecord[] {
  const troop = (id: string, name: string, enemyIds: readonly string[], backdrop: string): TroopRecord =>
    normalizeTroopRecord({
      id,
      name,
      enemyIds: [...enemyIds],
      autoAlign: true,
      previewBackgroundResourceId: backdrop,
      battleEventPages: [],
    });
  return [
    troop(SKY_TROOP.fieldPests, "밀밭의 해충", ["enemy_sky_rat", "enemy_sky_moth", "enemy_sky_rat"], SKY_BATTLE_BG.wheat),
    troop(SKY_TROOP.scarecrow, "일어선 허수아비", ["enemy_sky_mantis", "enemy_sky_scarecrow", "enemy_sky_mantis"], SKY_BATTLE_BG.wheat),
    troop(SKY_TROOP.mistThicket, "안개 수풀", ["enemy_sky_leafling", "enemy_sky_wisp", "enemy_sky_leafling", "enemy_sky_spider"], SKY_BATTLE_BG.mistwood),
    troop(SKY_TROOP.carnivore, "식충화 군락", ["enemy_sky_spider", "enemy_sky_carnivore", "enemy_sky_spider"], SKY_BATTLE_BG.mistwood),
    troop(SKY_TROOP.sealWater, "물의 방 수호자", ["enemy_sky_kappa", "enemy_sky_eel", "enemy_sky_kappa"], SKY_BATTLE_BG.shrine),
    troop(SKY_TROOP.sealStone, "돌의 방 수호자", ["enemy_sky_crab", "enemy_sky_crab", "enemy_sky_kappa"], SKY_BATTLE_BG.shrine),
    troop(SKY_TROOP.sealStorm, "바람의 방 수호자", ["enemy_sky_eel", "enemy_sky_undine", "enemy_sky_eel"], SKY_BATTLE_BG.shrine),
    troop(SKY_TROOP.mineCrew, "폐광의 잔당", ["enemy_sky_kobold", "enemy_sky_archer", "enemy_sky_ooze", "enemy_sky_kobold"], SKY_BATTLE_BG.mine),
    troop(SKY_TROOP.snowPack, "설산 무리", ["enemy_sky_direwolf", "enemy_sky_goat", "enemy_sky_harpy", "enemy_sky_direwolf"], SKY_BATTLE_BG.snowgate),
    troop(SKY_TROOP.skyWardens, "제단의 파수꾼", ["enemy_sky_griffin", "enemy_sky_knight", "enemy_sky_wyvern"], SKY_BATTLE_BG.altar),
    // 최종 보스는 단독 — 호위를 붙이면 canLose=false 결전이 과해진다.
    troop(SKY_TROOP.demonLord, "계단의 주인", ["enemy_sky_demon"], SKY_BATTLE_BG.altar),
  ];
}

/** 아이템 15종 = 소비품 6 + 퀘스트·열쇠 9. 기본 회복약(DEFAULT_ITEM_ID)만 물려받는다. */
function skyItems(base: readonly ItemRecord[]): ItemRecord[] {
  const potion = base.find((item) => item.id === SKY_ITEM.potion);
  const consumable = (
    id: string,
    name: string,
    price: number,
    description: string,
    icon: string,
    scope: ItemRecord["scope"] = "ally"
  ): ItemRecord =>
    normalizeItemRecord({
      id,
      name,
      scope,
      price,
      description,
      imageResourceId: icon,
      iconResourceId: icon,
      type: "medicine",
      occasion: "always",
      consumable: true,
    });
  const keyItem = (id: string, name: string, description: string, icon: string): ItemRecord =>
    normalizeItemRecord({
      id,
      name,
      scope: "none",
      price: 0,
      description,
      imageResourceId: icon,
      iconResourceId: icon,
      type: "normalGoods",
      occasion: "never",
      consumable: false,
    });

  return [
    ...(potion ? [potion] : []),
    consumable(SKY_ITEM.hiPotion, "상급 회복약", 120, "깊은 상처까지 덮는 진한 약. 폐광 아래에서는 이것 없이 못 간다.", "cc0-jetrel-potion-red"),
    consumable(SKY_ITEM.ether, "에테르", 150, "마력을 되돌리는 맑은 물. 세이가 늘 아까워한다.", "cc0-jetrel-ether-blue"),
    consumable(SKY_ITEM.antidote, "해독초", 40, "쓴 잎을 씹으면 독이 풀린다. 안개 숲에서 꼭 챙길 것.", "cc0-jetrel-antidote-green"),
    consumable(SKY_ITEM.feather, "되살림의 깃털", 300, "쓰러진 동료를 한 번 일으켜 세우는 흰 깃털.", "cc0-jetrel-gen-revive-feather"),
    consumable(SKY_ITEM.bomb, "폭탄", 90, "던지면 앞줄을 한꺼번에 흔든다. 다수전에서 값을 한다.", "cc0-jetrel-bomb", "enemy"),
    keyItem(SKY_ITEM.lampOil, "등대 기름", "굳지 않는 고래 기름 한 통. 등대지기 마루가 기다린다.", "cc0-jetrel-gen-lamp-oil"),
    keyItem(SKY_ITEM.charm, "허수아비 부적", "밀밭 허수아비 가슴에 박혀 있던 낡은 부적. 무언가를 붙들고 있었다.", "cc0-jetrel-badge"),
    keyItem(SKY_ITEM.scarf, "아이의 목도리", "안개 숲에서 찾은 작은 목도리. 아직 따뜻하다.", "cc0-jetrel-cloak"),
    keyItem(SKY_ITEM.seal1, "물의 봉인석", "호수 신전 첫 방의 봉인석. 손에 쥐면 파도 소리가 난다.", "cc0-jetrel-crystal"),
    keyItem(SKY_ITEM.seal2, "돌의 봉인석", "호수 신전 둘째 방의 봉인석. 묵직하게 가라앉는다.", "cc0-jetrel-earth-ore"),
    keyItem(SKY_ITEM.seal3, "바람의 봉인석", "호수 신전 셋째 방의 봉인석. 쥐면 손바닥이 서늘하다.", "cc0-jetrel-crystal"),
    keyItem(SKY_ITEM.snowPass, "설산 통행증", "관문 지기만 알아보는 각인이 찍힌 목패.", "cc0-jetrel-badge"),
    keyItem(SKY_ITEM.skyKey, "천공의 열쇠", "세 봉인석이 하나로 맞물려 만들어진 열쇠. 위쪽에서 바람이 인다.", "cc0-jetrel-compass"),
    keyItem(SKY_ITEM.starShard, "별빛 조각", "계단 맨 위에서 떨어진 빛. 등대에 넣으면 꺼지지 않는다.", "cc0-jetrel-crystal"),
  ];
}

// ── 스위치·변수 등록 헬퍼 ────────────────────────────────────────────────────
function nameSwitch(project: Project, id: string, name: string): void {
  const record = project.switches.find((entry) => entry.id === id);
  if (record) record.name = name;
  else project.switches.push({ id, name });
  project.session.switches[id] ??= false;
}

function nameVariable(project: Project, id: string, name: string): void {
  const record = project.variables.find((entry) => entry.id === id);
  if (record) record.name = name;
  else project.variables.push({ id, name });
  project.session.variables[id] ??= 0;
}
