// 완주 가능한 소형 RPG 한 편을 저작한다 — 마을 → 폐허(액션 전투) → 보스방(턴제) → 엔딩.
//
// "완주" 의 정의: 엔딩 화면([data-testid=ending-screen])이 뜨는 것.
// 그 경로가 실제로 걸어서 도달 가능한지는 빌드 끝의 통행성/참조 검증과
// test/e2e/_quest-playthrough.spec.ts 가 확인한다.
//
// 사용:
//   npx tsx scripts/build-quest-demo.mts            # 로컬 검증만
//   npx tsx scripts/build-quest-demo.mts --push     # Supabase 저장 + 재로드 검증
import { writeFileSync } from "node:fs";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { isSolidChipsetTile } from "@/project/defaults/chipsetMapping";
import { normalizeEnemyRecord } from "@/project/databaseRecordModel";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { sha256HexText } from "@/util/sha256";
import type {
  Command,
  EventPage,
  EventPageCondition,
  EventPageGraphic,
  FieldSpawnDef,
  GameEvent,
  GameMap,
  Project,
} from "@/project/types";

const PROJECT_ID = "rpg-zzu-quest-demo";
const TITLE = "잊혀진 폐허";

const MAP_VILLAGE = "map_quest_village";
const MAP_RUINS = "map_quest_ruins";
const MAP_BOSS = "map_quest_boss";

// 보스 트룹 — 기본 DB 에는 슬라임/박쥐 트룹만 있어서, 그걸 쓰면 "봉인된 것" 이
// 잡몹 두 마리가 된다(적대적 플레이어가 가장 먼저 비웃는 지점). 전용 트룹을 만든다.
// 구성원은 주인공 실측 위력(HP 514, 한 방 약 59 피해)에 맞춰 고른다 —
// 방어 130대 최상위 보스는 피해가 바닥나 이길 수 없다.
const TROOP_BOSS = "troop_quest_sealed";
const BOSS_LEAD = "enemy_quest_sealed_one";
const BOSS_MINION = "enemy_quest_bone_thrall";

// 데미지 공식(battleDamage.ts): 피해 = 위력 − floor(대상 방어/2), 0 이하는 0.
// 실측: 주인공 L1 은 HP 514 · 방어 72 · 위력 약 61(슬라임에 59 피해).
//   → 방어 72 면 들어오는 피해에서 36 이 깎인다. DB 의 중간 티어(공격 33~68)는
//     0~32 밖에 안 들어가고, 어둠 망령(공격 33)은 **21턴 동안 1 도 못 깎았다**(실측).
//   → 최상위 보스(방어 138~156)는 반대로 주인공 피해가 바닥나 잡을 수 없다.
// 그래서 이 게임의 보스만 공식에 맞춰 직접 잡는다:
//   공격 96 → 주인공에게 약 60 피해(≈9턴 버팀), 방어 30 → 주인공이 약 46 피해(HP320 을 7방).
const BOSS_STATS = { maxHp: 320, maxMp: 20, attack: 96, defense: 30, mind: 40, agility: 24 } as const;
const MINION_STATS = { maxHp: 120, maxMp: 10, attack: 78, defense: 22, mind: 20, agility: 18 } as const;

const SW_KEY = "sw_quest_key";
const SW_RUINS_CLEARED = "sw_quest_ruins_cleared";
const SW_BOSS_DOWN = "sw_quest_boss_down";

// 통행성은 눈으로 믿지 않는다 — 빌드 끝 검증이 실제로 확인한다.
const T = {
  grass: 240,
  tallGrass: 243,
  road: 421,
  cobble: 190,
  stone: 129,
  wall: 366,
  water: 120,
} as const;

function charsetGraphic(textureKey: string, characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: textureKey },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

const GFX_SIGN = charsetGraphic("tex_easyrpg_charset_object2", 3);
const GFX_CHEST = charsetGraphic("tex_easyrpg_charset_object1", 6);
const GFX_DOOR = charsetGraphic("tex_easyrpg_charset_object1", 3);
const GFX_ELDER = charsetGraphic("tex_easyrpg_charset_people1", 0);
const GFX_GUARD = charsetGraphic("tex_easyrpg_charset_people3", 5);
const GFX_SLIME = charsetGraphic("tex_easyrpg_charset_monster1", 0);
const GFX_BAT = charsetGraphic("tex_easyrpg_charset_monster3", 0);
const GFX_BOSS = charsetGraphic("tex_easyrpg_charset_monster2", 1);

function say(speaker: string, body: string): Command {
  return { kind: "text", speaker, body };
}
function narrate(body: string): Command {
  // speaker: "" 를 넘기면 이름표 자리만 빈 채로 남는다 — 아예 생략한다.
  return { kind: "text", body };
}

function event(id: string, x: number, y: number, pages: EventPage[]): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages };
}

function page(
  id: string,
  name: string,
  graphic: EventPageGraphic,
  conditions: EventPageCondition[],
  commands: Command[],
  trigger: EventPage["trigger"]["kind"] = "action"
): EventPage {
  return {
    id,
    name,
    conditions,
    graphic,
    trigger: { kind: trigger },
    priority: "same",
    overlapForbidden: true,
    animationType: "normal",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function painter(map: GameMap) {
  const set = (x: number, y: number, tile: number): void => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    map.lowerTiles[y * map.width + x] = tile;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, tile: number): void => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) set(x, y, tile);
  };
  const border = (tile: number): void => {
    fill(0, 0, map.width - 1, 0, tile);
    fill(0, map.height - 1, map.width - 1, map.height - 1, tile);
    fill(0, 0, 0, map.height - 1, tile);
    fill(map.width - 1, 0, map.width - 1, map.height - 1, tile);
  };
  return { set, fill, border };
}

// ── 마을 ────────────────────────────────────────────────────────────────────
function buildVillage(): GameMap {
  const map = createBlankMap("이스트 마을", 20, 15);
  map.id = MAP_VILLAGE;
  const { set, fill, border } = painter(map);
  fill(0, 0, 19, 14, T.grass);
  border(T.wall);
  // 십자 흙길 — 북쪽 끝이 폐허 출구다.
  fill(9, 1, 10, 13, T.road);
  fill(1, 7, 18, 8, T.road);
  // 집 세 채(통행 불가 덩어리) + 앞마당 돌바닥
  fill(3, 3, 6, 5, T.wall);
  fill(3, 6, 6, 6, T.stone);
  fill(13, 3, 16, 5, T.wall);
  fill(13, 6, 16, 6, T.stone);
  fill(3, 10, 6, 12, T.wall);
  fill(3, 9, 6, 9, T.stone);
  // 우물 주변 돌바닥
  fill(13, 10, 15, 12, T.cobble);
  // 마을 남쪽 연못
  fill(16, 10, 17, 12, T.water);

  map.events = [
    event("ev_q_sign", 11, 8, [
      page("ev_q_sign_p", "안내판", GFX_SIGN, [], [
        say("안내판", "이스트 마을. 북쪽 길은 잊혀진 폐허로 이어진다."),
        say("안내판", "이동: 방향키 / 조사·대화: Z 또는 Enter / 메뉴: X"),
        say("안내판", "폐허에서는 적이 필드에서 바로 덤빈다. 공격은 Z."),
      ]),
    ]),
    event("ev_q_elder", 8, 6, [
      page("ev_q_elder_p1", "촌장", GFX_ELDER, [], [
        say("촌장", "북쪽 폐허에서 이상한 울음소리가 들린다네."),
        say("촌장", "안쪽 문은 잠겨 있어. 열쇠는 폐허 어딘가에 있을 게야."),
        say("촌장", "이걸 가져가게. 몸조심하고."),
        { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 3 },
        narrate("회복약 3개를 받았다."),
        { kind: "setSelfSwitch", key: "A", value: true },
      ]),
      page("ev_q_elder_p2", "촌장(이후)", GFX_ELDER, [{ kind: "selfSwitch", key: "A", value: true }], [
        say("촌장", "우물물을 마시면 기운이 돌아올 거야."),
        say("촌장", "북쪽이야. 조심하게."),
      ]),
    ]),
    // 상인 — 상자에서 얻은 골드를 쓸 곳이 있어야 한다. 없으면 골드가 장식이다.
    event("ev_q_merchant", 14, 6, [
      page("ev_q_merchant_p", "행상인", GFX_GUARD, [], [
        say("행상인", "폐허로 간다고? 약이라도 챙겨 가시지."),
        {
          kind: "shop",
          itemIds: ["item_potion", "item_hi_potion", "item_antidote"],
          allowSell: true,
          quantityMode: "select",
        },
        say("행상인", "살아서 돌아오시오."),
      ]),
    ]),
    // 집 문 — 들어갈 수 없는 벽 덩어리를 말없이 세워두면 "이건 왜 있냐" 가 된다.
    // 최소한 반응은 해야 한다. 다만 이벤트는 **집 벽 타일**에 붙인다:
    // 걸어다닐 수 있는 앞마당에 두면 overlapForbidden 때문에 투명한 벽이 생겨
    // 앞마당을 지나갈 수 없게 된다(실측: y=6 줄이 막혔다).
    event("ev_q_house_a", 4, 5, [
      page("ev_q_house_a_p", "집 문", { transparent: true }, [], [
        narrate("문이 잠겨 있다. 주민은 폐허 소동이 가라앉기를 기다리는 듯하다."),
      ]),
    ]),
    event("ev_q_house_b", 15, 5, [
      page("ev_q_house_b_p", "집 문", { transparent: true }, [], [
        narrate("안에서 인기척이 없다."),
      ]),
    ]),
    event("ev_q_house_c", 4, 10, [
      page("ev_q_house_c_p", "창고 문", { transparent: true }, [], [
        narrate("창고다. 자물쇠가 단단히 걸려 있다."),
      ]),
    ]),
    event("ev_q_well", 14, 11, [
      page("ev_q_well_p", "우물", GFX_SIGN, [], [
        narrate("우물물을 마셨다. 몸이 가벼워졌다."),
        { kind: "recoverAll" },
      ]),
    ]),
    // 북쪽 출구 — 밟으면 폐허로. playerTouch 라 대화 없이 넘어간다.
    event("ev_q_to_ruins", 9, 1, [
      page("ev_q_to_ruins_p", "폐허 입구", { transparent: true }, [], [
        { kind: "transfer", mapId: MAP_RUINS, x: 10, y: 12, direction: "up" },
      ], "playerTouch"),
    ]),
    event("ev_q_to_ruins_b", 10, 1, [
      page("ev_q_to_ruins_b_p", "폐허 입구", { transparent: true }, [], [
        { kind: "transfer", mapId: MAP_RUINS, x: 10, y: 12, direction: "up" },
      ], "playerTouch"),
    ]),
  ];
  return map;
}

// ── 폐허(액션 전투) ─────────────────────────────────────────────────────────
function buildRuins(): GameMap {
  const map = createBlankMap("잊혀진 폐허", 20, 15);
  map.id = MAP_RUINS;
  map.actionCombat = true;
  const { set, fill, border } = painter(map);
  fill(0, 0, 19, 14, T.cobble);
  border(T.wall);
  // 부서진 기둥들 — 엄폐물이자 회피 지형
  for (const [cx, cy] of [[4, 4], [7, 3], [13, 4], [16, 3], [5, 9], [15, 9]] as const) {
    fill(cx, cy, cx + 1, cy + 1, T.wall);
  }
  // 이끼 낀 구역(적 서식지 표시)
  fill(2, 2, 8, 6, T.tallGrass);
  fill(12, 2, 18, 6, T.stone);
  // 중앙 통로
  fill(1, 7, 18, 8, T.road);
  // 남쪽 입구 복도(마을로 되돌아가는 길)
  fill(9, 9, 10, 13, T.road);
  // 봉인문 방 — 북쪽 중앙.
  fill(8, 1, 12, 1, T.wall);
  fill(8, 1, 8, 3, T.wall);
  fill(12, 1, 12, 3, T.wall);
  fill(9, 2, 11, 3, T.cobble);
  // 입구는 **문이 서 있는 한 칸(10,4)뿐**이어야 한다. 세 칸으로 열어두면
  // "잠긴 문" 옆으로 그냥 걸어 들어갈 수 있어 봉인이 아무것도 막지 못한다(실측).
  fill(9, 4, 11, 4, T.wall);
  set(10, 4, T.road);

  const spawns: FieldSpawnDef[] = [
    {
      id: "spawn_q_slimes",
      troopId: "troop_slime",
      graphic: GFX_SLIME,
      area: { x: 2, y: 2, w: 7, h: 5 },
      maxAlive: 3,
      respawnSec: 8,
      chase: true,
    },
    {
      id: "spawn_q_bats",
      troopId: "troop_bat_swarm",
      graphic: GFX_BAT,
      area: { x: 12, y: 2, w: 7, h: 5 },
      maxAlive: 2,
      respawnSec: 10,
      chase: true,
    },
  ];
  map.fieldSpawns = spawns;

  map.events = [
    event("ev_q_ruins_sign", 11, 12, [
      page("ev_q_ruins_sign_p", "낡은 비석", GFX_SIGN, [], [
        say("낡은 비석", "…봉인은 열쇠로만 풀린다…"),
        say("낡은 비석", "좌우를 뒤져라. 상자에 남아 있을 것이다."),
      ]),
    ]),
    // 열쇠 상자 — 좌측 이끼 구역 안쪽.
    event("ev_q_key_chest", 3, 3, [
      page("ev_q_key_chest_p1", "상자", GFX_CHEST, [], [
        narrate("상자를 열었다. 녹슨 열쇠가 들어 있다."),
        { kind: "setSwitch", switchId: SW_KEY, value: true },
        { kind: "changeGold", op: "+=", amount: 120 },
        narrate("녹슨 열쇠와 120 골드를 얻었다."),
        { kind: "setSelfSwitch", key: "A", value: true },
      ]),
      page("ev_q_key_chest_p2", "빈 상자", GFX_CHEST, [{ kind: "selfSwitch", key: "A", value: true }], [
        narrate("이미 비어 있다."),
      ]),
    ]),
    // 봉인문 — 열쇠가 없으면 막힌다. 있으면 보스방으로.
    event("ev_q_sealed_door", 10, 4, [
      page("ev_q_sealed_door_locked", "봉인문(잠김)", GFX_DOOR, [], [
        narrate("두꺼운 문이다. 열쇠 구멍에 녹이 슬어 있다."),
        say("문지기의 유령", "열쇠 없이는 지나갈 수 없다."),
      ]),
      page(
        "ev_q_sealed_door_open",
        "봉인문(열림)",
        GFX_DOOR,
        [{ kind: "switch", switchId: SW_KEY, value: true }],
        [
          narrate("녹슨 열쇠를 꽂았다. 문이 열린다."),
          { kind: "setSwitch", switchId: SW_RUINS_CLEARED, value: true },
          { kind: "transfer", mapId: MAP_BOSS, x: 10, y: 12, direction: "up" },
        ]
      ),
    ]),
    // 마을로 되돌아가는 길
    event("ev_q_back_village", 9, 13, [
      page("ev_q_back_village_p", "마을로", { transparent: true }, [], [
        { kind: "transfer", mapId: MAP_VILLAGE, x: 10, y: 2, direction: "down" },
      ], "playerTouch"),
    ]),
    event("ev_q_back_village_b", 10, 13, [
      page("ev_q_back_village_b_p", "마을로", { transparent: true }, [], [
        { kind: "transfer", mapId: MAP_VILLAGE, x: 10, y: 2, direction: "down" },
      ], "playerTouch"),
    ]),
  ];
  return map;
}

// ── 보스방(턴제 전투 → 엔딩) ─────────────────────────────────────────────────
function buildBossRoom(): GameMap {
  const map = createBlankMap("봉인의 방", 20, 15);
  map.id = MAP_BOSS;
  const { fill, border } = painter(map);
  fill(0, 0, 19, 14, T.stone);
  border(T.wall);
  // 제단으로 이어지는 길
  fill(9, 3, 10, 13, T.cobble);
  fill(6, 3, 13, 5, T.cobble);
  // 양옆 물길 — 우회 불가하게 가둔다
  fill(2, 6, 4, 12, T.water);
  fill(15, 6, 17, 12, T.water);

  map.events = [
    // 보스 — 제단 위. 조사하면 턴제 전투, 승리 후 엔딩.
    event("ev_q_boss", 10, 4, [
      page("ev_q_boss_p1", "봉인된 것", GFX_BOSS, [], [
        say("봉인된 것", "…누가… 나를 깨웠는가…"),
        { kind: "battleProcessing", troopId: TROOP_BOSS, canEscape: false, canLose: true },
        { kind: "setSwitch", switchId: SW_BOSS_DOWN, value: true },
        narrate("봉인된 것이 흩어져 사라졌다."),
        { kind: "setSelfSwitch", key: "A", value: true },
        { kind: "ending", title: "잊혀진 폐허", message: "봉인은 풀렸고, 마을은 다시 조용해졌다." },
      ]),
      page("ev_q_boss_p2", "빈 제단", { transparent: true }, [{ kind: "selfSwitch", key: "A", value: true }], [
        narrate("제단은 비어 있다."),
      ]),
    ]),
    // 폐허로 되돌아가는 길
    event("ev_q_boss_back", 9, 13, [
      page("ev_q_boss_back_p", "폐허로", { transparent: true }, [], [
        { kind: "transfer", mapId: MAP_RUINS, x: 10, y: 5, direction: "down" },
      ], "playerTouch"),
    ]),
    event("ev_q_boss_back_b", 10, 13, [
      page("ev_q_boss_back_b_p", "폐허로", { transparent: true }, [], [
        { kind: "transfer", mapId: MAP_RUINS, x: 10, y: 5, direction: "down" },
      ], "playerTouch"),
    ]),
  ];
  return map;
}

export function buildQuestProject(): Project {
  const project = createBlankProject();
  const village = buildVillage();
  const ruins = buildRuins();
  const boss = buildBossRoom();

  project.maps = { [village.id]: village, [ruins.id]: ruins, [boss.id]: boss };
  project.startMapId = village.id;
  project.startX = 10;
  project.startY = 8;
  project.meta.title = TITLE;
  project.system = {
    ...project.system,
    titleScreen: { ...project.system.titleScreen, title: TITLE },
    actionCombat: { ...project.system.actionCombat, enabled: true, hearts: true, enemyHpBars: "always" },
  };
  // 보스·수하 적 레코드. 배틀러 이미지는 생성된 것을 재사용한다.
  project.database.enemies.push(
    normalizeEnemyRecord({
      id: BOSS_LEAD,
      name: "봉인된 것",
      monsterResourceId: "generated-enemy-wraith-dark",
      stats: { ...BOSS_STATS },
      rewards: { exp: 180, gold: 260, dropRatePercent: 100, dropItemId: "item_hi_potion" },
      actions: [{ skillId: "skill_attack", priority: 5, condition: { kind: "always" } }],
    }),
    normalizeEnemyRecord({
      id: BOSS_MINION,
      name: "뼈 하수인",
      monsterResourceId: "generated-enemy-bonepile-crawler",
      stats: { ...MINION_STATS },
      rewards: { exp: 40, gold: 30, dropRatePercent: 20 },
      actions: [{ skillId: "skill_attack", priority: 5, condition: { kind: "always" } }],
    })
  );

  // 보스 트룹 등록. 좌표는 기본 트룹(troop_slime_pair)의 배치 공간과 같은 단위다.
  project.database.troops.push({
    id: TROOP_BOSS,
    name: "봉인된 것",
    enemyIds: [BOSS_LEAD, BOSS_MINION, BOSS_MINION],
    members: [
      { enemyId: BOSS_LEAD, x: 96, y: 96, hidden: false },
      { enemyId: BOSS_MINION, x: 52, y: 128, hidden: false },
      { enemyId: BOSS_MINION, x: 140, y: 128, hidden: false },
    ],
    autoAlign: false,
    battleEventPages: [],
  });

  project.switches.push(
    { id: SW_KEY, name: "녹슨 열쇠" },
    { id: SW_RUINS_CLEARED, name: "봉인문 개방" },
    { id: SW_BOSS_DOWN, name: "보스 격파" }
  );

  // 주인공이 검을 들고 시작해야 액션 스윙 프로필이 적용된다.
  const hero = project.database.actors.find((entry) => entry.id === "actor_hero");
  if (hero) hero.initialEquipment = { ...hero.initialEquipment, weapon: "equip_sword" };

  // 필드 적에게 액션 프로필을 준다 — 없으면 추격/접촉 피해가 성립하지 않는다.
  for (const [enemyId, profile] of Object.entries({
    enemy_slime: { contactDamage: 4, aggroRange: 6, moveIntervalMs: 520 },
    enemy_meadow_slime: { contactDamage: 5, aggroRange: 6, moveIntervalMs: 500 },
    enemy_cave_bat: { contactDamage: 6, aggroRange: 8, moveIntervalMs: 360 },
  })) {
    const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
    if (enemy) enemy.actionProfile = { ...enemy.actionProfile, ...profile };
  }

  return project;
}

// ── 검증 ────────────────────────────────────────────────────────────────────
const project = buildQuestProject();
const json = serialize(project);
const reloaded = deserialize(json);
console.log("[local] 역직렬화 통과");

// 통행성 — 시작 지점·스폰·이벤트 접근 칸이 실제로 걸어갈 수 있는지 본다.
const problems: string[] = [];
for (const map of Object.values(reloaded.maps)) {
  const tileAt = (x: number, y: number): number => map.lowerTiles[y * map.width + x] ?? -1;
  const solid = (x: number, y: number): boolean => isSolidChipsetTile(tileAt(x, y));
  if (map.id === reloaded.startMapId && solid(reloaded.startX, reloaded.startY)) {
    problems.push(`시작 지점 (${reloaded.startX},${reloaded.startY}) 통행 불가`);
  }
  for (const spawn of map.fieldSpawns ?? []) {
    let walkable = 0;
    for (let y = spawn.area.y; y < spawn.area.y + spawn.area.h; y += 1) {
      for (let x = spawn.area.x; x < spawn.area.x + spawn.area.w; x += 1) if (!solid(x, y)) walkable += 1;
    }
    console.log(`[local] ${map.id} 스폰 ${spawn.id} 통행 가능 칸 = ${walkable}`);
    if (walkable === 0) problems.push(`${map.id} 스폰 ${spawn.id} 영역 전체가 통행 불가`);
  }
  for (const gameEvent of map.events) {
    // 이벤트 칸 자체는 막혀도 되지만(상자·문), 인접 칸 하나는 걸어갈 수 있어야 조사된다.
    // playerTouch 이벤트는 그 칸을 직접 밟아야 하므로 자기 칸이 통행 가능해야 한다.
    const isTouch = gameEvent.pages.some((entry) => entry.trigger.kind === "playerTouch");
    if (isTouch) {
      if (solid(gameEvent.x, gameEvent.y)) problems.push(`${map.id} ${gameEvent.id} playerTouch 칸이 통행 불가`);
      continue;
    }
    const reachable = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => !solid(gameEvent.x + dx, gameEvent.y + dy));
    if (!reachable) problems.push(`${map.id} ${gameEvent.id} 접근 가능한 인접 칸이 없다`);
  }
}
if (problems.length > 0) {
  console.error("[local] 통행성 검증 실패:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log("[local] 통행성 검증 통과");

// 전송 대상이 실제 맵/좌표인지
for (const map of Object.values(reloaded.maps)) {
  for (const gameEvent of map.events) {
    for (const entry of gameEvent.pages) {
      for (const command of entry.commands) {
        if (command.kind !== "transfer") continue;
        const target = reloaded.maps[command.mapId];
        if (!target) {
          console.error(`[local] ${gameEvent.id} 전송 대상 맵이 없다: ${command.mapId}`);
          process.exit(1);
        }
        if (isSolidChipsetTile(target.lowerTiles[command.y * target.width + command.x] ?? -1)) {
          console.error(`[local] ${gameEvent.id} 전송 도착 칸이 통행 불가: ${command.mapId} (${command.x},${command.y})`);
          process.exit(1);
        }
      }
    }
  }
}
console.log("[local] 전송 대상 검증 통과");
console.log("[local] 맵", Object.keys(reloaded.maps).length, "개 / 이벤트", Object.values(reloaded.maps).reduce((n, m) => n + m.events.length, 0), "개");
console.log("[local] JSON 크기", json.length, "자");

if (!process.argv.includes("--push")) {
  writeFileSync("tmp/quest-demo.json", json, "utf8");
  console.log("[local] tmp/quest-demo.json 에 덤프했습니다. 저장하려면 --push 를 붙이세요.");
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("[error] SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 필요합니다.");
  process.exit(2);
}
const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
  "Content-Profile": "rpg_zzu",
  Prefer: "resolution=merge-duplicates,return=representation",
};
const terrainTemplateCount = Object.values(project.tilesets).reduce((sum, tileset) => {
  const templates = (tileset as { terrainTemplates?: unknown }).terrainTemplates;
  return sum + (Array.isArray(templates) ? templates.length : 0);
}, 0);
const upsert = await fetch(`${url}/rest/v1/projects?on_conflict=project_id`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    project_id: PROJECT_ID,
    title: TITLE,
    schema_version: project.version,
    current_json: JSON.parse(json),
    current_sha256: await sha256HexText(json),
    map_count: Object.keys(project.maps).length,
    tileset_count: Object.keys(project.tilesets).length,
    terrain_template_count: terrainTemplateCount,
  }),
});
if (!upsert.ok) {
  console.error("[push] 실패", upsert.status, (await upsert.text()).slice(0, 400));
  process.exit(1);
}
console.log("[push] 업서트 성공:", PROJECT_ID);

// maps 테이블도 같이 쓴다 — 로드 경로가 current_json 위에 maps.map_json 을 덮어쓴다.
// 여기를 빼먹으면 저장은 성공했는데 게임에는 옛 맵이 나오는 유령 상태가 된다.
const mapRows = await Promise.all(
  Object.values(project.maps).map(async (map) => ({
    project_id: PROJECT_ID,
    map_id: map.id,
    name: map.name,
    width: map.width,
    height: map.height,
    tileset_id: map.tilesetId,
    lower_sha256: await sha256HexText(JSON.stringify(map.lowerTiles)),
    upper_sha256: await sha256HexText(JSON.stringify(map.upperTiles)),
    lower_tile_count: map.lowerTiles.length,
    upper_tile_count: map.upperTiles.length,
    map_json: map,
  }))
);
const mapsUpsert = await fetch(`${url}/rest/v1/maps?on_conflict=project_id,map_id`, {
  method: "POST",
  headers,
  body: JSON.stringify(mapRows),
});
if (!mapsUpsert.ok) {
  console.error("[push] maps 실패", mapsUpsert.status, (await mapsUpsert.text()).slice(0, 400));
  process.exit(1);
}
console.log("[push] maps 업서트 성공:", mapRows.length, "행");

const verify = await fetch(
  `${url}/rest/v1/maps?project_id=eq.${PROJECT_ID}&select=map_id,map_json`,
  { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Accept-Profile": "rpg_zzu" } }
);
const rows = (await verify.json()) as { map_id: string; map_json: { events?: unknown[] } }[];
for (const row of rows) {
  console.log(`[verify] ${row.map_id} 이벤트 ${row.map_json?.events?.length ?? 0}개`);
}
if (rows.length !== 3) {
  console.error("[verify] maps 행 수가 3이 아니다:", rows.length);
  process.exit(1);
}
console.log("[verify] 재로드 검증 통과");
