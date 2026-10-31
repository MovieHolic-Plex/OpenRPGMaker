/**
 * 『폴른 스타』 제2막 — B10 하늘탑 아래층(1~3층) · B11 이리스 재회(4층 렌즈 대기실). 기획 docs/fallen-star/act2-plan.md 7절.
 *
 * 탑 네 층 맵은 B9(act2Opening.ts skyTower — author_dungeon tower floors 4)이 이미 지었다. 여기서는 그 위에 조수 도구로 짓는다.
 *   - 1층 「기사와 기계의 싸움터」: 들어서면 파수 기계가 심문회 기사를 쳐 내는 장면 → 그 기계가 필드 적으로 남는다.
 *     다친 기사(새라의 동료)·별빛 결정·남쪽 방 태엽나방·서고 관측 일지.
 *   - 2층 「갈라진 회랑」: author_party_split — 발판이 꺼지며 카엘·새라(서쪽 나무 발판) / 엘레나(동쪽 서고)로 갈린다.
 *     카엘 쪽 벽 손잡이가 엘레나 쪽 쇠창살을, 엘레나 쪽 거울 손잡이가 카엘 쪽 쇠창살을 연다. 둥근 방 박쥐.
 *   - 3층 「거울의 층」: author_map_puzzle mirror_beam_refraction 이 4층 계단을 막는다. 거미·회로뱀.
 *   - 4층 「렌즈 대기실」(B11): 어둠(place_field_obstacle dark) 속 관에서 이리스가 깨어난다. 일지(configure_story_journal)의
 *     지워진 줄을 카엘이 읽어 주면 기술이 돌아온다. 이리스 손끝 빛이 서쪽 골방의 일지 쪽 둘을 드러낸다.
 *     둥근 방 계단 = 꼭대기(act2Summit.ts B12·B13)로.
 * 새 그림은 없다 — 버들항 던전 키트·RTP 칩·1막 칩만 쓴다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { isPassable } from "@/project/collision";
import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { FS_NAMES } from "../fallenStarStory";
import { applyFallenAct2Summit, buildSummitMap, FS2_SW_B12_DONE, FS2_SW_B13_WON, FS2_SW_STOP_B13, FS2_TOP, gateSummitStair } from "./act2Summit";
import { FS_ACT2_JOIN_LEVEL } from "./mobBalance";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Cell = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
type Rec = Record<string, unknown>;

const KAEL = FS_NAMES.hero;
const ELENA = FS_NAMES.mage;
const IRIS = FS_NAMES.android;
const SARAH = "새라";
const KNIGHT = "심문회 기사";

const HERO = "actor_hero";
const ELENA_ID = "actor_fs_elena";
const IRIS_ID = "actor_fs_iris";
const SARAH_ID = "actor_fs2_sarah";

export const FS2_T1 = "fs2_sky_tower";
export const FS2_T2 = "fs2_sky_tower_f2";
export const FS2_T3 = "fs2_sky_tower_f3";
export const FS2_T4 = "fs2_sky_tower_f4";

// 앞 비트(act2Opening.ts)의 스위치 — 문자열로만 잇는다(그 파일은 다른 작업자가 고친다).
const SW_VALEN_MET = "sw_fs2_valen_lake_met";
const SW_STOP_B9_OLD = "sw_fs2_release_stop_b9";

const SW_T1_ARRIVE = "sw_fs2_t1_arrive";
const SW_T1_KNIGHT = "sw_fs2_t1_knight_told";
const SW_T1_LOG = "sw_fs2_t1_log_read";
const SPLIT = "fs2t2";
const SW_T2_SPLIT = `${SPLIT}_split`;
const SW_T2_DONE = `${SPLIT}_done`;
const SW_T3_ARRIVE = "sw_fs2_t3_arrive";
const SW_T3_SOLVED = "sw_fs2_t3_mirror_solved";
const SW_T4_ARRIVE = "sw_fs2_t4_arrive";
const SW_T4_ROOM = "sw_fs2_t4_coffin_seen";
const SW_IRIS_WAKE = "sw_fs2_iris_wake";
const SW_IRIS_BACK = "sw_fs2_iris_back";
const SW_PAGE_NAME = "sw_fs2_page_star_read";
const SW_PAGE_HAND = "sw_fs2_page_hand_read";
const SW_BE_WELL = "sw_fs2_iris_be_well";

const SKILL_RAPID = "skill_gunner_rapid_fire";
const SKILL_SHOT = "skill_gunner_shot";
const SKILL_SNIPE = "skill_gunner_snipe";
export const FS2_SKILL_FINGERLIGHT = "skill_fs2_iris_fingerlight";
export const FS2_SKILL_BE_WELL = "skill_fs2_iris_be_well";
const SKILL_MOTH_DUST = "skill_fs2_moth_dust";
const SKILL_CIRCUIT_BITE = "skill_fs2_circuit_bite";

const E_SENTINEL = "enemy_fs2_tower_sentinel";
const E_MOTH = "enemy_fs2_light_moth";
const E_SPIDER = "enemy_fs2_crystal_spider";
const E_SNAKE = "enemy_fs2_circuit_snake";
const E_BAT = "enemy_fs2_frost_bat";
const T_SENTINEL = "troop_fs2_tower_sentinel";
const T_MOTHS = "troop_fs2_tower_moths";
const T_BATS = "troop_fs2_tower_bats";
const T_SPIDERS = "troop_fs2_tower_spiders";
const T_SNAKES = "troop_fs2_tower_snakes";

const TOWER_BGM = "cc0-bgm-rtp-mys-001";
const IRIS_BGM = "cc0-bgm-rtp-emo-002";
const SAVE_CRYSTAL = "kit:beodeul_city/bd-pick-dungeon-theme-crystal-pedestal";
const TOWER_LAYERS = [{ preset: "glow", opacity: 45 }, { preset: "lightRays", opacity: 35 }];

// ── 명령 조각(act2Opening.ts 와 같은 꼴) ─────────────────────────────────────
const say = (speaker: string, body: string, extra: Rec = {}): Command => ({ kind: "text", speaker, body, ...extra } as unknown as Command);
const narrate = (body: string, extra: Rec = {}): Command => ({ kind: "text", body, ...extra } as unknown as Command);
const sys = (body: string): Command => narrate(body, { context: "system" });
const m2 = (commandId: string, fields: Rec): Command => ({ kind: "m2Command", commandId, fields } as unknown as Command);
const wait = (ms: number): Command => ({ kind: "wait", ms } as Command);
const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value } as Condition);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as unknown as Command);
const bgm = (resourceId: string, fadeInMs = 1500): Command => ({ kind: "playAudio", resourceId, loop: true, channel: "bgm", fadeInMs } as unknown as Command);
const stopBgm = (): Command => ({ kind: "stopAudio", channel: "bgm" } as unknown as Command);
const emote = (target: string, kind: string, durationMs = 800): Command =>
  ({ kind: "showEmote", target: target === "player" ? "player" : { eventId: target }, emote: kind, durationMs } as unknown as Command);
const route = (eventId: string, moves: Rec[], waitFor = true): Command =>
  ({ kind: "moveEvent", eventId, route: { moves, repeat: false, wait: waitFor, skippable: true } } as unknown as Command);
const walk = (dirs: Dir[]): Rec[] => dirs.map((dir) => ({ kind: "move", dir }));
const shake = (level = 3, durationMs = 500): Command =>
  m2("m2-048-shake-screen", { intensity: level <= 1 ? "1" : level <= 3 ? "3" : "6", durationMs, direction: "vertical" });
const flash = (color = "white", durationMs = 300): Command => m2("m2-047-flash-screen", { color, value: "flash", durationMs });
const fx = (preset: string, x: number, y: number, durationMs: number): Command =>
  m2("m2-224-particle-effect", { preset, target: "tile", x, y, durationMs, wait: false });
const letterbox = (): Command => m2("m2-202-screen-effect", { effect: "letterbox", value: "12", durationMs: 600 });
const clearLetterbox = (): Command => m2("m2-202-screen-effect", { effect: "clearLetterbox", value: "", durationMs: 500 });
const fadeOut = (ms = 1200): Command => m2("m2-202-screen-effect", { effect: "fadeOut", value: "", durationMs: ms });
const fadeIn = (ms = 900): Command => m2("m2-202-screen-effect", { effect: "fadeIn", value: "", durationMs: ms });
/** offsetY(월드 px, +면 카메라가 아래로) — 클로즈업에서 대화창(화면 아래 40%)이 인물을 덮지 않게 대상을 위로 올린다. */
const camTo = (eventId: string, durationMs = 1100, zoom?: number, offsetY?: number): Command =>
  m2("m2-201-camera-control", { mode: "panTo", targetEventId: eventId, durationMs: String(durationMs), wait: "true", ...(zoom ? { zoom: String(zoom) } : {}), ...(offsetY ? { offsetY: String(offsetY) } : {}) });
const camBack = (durationMs = 600, zoom?: number): Command => m2("m2-201-camera-control", { mode: "return", durationMs: String(durationMs), wait: "true", ...(zoom ? { zoom: String(zoom) } : {}) });
const cutBegin = (): Command => ({ kind: "cutsceneControl", mode: "begin", skippable: true } as unknown as Command);
const cutEnd = (): Command => ({ kind: "cutsceneControl", mode: "end" } as unknown as Command);
const cutLabel = (): Command => ({ kind: "label", name: "cutscene_end" } as unknown as Command);
const item = (itemId: string, amount = 1): Command => ({ kind: "changeItem", itemId, op: amount >= 0 ? "+=" : "-=", amount: Math.abs(amount) } as unknown as Command);
const learn = (actorId: string, skillId: string, action: "learn" | "forget" = "learn"): Command => ({ kind: "learnSkill", actorId, skillId, action } as unknown as Command);
const setSelf = (key = "A"): Command => ({ kind: "setSelfSwitch", key, value: true } as unknown as Command);
const selfSw = (key = "A"): Condition => ({ kind: "selfSwitch", key, value: true } as unknown as Condition);
const fork = (condition: Rec, then: Command[], otherwise: Command[] = []): Command => ({ kind: "fork", condition, then, else: otherwise } as unknown as Command);

const fixedMove = { type: "fixed", speed: 3, frequency: 3 };
function page(id: string, name: string, conditions: Condition[], commands: Command[], extra: Rec = {}): EventPage {
  const out = {
    id, name, conditions, graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
    movement: fixedMove, commands, ...extra,
  } as Rec;
  const g = out.graphic as { transparent?: boolean; sprite?: unknown } | undefined;
  if (!("overlapForbidden" in extra) && out.priority === "same" && g?.sprite && !g.transparent) out.overlapForbidden = true;
  return out as unknown as EventPage;
}
const chip = (sprite: string, characterIndex: number, direction: Dir): Rec => ({
  sprite: { type: "bundled", id: sprite }, direction, pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
});
const KNIGHT_CHIP: [string, number] = ["tex_easyrpg_charset_actor1", 2];
const IRIS_CHIP: [string, number] = ["tex_easyrpg_charset_actor4", 7];

function M(project: Project, id: string): GameMap {
  const map = project.maps[id];
  if (!map) throw new Error(`[fallen-star tower] 맵이 없다: ${id}`);
  return map;
}
/** 도구를 부를 때마다 맵 객체가 바뀐다 — 이벤트는 그때그때 맵을 다시 찾아 붙인다. */
let EXEC: Exec | null = null;
/** 이벤트는 조수 도구(upsert_event)로 짓는다 — 같은 id 면 페이지째 바꾼다. */
function addEv(project: Project, mapId: string, id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  if (!EXEC) throw new Error("[fallen-star tower] exec 가 없다");
  const exists = M(project, mapId).events.some((e) => e.id === id);
  // (0,1) = 「자리 상관없는 자동·병렬 이벤트」 — 바닥 곁 빈 벽 칸에 둔다(구석 허공은 도구가 받지 않는다).
  const spot = at.x === 0 && at.y === 1 && !exists ? autoSpot(project, mapId) : at;
  EXEC(project, "upsert_event", { mapId, ...(exists ? { replacePages: true } : {}), event: { id, name, x: spot.x, y: spot.y, trigger: { kind: "action" }, commands: [], pages } });
  const out = ev(project, mapId, id);
  if (out.x !== spot.x || out.y !== spot.y) throw new Error(`[fallen-star tower] ${mapId} ${id} 를 (${spot.x},${spot.y}) 에 두려 했는데 도구가 (${out.x},${out.y}) 로 옮겼다`);
  return out;
}
/** 자동 이벤트 자리 — 바닥과 맞닿은 빈 벽 칸(위에서부터). */
function autoSpot(project: Project, mapId: string): Cell {
  const map = M(project, mapId);
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const c = { x, y };
    if (walkable(project, mapId, c) || !freeOfEvents(project, mapId, c)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => walkable(project, mapId, { x: x + dx!, y: y + dy! }))) return c;
  }
  throw new Error(`[fallen-star tower] ${mapId} 에 자동 이벤트 자리가 없다`);
}
function ev(project: Project, mapId: string, id: string): GameEvent {
  const e = M(project, mapId).events.find((x) => x.id === id);
  if (!e) throw new Error(`[fallen-star tower] ${mapId} 에 이벤트 ${id} 가 없다`);
  return e;
}
function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
function walkable(project: Project, mapId: string, c: Cell): boolean {
  const map = M(project, mapId);
  return c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height && isPassable(project, map, c.x, c.y);
}
function mustWalk(project: Project, mapId: string, c: Cell, what: string): void {
  if (!walkable(project, mapId, c)) throw new Error(`[fallen-star tower] ${mapId} (${c.x},${c.y}) ${what} 자리가 막혀 있다`);
}
const freeOfEvents = (project: Project, mapId: string, c: Cell): boolean => !M(project, mapId).events.some((e) => e.x === c.x && e.y === c.y);
/** 후보 칸을 차례로 — 도구가 받아 주는 첫 자리. */
function firstOk<T>(cands: Cell[], fn: (c: Cell) => T): { at: Cell; out: T } | null {
  for (const c of cands) {
    try { return { at: c, out: fn(c) }; } catch { /* 다음 자리 */ }
  }
  return null;
}
function stamp(project: Project, exec: Exec, mapId: string, kitId: string, at: Cell): boolean {
  try { exec(project, "stamp_object", { objectId: `kit:beodeul_city/${kitId}`, mapId, x: at.x, y: at.y }); return true; } catch { return false; }
}

// ════════════════════════════════════════════════════════════════════
// 0. 데이터 — 적·기술
// ════════════════════════════════════════════════════════════════════

const ENEMY_TOOL_FIELDS = new Set(["id", "name", "speciesId", "monsterResourceId", "battleScalePercent", "collapseEffect", "hideHp", "damageTypeRates", "criticalHit", "attackOptions", "skillIds", "level", "stats", "rewards", "actions", "reactions", "stealItems", "stateRates", "elementRates"]);
const actRow = (skillId: string, priority: number) => ({ skillId, priority, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });

/**
 * 탑 적 — 서리 가도(Lv9 늑대 HP240·박쥐 HP200) 다음 단계. 탑에 들어설 때 파티 Lv10~11, 4층에서 Lv12 쯤.
 * 파수 기계는 느리고(lumber) 물리 반감·번개 두 배 — 피해 가거나 엘레나 마법으로. 태엽나방(청동 날개 — 탑 기계의 하나)은 실명, 회로뱀은 마력을 갉는다.
 */
const SENTINEL_ART = "generated-enemy-golem-iron";
const TOWER_FOES: { id: string; name: string; art: string; level: number; stats: Rec; skills: [string, number][]; exp: number; gold: number; elementRates?: Rec; damageTypeRates?: Rec; scale?: number }[] = [
  { id: E_SENTINEL, name: "탑 파수 기계", art: SENTINEL_ART, level: 11, stats: { maxHp: 520, maxMp: 30, attack: 122, defense: 58, mind: 40, agility: 30 },
    skills: [["skill_attack", 6], ["skill_mon_body_slam", 5], ["skill_mon_shell_guard", 3]], exp: 190, gold: 46, elementRates: { thunder: "A", fire: "C", ice: "C" }, damageTypeRates: { physical: 60 }, scale: 115 },
  { id: E_MOTH, name: "태엽나방", art: "generated-enemy-moth-dust", level: 10, stats: { maxHp: 190, maxMp: 30, attack: 72, defense: 26, mind: 74, agility: 84 },
    skills: [["skill_attack", 5], [SKILL_MOTH_DUST, 5]], exp: 72, gold: 18, elementRates: { fire: "A", wind: "A" } },
  { id: E_SPIDER, name: "결정 거미", art: "generated-enemy-spider-cave", level: 11, stats: { maxHp: 300, maxMp: 20, attack: 104, defense: 46, mind: 40, agility: 72 },
    skills: [["skill_attack", 6], ["skill_mon_web_shot", 3]], exp: 110, gold: 24, elementRates: { fire: "A", ice: "E" } },
  { id: E_SNAKE, name: "회로뱀", art: "generated-enemy-snake-01", level: 11, stats: { maxHp: 260, maxMp: 30, attack: 94, defense: 40, mind: 60, agility: 62 },
    skills: [["skill_attack", 5], [SKILL_CIRCUIT_BITE, 4]], exp: 96, gold: 22, elementRates: { thunder: "A" } },
];

function towerData(project: Project, exec: Exec): void {
  exec(project, "upsert_skill", { skill: {
    id: SKILL_MOTH_DUST, name: "인광 가루", scope: "enemy", type: "normal", power: 34, variance: 15, hitRate: 95,
    description: "날개에서 푸른 인광 가루를 털어 낸다. 가루가 눈에 닿으면 앞이 안 보인다.",
    mpCost: { flat: 3, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" },
    stateEffects: [{ stateId: "state_blind", chance: 55, operation: "add" }], animationId: "anim_gen_power_aura",
  } });
  exec(project, "upsert_skill", { skill: {
    id: SKILL_CIRCUIT_BITE, name: "회로 물기", scope: "enemy", type: "normal", power: 30, variance: 15, hitRate: 95,
    description: "이빨 끝 전선으로 물어 마력을 갉아 낸다.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "attack", affects: "mp" }, stateEffects: [],
  } });
  const base = project.database.enemies.find((e) => e.id === "enemy_fs_wolf");
  if (!base) throw new Error("[fallen-star tower] enemy_fs_wolf 가 없다");
  for (const f of TOWER_FOES) {
    const rec = JSON.parse(JSON.stringify(base)) as Rec;
    Object.assign(rec, {
      id: f.id, name: f.name, level: f.level, monsterResourceId: f.art, stats: f.stats, skillIds: f.skills.map(([s]) => s),
      actions: f.skills.map(([s, p]) => actRow(s, p)),
      rewards: { exp: f.exp, gold: f.gold, dropRatePercent: 0, drops: [{ itemId: "item_potion", ratePercent: 10, quantity: 1, condition: { kind: "always" } }] },
      elementRates: { ...(base as unknown as Rec).elementRates as Rec, ...(f.elementRates ?? {}) },
      ...(f.damageTypeRates ? { damageTypeRates: f.damageTypeRates } : {}),
      ...(f.scale ? { battleScalePercent: f.scale } : {}),
    });
    for (const key of Object.keys(rec)) if (!ENEMY_TOOL_FIELDS.has(key)) delete rec[key];
    exec(project, "upsert_enemy", { enemy: rec });
  }
  if (!project.database.enemies.some((e) => e.id === E_BAT)) throw new Error("[fallen-star tower] 서리박쥐(B7)가 없다");
  for (const [id, name, members] of [
    [T_SENTINEL, "탑 파수 기계", [E_SENTINEL, E_MOTH]],
    [T_MOTHS, "태엽나방 떼", [E_MOTH, E_MOTH, E_MOTH]],
    [T_BATS, "서리박쥐와 태엽나방", [E_BAT, E_BAT, E_MOTH]],
    [T_SPIDERS, "결정 거미", [E_SPIDER, E_SPIDER]],
    [T_SNAKES, "회로뱀", [E_SNAKE, E_SNAKE, E_MOTH]],
  ] as const) {
    exec(project, "upsert_troop", { troop: { id, name, enemyIds: [...members], previewBackgroundResourceId: "battle-scenery-cave", backdropLayers: TOWER_LAYERS } });
  }
  // 이리스 기술 — 손끝 빛(필드 기술, place_field_obstacle 이 공통 이벤트를 붙인다)과 「잘 지내」(일지 쪽 셋을 다 읽으면).
  exec(project, "upsert_skill", { skill: {
    id: FS2_SKILL_BE_WELL, name: "잘 지내", scope: "allAllies", type: "normal", power: 60, variance: 10, hitRate: 100,
    description: "아군 전체를 치료하고 나쁜 상태를 걷어 낸다.\n카엘이 처음 하늘에 보낸 대답.",
    mpCost: { flat: 18, percentMax: 0 }, effect: { kind: "healing", statistic: "mind", affects: "hp" }, animationId: "anim_heal",
    stateEffects: ["state_poison", "state_blind", "state_silence", "state_paralysis", "state_sleep", "state_attack_down", "state_defense_down", "state_agility_down"]
      .map((stateId) => ({ stateId, chance: 100, operation: "remove" })),
  } });
}

// ════════════════════════════════════════════════════════════════════
// 1. 1층 「기사와 기계의 싸움터」
// ════════════════════════════════════════════════════════════════════

// 2026-10-31 main #4125(탑 층마다 계단방 윤곽·표지) 뒤 1층 배치(seed 91 cross): 동쪽 성문 날개 → 가운데 홀(마법진 (20,19)) → 서쪽 계단방(마법진 바닥)·북쪽 막다른 연금 공방·남쪽 서고(마법진 짝).
// 장면은 가운데 홀과 서쪽 계단방 사이 목(x13~15 y18~20) — place_field_enemy 는 순찰 칸이 입구·마법진 착지(성문 (34,16)·홀 (20,19)(20,20)·
// 2층에서 내려온 (7,16))에서 6칸 안이면 거절한다. 성문 쪽 목에 두면 들어서자마자 붙잡혔다(QA 2026-11-01).
// 기계는 계단방 앞 목에서 세로로 오가고, 쳐 내진 기사는 가운데 홀로 물러나 앉는다.
const T1 = { arrive: { x: 34, y: 17 }, machine: { x: 13, y: 18 }, knight: { x: 15, y: 19 }, knightEnd: { x: 18, y: 20 }, stair: { x: 7, y: 15 } };

function floorOne(project: Project, exec: Exec): void {
  for (const [id, name] of [[SW_T1_ARRIVE, "B10: 하늘탑 1층 — 기계가 기사를 쳐 냄"], [SW_T1_KNIGHT, "B10: 다친 기사에게 들음"], [SW_T1_LOG, "B10: 관측 일지를 읽음"]] as const) ensureSwitch(project, id, name);
  const map = M(project, FS2_T1);
  // 1.24 판본 끝 마개가 남아 있으면 걷는다(이 판본에서는 FS2_RELEASE_STOP = null — 굽기 결과를 다시 쓰는 탐침에서도 같은 모양이 되게).
  map.events = map.events.filter((e) => e.id !== "ev_fs2_tower_stop");
  const stair = ev(project, FS2_T1, "ev_fs2_sky_tower_stair_next");
  if (!JSON.stringify(stair.pages ?? []).includes(`"mapId":"${FS2_T2}"`)) {
    for (const pg of stair.pages ?? []) pg.commands = [{ kind: "transfer", mapId: FS2_T2, x: 15, y: 22, direction: "down", fade: "black" } as unknown as Command];
  }
  for (const c of [T1.arrive, T1.machine, T1.knight, T1.knightEnd]) mustWalk(project, FS2_T1, c, "1층");

  // 기계 — 장면이 끝나면(SW_T1_ARRIVE) 필드 적으로 나타난다. 느리고 돌진하지 않는다(피해 갈 수 있는 정예).
  const placed = exec(project, "place_field_enemy", {
    mapId: FS2_T1, x: T1.machine.x, y: T1.machine.y, troopId: T_SENTINEL, behavior: "chase", patrol: { length: 2, axis: "vertical" },
    sightRange: 5, vision: "cone", pace: "slow", approachStyle: "lumber", respawnSec: 0, appearSwitchId: SW_T1_ARRIVE, checkpointOnEntry: true,
  }) as { eventId?: string } | undefined;
  const machineId = placed?.eventId ?? M(project, FS2_T1).events.find((e) => e.x === T1.machine.x && e.y === T1.machine.y)?.id;
  if (!machineId) throw new Error("[fallen-star tower] 1층 파수 기계가 없다");
  // 필드 그림 = 전투 그림. 도구는 골렘 종류를 모두 같은 RTP 흙 골렘 칩으로 세워, 필드의 누런 흙인형이 전투에서 검은 쇠 기계로 바뀌었다
  // (첫 플레이 검수 2026-10-31). 전투 도트 그대로(걷기 칩이 없는 종과 같은 방식)를 필드 심볼로 쓴다.
  for (const pg of ev(project, FS2_T1, machineId).pages ?? []) {
    if ((pg.graphic as { sprite?: unknown } | undefined)?.sprite) pg.graphic = { sprite: { type: "bundled", id: SENTINEL_ART }, direction: "down", pattern: 0 } as EventPage["graphic"];
  }
  const machineLook = (ev(project, FS2_T1, machineId).pages ?? []).map((p) => p.graphic as Rec | undefined).find((g) => g && (g as { sprite?: unknown }).sprite);
  if (!machineLook) throw new Error("[fallen-star tower] 파수 기계 그림이 없다");
  // 다친 기사 — 새라의 견습 동기. 장면 기사가 물러난 칸(T1.knightEnd)에 같이 서므로 목록에서 먼저 둔다(조사는 앞 이벤트가 받는다). 발렌이 위로 갔다는 것, 회복약 둘.
  addEv(project, FS2_T1, "ev_fs2_t1_knight", KNIGHT, T1.knightEnd, [
    page("ev_fs2_t1_knight_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_t1_knight_p", "다친 기사", [sw(SW_T1_ARRIVE)], [
      say(KNIGHT, "…새라? 북문 지키던 네가\n왜 별지기들이랑 같이 있어."),
      say(SARAH, "물어볼 게 생겼어. 발렌 님은?"),
      say(KNIGHT, "위로 가셨다. 빛기둥이 솟고 나서\n기계들이 한꺼번에 깨어났지."),
      say(KNIGHT, "…우리가 모르는 걸 그분은 아는 눈치였다.\n이거 가져가라. 난 더는 못 올라간다."),
      item("item_potion", 2), item("item_ether", 1),
      sys("「회복약」 2개와 「마력약」 1개를 받았다."),
      setSw(SW_T1_KNIGHT), setSelf("A"),
    ], { graphic: chip(KNIGHT_CHIP[0], KNIGHT_CHIP[1], "left") }),
    page("ev_fs2_t1_knight_after", "다친 기사(뒤)", [sw(SW_T1_ARRIVE), selfSw("A")], [
      say(KNIGHT, "계단방 앞 기계는 피해서 가라.\n느려도 한 대 맞으면 뼈가 나간다."),
    ], { graphic: chip(KNIGHT_CHIP[0], KNIGHT_CHIP[1], "left") }),
  ]);

  // 장면 배우 — 기계(장면용, 장면 뒤엔 없음)·기사(장면 뒤엔 동쪽 날개에 기대앉은 다친 기사가 대신한다).
  addEv(project, FS2_T1, "ev_fs2_t1_stage_machine", "파수 기계(장면)", { x: T1.machine.x, y: T1.machine.y + 1 }, [
    page("ev_fs2_t1_stage_machine_p", "대치", [], [], { graphic: { ...structuredClone(machineLook), direction: "right" }, priority: "same", overlapForbidden: true }),
    page("ev_fs2_t1_stage_machine_gone", "없음", [sw(SW_T1_ARRIVE)], [], { priority: "below" }),
  ]);
  addEv(project, FS2_T1, "ev_fs2_t1_stage_knight", KNIGHT, T1.knight, [
    page("ev_fs2_t1_stage_knight_p", "싸움", [], [], { graphic: chip(KNIGHT_CHIP[0], KNIGHT_CHIP[1], "left") }),
    page("ev_fs2_t1_stage_knight_gone", "없음", [sw(SW_T1_ARRIVE)], [], { priority: "below" }),
  ]);
  // 들어서면 한 번 — 홀에서 기계가 기사를 쳐 낸다.
  addEv(project, FS2_T1, "ev_fs2_t1_arrive", "하늘탑 1층", { x: 0, y: 1 }, [
    page("ev_fs2_t1_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_t1_arrive_run", "기사와 기계", [sw(SW_VALEN_MET)], [
      cutBegin(),
      wait(500),
      se("cc0-se-osx-metal-03"), shake(1, 300),
      say(SARAH, "…쇳소리다. 안쪽 홀에서."),
      // 1배로는 기사·기계가 손톱만 해서 「쳐 낸다」가 안 읽혔다(첫 플레이 검수 2026-11-01) — 2배로 당겨 본다.
      camTo("ev_fs2_t1_stage_knight", 1300, 2),
      wait(300),
      route("ev_fs2_t1_stage_knight", [{ kind: "move", dir: "left" }]),
      se("cc0-se-osx-metal-03"), flash("white", 200),
      route("ev_fs2_t1_stage_machine", [{ kind: "turn", dir: "right" }]),
      se("cc0-se-osx-metal-03"), shake(3, 500),
      route("ev_fs2_t1_stage_knight", [{ kind: "setDirectionFix", enabled: true }, { kind: "jump", dx: 2, dy: 0, heightPx: 10, durationMs: 420 }, { kind: "setDirectionFix", enabled: false }]),
      emote("ev_fs2_t1_stage_knight", "sweat", 700),
      route("ev_fs2_t1_stage_knight", [{ kind: "turn", dir: "right" }, ...walk(["right", "right", "down"])]),
      wait(300),
      emote("ev_fs2_t1_stage_machine", "exclamation", 800),
      // 기계가 홀 가운데 자리(필드 적이 서는 칸)로 한 걸음 물러나 선다 — 장면이 끝나고 필드 적으로 바뀔 때 칸이 튀지 않게.
      route("ev_fs2_t1_stage_machine", [{ kind: "move", dir: "up" }, { kind: "turn", dir: "down" }]),
      wait(400),
      camBack(700, 1),
      say(SARAH, "기계가 기사를 쳤어.\n…저것들한텐 우리도 기사도 똑같나 봐."),
      say(ELENA, "벽 글자 봐. 천문대 지하 패널이랑 같아.\n이 탑도 그 사람들이 지었어."),
      say(KAEL, "부딪히지 말고 돌아서 가자.\n이리스는 위층이야."),
      setSw(SW_T1_ARRIVE),
      cutLabel(),
      cutEnd(),
      setSw(SW_T1_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_t1_arrive_done", "끝", [sw(SW_T1_ARRIVE)], [], { priority: "below" }),
  ]);

  // 별빛 결정 — 들어온 문 곁(동쪽 날개).
  const save = firstOk([{ x: 37, y: 17 }, { x: 36, y: 17 }, { x: 38, y: 18 }, { x: 31, y: 17 }], (c) => exec(project, "place_savepoint", {
    mapId: FS2_T1, x: c.x, y: c.y, id: "ev_fs2_t1_save", name: "별빛 결정", mode: "slot", objectId: SAVE_CRYSTAL, prompt: "기록하시겠습니까?", sparkleRadius: 2,
  }));
  if (!save) throw new Error("[fallen-star tower] 1층 별빛 결정 자리가 없다");

  // 북쪽 막다른 방(연금 공방) — 태엽나방 떼가 지키는 기계 부품 상자.
  const chest = firstOk([{ x: 21, y: 8 }, { x: 22, y: 8 }, { x: 23, y: 9 }, { x: 17, y: 9 }], (c) => exec(project, "place_chest", {
    mapId: FS2_T1, x: c.x, y: c.y, contents: { itemId: "item_hi_potion", gold: 180 }, name: "녹슨 부품 상자", id: "ev_fs2_t1_chest",
  }));
  if (!chest) throw new Error("[fallen-star tower] 1층 남쪽 상자 자리가 없다");
  const moths = firstOk([{ x: 20, y: 10 }, { x: 19, y: 10 }, { x: 21, y: 10 }, { x: 20, y: 11 }], (c) => exec(project, "place_field_enemy", {
    mapId: FS2_T1, x: c.x, y: c.y, troopId: T_MOTHS, behavior: "chase", patrol: { length: 2, axis: "horizontal" },
    sightRange: 6, vision: "cone", pace: "normal", approachStyle: "float", respawnSec: 120, checkpointOnEntry: true,
  }));
  if (!moths) throw new Error("[fallen-star tower] 1층 태엽나방 자리가 없다");

  // 남쪽 서고(가운데 홀 마법진으로도 닿는다) — 독서대 위 관측 일지: 「4층 대기실 — 회수 대상 보관」.
  const lectern = firstOk([{ x: 18, y: 27 }, { x: 22, y: 27 }, { x: 18, y: 29 }, { x: 22, y: 29 }], (c) => {
    if (!freeOfEvents(project, FS2_T1, c) || !walkable(project, FS2_T1, c) || !walkable(project, FS2_T1, { x: c.x, y: c.y + 1 })) throw new Error("x");
    if (!stamp(project, exec, FS2_T1, "bd-pick-dungeon-theme-lectern", { x: c.x, y: c.y - 1 })) throw new Error("x");
    return true;
  });
  const logAt = lectern?.at ?? { x: 18, y: 28 };
  addEv(project, FS2_T1, "ev_fs2_t1_log", "관측 일지", logAt, [
    page("ev_fs2_t1_log_p", "관측 일지", [], [
      narrate("(펼친 관측 일지) 「4층 대기실 ── 회수 대상 한 기 보관.\n귀환선이 내려오기 전에 현지 기록을 정리할 것.」"),
      say(KAEL, "…회수 대상. 이리스를 그렇게 부르네."),
      say(ELENA, "기록을 정리한다는 건, 지운다는 소리야.\n서두르자."),
      setSw(SW_T1_LOG),
    ], { priority: "same" }),
  ]);
  // 1층 칸 장식 — 장치 문법: 홀 벽 앞 밸브 바퀴·구리 관(자리 없으면 건너뛴다).
  for (const [kit, c] of [["bd-pick-aqueduct-sewer-valve-wheel", { x: 18, y: 15 }], ["bd-pick-aqueduct-sewer-valve-wheel", { x: 23, y: 15 }], ["bd-pick-aqueduct-sewer-crate-stack", { x: 38, y: 20 }]] as const) {
    if (freeOfEvents(project, FS2_T1, { x: c.x, y: c.y + 1 })) stamp(project, exec, FS2_T1, kit, c);
  }
  void machineId;
}

// ════════════════════════════════════════════════════════════════════
// 2. 2층 「갈라진 회랑」 — author_party_split
// ════════════════════════════════════════════════════════════════════

const T2 = {
  arrive: { x: 15, y: 22 },
  // 서쪽 날개(카엘·새라)와 가운데 홀 사이 두 칸 틈, 동쪽 날개(엘레나) 사이 두 칸 틈 — 윗칸은 밸브 기둥으로 막고 아랫칸이 쇠창살.
  westPlug: { x: 10, y: 19 }, westDoor: { x: 10, y: 20 },
  eastPlug: { x: 21, y: 19 }, eastDoor: { x: 21, y: 20 },
  westStart: { x: 6, y: 20 }, eastStart: { x: 25, y: 20 },
  westSwitch: { x: 7, y: 17 }, eastSwitch: { x: 24, y: 17 },
  westLever: { x: 5, y: 15 }, eastLever: { x: 26, y: 15 },
  rejoin: { x: 15, y: 17 }, rejoinPlug: { x: 16, y: 17 },
};

function floorTwo(project: Project, exec: Exec): void {
  for (const c of [T2.arrive, T2.westPlug, T2.westDoor, T2.eastPlug, T2.eastDoor, T2.westStart, T2.eastStart, T2.rejoin, T2.rejoinPlug]) mustWalk(project, FS2_T2, c, "2층");
  // 두 칸 높이 옆 틈마다 쇠창살 하나(doorHeight 2) · 벽걸이 손잡이(leverLook wall) · 받침 위 수정(switchLook pedestal) — 모두 칩셋 키트 그림.
  exec(project, "author_party_split", {
    id: SPLIT, mapId: FS2_T2, splitAt: T2.arrive,
    splitTrigger: "auto", splitWhenSwitchId: SW_VALEN_MET, splitQuake: true, fadeOnSplit: true,
    gateLook: "portcullis", leverLook: "wall", switchLook: "pedestal",
    groups: [
      { name: "카엘·새라", actorIds: [HERO, SARAH_ID], x: T2.westStart.x, y: T2.westStart.y, switchAt: T2.westSwitch },
      { name: "엘레나", actorIds: [ELENA_ID], x: T2.eastStart.x, y: T2.eastStart.y, switchAt: T2.eastSwitch },
    ],
    levers: [
      { lever: T2.westLever, door: T2.eastDoor, doorHeight: 2, name: "동쪽 쇠창살",
        text: "벽에 쇠 손잡이가 박혀 있다.\n쇠줄이 동쪽 벽 속으로 들어가 있다.", prompt: "손잡이를 내릴까?", pullLabel: "내린다",
        pullText: "끼긱. 손잡이가 내려가며 쇠줄이 감겼다.\n벽 너머 동쪽에서 쇠창살 올라가는 소리.",
        pullLines: [{ speaker: ELENA, text: "(벽 너머) 열렸어! 카엘, 들려?\n이쪽 창살이 올라갔어." }, { speaker: KAEL, text: "들려! 거울은?" }],
        doneText: "손잡이가 끝까지 내려가 있다.", doorText: "굵은 쇠창살이 길을 막고 있다.\n반대편 어딘가에 있는 장치로 올리는 것 같다." },
      { lever: T2.eastLever, door: T2.westDoor, doorHeight: 2, name: "서쪽 쇠창살",
        text: "벽에 박힌 손잡이다. 쇠줄이 천창 거울까지 뻗어 있다.\n내리면 거울이 돌아 빛이 서쪽으로 꺾일 것 같다.", prompt: "손잡이를 내릴까?", pullLabel: "내린다",
        pullText: "거울이 돌아갔다. 꺾인 빛줄기가 벽 틈으로 빠져나간다.\n서쪽에서 쇠창살 자물쇠가 철컥 풀리는 소리.",
        pullLines: [{ speaker: ELENA, text: "빛 갔어? 카엘, 그쪽 문에 닿았어?" }, { speaker: SARAH, text: "(벽 너머) 닿았다. 창살이 올라가." }],
        doneText: "거울이 서쪽을 향해 있다.", doorText: "굵은 쇠창살이 길을 막고 있다.\n반대편 어딘가의 장치로 올라갈 것 같다." },
    ],
    rejoin: T2.rejoin,
    splitLines: [{ speaker: ELENA, text: "바닥 돌판이 들썩여.\n…밑이 텅 빈 소리가 나." }],
    splitText: "발밑 판이 덜컹 꺼졌다! 양쪽 날개 사이로 쇠창살이 내리꽂혔다.",
    afterSplitLines: [
      { speaker: SARAH, text: "…갈렸군. 엘레나는 반대쪽 날개야." },
      // 해법(「내가 거울을 돌릴게, 빛이 그쪽 문에 닿으면」)을 먼저 말해 퍼즐이 지시가 됐다(적대 검수 2026-11-01) — 갇혔다는 것만.
      { speaker: ELENA, text: "(벽 너머) 카엘, 들려? 이쪽도 창살에 막혔어.\n벽에 뭔가 장치가 있긴 한데…" },
      { speaker: KAEL, text: "들려! 우리도 이쪽에서\n열 방법을 찾아볼게." },
      { text: "수정 받침을 조사하면 엘레나 쪽으로 넘어간다." },
    ],
    switchIdleText: "수정 받침이 희미하게 울린다.\n벽 너머 동료의 숨소리가 들리는 것 같다.",
    rejoinText: "다시 모였다.",
    rejoinLines: [{ speaker: ELENA, text: "거울, 진짜 됐네. 빛이 그쪽까지 갔어." }, { speaker: SARAH, text: "기계보다 손발이 잘 맞는군.\n…올라가자." }],
  });
  // 손잡이 이름표 — 도구는 「레버 → 동쪽 쇠창살」로 이름을 지어 이름표가 답(어느 손잡이가 어느 문)을 알려 줬다(첫 플레이 검수 2026-10-31).
  // 무엇인지만 보이게 고친다. 어느 문이 열리는지는 당겨 보고 소리로 안다.
  for (const [at, label] of [[T2.westLever, "벽 손잡이"], [T2.eastLever, "거울 손잡이"]] as const) {
    const lever = M(project, FS2_T2).events.find((e) => e.x === at.x && e.y === at.y && String(e.name ?? "").startsWith("레버"));
    if (!lever) throw new Error(`[fallen-star tower] 2층 손잡이 이벤트가 없다 (${at.x},${at.y})`);
    lever.name = label;
  }
  // 합류 칸 곁 칸 — 갈린 동안만 막아 합류 칸을 반드시 밟게 한다.
  addEv(project, FS2_T2, "ev_fs2_t2_rejoin_plug", "합류 길목", T2.rejoinPlug, [
    page("ev_fs2_t2_rejoin_plug_open", "열림", [], [], { priority: "below" }),
    page("ev_fs2_t2_rejoin_plug_shut", "기다림", [sw(SW_T2_SPLIT)], [say(SARAH, "여기서 기다리자.\n엘레나랑 같이 올라간다.")], { priority: "same" }),
    page("ev_fs2_t2_rejoin_plug_done", "합친 뒤", [sw(SW_T2_DONE)], [], { priority: "below" }),
  ]);
  // 갈린 동안 내려가는 계단은 막는다.
  const back = ev(project, FS2_T2, "ev_fs2_sky_tower_f2_stair_back");
  const backPages = back.pages ?? [];
  back.pages = [
    ...backPages,
    page("ev_fs2_t2_back_wait", "갈린 동안", [sw(SW_T2_SPLIT)], [say(KAEL, "엘레나를 두고 내려갈 순 없어.")], { trigger: { kind: "playerTouch" }, priority: "below" }),
    ...backPages.map((pg) => ({ ...structuredClone(pg), id: `${pg.id}_after`, conditions: [sw(SW_T2_DONE)] })),
  ];
  // 둥근 방 — 서리박쥐 떼(비계로 들어온 박쥐들), 계단은 피해 둔다.
  const bats = firstOk([{ x: 17, y: 11 }, { x: 18, y: 12 }, { x: 15, y: 11 }, { x: 17, y: 9 }], (c) => exec(project, "place_field_enemy", {
    mapId: FS2_T2, x: c.x, y: c.y, troopId: T_BATS, behavior: "chase", patrol: { length: 2, axis: "horizontal" },
    sightRange: 6, vision: "cone", pace: "normal", approachStyle: "swoop", respawnSec: 120, checkpointOnEntry: true,
  }));
  if (!bats) throw new Error("[fallen-star tower] 2층 박쥐 자리가 없다");
  // 엘레나 쪽 서고 — 마력약 상자(혼자인 엘레나 몫).
  firstOk([{ x: 28, y: 18 }, { x: 29, y: 18 }, { x: 27, y: 21 }], (c) => exec(project, "place_chest", {
    mapId: FS2_T2, x: c.x, y: c.y, contents: { itemId: "item_ether" }, name: "서고 상자", id: "ev_fs2_t2_chest",
  }));
}

// ════════════════════════════════════════════════════════════════════
// 3. 3층 「거울의 층」 — mirror_beam_refraction 이 4층 계단을 막는다
// ════════════════════════════════════════════════════════════════════

/**
 * 3층 거울 — 천창 빛이 첫 거울에 떨어진다. 거울 넷(+ 빛을 삼키는 검은 수정 쪽으로 새는 미끼 거울 하나)을 저마다 위·오른쪽·아래·왼쪽으로
 * 돌려 빛을 계단 빛 막까지 잇는다. 빛이 닿은 거울은 수정처럼 빛나고, 빛줄기는 반짝이로 그 길을 따라 흐른다 — 막히는 데도 보인다.
 * 처음 판: 첫 거울은 위(미끼 거울)를 본다. 미끼 거울 왼쪽 길은 검은 수정이 빛을 삼킨다. 답은 첫 거울 왼쪽 → 남서 거울 위 → 북서 거울
 * 오른쪽 → 계단 앞 거울 위. 넷 다 처음 방향이 틀려 있다(2026-11-01 「거울 두 개를 돌리면 끝」 적대 검수).
 */
const T3_MIRRORS = [
  { key: "m1", at: { x: 12, y: 13 }, first: "up", name: "천창 아래 거울" },
  { key: "m2", at: { x: 5, y: 13 }, first: "down", name: "남서 거울" },
  { key: "m3", at: { x: 5, y: 7 }, first: "left", name: "북서 거울" },
  { key: "m4", at: { x: 7, y: 7 }, first: "right", name: "계단 앞 거울" },
  { key: "m5", at: { x: 12, y: 7 }, first: "left", name: "북동 거울" },
] as const;
const T3_STAIR = { x: 7, y: 5 };
const T3_SINK = { x: 9, y: 7 };   // 빛을 삼키는 검은 수정(1×2, 밑칸)
const DIRS4: Dir[] = ["up", "right", "down", "left"];
const DIR_WORD: Record<Dir, string> = { up: "위", right: "오른쪽", down: "아래", left: "왼쪽" };
const STEP4: Record<Dir, Cell> = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };

function floorThree(project: Project, exec: Exec): void {
  ensureSwitch(project, SW_T3_ARRIVE, "B10: 하늘탑 3층 도착");
  ensureSwitch(project, SW_T3_SOLVED, "B10: 거울 빛줄기로 4층 계단을 엶");
  // 방 꾸밈(거울 홀 바닥·기둥 격자·계단 앞 빛 막 칸)은 거울 프리셋이 짓는다 — 그 방 위에 거울 다섯을 새로 세운다.
  // 프리셋 거울 둘(「둘을 차례로 돌리면 끝」)과 빛 막 글은 걷어 낸다.
  const done = firstOk([{ x: 9, y: 9 }, { x: 10, y: 8 }, { x: 12, y: 10 }, { x: 19, y: 11 }], (c) => exec(project, "author_map_puzzle", {
    mapId: FS2_T3, presetId: "mirror_beam_refraction", puzzleId: "fs2_t3_mirror", x: c.x, y: c.y,
    gateEventId: "ev_fs2_sky_tower_f3_stair_next", solveSwitchId: SW_T3_SOLVED, title: "렌즈 거울",
  }));
  if (!done) throw new Error("[fallen-star tower] 3층 거울 방을 못 지었다");
  const map = M(project, FS2_T3);
  map.events = map.events.filter((e) => !e.id.startsWith("ev_fs2_t3_mirror"));
  for (const m of T3_MIRRORS) mustWalk(project, FS2_T3, m.at, `3층 ${m.name}`);
  mustWalk(project, FS2_T3, T3_SINK, "3층 검은 수정");
  mustWalk(project, FS2_T3, { x: T3_STAIR.x, y: T3_STAIR.y + 1 }, "3층 계단 앞");
  // 빛을 삼키는 검은 수정 — 미끼 거울의 왼쪽 길을 끊는다.
  if (!stamp(project, exec, FS2_T3, "bd-pick-dungeon-theme-corrupt-crystal", { x: T3_SINK.x, y: T3_SINK.y - 1 })) throw new Error("[fallen-star tower] 3층 검은 수정을 못 놓았다");

  const varOf = (key: string): string => `var_fs2_t3_${key}_dir`;
  const litOf = (key: string): string => `sw_fs2_t3_${key}_lit`;
  const segOf = (key: string, d: Dir): string => `sw_fs2_t3_${key}_ray_${d}`;
  const SW_INIT = "sw_fs2_t3_beam_init";
  ensureSwitch(project, SW_INIT, "B10: 3층 빛줄기 첫 계산");
  for (const m of T3_MIRRORS) {
    if (!project.variables.some((v) => v.id === varOf(m.key))) project.variables.push({ id: varOf(m.key), name: `B10: 3층 ${m.name} 방향` });
    ensureSwitch(project, litOf(m.key), `B10: 3층 ${m.name}에 빛`);
    for (const d of DIRS4) ensureSwitch(project, segOf(m.key, d), `B10: 3층 ${m.name} 빛줄기 ${DIR_WORD[d]}`);
  }
  /** 변수 값 0..3 → 방향. 0 이 처음 방향(틀린 쪽)이다 — 변수 기본값 0 이면 체크포인트로 들어와도 같은 처음 판. */
  const order = (first: Dir): Dir[] => { const i = DIRS4.indexOf(first); return [0, 1, 2, 3].map((k) => DIRS4[(i + k) % 4]!); };
  // 빛줄기 — 거울에서 한 방향으로 칸을 따라가다 거울·계단·막힌 칸(벽·기물·검은 수정)에서 멈춘다.
  type Ray = { cells: Cell[]; hit: string | null };
  const rays = new Map<string, Ray>();
  for (const m of T3_MIRRORS) for (const d of DIRS4) {
    const cells: Cell[] = [];
    let hit: string | null = null;
    let c: Cell = { x: m.at.x, y: m.at.y };
    for (let k = 0; k < 14; k += 1) {
      c = { x: c.x + STEP4[d].x, y: c.y + STEP4[d].y };
      const other = T3_MIRRORS.find((o) => o.at.x === c.x && o.at.y === c.y);
      if (other) { hit = other.key; break; }
      if (c.x === T3_STAIR.x && c.y === T3_STAIR.y) { cells.push(c); hit = "stair"; break; }
      if (c.x === T3_SINK.x && c.y === T3_SINK.y) { cells.push(c); hit = "sink"; break; }
      if (!walkable(project, FS2_T3, c)) break;
      cells.push(c);
    }
    rays.set(`${m.key}:${d}`, { cells, hit });
  }
  // 설계 확인 — 답 길이 이어지고, 미끼 길은 수정에 막힌다.
  const want: [string, Dir, string][] = [["m1", "left", "m2"], ["m2", "up", "m3"], ["m3", "right", "m4"], ["m4", "up", "stair"], ["m1", "up", "m5"], ["m5", "left", "sink"]];
  for (const [k, d, hit] of want) if (rays.get(`${k}:${d}`)?.hit !== hit) throw new Error(`[fallen-star tower] 3층 빛줄기 ${k} ${d} 가 ${hit} 에 닿지 않는다(${rays.get(`${k}:${d}`)?.hit})`);

  // 빛 계산(공통 이벤트) — 첫 거울은 천창 빛을 늘 받는다. 다섯 번 번지면 어떤 길이든 끝까지 닿는다.
  const CE_BEAM = "ce_fs2_t3_beam";
  const beam: Command[] = [
    ...T3_MIRRORS.flatMap((m) => [setSw(litOf(m.key), false), ...DIRS4.map((d) => setSw(segOf(m.key, d), false))]),
    setSw(litOf("m1")),
  ];
  const stairHits: Condition[] = [];
  for (let pass = 0; pass < T3_MIRRORS.length; pass += 1) {
    for (const m of T3_MIRRORS) order(m.first).forEach((d, v) => {
      const ray = rays.get(`${m.key}:${d}`)!;
      const cond: Rec = { kind: "all", conditions: [sw(litOf(m.key)), { kind: "variable", variableId: varOf(m.key), op: "==", value: v }] };
      beam.push(fork(cond, [setSw(segOf(m.key, d)), ...(ray.hit && ray.hit !== "stair" && ray.hit !== "sink" ? [setSw(litOf(ray.hit))] : [])]));
      if (pass === 0 && ray.hit === "stair") stairHits.push(sw(segOf(m.key, d)));
    });
  }
  beam.push(fork({ kind: "all", conditions: [{ kind: "any", conditions: stairHits }, sw(SW_T3_SOLVED, false)] }, [
    wait(300), se("easyrpg-sound-chime2"),
    fx("magic", T3_STAIR.x, T3_STAIR.y, 1600), fx("sparkle", T3_STAIR.x, T3_STAIR.y + 1, 1600), flash("white", 400), shake(2, 400),
    narrate("빛줄기가 계단 빛 막에 꽂혔다.\n막이 녹듯이 걷혀 간다."),
    setSw(SW_T3_SOLVED),
    item("item_ether", 1), { kind: "changeGold", op: "+=", amount: 150 } as unknown as Command,
    sys("계단 곁 틈에서 「마력약」과 150G를 찾았다."),
    say(ELENA, "됐다. …천문대 렌즈도\n이렇게 빛을 모았겠지."),
  ]));
  const ces = project.commonEvents.filter((c) => c.id !== CE_BEAM);
  ces.push({ id: CE_BEAM, name: "B10: 3층 빛줄기 계산", trigger: "none", commands: beam });
  project.commonEvents = ces;
  const callBeam: Command = { kind: "callCommonEvent", commonEventId: CE_BEAM } as unknown as Command;

  // 거울 — 조사하면 지금 어느 쪽을 보는지 듣고, 돌릴 쪽을 고른다.
  const LOOK_DARK = { sprite: { type: "bundled", id: "tex_easyrpg_charset_object2" }, direction: "down", pattern: charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 1 }) };
  const LOOK_LIT = { sprite: { type: "bundled", id: "tex_easyrpg_charset_object2" }, direction: "down", pattern: charsetFrameIndex({ characterIndex: 6, direction: "down", pattern: 1 }) };
  for (const m of T3_MIRRORS) {
    const dirs = order(m.first);
    const nowLine = dirs.map((d, v) => fork({ kind: "variable", variableId: varOf(m.key), op: "==", value: v }, [narrate(`거울 면이 ${DIR_WORD[d]}쪽을 향해 있다.`)]));
    const turn: Command = { kind: "choices", prompt: "어느 쪽으로 돌릴까?", cancelBehavior: "branch", cancelBranch: [], options: [
      ...dirs.map((d, v) => ({ text: `${DIR_WORD[d]}쪽`, branch: [
        { kind: "setVariable", variableId: varOf(m.key), op: "=", value: v } as unknown as Command,
        se("cc0-se-osx-metal-03"), callBeam,
      ] })),
      { text: "그대로 둔다", branch: [] },
    ] } as unknown as Command;
    const body = (lit: boolean): Command[] => [
      narrate(lit ? "거울에 빛이 맺혀 있다." : "어두운 거울. 아직 빛이 닿지 않는다."),
      ...nowLine, turn,
    ];
    addEv(project, FS2_T3, `ev_fs2_t3_${m.key}`, m.name, m.at, [
      page(`ev_fs2_t3_${m.key}_dark`, "어두움", [], body(false), { graphic: LOOK_DARK, priority: "same", overlapForbidden: true }),
      page(`ev_fs2_t3_${m.key}_lit`, "빛", [sw(litOf(m.key))], body(true), { graphic: LOOK_LIT, priority: "same", overlapForbidden: true }),
    ]);
  }
  // 빛줄기가 흐르는 길 — 켜진 길마다 반짝이(계산은 처음 한 번 여기서).
  const flow: Command[] = [fork(sw(SW_INIT, false), [setSw(SW_INIT), callBeam])];
  for (const m of T3_MIRRORS) for (const d of DIRS4) {
    const ray = rays.get(`${m.key}:${d}`)!;
    if (!ray.cells.length) continue;
    flow.push(fork(sw(segOf(m.key, d)), [
      ...ray.cells.map((c) => fx("sparkle", c.x, c.y, 1100)),
      ...(ray.hit === "sink" ? [fx("smoke", T3_SINK.x, T3_SINK.y, 900)] : []),
    ]));
  }
  flow.push(fx("sparkle", T3_MIRRORS[0].at.x, T3_MIRRORS[0].at.y - 1, 1100), wait(1300));
  addEv(project, FS2_T3, "ev_fs2_t3_beam", "빛줄기", { x: 0, y: 1 }, [
    page("ev_fs2_t3_beam_p", "빛줄기", [], flow, { trigger: { kind: "parallel" }, priority: "below" }),
  ]);
  // 계단 — 빛 막이 걷히기 전에는 한 줄.
  const stairEv = ev(project, FS2_T3, "ev_fs2_sky_tower_f3_stair_next");
  const goPage = (stairEv.pages ?? []).find((pg) => pg.commands.some((c) => c.kind === "transfer"));
  if (!goPage) throw new Error("[fallen-star tower] 3층 계단 이동이 없다");
  exec(project, "upsert_event", { mapId: FS2_T3, replacePages: true, event: { id: stairEv.id, name: "4층 계단", x: stairEv.x, y: stairEv.y, trigger: goPage.trigger, commands: [], pages: [
    page(`${stairEv.id}_seal`, "빛 막", [], [narrate("계단 위에 희미한 빛 막이 쳐져 있다.\n손을 대면 차갑게 밀려난다.")], { trigger: goPage.trigger, priority: goPage.priority }),
    { ...goPage, id: `${stairEv.id}_go`, name: "4층으로", conditions: [...(goPage.conditions ?? []).filter((c) => !(c.kind === "switch" && c.switchId === SW_T3_SOLVED)), sw(SW_T3_SOLVED)] },
  ] } });
  // 빛 막 — 풀기 전엔 계단에 막이 일렁인다.
  addEv(project, FS2_T3, "ev_fs2_t3_seal_glow", "빛 막", { x: 0, y: 1 }, [
    page("ev_fs2_t3_seal_glow_p", "일렁임", [], [fx("magic", T3_STAIR.x, T3_STAIR.y, 1400), wait(1700)], { trigger: { kind: "parallel" }, priority: "below" }),
    page("ev_fs2_t3_seal_glow_off", "걷힘", [sw(SW_T3_SOLVED)], [], { priority: "below" }),
  ]);
  // 천창 — 첫 거울에 떨어지는 빛과 계단 빛 막. 층 전체는 조금 어둡게(1층 횃불·2층 서고와 다른 빛).
  exec(project, "set_lighting_volume", { mapId: FS2_T3, applyMode: "map", ambient: 0.42, color: "#0c1424", sources: [
    { id: "skylight", at: { x: T3_MIRRORS[0].at.x, y: T3_MIRRORS[0].at.y }, radius: 3, intensity: 1, color: "#f4f0c8", flicker: false },
    { id: "seal", at: { x: T3_STAIR.x, y: T3_STAIR.y + 1 }, radius: 2, intensity: 0.8, color: "#a8d8ff", flicker: true },
    { id: "sink", at: { x: T3_SINK.x, y: T3_SINK.y }, radius: 2, intensity: 0.5, color: "#b080ff", flicker: true },
    { id: "player", at: { kind: "player" }, radius: 3, intensity: 0.5, color: "#ffc070", flicker: true },
  ] });

  // 들어서면 한 번.
  addEv(project, FS2_T3, "ev_fs2_t3_arrive", "하늘탑 3층", { x: 0, y: 1 }, [
    page("ev_fs2_t3_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_t3_arrive_run", "거울의 층", [sw(SW_T2_DONE)], [
      wait(400),
      say(ELENA, "천장에 유리창이 나 있어. 빛이 들어와.\n…여기 거울들, 천문대 렌즈 틀이랑 모양이 같아."),
      say(KAEL, "천문대 렌즈는 하늘을 봤는데,\n여기 거울은 서로를 비추네."),
      setSw(SW_T3_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_t3_arrive_done", "끝", [sw(SW_T3_ARRIVE)], [], { priority: "below" }),
  ]);
  // 적 — 아래 방(동쪽 끝) 결정 거미, 가운데 서고 회로뱀.
  const spiders = firstOk([{ x: 17, y: 21 }, { x: 16, y: 20 }, { x: 18, y: 21 }, { x: 15, y: 22 }], (c) => exec(project, "place_field_enemy", {
    mapId: FS2_T3, x: c.x, y: c.y, troopId: T_SPIDERS, behavior: "chase", patrol: { length: 2, axis: "horizontal" },
    sightRange: 6, vision: "cone", pace: "normal", approachStyle: "pounce", respawnSec: 120, checkpointOnEntry: true,
  }));
  const snakes = firstOk([{ x: 18, y: 12 }, { x: 17, y: 12 }, { x: 19, y: 13 }, { x: 20, y: 13 }], (c) => exec(project, "place_field_enemy", {
    mapId: FS2_T3, x: c.x, y: c.y, troopId: T_SNAKES, behavior: "chase", patrol: { length: 1, axis: "horizontal" },
    sightRange: 5, vision: "cone", pace: "normal", approachStyle: "slither", respawnSec: 120, checkpointOnEntry: true,
  }));
  if (!spiders || !snakes) throw new Error("[fallen-star tower] 3층 적 자리가 없다");
  firstOk([{ x: 5, y: 21 }, { x: 5, y: 22 }, { x: 6, y: 20 }, { x: 8, y: 24 }], (c) => exec(project, "place_chest", {
    mapId: FS2_T3, x: c.x, y: c.y, contents: { itemId: "item_hi_potion" }, name: "녹슨 상자", id: "ev_fs2_t3_chest",
  }));
}

// ════════════════════════════════════════════════════════════════════
// 4. 4층 「렌즈 대기실」 — B11 이리스 재회
// ════════════════════════════════════════════════════════════════════

/** 이리스의 관 — 동서로 누운 석관(닫힘 → 뚜껑이 밀린 열림). */
const COFFIN_KIT = { closed: "bd-pick-dungeon-theme-sarcophagus-ew", open: "bd-pick-dungeon-theme-sarcophagus-ew-open" } as const;

/** 4층 기본 카메라 배율 — 둥근 방이 화면을 채운다(배율 1 은 왼쪽·아래가 검은 허공이었다, 감독 2026-10-30). */
/** 4층 기본 배율. 정수만(도트 굵기 — #3950 이 소수 배율을 정수로 맞춘다). 23×26 방은 1배면 좌우 3칸 반이 검게 남고, 2배면 방이 화면을 채운다. */
const T4_ZOOM = 2;
const T4 = {
  arrive: { x: 15, y: 22 },
  coffin: { x: 15, y: 11 },         // 석관(동서 2×1) 왼쪽 — (15..16, 11). 바로 뒤(북쪽)가 큰 렌즈
  coffinFront: { x: 15, y: 12 },    // 관을 조사하는 칸(관 바로 아래)
  iris: { x: 17, y: 11 },           // 깨어난 이리스가 서는 칸(관 동쪽 곁)
  /** 카엘이 다가가 이리스(17,11)와 마주 서는 칸. 위를 보고 서면 동료가 양옆(16,12)·(18,12)에 횡대로 선다 —
   *  옆을 보고 서면 횡대 칸이 관·벽에 막혀 동료가 카엘 밑에 겹쳐 섰다(첫 플레이 검수 2026-10-31). */
  irisNear: { x: 17, y: 12 },
  besideKael: [{ x: 16, y: 12 }, { x: 18, y: 12 }],
  doorway: [{ x: 15, y: 13 }, { x: 16, y: 13 }],
  dark: { x: 14, y: 19 },
  alcovePlugs: [{ x: 10, y: 19 }, { x: 10, y: 20 }],
  pageStar: { x: 3, y: 20 },
  pageHand: { x: 7, y: 19 },
  stair: { x: 12, y: 7 },
};

/**
 * 링 계단방의 벽 계단 칸을 4층 같은 자리에 옮긴다(4층 둥근 방은 계단 없는 링이다).
 * main #4125(2026-10-31) 뒤로 링 계단방은 한 층 걸러 온다 — 꼭대기(4층)가 링이면 3층은 팔각 홀, 2층이 링이다. 2층 링 방은 4층 링과 같은 칸(x11~20 y6~14)에 선다.
 */
function copyStair(project: Project): void {
  const from = M(project, FS2_T2), to = M(project, FS2_T4);
  const stairAt = (mapId: string) => M(project, mapId).events.find((e) => e.id === `ev_${mapId}_stair_next`);
  const src = stairAt(FS2_T2);
  if (!src || src.x !== T4.stair.x || src.y !== T4.stair.y) throw new Error(`[fallen-star tower] 2층 링 계단(${src?.x},${src?.y})이 4층 계단 자리(${T4.stair.x},${T4.stair.y})와 다르다`);
  const layers = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
  // 2층 둥근 방 서쪽(계단 x11~13 y5~8 + 4층 서쪽 책장이 서 있던 x13~14 y7~10 바닥)을 통째로 — 책장 반쪽이 남지 않게.
  for (let y = 4; y <= 10; y += 1) for (let x = 10; x <= 14; x += 1) {
    const i = y * from.width + x, j = y * to.width + x;
    for (const l of layers) {
      const a = (from as unknown as Record<string, number[] | undefined>)[l], b = (to as unknown as Record<string, number[] | undefined>)[l];
      if (a && b) b[j] = a[i]!;
    }
  }
}

function floorFour(project: Project, exec: Exec): void {
  for (const [id, name] of [
    [SW_T4_ARRIVE, "B11: 4층 어둠"], [SW_T4_ROOM, "B11: 렌즈 대기실의 관"], [SW_IRIS_WAKE, "B11: 이리스가 깨어남"], [SW_IRIS_BACK, "B11: 이리스 합류"],
    [SW_PAGE_NAME, "B11: 일지 쪽(별 이름)"], [SW_PAGE_HAND, "B11: 일지 쪽(엘레나 손)"], [SW_BE_WELL, "B11: 「잘 지내」"]
  ] as const) ensureSwitch(project, id, name);
  copyStair(project);
  exec(project, "set_map_properties", { mapId: FS2_T4, zoom: T4_ZOOM });
  // 꼭대기(B12)를 먼저 잇는다 — 둥근 방 문 이벤트가 생기면 계단 쪽이 갈려 연결 도구가 「봉쇄」로 거절한다.
  buildSummitMap(project, exec, T4.stair);
  for (const c of [T4.arrive, T4.coffinFront, T4.iris, ...T4.doorway, T4.dark, ...T4.alcovePlugs, T4.pageStar, T4.pageHand]) mustWalk(project, FS2_T4, c, "4층");
  for (const c of [T4.irisNear, ...T4.besideKael]) mustWalk(project, FS2_T4, c, "4층");

  // 렌즈 대기실 — 북쪽 벽 앞 큰 렌즈(등대 프레넬 렌즈), 그 앞 석관, 양옆 수정 받침·촛대, 벽에 별자리 지도. 모두 stamp_object.
  if (!stamp(project, exec, FS2_T4, COFFIN_KIT.closed, T4.coffin)) throw new Error("[fallen-star tower] 4층 석관을 못 놓았다");
  const placed = (kit: string, cands: Cell[]): Cell | null => firstOk(cands, (c) => { if (!stamp(project, exec, FS2_T4, kit, c)) throw new Error("x"); return true; })?.at ?? null;
  const lens = placed("bd-pick-headland-lighthouse-lamp-lens", [{ x: 14, y: 7 }, { x: 15, y: 7 }]);
  if (!lens) throw new Error("[fallen-star tower] 4층 렌즈를 못 놓았다");
  const pedW = placed("bd-pick-dungeon-theme-crystal-pedestal", [{ x: 13, y: 9 }, { x: 12, y: 10 }, { x: 13, y: 10 }]);
  const pedE = placed("bd-pick-dungeon-theme-crystal-pedestal", [{ x: 18, y: 11 }, { x: 19, y: 11 }, { x: 18, y: 10 }]);
  const candW = placed("bd-pick-dungeon-theme-iron-candelabra", [{ x: 14, y: 8 }, { x: 14, y: 9 }, { x: 13, y: 7 }, { x: 12, y: 11 }]);
  const candE = placed("bd-pick-dungeon-theme-iron-candelabra", [{ x: 18, y: 7 }, { x: 18, y: 8 }, { x: 19, y: 7 }, { x: 20, y: 10 }]);
  placed("bd-pick-wizard-tower-starmap", [{ x: 17, y: 5 }, { x: 13, y: 5 }, { x: 18, y: 6 }, { x: 12, y: 6 }]);

  // 조명 — 빛 웅덩이: 렌즈(가장 밝다)·석관·수정 받침 둘·촛대 둘·주인공 등불. 어둠 세기는 아래 dark 장애물이 0.82 로 잡는다(빛 웅덩이 밖은 캄캄하게).
  const centre = (c: Cell | null, dx: number, dy: number): Rec | null => (c ? { x: c.x + dx, y: c.y + dy } : null);
  const sources = [
    { id: "lens", at: centre(lens, 1, 2), radius: 4, intensity: 0.95, color: "#d8fff0", flicker: false },
    { id: "coffin", at: { x: T4.coffin.x + 1, y: T4.coffin.y }, radius: 2, intensity: 0.8, color: "#7dffc0", flicker: true },
    { id: "ped_w", at: centre(pedW, 0, 0), radius: 2, intensity: 0.7, color: "#9fe8ff", flicker: false },
    { id: "ped_e", at: centre(pedE, 0, 0), radius: 2, intensity: 0.7, color: "#9fe8ff", flicker: false },
    { id: "cand_w", at: centre(candW, 0, 0), radius: 2, intensity: 0.65, color: "#ffb860", flicker: true },
    { id: "cand_e", at: centre(candE, 0, 0), radius: 2, intensity: 0.65, color: "#ffb860", flicker: true },
    { id: "player", at: { kind: "player" }, radius: 2, intensity: 0.45, color: "#ffc070", flicker: true },
  ].filter((src) => src.at);
  // 0.62 는 「발밑이 캄캄하다」는 글과 달리 방이 다 보였다(첫 플레이 검수 2026-10-31) — 빛 웅덩이 밖은 거의 안 보이게 짙게.
  exec(project, "set_lighting_volume", { mapId: FS2_T4, applyMode: "map", ambient: 0.82, color: "#040c0a", sources });
  // 어둠 — 서쪽 골방 길목 두 칸은 어두운 동안 막히고(blockCells), 이리스가 돌아오면(litSwitchId) 들어설 때마다 밝다.
  exec(project, "place_field_obstacle", {
    mapId: FS2_T4, x: T4.dark.x, y: T4.dark.y, kind: "dark", requiresSkillId: FS2_SKILL_FINGERLIGHT, skillName: "손끝 빛", machine: "none",
    id: "ev_fs2_t4_dark", name: "렌즈 대기실의 어둠", darkness: 0.82, blockCells: T4.alcovePlugs, litSwitchId: SW_IRIS_BACK,
    hint: "이리스가 손끝을 들자 둘레가 환해졌다.",
    blockedText: "발밑이 캄캄하다.\n한 발짝 앞이 바닥인지 낭떠러지인지 모르겠다.",
  });
  // 도구의 어둠 자동 페이지는 4층에 들어설 때마다(체크포인트·계단 왕복 포함) 「발밑이 캄캄하다 … 손끝 빛을 쓸 줄 아는 동료가 있으면」을 띄웠다 —
  // 도착 대사(엘레나·새라)보다 먼저 답(누가 밝히는지)을 말하고, 드나들 때마다 되풀이됐다(첫 플레이 검수 2026-11-01). 들어설 때는 말없이 어둡게만 둔다.
  // 골방 길목(blockCells)을 조사하면 여전히 「발밑이 캄캄하다」 한 줄이 나온다.
  for (const pg of ev(project, FS2_T4, "ev_fs2_t4_dark").pages ?? []) {
    for (const c of pg.commands) if (c.kind === "fork") (c as unknown as { else: Command[] }).else = [];
  }
  const light = project.database.skills.find((s) => s.id === FS2_SKILL_FINGERLIGHT);
  if (!light) throw new Error("[fallen-star tower] 손끝 빛 기술이 없다");
  Object.assign(light, { name: "손끝 빛", description: "필드 기술. 손끝에 빛을 맺어 어둠을 밝힌다.\n이리스가 처음 배운 「아침」의 빛." });
  const ce = project.commonEvents.find((c) => c.id === (light as unknown as Rec).fieldCommonEventId);
  if (ce) ce.commands = [narrate("이리스가 손끝을 들었다.\n작은 빛이 둘레로 번져 나간다."), { kind: "setLighting", ambient: 0, transitionMs: 900 } as unknown as Command];

  // 들어서면 한 번 — 어둠 속 초록 불빛.
  addEv(project, FS2_T4, "ev_fs2_t4_arrive", "하늘탑 4층", { x: 0, y: 1 }, [
    page("ev_fs2_t4_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_t4_arrive_run", "어둠", [sw(SW_T3_SOLVED)], [
      stopBgm(),
      wait(600),
      say(ELENA, "불씨를 켜도 손바닥만 밝아.\n…이 층은 빛을 먹나 봐."),
      say(SARAH, "위쪽. 초록 불빛이 새어 나와."),
      say(KAEL, "이리스야. …가자."),
      setSw(SW_T4_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_t4_arrive_done", "끝", [sw(SW_T4_ARRIVE)], [], { priority: "below" }),
  ]);
  // 둥근 방에 들어서면 — 관.
  T4.doorway.forEach((c, i) => addEv(project, FS2_T4, `ev_fs2_t4_room_${i}`, "렌즈 대기실", c, [
    page(`ev_fs2_t4_room_${i}_p`, "관", [], [
      cutBegin(),
      se("cc0-se-osx-metal-03"),
      camTo("ev_fs2_t4_coffin", 1200, 2),
      narrate("커다란 렌즈 앞에 석관이 하나 놓여 있다.\n뚜껑 틈으로 초록 글자가 흘러나온다."),
      say(ELENA, "은빛 알 안쪽이랑 같은 글자야.\n…이리스는 저 안이야."),
      camBack(900, T4_ZOOM),
      setSw(SW_T4_ROOM),
      cutLabel(), cutEnd(), setSw(SW_T4_ROOM),
    ], { trigger: { kind: "playerTouch" }, priority: "below" }),
    page(`ev_fs2_t4_room_${i}_done`, "끝", [sw(SW_T4_ROOM)], [], { priority: "below" }),
  ]));

  // 이리스 — 깨어나기 전엔 없다.
  addEv(project, FS2_T4, "ev_fs2_t4_iris", IRIS, T4.iris, [
    page("ev_fs2_t4_iris_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_t4_iris_awake", "깨어남", [sw(SW_IRIS_WAKE)], [], { graphic: chip(IRIS_CHIP[0], IRIS_CHIP[1], "down"), priority: "same", overlapForbidden: true }),
    page("ev_fs2_t4_iris_joined", "합류", [sw(SW_IRIS_BACK)], [], { priority: "below" }),
  ]);
  const forgetThree = (): Command[] => [SKILL_SHOT, SKILL_RAPID, SKILL_SNIPE].map((id) => learn(IRIS_ID, id, "forget"));
  // 관 — 재회 장면.
  // 뚜껑이 밀리는 그림 — 닫힘 석관 칸을 열림 석관 칸으로(키트 그림 그대로).
  const lidOpen: Command[] = (() => {
    const ts = project.tilesets.beodeul_city as unknown as { structureKits?: { id: string; rows: { upperTiles?: number[] }[] }[] } | undefined;
    const row = ts?.structureKits?.find((k) => k.id === COFFIN_KIT.open)?.rows[0]?.upperTiles ?? [];
    if (row.length !== 2) throw new Error("[fallen-star tower] 열린 석관 그림이 없다");
    return row.map((tile, dx) => ({ kind: "changeTile", mapId: FS2_T4, layer: "upper", x: T4.coffin.x + dx, y: T4.coffin.y, tile } as unknown as Command));
  })();
  const reunion: Command[] = [
    cutBegin(), letterbox(),
    { kind: "stopAudio", channel: "bgm" } as unknown as Command,
    // 카엘이 한 걸음 물러선다 — 바로 밑 칸에 서면 카엘·동료 그림이 석관을 반쯤 가렸다(QA 2026-10-29). 한 줄 띄워 관이 통째로 보이게.
    route("@player", [{ kind: "move", dir: "down" }, { kind: "turn", dir: "up" }]),
    // 가까이 — 석관과 그 앞에 선 카엘만 화면에 차게.
    camTo("ev_fs2_t4_coffin", 1400, 2),
    say(KAEL, "이리스."),
    wait(900),
    narrate("관은 조용했다. 뚜껑 위로 초록 글자만 깜빡였다."),
    say(KAEL, "…열게."),
    se("cc0-se-osx-metal-03"), shake(1, 600),
    ...lidOpen,
    narrate("카엘이 무거운 뚜껑을 힘껏 밀어젖혔다."),
    // 이리스는 관 속(오른쪽 칸)에서 일어나 관 밖으로 뛰어내린다 — 「원래 서 있던 사람」으로 읽혔다(적대 VQA 2026-10-30).
    m2("m2-040-set-event-location", { target: "ev_fs2_t4_iris", mapId: FS2_T4, x: T4.coffin.x + 1, y: T4.coffin.y }),
    fx("sparkle", T4.coffin.x + 1, T4.coffin.y, 1400),
    flash("white", 500),
    setSw(SW_IRIS_WAKE),
    wait(900),
    route("ev_fs2_t4_iris", [{ kind: "setDirectionFix", enabled: true }, { kind: "jump", dx: 1, dy: 0, heightPx: 10, durationMs: 520 }, { kind: "setDirectionFix", enabled: false }]),
    fx("dust", T4.iris.x, T4.iris.y, 600),
    // 탑이 걷어 간 기록 셋 — 직업이 주는 기술도 「잊기」로 빠진다(일지를 다시 읽으면 하나씩 돌아온다).
    ...forgetThree(),
    wait(700),
    camTo("ev_fs2_t4_iris", 700, 2),
    // 깨어난 이리스가 카엘 쪽으로 고개를 돌린다.
    route("ev_fs2_t4_iris", [{ kind: "turn", dir: "left" }]),
    say(IRIS, "…신호, 수신. 현지 시각 불명.\n귀환 준비 중입니다. 기록을 정리합니다."),
    say(KAEL, "이리스, 나야. 카엘."),
    emote("ev_fs2_t4_iris", "question", 900),
    wait(400),
    say(IRIS, "…누구세요? 아니, 알아요.\n모르는데 알아요."),
    // 카엘이 이리스 앞으로 다가선다(이리스 바로 아래, 마주 본다). 동료는 카엘 양옆에 선다.
    route("@player", [{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }, { kind: "move", dir: "up" }, { kind: "turn", dir: "up" }]),
    route("ev_fs2_t4_iris", [{ kind: "turn", dir: "down" }]),
    narrate("이리스가 품에 안고 있던 일지를 펼쳤다."),
    narrate("넘기는 쪽마다 글자가 하얗게 바래 간다."),
    say(IRIS, "일지에 당신 글씨가 있어요.\n그런데 읽으려니까 자꾸 지워져요."),
    say(ELENA, "탑이 이리스 기록을 걷어 가고 있어.\n…돌아가기 전에 싹 비우는 거야."),
    say(SARAH, "발렌 님이 끊겠다던 줄이 이거였군."),
    say(KAEL, "…괜찮아. 내가 읽어 줄게.\n약속했잖아."),
    // 둘을 한 화면에 — 천천히 당긴다.
    camTo("ev_fs2_t4_coffin", 2200, 3, 6),
    bgm(IRIS_BGM, 2500),
    narrate("카엘이 바랜 쪽을 짚었다. 제 글씨였다."),
    say(KAEL, "「오늘, 이리스가 빵을 먹었다.\n따뜻했다고 했다.」 …기억나?"),
    // 읽은 줄이 돌아오는 순간 — 렌즈와 수정 받침이 함께 맥박친다.
    // 빛이 약해 안 읽혔다(적대 VQA) — 렌즈·수정·이리스가 한 번에, 화면이 하얗게 한 번 숨 쉰다(초록 플래시는 화면이 통째로 초록이 됐다).
    flash("white", 400),
    fx("heal", T4.iris.x, T4.iris.y, 1600), se("easyrpg-sound-recovery7"),
    fx("magic", (lens?.x ?? T4.coffin.x) + 1, (lens?.y ?? T4.coffin.y - 4) + 2, 1800),
    fx("sparkle", (lens?.x ?? T4.coffin.x) + 1, (lens?.y ?? T4.coffin.y - 4) + 2, 1800),
    ...(pedW ? [fx("magic", pedW.x, pedW.y, 1600), fx("sparkle", pedW.x, pedW.y - 1, 1600)] : []),
    se("easyrpg-sound-chime2"),
    sys("이리스가 「광선 조준」을 다시 떠올렸다."),
    wait(500),
    say(IRIS, "맛은 안 나요.\n그런데 이 줄은 따뜻해요."),
    emote("ev_fs2_t4_iris", "heart", 1000),
    // 이리스가 카엘을 내려다본다(이미 마주 서 있다 — 한 걸음 내려오면 카엘 자리에 겹쳤다).
    route("ev_fs2_t4_iris", [{ kind: "turn", dir: "down" }]),
    say(IRIS, "한 번 더 읽어 주세요. 몇 번이고."),
    say(KAEL, "응. 몇 번이고."),
    say(ELENA, "이리스, 손 줘. …차가워.\n그래도 안 떨리네."),
    route("ev_fs2_t4_iris", [{ kind: "turn", dir: "left" }]),
    say(IRIS, "떨리는 건 흉내예요.\n…지금은 흉내 안 내는데도 떨려요."),
    route("ev_fs2_t4_iris", [{ kind: "turn", dir: "down" }]),
    wait(700),
    say(IRIS, "어둡네요. 잠깐만요."),
    se("easyrpg-sound-recovery7"),
    { kind: "setLighting", ambient: 0, transitionMs: 1800 } as unknown as Command,
    camBack(1600, T4_ZOOM),
    narrate("이리스의 손끝에 작은 빛이 맺혔다.\n빛은 금세 층 전체로 번져 나갔다."),
    fx("sparkle", T4.pageStar.x, T4.pageStar.y, 1600), fx("sparkle", T4.pageHand.x, T4.pageHand.y, 1600),
    camTo("ev_fs2_t4_page_star", 1200, T4_ZOOM),
    say(IRIS, "저기, 종이가 떨어져 있어요.\n…제 일지 쪽이에요."),
    camBack(900, T4_ZOOM),
    { kind: "changeParty", actorId: IRIS_ID, action: "add" } as unknown as Command,
    // 1막 끝(Lv13)에 멈춰 있던 이리스를 탑까지 올라온 일행 레벨에 맞춘다(FS_ACT2_JOIN_LEVEL.iris, mobBalance — 1막에서 이어 한 도착 레벨).
    { kind: "changeLevel", actorId: IRIS_ID, op: "=", amount: FS_ACT2_JOIN_LEVEL.iris } as unknown as Command,
    learn(IRIS_ID, FS2_SKILL_FINGERLIGHT),
    { kind: "recoverAll", actorId: IRIS_ID } as unknown as Command,
    setSw(SW_IRIS_BACK),
    sys("이리스가 다시 일행이 되었다."),
    clearLetterbox(),
    cutLabel(), cutEnd(),
    // 넘겨도 같은 끝 — 합류·조명은 다시 확실히.
    setSw(SW_IRIS_WAKE), setSw(SW_IRIS_BACK), ...lidOpen,
    { kind: "setLighting", ambient: 0, transitionMs: 300 } as unknown as Command,
  ];
  addEv(project, FS2_T4, "ev_fs2_t4_coffin", "이리스의 관", { x: T4.coffin.x, y: T4.coffin.y }, [
    page("ev_fs2_t4_coffin_p", "관", [], reunion, { priority: "same" }),
    page("ev_fs2_t4_coffin_open", "빈 관", [sw(SW_IRIS_BACK)], [narrate("빈 관. 안쪽에 초록 글자가 아직 흐른다.\n「귀환까지 기록 정리 중」.")], { priority: "same" }),
  ]);
  // 석관 오른쪽 칸도 같은 조사.
  addEv(project, FS2_T4, "ev_fs2_t4_coffin_r", "이리스의 관", { x: T4.coffin.x + 1, y: T4.coffin.y }, [
    page("ev_fs2_t4_coffin_r_p", "관", [], [{ kind: "callMapEvent", eventId: "ev_fs2_t4_coffin" } as unknown as Command], { priority: "same" }),
    page("ev_fs2_t4_coffin_r_open", "빈 관", [sw(SW_IRIS_BACK)], [narrate("빈 관. 안쪽에 초록 글자가 아직 흐른다.\n「귀환까지 기록 정리 중」.")], { priority: "same" }),
  ]);

  // 일지 쪽 둘 — 손끝 빛이 드러낸 서쪽 골방.
  // 반짝임 — 읽기 전까지 종이 자리에서 빛이 인다(종이 칸 이벤트와 따로 둔다: 뒤 페이지가 이기므로).
  const glint = (id: string, at: Cell, done: string): void => {
    addEv(project, FS2_T4, `${id}_glint`, "일지 쪽 반짝임", { x: at.x, y: at.y - 1 }, [
      page(`${id}_glint_none`, "없음", [], [], { priority: "below" }),
      page(`${id}_glint_on`, "반짝임", [sw(SW_IRIS_BACK)], [fx("sparkle", at.x, at.y, 900), wait(2600)], { trigger: { kind: "parallel" }, priority: "below" }),
      page(`${id}_glint_off`, "읽음", [sw(done)], [], { priority: "below" }),
    ]);
  };
  glint("ev_fs2_t4_page_star", T4.pageStar, SW_PAGE_NAME);
  glint("ev_fs2_t4_page_hand", T4.pageHand, SW_PAGE_HAND);
  const readBoth: Command[] = [
    fork({ kind: "all", conditions: [sw(SW_PAGE_NAME), sw(SW_PAGE_HAND)] }, [
      wait(500),
      narrate("일지 맨 뒤 쪽에, 지워지지 않은 줄이 하나 남아 있다."),
      say(KAEL, "「잊어도 괜찮다.\n카엘이 읽어 줄 거다.」"),
      say(IRIS, "…마차에서 제가 쓴 거예요.\n그때도 알았나 봐요. 카엘이 올 거라는 거."),
      say(KAEL, "왔잖아."),
      say(IRIS, "네. 왔어요."),
      learn(IRIS_ID, FS2_SKILL_BE_WELL), setSw(SW_BE_WELL),
      fx("heal", T4.pageStar.x, T4.pageStar.y, 1200), se("easyrpg-sound-recovery7"),
      sys("이리스가 「잘 지내」를 익혔다."),
      wait(500),
      say(IRIS, "…위에서 누가 불러요.\n「집」 쪽 신호예요. 둥근 방 계단 위."),
      say(KAEL, "같이 가자. 이번엔 같이."),
    ]),
  ];
  addEv(project, FS2_T4, "ev_fs2_t4_page_star", "일지 쪽", T4.pageStar, [
    page("ev_fs2_t4_page_star_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_t4_page_star_p", "일지 쪽", [sw(SW_IRIS_BACK)], [
      narrate("바닥에 일지 한 쪽이 떨어져 있다. 카엘 글씨다."),
      say(KAEL, "「별 이름을 셋 알려 줬다.\n이리스는 맨 끝 별이 제일 좋댔다.」"),
      fx("heal", T4.pageStar.x, T4.pageStar.y, 1000), se("easyrpg-sound-recovery7"),
      sys("이리스가 「충전 광선포」를 다시 떠올렸다."),
      say(IRIS, "맨 끝 별. 제일 늦게 뜨는 별이요.\n…기다려 주는 것 같아서 좋았어요."),
      setSw(SW_PAGE_NAME),
      ...readBoth,
    ], { priority: "below" }),
    page("ev_fs2_t4_page_star_done", "읽음", [sw(SW_PAGE_NAME)], [], { priority: "below" }),
  ]);
  addEv(project, FS2_T4, "ev_fs2_t4_page_hand", "일지 쪽", T4.pageHand, [
    page("ev_fs2_t4_page_hand_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_t4_page_hand_p", "일지 쪽", [sw(SW_IRIS_BACK)], [
      narrate("또 한 쪽. 이번엔 반듯한 이리스 글씨다."),
      say(KAEL, "「엘레나가 손을 녹여 줬다.\n손은 안 시린데, 좋았다.」"),
      fx("heal", T4.pageHand.x, T4.pageHand.y, 1000), se("easyrpg-sound-recovery7"),
      sys("이리스가 「광자 연사」를 다시 떠올렸다."),
      say(ELENA, "…그걸 적어 뒀어?"),
      say(IRIS, "좋았던 건 다 적어요.\n안 그러면 지워지니까요."),
      setSw(SW_PAGE_HAND),
      ...readBoth,
    ], { priority: "below" }),
    page("ev_fs2_t4_page_hand_done", "읽음", [sw(SW_PAGE_HAND)], [], { priority: "below" }),
  ]);

  // 별빛 결정 — 홀 동쪽.
  const save = firstOk([{ x: 19, y: 20 }, { x: 18, y: 19 }, { x: 20, y: 20 }, { x: 18, y: 20 }], (c) => exec(project, "place_savepoint", {
    mapId: FS2_T4, x: c.x, y: c.y, id: "ev_fs2_t4_save", name: "별빛 결정", mode: "slot", objectId: SAVE_CRYSTAL, prompt: "기록하시겠습니까?", sparkleRadius: 2,
  }));
  if (!save) throw new Error("[fallen-star tower] 4층 별빛 결정 자리가 없다");

  // 꼭대기 계단 — 이리스 전에는 한 줄, 뒤에는 author_dungeon 이 이은 이동(B12 꼭대기).
  gateSummitStair(project, exec, SW_IRIS_BACK);

  // 일지 — 이리스의 일지. 깨어날 때 지난 줄들이 펼쳐지고(쓰기), 탑이 셋을 지우고(지우기), 카엘이 읽어 주면 되살아난다.
  const P = (eventId: string, pageId: string, afterText: string) => ({ mapId: FS2_T4, eventId, pageId, afterText });
  exec(project, "configure_story_journal", {
    title: "이리스의 일지",
    writers: [{ id: "iris", name: IRIS }, { id: "kael", name: KAEL }],
    lines: [
      // 같은 대사 뒤에 넣으면 나중 줄이 앞에 붙는다 — 거꾸로 준다.
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "품에 안고 있던 일지를"), action: "write", lineId: "fs2_last", writer: "iris", date: "마차 나흘째", text: "잊어도 괜찮다. 카엘이 읽어 줄 거다." },
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "품에 안고 있던 일지를"), action: "write", lineId: "fs2_hand", writer: "iris", date: "마차 사흘째", text: "엘레나가 손을 녹여 줬다. 손은 안 시린데, 좋았다.", learnActorId: IRIS_ID, learnSkillId: SKILL_RAPID },
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "품에 안고 있던 일지를"), action: "write", lineId: "fs2_star", writer: "kael", date: "광장의 밤", text: "별 이름을 셋 알려 줬다. 이리스는 맨 끝 별이 제일 좋댔다.", learnActorId: IRIS_ID, learnSkillId: SKILL_SNIPE },
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "품에 안고 있던 일지를"), action: "write", lineId: "fs2_bread", writer: "kael", date: "이튿날", text: "오늘, 이리스가 빵을 먹었다. 따뜻했다고 했다.", learnActorId: IRIS_ID, learnSkillId: SKILL_SHOT },
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "품에 안고 있던 일지를"), action: "write", lineId: "fs2_first", writer: "kael", date: "별 떨어진 밤", text: "숲에 떨어진 아이가 깨어났다. 「잘 지내」라고 했더니 대답을 했다." },
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "넘기는 쪽마다"), action: "erase", lineId: "fs2_hand" },
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "넘기는 쪽마다"), action: "erase", lineId: "fs2_star" },
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "넘기는 쪽마다"), action: "erase", lineId: "fs2_bread" },
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "따뜻했다고 했다.」 …기억나?"), action: "reread", lineId: "fs2_bread" },
      { ...P("ev_fs2_t4_page_star", "ev_fs2_t4_page_star_p", "맨 끝 별이 제일 좋댔다.」"), action: "reread", lineId: "fs2_star" },
      { ...P("ev_fs2_t4_page_hand", "ev_fs2_t4_page_hand_p", "손은 안 시린데, 좋았다.」"), action: "reread", lineId: "fs2_hand" },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════
// 둥근 계단방 꾸미기 — author_dungeon 은 링 계단방마다 같은 자리에 같은 책장 둘을 놓아 「층을 복사해 붙인 탑」으로 읽혔다
// (첫 플레이 검수 2026-10-31). 2층(박쥐가 든 회랑)은 책장을 걷고 뼈·부서진 통·돌 부스러기로, 4층은 렌즈·석관이 이미 차지한다.
// ════════════════════════════════════════════════════════════════════

const BOOKSHELF_KITS = ["bd-pick-dungeon-theme-bookshelf", "bd-pick-dungeon-theme-bookshelf-tall"];

function redressRing(project: Project, exec: Exec, mapId: string, swaps: { kit: string; dx: number; dy: number }[][]): void {
  const map = M(project, mapId);
  const ts = project.tilesets.beodeul_city as unknown as { structureKits?: { id: string; width: number; height: number; rows: { upperTiles?: number[] }[] }[] } | undefined;
  const shelfTiles = new Set<number>();
  for (const id of BOOKSHELF_KITS) for (const r of ts?.structureKits?.find((k) => k.id === id)?.rows ?? []) for (const t of r.upperTiles ?? []) if (t >= 0) shelfTiles.add(t);
  if (!shelfTiles.size) throw new Error("[fallen-star tower] 책장 키트 그림이 없다");
  const up = map.upperTiles as number[];
  // 책장 덩이(왼쪽 위 칸) — 위·왼쪽이 책장이 아닌 책장 칸.
  const shelf = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height && shelfTiles.has(up[y * map.width + x]!);
  const anchors: Cell[] = [];
  for (let y = 0; y < Math.min(map.height, 16); y += 1) for (let x = 0; x < map.width; x += 1) if (shelf(x, y) && !shelf(x - 1, y) && !shelf(x, y - 1)) anchors.push({ x, y });
  // 생성기 판이 바뀌어 책장 수가 다르면(다른 방 책장까지 잡을 수 있다) 건드리지 않는다 — 굽기를 멈출 일은 아니다.
  if (anchors.length !== swaps.length) { console.warn(`[fallen-star tower] ${mapId} 둥근 방 책장이 ${anchors.length}개다(기대 ${swaps.length}) — 꾸미기를 건너뛴다`); return; }
  // 걷기: 덩이마다 책장 칸을 비운다(아래층 바닥이 드러난다).
  for (const a of anchors) for (let y = a.y; shelf(a.x, y) || shelf(a.x + 1, y); y += 1) for (const x of [a.x, a.x + 1]) if (shelf(x, y)) up[y * map.width + x] = -1;
  anchors.forEach((a, i) => {
    for (const s of swaps[i]!) if (!stamp(project, exec, mapId, s.kit, { x: a.x + s.dx, y: a.y + s.dy })) throw new Error(`[fallen-star tower] ${mapId} (${a.x + s.dx},${a.y + s.dy}) 에 ${s.kit} 를 못 놓았다`);
  });
}

type Kit = { id: string; width: number; height: number; rows: { upperTiles?: number[] }[] };
function kitOf(project: Project, id: string): Kit {
  const ts = project.tilesets.beodeul_city as unknown as { structureKits?: Kit[] } | undefined;
  const kit = ts?.structureKits?.find((k) => k.id === id);
  if (!kit) throw new Error(`[fallen-star tower] 키트가 없다: ${id}`);
  return kit;
}
/** 생성기가 놓은 기물 하나를 걷는다(윗층 칸이 그 키트 그림과 꼭 맞을 때만 — 판이 바뀌었으면 건드리지 않고 false). */
function liftKit(project: Project, mapId: string, kitId: string, at: Cell): boolean {
  const map = M(project, mapId), kit = kitOf(project, kitId), up = map.upperTiles as number[];
  const cells: [number, number][] = [];
  kit.rows.forEach((r, dy) => (r.upperTiles ?? []).forEach((tile, dx) => { if (tile >= 0) cells.push([(at.y + dy) * map.width + at.x + dx, tile]); }));
  if (!cells.length || cells.some(([i, tile]) => up[i] !== tile)) { console.warn(`[fallen-star tower] ${mapId} (${at.x},${at.y}) 에 ${kitId} 가 없다 — 걷지 않는다`); return false; }
  for (const [i] of cells) up[i] = -1;
  return true;
}
/** 바닥 장식 — 키트 칸이 모두 걷는 바닥이고 이벤트·지켜야 할 칸이 없을 때만 놓는다(후보를 차례로). */
function dress(project: Project, exec: Exec, mapId: string, kitId: string, cands: Cell[], keep: Cell[]): Cell | null {
  const kit = kitOf(project, kitId);
  for (const c of cands) {
    const foot: Cell[] = [];
    for (let dy = 0; dy < kit.height; dy += 1) for (let dx = 0; dx < kit.width; dx += 1) foot.push({ x: c.x + dx, y: c.y + dy });
    if (!foot.every((f) => walkable(project, mapId, f) && freeOfEvents(project, mapId, f) && !keep.some((k) => Math.abs(k.x - f.x) + Math.abs(k.y - f.y) <= 1))) continue;
    if (stamp(project, exec, mapId, kitId, c)) return c;
  }
  console.warn(`[fallen-star tower] ${mapId} ${kitId} 둘 자리가 없다`);
  return null;
}

/**
 * 1층·3층 다시 꾸미기 — 생성기가 두 층에 같은 연금 화로·약초 선반·수정 받침을 놓아 층이 복사돼 보였다(적대 검수 2026-11-01).
 * 1층은 「기사와 기계의 싸움터」: 깨진 바닥·무너진 기둥·쓰러진 심문회 깃발·부서진 관·무기 통. 연금 공방(북쪽 막다른 방)은 그대로.
 * 3층은 「거울의 층」: 연금 화로 자리에 망원경, 술통 자리에 얼음 결정, 남쪽 홀은 결정 거미 둥지(결정 무리·깨진 바닥).
 * 지켜야 할 칸(장면·체크포인트·순찰·거울 빛길)은 비운다.
 */
function redressFloors(project: Project, exec: Exec): void {
  // 1층 — 장면 칸(기계 13,18·19 / 기사 15,19 → 17,19 → 19,19 → 19,20 / 다친 기사 18,20)과 입구·계단·마법진 착지를 비운다.
  const keep1: Cell[] = [T1.arrive, T1.machine, { x: 13, y: 19 }, T1.knight, { x: 16, y: 19 }, { x: 17, y: 19 }, { x: 18, y: 19 }, { x: 19, y: 19 }, T1.knightEnd, { x: 19, y: 20 },
    { x: 34, y: 16 }, { x: 20, y: 19 }, { x: 20, y: 20 }, { x: 7, y: 16 }, T1.stair, { x: 20, y: 28 }, { x: 37, y: 17 }, { x: 36, y: 17 }];
  dress(project, exec, FS2_T1, "bd-pick-dungeon-theme-cracked-floor", [{ x: 10, y: 20 }, { x: 9, y: 20 }, { x: 22, y: 20 }], keep1);
  dress(project, exec, FS2_T1, "bd-pick-dungeon-theme-rubble-heap", [{ x: 31, y: 20 }, { x: 29, y: 19 }, { x: 33, y: 20 }], keep1);
  dress(project, exec, FS2_T1, "bd-pick-dungeon-cave-broken-pillar", [{ x: 24, y: 16 }, { x: 28, y: 16 }], keep1);
  dress(project, exec, FS2_T1, "bd-pick-volcano-cave-pillar-broken-b", [{ x: 10, y: 16 }, { x: 9, y: 16 }], keep1);
  dress(project, exec, FS2_T1, "bd-pick-dungeon-theme-royal-banner", [{ x: 30, y: 16 }, { x: 31, y: 16 }, { x: 29, y: 16 }], keep1);
  dress(project, exec, FS2_T1, "bd-pick-dungeon-theme-armor-stand", [{ x: 32, y: 16 }, { x: 33, y: 16 }], keep1);
  dress(project, exec, FS2_T1, "bd-prop-sword_barrel", [{ x: 35, y: 20 }, { x: 36, y: 20 }, { x: 34, y: 20 }], keep1);
  dress(project, exec, FS2_T1, "bd-pick-aqueduct-sewer-pipe-copper-leak", [{ x: 22, y: 21 }, { x: 23, y: 21 }, { x: 17, y: 21 }], keep1);
  dress(project, exec, FS2_T1, "bd-pick-castle-catacombs-rubble", [{ x: 12, y: 21 }, { x: 11, y: 21 }, { x: 12, y: 17 }], keep1);
  dress(project, exec, FS2_T1, "bd-pick-aqueduct-sewer-rubble", [{ x: 28, y: 20 }, { x: 29, y: 20 }], keep1);

  // 3층 — 거울 빛길·계단·도착 칸을 비운다.
  const keep3: Cell[] = [{ x: 7, y: 6 }, { x: 6, y: 6 }, { x: 8, y: 6 }, { x: 10, y: 22 }, { x: 10, y: 21 }, { x: 2, y: 6 }, { x: 17, y: 21 }, { x: 18, y: 12 }, { x: 5, y: 21 },
    ...T3_MIRRORS.map((m) => m.at)];
  if (liftKit(project, FS2_T3, "bd-pick-wizard-tower-athanor", { x: 3, y: 6 })) stamp(project, exec, FS2_T3, "bd-pick-headland-lighthouse-telescope", { x: 3, y: 6 });
  if (liftKit(project, FS2_T3, "bd-pick-aqueduct-sewer-barrel", { x: 2, y: 10 })) stamp(project, exec, FS2_T3, "bd-pick-dungeon-theme-ice-crystal", { x: 2, y: 9 });
  dress(project, exec, FS2_T3, "bd-pick-dungeon-theme-corrupt-crystal-big", [{ x: 19, y: 23 }, { x: 18, y: 23 }, { x: 20, y: 23 }], keep3);
  dress(project, exec, FS2_T3, "bd-pick-dungeon-theme-ice-crystal", [{ x: 13, y: 19 }, { x: 12, y: 19 }], keep3);
  dress(project, exec, FS2_T3, "bd-pick-dungeon-theme-ice-crystal", [{ x: 7, y: 19 }, { x: 8, y: 19 }, { x: 6, y: 20 }], keep3);
  dress(project, exec, FS2_T3, "bd-pick-dungeon-theme-cracked-floor", [{ x: 12, y: 22 }, { x: 13, y: 23 }, { x: 14, y: 22 }], keep3);
  dress(project, exec, FS2_T3, "bd-pick-aqueduct-sewer-bones", [{ x: 8, y: 24 }, { x: 9, y: 24 }], keep3);
  dress(project, exec, FS2_T3, "bd-pick-wizard-tower-orrery", [{ x: 19, y: 13 }, { x: 20, y: 13 }], keep3);
}

export function ringRooms(project: Project, exec: Exec): void {
  // main #4125 뒤로 1·3층 계단방은 팔각 홀·서쪽 방으로 바뀌어 저마다 다르다. 링 계단방은 2층(과 렌즈·석관이 차지한 4층)만 남았다.
  redressRing(project, exec, FS2_T2, [
    [{ kit: "bd-pick-dungeon-cave-broken-pillar", dx: 0, dy: 0 }, { kit: "bd-pick-aqueduct-sewer-bones", dx: 1, dy: 1 }],
    [{ kit: "bd-pick-shipwreck-reef-broken-barrel", dx: 0, dy: 1 }, { kit: "bd-pick-castle-catacombs-rubble", dx: 1, dy: 0 }],
  ]);
}

// ════════════════════════════════════════════════════════════════════

/** 탑 공통 — 전투 배경·같은 음악(층마다 곡이 바뀌던 것을 하나로)·알아채기·임무 줄기. */
function towerCommon(project: Project, exec: Exec): void {
  for (const mapId of [FS2_T1, FS2_T2, FS2_T3, FS2_T4, FS2_TOP]) {
    exec(project, "set_map_properties", { mapId, battleBackground: "battle-scenery-cave" });
    (M(project, mapId) as unknown as Rec).bgm = { mode: "custom", resourceId: TOWER_BGM };
  }
  const ids = [FS2_T1, FS2_T2, FS2_T3, FS2_T4].flatMap((mapId) => M(project, mapId).events
    .filter((e) => (e.pages ?? []).some((p) => p.movement?.type === "chase") && /troop_fs2_tower_/u.test(JSON.stringify(e.pages)))
    .map((e) => e.id));
  // 기계·뱀은 느리다(돌진 없음), 나방·박쥐·거미는 짧게 덮친다.
  const slow = ids.filter((id) => ["sentinel", "snakes"].some((k) => JSON.stringify(Object.values(project.maps).flatMap((m) => m.events).find((e) => e.id === id)?.pages).includes(`troop_fs2_tower_${k}`)));
  const quick = ids.filter((id) => !slow.includes(id));
  const maps = [FS2_T1, FS2_T2, FS2_T3, FS2_T4];
  if (slow.length) exec(project, "set_field_detection", { mapIds: maps, eventIds: slow, sightRange: 5, coneDegrees: 100, alertMs: 500, rush: false, chaseStepMs: 340, giveUpRange: 8 });
  if (quick.length) exec(project, "set_field_detection", { mapIds: maps, eventIds: quick, sightRange: 6, coneDegrees: 110, alertMs: 220, rush: true, rushSteps: 3, rushStepMs: 110, chaseStepMs: 170 });

  // 임무 「빌린 불」 — 1.24 마지막 줄(하늘탑에 들어선다)을 탑 도착으로 바꾸고 B10·B11 을 잇는다.
  const quest = (project as unknown as { quests?: Rec[] }).quests?.find((q) => q.id === "fs2_main") as { nodes: { id: string; description: string; completesWhen: Rec }[] } & Rec | undefined;
  if (!quest) throw new Error("[fallen-star tower] 임무 fs2_main 이 없다");
  const nodes = quest.nodes.map((n) => (JSON.stringify(n.completesWhen).includes(SW_STOP_B9_OLD) ? { ...n, completesWhen: { kind: "switch", switchId: SW_T1_ARRIVE, value: true } } : n));
  const more: [string, string][] = [
    ...(nodes.some((n) => JSON.stringify(n.completesWhen).includes(SW_T1_ARRIVE)) ? [] : [[SW_T1_ARRIVE, "하늘탑에 들어선다"] as [string, string]]),
    [SW_T2_DONE, "2층에서 흩어진 일행이 서로 쇠창살을 열어 주고 다시 만난다"],
    [SW_T3_SOLVED, "3층 거울들을 돌려 천창 빛을 계단 빛 막까지 잇는다"],
    [SW_IRIS_BACK, "4층 렌즈 대기실의 관에서 이리스를 찾는다"],
    [FS2_SW_B12_DONE, "꼭대기 렌즈실에서 발렌을 막는다. 하넬이 서른 해 전 일을 털어놓는다"],
    [FS2_SW_B13_WON, "탑 깊은 곳에서 올라온 재의 회수자를 쓰러뜨린다"],
    [FS2_SW_STOP_B13, "두 번째 렌즈에 손을 얹고 다시 대답한다"],
  ];
  const start = nodes.length;
  const all = [...nodes, ...more.map(([switchId, description], i) => ({ id: `fs2-${start + i + 1}`, description, completesWhen: { kind: "switch", switchId, value: true } }))];
  exec(project, "define_quest", {
    id: "fs2_main", title: quest.title, summary: quest.summary,
    nodes: all, edges: all.slice(1).map((n, i) => ({ from: all[i]!.id, to: n.id })),
  });
}

export function applyFallenAct2Tower(project: Project, exec: Exec): void {
  EXEC = exec;
  towerData(project, exec);
  ringRooms(project, exec);
  floorOne(project, exec);
  floorTwo(project, exec);
  floorThree(project, exec);
  floorFour(project, exec);
  redressFloors(project, exec);
  applyFallenAct2Summit(project, exec);
  towerCommon(project, exec);
}

/** 꼭대기(act2Summit.ts)가 같은 손잡이로 짓는다. */
export const towerKit = {
  KAEL, ELENA, IRIS, SARAH, HERO, ELENA_ID, IRIS_ID, SARAH_ID, TOWER_BGM, IRIS_BGM, SAVE_CRYSTAL, TOWER_LAYERS,
  say, narrate, sys, m2, wait, sw, setSw, se, bgm, stopBgm, emote, route, walk, shake, flash, fx, letterbox, clearLetterbox,
  fadeOut, fadeIn, camTo, camBack, cutBegin, cutEnd, cutLabel, setSelf, selfSw, page, chip, addEv, ev, ensureSwitch, mustWalk,
  walkable, firstOk, stamp, M, actRow, ENEMY_TOOL_FIELDS,
};
