/**
 * 『폴른 스타』 제2막 — B10 하늘탑 아래층(1~3층) · B11 이리스 재회(4층 렌즈 대기실). 기획 docs/fallen-star/act2-plan.md 7절.
 *
 * 탑 네 층 맵은 B9(act2Opening.ts skyTower — author_dungeon tower floors 4)이 이미 지었다. 여기서는 그 위에 조수 도구로 짓는다.
 *   - 1층 「기사와 기계의 싸움터」: 들어서면 파수 기계가 심문회 기사를 쳐 내는 장면 → 그 기계가 필드 적으로 남는다.
 *     다친 기사(새라의 동료)·별빛 결정·남쪽 방 빛나방·서고 관측 일지.
 *   - 2층 「갈라진 회랑」: author_party_split — 발판이 꺼지며 카엘·새라(서쪽 나무 발판) / 엘레나(동쪽 서고)로 갈린다.
 *     카엘 쪽 톱니 레버가 엘레나 쪽 쇠창살을, 엘레나 쪽 거울 손잡이가 카엘 쪽 쇠창살을 연다. 둥근 방 박쥐.
 *   - 3층 「거울의 층」: author_map_puzzle mirror_beam_refraction 이 4층 계단을 막는다. 거미·회로뱀.
 *   - 4층 「렌즈 대기실」(B11): 어둠(place_field_obstacle dark) 속 관에서 이리스가 깨어난다. 일지(configure_story_journal)의
 *     지워진 줄을 카엘이 읽어 주면 기술이 돌아온다. 이리스 손끝 빛이 서쪽 골방의 일지 쪽 둘을 드러낸다.
 *     둥근 방 계단 = 판본 끝(막 카드·회복·저장·「다음 업데이트」).
 * 새 그림은 없다 — 버들항 던전 키트·RTP 칩·1막 칩만 쓴다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { isPassable } from "@/project/collision";
import { objGraphic } from "@/editor/tools/puzzleKit";
import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { FS_NAMES } from "../fallenStarStory";

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
const SW_T2_TALK = "sw_fs2_t2_split_talk";
const SW_T3_ARRIVE = "sw_fs2_t3_arrive";
const SW_T3_SOLVED = "sw_fs2_t3_mirror_solved";
const SW_T4_ARRIVE = "sw_fs2_t4_arrive";
const SW_T4_ROOM = "sw_fs2_t4_coffin_seen";
const SW_IRIS_WAKE = "sw_fs2_iris_wake";
const SW_IRIS_BACK = "sw_fs2_iris_back";
const SW_PAGE_NAME = "sw_fs2_page_star_read";
const SW_PAGE_HAND = "sw_fs2_page_hand_read";
const SW_BE_WELL = "sw_fs2_iris_be_well";
export const FS2_SW_STOP_B11 = "sw_fs2_release_stop_b11";

const SKILL_RAPID = "skill_gunner_rapid_fire";
const IRIS_RELAY_CLASS = "class_fs2_iris_relay";
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
const camTo = (eventId: string, durationMs = 1100, zoom?: number): Command =>
  m2("m2-201-camera-control", { mode: "panTo", targetEventId: eventId, durationMs: String(durationMs), wait: "true", ...(zoom ? { zoom: String(zoom) } : {}) });
const camBack = (durationMs = 600): Command => m2("m2-201-camera-control", { mode: "return", durationMs: String(durationMs), wait: "true" });
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
function addEv(project: Project, mapId: string, id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  const map = M(project, mapId);
  map.events = map.events.filter((e) => e.id !== id);
  const event = { id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages } as unknown as GameEvent;
  map.events.push(event);
  return event;
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
/** 버들항 키트 칸 — 바꿔 끼울 그림(레버 내림/올림 같은 1칸 키트). */
function kitTile(project: Project, kitId: string): { tile: number; layer: "lower" | "upper" } {
  const ts = project.tilesets.beodeul_city as unknown as { structureKits?: { id: string; rows: { tiles?: number[]; upperTiles?: number[] }[] }[] } | undefined;
  const kit = ts?.structureKits?.find((k) => k.id === kitId);
  const up = kit?.rows[0]?.upperTiles?.[0];
  const lo = kit?.rows[0]?.tiles?.[0];
  if (typeof up === "number" && up >= 0) return { tile: up, layer: "upper" };
  if (typeof lo === "number" && lo >= 0) return { tile: lo, layer: "lower" };
  throw new Error(`[fallen-star tower] 키트 칸이 없다: ${kitId}`);
}

// ════════════════════════════════════════════════════════════════════
// 0. 데이터 — 적·기술
// ════════════════════════════════════════════════════════════════════

const ENEMY_TOOL_FIELDS = new Set(["id", "name", "speciesId", "monsterResourceId", "battleScalePercent", "collapseEffect", "hideHp", "damageTypeRates", "criticalHit", "attackOptions", "skillIds", "level", "stats", "rewards", "actions", "reactions", "stealItems", "stateRates", "elementRates"]);
const actRow = (skillId: string, priority: number) => ({ skillId, priority, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });

/**
 * 탑 적 — 서리 가도(Lv9 늑대 HP240·박쥐 HP200) 다음 단계. 탑에 들어설 때 파티 Lv10~11, 4층에서 Lv12 쯤.
 * 파수 기계는 느리고(lumber) 물리 반감·번개 두 배 — 피해 가거나 엘레나 마법으로. 빛나방은 실명, 회로뱀은 마력을 갉는다.
 */
const TOWER_FOES: { id: string; name: string; art: string; level: number; stats: Rec; skills: [string, number][]; exp: number; gold: number; elementRates?: Rec; damageTypeRates?: Rec; scale?: number }[] = [
  { id: E_SENTINEL, name: "탑 파수 기계", art: "generated-enemy-golem-iron", level: 11, stats: { maxHp: 520, maxMp: 30, attack: 122, defense: 58, mind: 40, agility: 30 },
    skills: [["skill_attack", 6], ["skill_mon_body_slam", 5], ["skill_mon_shell_guard", 3]], exp: 190, gold: 46, elementRates: { thunder: "A", fire: "C", ice: "C" }, damageTypeRates: { physical: 60 }, scale: 115 },
  { id: E_MOTH, name: "빛나방", art: "generated-enemy-moth-dust", level: 10, stats: { maxHp: 190, maxMp: 30, attack: 72, defense: 26, mind: 74, agility: 84 },
    skills: [["skill_attack", 5], [SKILL_MOTH_DUST, 5]], exp: 72, gold: 18, elementRates: { fire: "A", wind: "A" } },
  { id: E_SPIDER, name: "결정 거미", art: "generated-enemy-spider-cave", level: 11, stats: { maxHp: 300, maxMp: 20, attack: 104, defense: 46, mind: 40, agility: 72 },
    skills: [["skill_attack", 6], ["skill_mon_web_shot", 3]], exp: 110, gold: 24, elementRates: { fire: "A", ice: "E" } },
  { id: E_SNAKE, name: "회로뱀", art: "generated-enemy-snake-01", level: 11, stats: { maxHp: 260, maxMp: 30, attack: 94, defense: 40, mind: 60, agility: 62 },
    skills: [["skill_attack", 5], [SKILL_CIRCUIT_BITE, 4]], exp: 96, gold: 22, elementRates: { thunder: "A" } },
];

function towerData(project: Project, exec: Exec): void {
  exec(project, "upsert_skill", { skill: {
    id: SKILL_MOTH_DUST, name: "인광 가루", scope: "enemy", type: "normal", power: 34, variance: 15, hitRate: 95,
    description: "날개에서 푸른 인광 가루를 털어 낸다. 눈에 들어가면 앞이 안 보인다.",
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
    [T_MOTHS, "빛나방 떼", [E_MOTH, E_MOTH, E_MOTH]],
    [T_BATS, "서리박쥐와 빛나방", [E_BAT, E_BAT, E_MOTH]],
    [T_SPIDERS, "결정 거미", [E_SPIDER, E_SPIDER]],
    [T_SNAKES, "회로뱀", [E_SNAKE, E_SNAKE, E_MOTH]],
  ] as const) {
    exec(project, "upsert_troop", { troop: { id, name, enemyIds: [...members], previewBackgroundResourceId: "battle-scenery-cave", backdropLayers: TOWER_LAYERS } });
  }
  // 이리스 「회수 대기」 직업 — 성광 사수와 같되 광선 조준·광자 연사·충전 광선포를 직업이 주지 않는다(일지를 다시 읽어야 돌아온다).
  // 전격탄은 이리스 몸에 붙은 기술(배우 습득)이라 남는다.
  const gunner = project.database.classes.find((c) => c.id === "class_gunner");
  if (!gunner) throw new Error("[fallen-star tower] class_gunner 가 없다");
  const relay = { ...structuredClone(gunner), id: IRIS_RELAY_CLASS, learnedSkills: gunner.learnedSkills.filter((l) => ![SKILL_SHOT, SKILL_RAPID, SKILL_SNIPE].includes(l.skillId)) } as typeof gunner;
  delete (relay as { promotions?: unknown }).promotions;
  project.database.classes = [...project.database.classes.filter((c) => c.id !== IRIS_RELAY_CLASS), relay];
  gunner.promotions = [...(gunner.promotions ?? []).filter((pr) => pr.toClassId !== IRIS_RELAY_CLASS), { toClassId: IRIS_RELAY_CLASS, requires: { switchId: SW_IRIS_WAKE } }];
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

const T1 = { arrive: { x: 29, y: 19 }, machine: { x: 19, y: 19 }, knight: { x: 21, y: 20 }, knightEnd: { x: 24, y: 21 }, stair: { x: 11, y: 7 } };

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
  const machineLook = (ev(project, FS2_T1, machineId).pages ?? []).map((p) => p.graphic as Rec | undefined).find((g) => g && (g as { sprite?: unknown }).sprite);
  if (!machineLook) throw new Error("[fallen-star tower] 파수 기계 그림이 없다");
  // 장면 배우 — 기계(장면용, 장면 뒤엔 없음)·기사(장면 뒤엔 동쪽 날개에 기대앉은 다친 기사가 대신한다).
  addEv(project, FS2_T1, "ev_fs2_t1_stage_machine", "파수 기계(장면)", { x: T1.machine.x, y: T1.machine.y + 1 }, [
    page("ev_fs2_t1_stage_machine_p", "대치", [], [], { graphic: { ...structuredClone(machineLook), direction: "right" }, priority: "same", overlapForbidden: true }),
    page("ev_fs2_t1_stage_machine_gone", "없음", [sw(SW_T1_ARRIVE)], [], { priority: "below" }),
  ]);
  addEv(project, FS2_T1, "ev_fs2_t1_stage_knight", KNIGHT, T1.knight, [
    page("ev_fs2_t1_stage_knight_p", "싸움", [], [], { graphic: chip(KNIGHT_CHIP[0], KNIGHT_CHIP[1], "left") }),
    page("ev_fs2_t1_stage_knight_gone", "없음", [sw(SW_T1_ARRIVE)], [], { priority: "below" }),
  ]);
  // 다친 기사 — 새라의 견습 동기. 발렌이 위로 갔다는 것, 회복약 둘.
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
      say(KNIGHT, "가운데 홀 기계는 피해서 가라.\n느려도 한 대 맞으면 뼈가 나간다."),
    ], { graphic: chip(KNIGHT_CHIP[0], KNIGHT_CHIP[1], "left") }),
  ]);

  // 들어서면 한 번 — 홀에서 기계가 기사를 쳐 낸다.
  addEv(project, FS2_T1, "ev_fs2_t1_arrive", "하늘탑 1층", { x: 0, y: 1 }, [
    page("ev_fs2_t1_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_t1_arrive_run", "기사와 기계", [sw(SW_VALEN_MET)], [
      cutBegin(),
      wait(500),
      se("cc0-se-osx-metal-03"), shake(1, 300),
      say(SARAH, "…쇳소리다. 안쪽 홀에서."),
      camTo("ev_fs2_t1_stage_knight", 1300),
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
      route("ev_fs2_t1_stage_machine", [{ kind: "turn", dir: "right" }]),
      wait(400),
      camBack(700),
      say(SARAH, "기계가 기사를 쳤어.\n…저것들한텐 우리도 기사도 똑같나 봐."),
      say(ELENA, "벽 글자 봐. 천문대 지하 패널이랑 같아.\n이 탑도 그 사람들이 지었어."),
      say(KAEL, "부딪히지 말고 돌아서 가자.\n이리스는 위에 있어."),
      setSw(SW_T1_ARRIVE),
      cutLabel(),
      cutEnd(),
      setSw(SW_T1_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_t1_arrive_done", "끝", [sw(SW_T1_ARRIVE)], [], { priority: "below" }),
  ]);

  // 별빛 결정 — 들어온 문 곁(동쪽 날개).
  const save = firstOk([{ x: 33, y: 19 }, { x: 32, y: 19 }, { x: 34, y: 20 }, { x: 26, y: 19 }], (c) => exec(project, "place_savepoint", {
    mapId: FS2_T1, x: c.x, y: c.y, id: "ev_fs2_t1_save", name: "별빛 결정", mode: "slot", objectId: SAVE_CRYSTAL, prompt: "기록하시겠습니까?", sparkleRadius: 2,
  }));
  if (!save) throw new Error("[fallen-star tower] 1층 별빛 결정 자리가 없다");

  // 남쪽 막다른 방 — 빛나방 떼가 지키는 기계 부품 상자.
  const chest = firstOk([{ x: 15, y: 33 }, { x: 16, y: 32 }, { x: 14, y: 32 }, { x: 17, y: 31 }], (c) => exec(project, "place_chest", {
    mapId: FS2_T1, x: c.x, y: c.y, contents: { itemId: "item_hi_potion", gold: 180 }, name: "녹슨 부품 상자", id: "ev_fs2_t1_chest",
  }));
  if (!chest) throw new Error("[fallen-star tower] 1층 남쪽 상자 자리가 없다");
  const moths = firstOk([{ x: 15, y: 29 }, { x: 14, y: 30 }, { x: 16, y: 30 }, { x: 15, y: 27 }], (c) => exec(project, "place_field_enemy", {
    mapId: FS2_T1, x: c.x, y: c.y, troopId: T_MOTHS, behavior: "chase", patrol: { length: 2, axis: "horizontal" },
    sightRange: 6, vision: "cone", pace: "normal", approachStyle: "float", respawnSec: 120, checkpointOnEntry: true,
  }));
  if (!moths) throw new Error("[fallen-star tower] 1층 빛나방 자리가 없다");

  // 서쪽 서고(마법진으로도 닿는다) — 독서대 위 관측 일지: 「4층 대기실 — 회수 대상 보관」.
  const lectern = firstOk([{ x: 4, y: 20 }, { x: 5, y: 20 }, { x: 6, y: 20 }, { x: 7, y: 20 }], (c) => {
    if (!freeOfEvents(project, FS2_T1, c) || !walkable(project, FS2_T1, c) || !walkable(project, FS2_T1, { x: c.x, y: c.y + 1 })) throw new Error("x");
    if (!stamp(project, exec, FS2_T1, "bd-pick-dungeon-theme-lectern", { x: c.x, y: c.y - 1 })) throw new Error("x");
    return true;
  });
  const logAt = lectern?.at ?? { x: 4, y: 21 };
  addEv(project, FS2_T1, "ev_fs2_t1_log", "관측 일지", logAt, [
    page("ev_fs2_t1_log_p", "관측 일지", [], [
      narrate("(펼친 관측 일지) 「4층 대기실 ── 회수 대상 한 기 보관.\n귀환선이 내려오기 전에 현지 기록을 정리할 것.」"),
      say(KAEL, "…회수 대상. 이리스를 그렇게 부르네."),
      say(ELENA, "기록을 정리한다는 건, 지운다는 소리야.\n서두르자."),
      setSw(SW_T1_LOG),
    ], { priority: "same" }),
  ]);
  // 1층 칸 장식 — 장치 문법: 홀 벽 앞 밸브 바퀴·구리 관(자리 없으면 건너뛴다).
  for (const [kit, c] of [["bd-pick-aqueduct-sewer-valve-wheel", { x: 19, y: 17 }], ["bd-pick-aqueduct-sewer-valve-wheel", { x: 25, y: 17 }], ["bd-pick-aqueduct-sewer-crate-stack", { x: 35, y: 21 }]] as const) {
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
  ensureSwitch(project, SW_T2_TALK, "B10: 갈라진 뒤 벽 너머 대화");
  for (const c of [T2.arrive, T2.westPlug, T2.westDoor, T2.eastPlug, T2.eastDoor, T2.westStart, T2.eastStart, T2.rejoin, T2.rejoinPlug]) mustWalk(project, FS2_T2, c, "2층");
  // 두 칸 틈의 윗칸을 기둥으로 막아 한 칸 길목으로(파티 분할 도구는 지형을 칠하지 않는다).
  for (const c of [T2.westPlug, T2.eastPlug]) {
    if (!stamp(project, exec, FS2_T2, "bd-pick-aqueduct-sewer-valve-wheel", { x: c.x, y: c.y - 1 }) || walkable(project, FS2_T2, c)) {
      throw new Error(`[fallen-star tower] 2층 틈 (${c.x},${c.y}) 을 밸브 기둥으로 못 막았다`);
    }
  }
  // 레버(벽 레버 키트) — 벽 앞면 칸. 그 아래 바닥에 서서 위를 보고 당긴다.
  const leverDown = kitTile(project, "bd-dg-lever-down");
  const leverUp = kitTile(project, "bd-dg-lever-up");
  for (const c of [T2.westLever, T2.eastLever]) {
    if (walkable(project, FS2_T2, c) || !walkable(project, FS2_T2, { x: c.x, y: c.y + 1 })) throw new Error(`[fallen-star tower] 2층 레버 자리 (${c.x},${c.y}) 가 벽 앞면이 아니다`);
    // 벽 레버 키트는 벽 앞면 칸에 건다 — stamp_object 는 발이 바닥이어야 해서 칸을 직접 쓴다(키트 그림 그대로).
    const map = M(project, FS2_T2);
    const layer = (map as unknown as Record<string, number[]>)[leverDown.layer === "upper" ? "upperTiles" : "lowerTiles"];
    if (!layer) throw new Error("[fallen-star tower] 2층 레버 층이 없다");
    layer[c.y * map.width + c.x] = leverDown.tile;
  }
  // 전환 구슬 자리 — 받침 위 수정(1×2).
  for (const c of [T2.westSwitch, T2.eastSwitch]) mustWalk(project, FS2_T2, c, "2층 전환 구슬");

  exec(project, "author_party_split", {
    id: SPLIT, mapId: FS2_T2, splitAt: T2.arrive,
    groups: [
      { name: "카엘·새라", actorIds: [HERO, SARAH_ID], x: T2.westStart.x, y: T2.westStart.y, switchAt: T2.westSwitch },
      { name: "엘레나", actorIds: [ELENA_ID], x: T2.eastStart.x, y: T2.eastStart.y, switchAt: T2.eastSwitch },
    ],
    levers: [
      { lever: T2.westLever, door: T2.eastDoor, name: "동쪽 쇠창살" },
      { lever: T2.eastLever, door: T2.westDoor, name: "서쪽 쇠창살" },
    ],
    rejoin: T2.rejoin,
    splitText: "발밑 판이 덜컹 꺼진다! 양쪽 날개로 쇠창살이 내려꽂힌다.",
    rejoinText: "다시 모였다.",
  });

  // 도구가 지은 이벤트를 탑에 맞게 다듬는다 ─────────────────────────
  const [lever1, lever2] = [ev(project, FS2_T2, `${SPLIT}_lever_1`), ev(project, FS2_T2, `${SPLIT}_lever_2`)];
  const tileSwap = (c: Cell, tile: number, layer: string): Command => ({ kind: "changeTile", mapId: FS2_T2, layer, x: c.x, y: c.y, tile } as unknown as Command);
  const reword = (lever: GameEvent, at: Cell, look: string, ask: string, pulled: string, after: Command[], idle: string) => {
    const [p1, p2] = lever.pages ?? [];
    if (!p1 || !p2) throw new Error("[fallen-star tower] 레버 페이지가 없다");
    p1.graphic = { transparent: true } as EventPage["graphic"];
    p2.graphic = { transparent: true } as EventPage["graphic"];
    const choice = (p1.commands as unknown as Rec[]).find((c) => c.kind === "choices") as { prompt: string; options: { text: string; branch: Command[] }[] } | undefined;
    if (!choice) throw new Error("[fallen-star tower] 레버 선택지가 없다");
    choice.prompt = ask;
    choice.options[0]!.text = "돌린다";
    const pull = choice.options[0]!.branch;
    const i = pull.findIndex((c) => c.kind === "text");
    pull.splice(i, 1, tileSwap(at, leverUp.tile, leverUp.layer), narrate(pulled), ...after);
    p1.commands = [narrate(look), choice as unknown as Command];
    p2.commands = [narrate(idle)];
  };
  reword(lever1, T2.westLever, "벽에 톱니바퀴 손잡이가 박혀 있다.\n쇠줄이 동쪽 벽 속으로 이어진다.", "손잡이를 돌릴까?",
    "끼긱, 끼긱. 톱니가 맞물려 돈다.\n벽 너머 동쪽에서 쇠창살 올라가는 소리.",
    [say(ELENA, "(벽 너머) 열렸어! 카엘, 들려?\n이쪽 창살이 올라갔어."), say(KAEL, "들려! 거울은?")],
    "손잡이가 끝까지 돌아가 있다.");
  reword(lever2, T2.eastLever, "벽에 박힌 거울 손잡이다.\n돌리면 천창 빛이 꺾여 서쪽으로 갈 것 같다.", "거울을 돌릴까?",
    "거울이 돌아간다. 꺾인 빛줄기가 벽 틈으로 빠져나간다.\n서쪽에서 쇠창살 자물쇠가 철컥 풀리는 소리.",
    [say(ELENA, "빛 갔어? 카엘, 그쪽 문에 닿았어?"), say(SARAH, "(벽 너머) 닿았다. 창살이 올라가.")],
    "거울이 서쪽을 향해 있다.");
  // 쇠창살 문 — RTP 철문 대신 같은 시트의 쇠창살(5번).
  for (const id of [`${SPLIT}_door_1`, `${SPLIT}_door_2`]) {
    const door = ev(project, FS2_T2, id);
    for (const pg of door.pages ?? []) {
      const g = pg.graphic as { sprite?: unknown; direction?: Dir } | undefined;
      if (g?.sprite) pg.graphic = objGraphic("object1", 5, g.direction ?? "down");
    }
    door.pages![0]!.commands = [narrate("굵은 쇠창살이 길을 막고 있다.\n반대편 어딘가의 장치로 올라갈 것 같다.")];
  }
  // 전환 구슬 — 받침 위 수정을 찍고 이벤트는 투명하게.
  for (const [key, c] of [["a", T2.westSwitch], ["b", T2.eastSwitch]] as const) {
    const orb = ev(project, FS2_T2, `${SPLIT}_switch_${key}`);
    const stamped = stamp(project, exec, FS2_T2, "bd-pick-dungeon-theme-crystal-pedestal", { x: c.x, y: c.y - 1 });
    if (stamped) for (const pg of orb.pages ?? []) pg.graphic = { transparent: true } as EventPage["graphic"];
    const p1 = orb.pages?.[1];
    if (p1) {
      const fk = (p1.commands as unknown as Rec[])[0] as { else?: Command[] } | undefined;
      if (fk?.else) fk.else = [narrate("수정 받침이 희미하게 울린다.\n벽 너머 동료의 숨소리가 들리는 것 같다.")];
      p1.commands = [narrate("수정에 손을 대면 벽 너머 동료와 말이 닿는다."), ...(p1.commands as Command[])];
    }
  }
  // 갈라지는 칸 = 도착 칸 — 계단에서 내려서자마자 갈린다(우회로 없음). 첫 대사·진동을 앞에 붙인다.
  const split = ev(project, FS2_T2, `${SPLIT}_split`);
  const sp1 = split.pages![0]!;
  sp1.trigger = { kind: "auto" } as EventPage["trigger"];
  sp1.conditions = [sw(SW_VALEN_MET)];
  sp1.commands = [
    cutBegin(), wait(500),
    say(ELENA, "여긴 바닥이 나무 판이야.\n…밑이 텅 빈 소리가 나."),
    se("cc0-se-osx-metal-03"), shake(6, 700), flash("white", 200),
    ...(sp1.commands as Command[]),
    cutLabel(), cutEnd(),
  ];
  // 갈린 뒤 벽 너머 대화(한 번).
  addEv(project, FS2_T2, "ev_fs2_t2_talk", "벽 너머", { x: 0, y: 1 }, [
    page("ev_fs2_t2_talk_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_t2_talk_run", "벽 너머", [sw(SW_T2_SPLIT)], [
      wait(400),
      say(SARAH, "…갈렸군. 엘레나는 반대쪽 날개야."),
      say(ELENA, "(벽 너머) 카엘, 들려? 내가 이쪽 거울을 돌릴게.\n빛이 그쪽 문에 닿으면 말해."),
      say(KAEL, "들려! 우리도 이쪽 톱니를 돌려 볼게.\n북쪽 벽에 손잡이가 있어."),
      sys("수정 받침을 조사하면 엘레나 쪽으로 조작을 바꿀 수 있다."),
      setSw(SW_T2_TALK),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_t2_talk_done", "끝", [sw(SW_T2_TALK)], [], { priority: "below" }),
  ]);
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
  // 합류 대사 — 도구 기본 한 줄 뒤에 짧게.
  const rejoin = ev(project, FS2_T2, `${SPLIT}_rejoin`);
  if (!JSON.stringify(rejoin.pages).includes("다시 모였다.")) throw new Error("[fallen-star tower] 합류 대사가 없다");
  const walkPages = (cmds: Command[]): void => {
    for (const c of cmds) {
      const r = c as unknown as Rec;
      if (r.kind === "text" && r.body === "다시 모였다.") {
        const i = cmds.indexOf(c);
        cmds.splice(i + 1, 0, say(ELENA, "거울이 진짜로 됐네. 빛이 그쪽까지 갔어."), say(SARAH, "기계보다 손발이 잘 맞는군.\n…올라가자."));
        return;
      }
      for (const k of ["then", "else"] as const) if (Array.isArray(r[k])) walkPages(r[k] as Command[]);
    }
  };
  for (const pg of rejoin.pages ?? []) walkPages(pg.commands as Command[]);

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

function floorThree(project: Project, exec: Exec): void {
  ensureSwitch(project, SW_T3_ARRIVE, "B10: 하늘탑 3층 도착");
  ensureSwitch(project, SW_T3_SOLVED, "B10: 거울 빛줄기로 4층 계단을 엶");
  const done = firstOk([{ x: 16, y: 11 }, { x: 15, y: 11 }, { x: 17, y: 12 }, { x: 16, y: 20 }], (c) => exec(project, "author_map_puzzle", {
    mapId: FS2_T3, presetId: "mirror_beam_refraction", puzzleId: "fs2_t3_mirror", x: c.x, y: c.y,
    gateEventId: "ev_fs2_sky_tower_f3_stair_next", solveSwitchId: SW_T3_SOLVED, title: "렌즈 거울",
    hintText: "(바닥 글) 첫 거울은 천창의 빛을 받고, 둘째 거울은 그 빛을 계단으로 보낸다.",
    reward: { itemId: "item_ether", gold: 150 },
  }));
  if (!done) throw new Error("[fallen-star tower] 3층 거울 퍼즐을 못 지었다");
  // 프리셋 문구는 「태양 성소」 말투다 — 탑의 렌즈 거울로 고쳐 쓴다.
  const rewrite: Record<string, string> = {
    "스르륵— 쨍! 서쪽 프리즘 거울을 45도 회전시키자 천창의 황금 태양빛이 동쪽 굴절 거울로 뻗어 나갔다!": "거울이 스르륵 돌아간다.\n천창 빛이 꺾여 북쪽 거울로 뻗는다.",
    "제1 프리즘 거울이 천창의 태양 빛줄기를 동쪽으로 반사하고 있다.": "첫 거울이 천창 빛을 북쪽 거울로 보내고 있다.",
    "동쪽 굴절 거울을 북쪽 성소 제단 각도로 맞췄다! 황금 빛줄기가 굴절되어 북쪽 암흑 결계를 직격한다!": "둘째 거울을 계단 쪽으로 돌렸다.\n빛줄기가 꺾여 서쪽 벽 계단에 꽂힌다.",
    "찬란한 태양 빛줄기가 북쪽 암흑 봉인을 산산이 정화하며 대성소 돌계단이 열렸다!": "계단을 막던 빛 막이 걷힌다.\n위층으로 가는 길이 열렸다.",
    "퍼즐 해독 보상! 「마력약」과(와) 150G를 획득했다!": "거울 받침 밑에서 「마력약」과 150G를 찾았다.",
    "동쪽 굴절 거울 기둥이다. 먼저 서쪽 천창 아래의 『제1 태양 프리즘 거울』을 돌려 빛줄기를 보내야 한다.": "둘째 거울이다. 아직 빛이 닿지 않는다.\n천창 아래 첫 거울부터 돌려야 한다.",
    "제2 굴절 거울이 황금 빛줄기를 북쪽 성소로 집중시키고 있다.": "둘째 거울이 빛을 계단으로 모으고 있다.",
    "태양 빛줄기로 정화된 대성소 마법진이다.": "빛 막이 걷힌 자리. 바닥 글자가 아직 따뜻하다.",
    "이 통로는 '렌즈 거울' 장치를 먼저 풀어야 열립니다.": "계단 위에 희미한 빛 막이 쳐져 있다.\n거울로 빛을 보내야 걷힐 것 같다.",
  };
  const fix = (cmds: Command[]): void => {
    for (const c of cmds) {
      const r = c as unknown as Rec;
      if (r.kind === "text" && typeof r.body === "string" && rewrite[r.body]) r.body = rewrite[r.body];
      for (const k of ["then", "else", "branch", "cancelBranch"] as const) if (Array.isArray(r[k])) fix(r[k] as Command[]);
      if (Array.isArray(r.options)) for (const o of r.options as { branch?: Command[] }[]) if (o.branch) fix(o.branch);
    }
  };
  for (const e of M(project, FS2_T3).events) {
    if (e.id.startsWith("ev_fs2_t3_mirror") || e.id === "ev_fs2_sky_tower_f3_stair_next") for (const pg of e.pages ?? []) fix(pg.commands as Command[]);
  }
  const names: Record<string, string> = { ev_fs2_t3_mirror_mirror_1: "천창 아래 첫 거울", ev_fs2_t3_mirror_mirror_2: "계단 쪽 둘째 거울", ev_fs2_t3_mirror_mirror_seal: "빛 막 바닥 글" };
  for (const e of M(project, FS2_T3).events) if (names[e.id]) e.name = names[e.id]!;
  const left = JSON.stringify(M(project, FS2_T3).events.filter((e) => e.id.startsWith("ev_fs2_t3_mirror")).map((e) => [e.name, (e.pages ?? []).map((pg) => pg.commands)]));
  const stale = /.{0,40}(태양|성소|결계).{0,20}/u.exec(left);
  if (stale) throw new Error(`[fallen-star tower] 3층 거울 문구에 태양 성소 말투가 남았다: ${stale[0]}`);
  // 들어서면 한 번.
  addEv(project, FS2_T3, "ev_fs2_t3_arrive", "하늘탑 3층", { x: 0, y: 1 }, [
    page("ev_fs2_t3_arrive_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_t3_arrive_run", "거울의 층", [sw(SW_T2_DONE)], [
      wait(400),
      say(ELENA, "천장에 유리 창이 나 있어. 빛이 들어와.\n…여기 거울들, 렌즈 받침이랑 모양이 같아."),
      say(KAEL, "천문대 렌즈는 하늘을 봤는데,\n여기 거울은 서로를 비추네."),
      setSw(SW_T3_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_t3_arrive_done", "끝", [sw(SW_T3_ARRIVE)], [], { priority: "below" }),
  ]);
  // 적 — 아래 방 결정 거미, 가운데 방 회로뱀.
  const spiders = firstOk([{ x: 12, y: 30 }, { x: 13, y: 29 }, { x: 10, y: 30 }, { x: 14, y: 31 }], (c) => exec(project, "place_field_enemy", {
    mapId: FS2_T3, x: c.x, y: c.y, troopId: T_SPIDERS, behavior: "chase", patrol: { length: 2, axis: "horizontal" },
    sightRange: 6, vision: "cone", pace: "normal", approachStyle: "pounce", respawnSec: 120, checkpointOnEntry: true,
  }));
  const snakes = firstOk([{ x: 16, y: 21 }, { x: 17, y: 20 }, { x: 15, y: 22 }, { x: 18, y: 21 }], (c) => exec(project, "place_field_enemy", {
    mapId: FS2_T3, x: c.x, y: c.y, troopId: T_SNAKES, behavior: "chase", patrol: { length: 1, axis: "horizontal" },
    sightRange: 5, vision: "cone", pace: "normal", approachStyle: "slither", respawnSec: 120, checkpointOnEntry: true,
  }));
  if (!spiders || !snakes) throw new Error("[fallen-star tower] 3층 적 자리가 없다");
  firstOk([{ x: 3, y: 30 }, { x: 3, y: 31 }, { x: 4, y: 29 }, { x: 5, y: 32 }], (c) => exec(project, "place_chest", {
    mapId: FS2_T3, x: c.x, y: c.y, contents: { itemId: "item_hi_potion" }, name: "녹슨 상자", id: "ev_fs2_t3_chest",
  }));
}

// ════════════════════════════════════════════════════════════════════
// 4. 4층 「렌즈 대기실」 — B11 이리스 재회
// ════════════════════════════════════════════════════════════════════

const T4 = {
  arrive: { x: 15, y: 22 },
  coffin: { x: 15, y: 8 },          // 관 2×2 왼쪽 위 — (15..16, 8..9)
  coffinFront: { x: 15, y: 10 },    // 관을 조사하는 칸(관 바로 아래)
  iris: { x: 16, y: 10 },           // 깨어난 이리스가 서는 칸
  doorway: [{ x: 15, y: 13 }, { x: 16, y: 13 }],
  dark: { x: 14, y: 19 },
  alcovePlugs: [{ x: 10, y: 19 }, { x: 10, y: 20 }],
  pageStar: { x: 3, y: 20 },
  pageHand: { x: 7, y: 19 },
  stair: { x: 12, y: 7 },
};

/** 3층 둥근 방의 벽 계단 칸을 4층 같은 자리에 옮긴다(4층 둥근 방은 계단 없는 링이다). */
function copyStair(project: Project): void {
  const from = M(project, FS2_T3), to = M(project, FS2_T4);
  if (from.width !== to.width) throw new Error("[fallen-star tower] 3·4층 폭이 달라 계단을 못 옮긴다");
  const layers = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
  // 3층 둥근 방 서쪽(계단 x11~13 y5~8 + 4층 서쪽 책장이 서 있던 x13~14 y7~10 바닥)을 통째로 — 책장 반쪽이 남지 않게.
  for (let y = 4; y <= 10; y += 1) for (let x = 10; x <= 14; x += 1) {
    const i = y * from.width + x;
    for (const l of layers) {
      const a = (from as unknown as Record<string, number[] | undefined>)[l], b = (to as unknown as Record<string, number[] | undefined>)[l];
      if (a && b) b[i] = a[i]!;
    }
  }
}

function floorFour(project: Project, exec: Exec): void {
  for (const [id, name] of [
    [SW_T4_ARRIVE, "B11: 4층 어둠"], [SW_T4_ROOM, "B11: 렌즈 대기실의 관"], [SW_IRIS_WAKE, "B11: 이리스가 깨어남"], [SW_IRIS_BACK, "B11: 이리스 합류"],
    [SW_PAGE_NAME, "B11: 일지 쪽(별 이름)"], [SW_PAGE_HAND, "B11: 일지 쪽(엘레나 손)"], [SW_BE_WELL, "B11: 「잘 지내」"], [FS2_SW_STOP_B11, "판본 끝: 하늘탑 4층 계단"],
  ] as const) ensureSwitch(project, id, name);
  copyStair(project);
  for (const c of [T4.arrive, T4.coffinFront, T4.iris, ...T4.doorway, T4.dark, ...T4.alcovePlugs, T4.pageStar, T4.pageHand]) mustWalk(project, FS2_T4, c, "4층");

  // 관(2×2)과 렌즈·장치.
  if (!stamp(project, exec, FS2_T4, "bd-pick-aqueduct-sewer-coffin", T4.coffin)) throw new Error("[fallen-star tower] 4층 관을 못 놓았다");
  firstOk([{ x: 12, y: 9 }, { x: 13, y: 9 }, { x: 17, y: 10 }], (c) => { if (!stamp(project, exec, FS2_T4, "bd-pick-wizard-tower-armillary", c)) throw new Error("x"); return true; });
  firstOk([{ x: 14, y: 8 }, { x: 17, y: 8 }, { x: 14, y: 9 }], (c) => { if (!stamp(project, exec, FS2_T4, "bd-pick-dungeon-theme-crystal-pedestal", c)) throw new Error("x"); return true; });

  // 조명 — 어둠 속 초록 렌즈·관 불빛. 어둠(place_field_obstacle dark)이 바탕을 0.82 로 깎는다.
  exec(project, "set_lighting_volume", {
    mapId: FS2_T4, applyMode: "map", ambient: 0.5, color: "#06140f",
    sources: [
      { id: "coffin", at: { x: 16, y: 9 }, radius: 3, intensity: 0.85, color: "#7dffc0", flicker: true },
      { id: "lens", at: { x: 18, y: 7 }, radius: 3, intensity: 0.6, color: "#b6ffd8", flicker: false },
      { id: "player", at: { kind: "player" }, radius: 2, intensity: 0.45, color: "#ffc070", flicker: true },
    ],
  });
  // 어둠 — 이리스 손끝 빛(필드 기술)을 아는 파티가 들어서면 밝다.
  exec(project, "place_field_obstacle", {
    mapId: FS2_T4, x: T4.dark.x, y: T4.dark.y, kind: "dark", requiresSkillId: FS2_SKILL_FINGERLIGHT, skillName: "손끝 빛", machine: "none",
    id: "ev_fs2_t4_dark", name: "렌즈 대기실의 어둠",
    hint: "이리스가 손끝을 들자 둘레가 환해진다.",
    blockedText: "칠흑 같다. 한 걸음 앞도 안 보인다.",
  });
  // 이리스가 일행이면(손끝 빛을 안다) 들어설 때마다 밝다 — 기술 판정과 별개로 스위치로도 확실히.
  const darkEv = ev(project, FS2_T4, "ev_fs2_t4_dark");
  darkEv.pages = [...(darkEv.pages ?? []), page("ev_fs2_t4_dark_lit", "이리스와 함께", [sw(SW_IRIS_BACK)], [{ kind: "setLighting", ambient: 0, transitionMs: 0 } as unknown as Command], { trigger: { kind: "auto" }, priority: "below" })];
  const light = project.database.skills.find((s) => s.id === FS2_SKILL_FINGERLIGHT);
  if (!light) throw new Error("[fallen-star tower] 손끝 빛 기술이 없다");
  Object.assign(light, { name: "손끝 빛", description: "필드 기술 — 손끝에 빛을 맺어 어두운 곳을 밝힌다.\n이리스가 처음 배운 「아침」의 빛." });
  const ce = project.commonEvents.find((c) => c.id === (light as unknown as Rec).fieldCommonEventId);
  if (ce) ce.commands = [narrate("이리스가 손끝을 든다.\n작은 빛이 둘레로 번진다."), { kind: "setLighting", ambient: 0, transitionMs: 900 } as unknown as Command];
  // 서쪽 골방 길목 — 어둠 속에선 발 디딜 데가 안 보인다(손끝 빛을 알면 지나간다).
  T4.alcovePlugs.forEach((c, i) => addEv(project, FS2_T4, `ev_fs2_t4_gloom_${i}`, "어두운 길목", c, [
    page(`ev_fs2_t4_gloom_${i}_shut`, "캄캄함", [], [narrate("발밑이 안 보인다.\n판석이 끊겼는지 이어졌는지조차 모르겠다.")], { priority: "same" }),
    page(`ev_fs2_t4_gloom_${i}_lit`, "밝음", [{ kind: "partyKnowsSkill", skillId: FS2_SKILL_FINGERLIGHT } as unknown as Condition], [], { priority: "below" }),
    page(`ev_fs2_t4_gloom_${i}_back`, "이리스와 함께", [sw(SW_IRIS_BACK)], [], { priority: "below" }),
  ]));

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
      narrate("둥근 방 한가운데 관이 하나 놓여 있다.\n뚜껑 틈으로 초록 글자가 흐른다."),
      say(ELENA, "은빛 알 안쪽이랑 같은 글자야.\n…저 안에 있어."),
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
  const reunion: Command[] = [
    cutBegin(), letterbox(),
    { kind: "stopAudio", channel: "bgm" } as unknown as Command,
    say(KAEL, "이리스."),
    wait(900),
    narrate("대답이 없다. 관 위 글자만 깜빡인다."),
    say(KAEL, "…열게."),
    se("cc0-se-osx-metal-03"), shake(1, 600),
    narrate("무거운 뚜껑이 옆으로 밀려난다."),
    fx("sparkle", T4.coffin.x + 1, T4.coffin.y + 1, 1400),
    flash("white", 500),
    setSw(SW_IRIS_WAKE),
    // 직업이 주는 기술은 「잊기」로 안 지워진다 — 회수 대기 직업으로 옮겨(지금까지 배운 것을 세션으로 옮긴다) 셋을 잊게 한다.
    { kind: "promoteActor", actorId: IRIS_ID, toClassId: IRIS_RELAY_CLASS } as unknown as Command,
    ...forgetThree(),
    wait(700),
    camTo("ev_fs2_t4_iris", 900, 1.25),
    say(IRIS, "…신호, 수신. 현지 시각 불명.\n귀환 준비 중입니다. 기록을 정리합니다."),
    say(KAEL, "이리스, 나야. 카엘."),
    emote("ev_fs2_t4_iris", "question", 900),
    wait(400),
    say(IRIS, "…누구세요? 아니, 알아요.\n모르는데 알아요."),
    narrate("이리스가 품에 안고 있던 일지를 펼친다."),
    narrate("넘기는 쪽마다 글자가 하얗게 바래 간다."),
    say(IRIS, "일지에 당신 글씨가 있어요.\n그런데 읽으려니까 자꾸 지워져요."),
    say(ELENA, "탑이 이리스 기록을 걷어 가고 있어.\n…돌아가기 전에 싹 비우는 거야."),
    say(SARAH, "발렌 님이 끊겠다던 줄이 이거였군."),
    say(KAEL, "…괜찮아. 내가 읽어 줄게.\n약속했잖아."),
    bgm(IRIS_BGM, 2500),
    narrate("카엘이 바랜 쪽을 짚는다. 카엘의 글씨다."),
    say(KAEL, "「오늘, 이리스가 빵을 먹었다.\n따뜻했다고 했다.」 …기억나?"),
    fx("heal", T4.iris.x, T4.iris.y, 1200), se("easyrpg-sound-recovery7"),
    sys("이리스가 「광선 조준」을 다시 떠올렸다."),
    wait(500),
    say(IRIS, "맛은 안 나요.\n그런데 이 줄은 따뜻해요."),
    say(IRIS, "한 번 더 읽어 주세요. 몇 번이고."),
    say(KAEL, "응. 몇 번이고."),
    say(ELENA, "이리스, 손 줘. …차가워.\n그래도 안 떨리네."),
    say(IRIS, "떨리는 건 흉내예요.\n…지금은 흉내 안 내는데도 떨려요."),
    wait(700),
    say(IRIS, "어둡네요. 잠깐만요."),
    se("easyrpg-sound-recovery7"),
    { kind: "setLighting", ambient: 0, transitionMs: 1800 } as unknown as Command,
    narrate("이리스의 손끝에 작은 빛이 맺힌다.\n그 빛이 층 전체로 번져 나간다."),
    fx("sparkle", T4.pageStar.x, T4.pageStar.y, 1600), fx("sparkle", T4.pageHand.x, T4.pageHand.y, 1600),
    camTo("ev_fs2_t4_page_star", 1200, 1),
    say(IRIS, "저기, 종이가 떨어져 있어요.\n…제 일지 쪽이에요."),
    camBack(900),
    { kind: "changeParty", actorId: IRIS_ID, action: "add" } as unknown as Command,
    { kind: "changeLevel", actorId: IRIS_ID, op: "=", amount: 13 } as unknown as Command,
    ...forgetThree(),
    learn(IRIS_ID, FS2_SKILL_FINGERLIGHT),
    { kind: "recoverAll", actorId: IRIS_ID } as unknown as Command,
    setSw(SW_IRIS_BACK),
    sys("이리스가 다시 일행이 되었다."),
    clearLetterbox(),
    cutLabel(), cutEnd(),
    // 넘겨도 같은 끝 — 합류·조명은 다시 확실히.
    setSw(SW_IRIS_WAKE), setSw(SW_IRIS_BACK),
    { kind: "setLighting", ambient: 0, transitionMs: 300 } as unknown as Command,
  ];
  addEv(project, FS2_T4, "ev_fs2_t4_coffin", "이리스의 관", { x: T4.coffin.x, y: T4.coffin.y + 1 }, [
    page("ev_fs2_t4_coffin_p", "관", [], reunion, { priority: "same" }),
    page("ev_fs2_t4_coffin_open", "빈 관", [sw(SW_IRIS_BACK)], [narrate("빈 관. 안쪽에 초록 글자가 아직 흐른다.\n「귀환까지 기록 정리 중」.")], { priority: "same" }),
  ]);
  // 관 오른쪽 칸(2×2 관의 오른쪽 아래)도 같은 조사.
  addEv(project, FS2_T4, "ev_fs2_t4_coffin_r", "이리스의 관", { x: T4.coffin.x + 1, y: T4.coffin.y + 1 }, [
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

  // 판본 끝 — 둥근 방 벽 계단. 이리스 전에는 한 줄, 뒤에는 막 카드·회복·저장.
  addEv(project, FS2_T4, "ev_fs2_t4_stair_up", "꼭대기 계단", T4.stair, [
    page("ev_fs2_t4_stair_wait", "아직", [], [narrate("위로 오르는 계단. 바람 소리가 내려온다.\n…이리스부터 찾자.")], { trigger: { kind: "playerTouch" }, priority: "below" }),
    page("ev_fs2_t4_stair_stop", "판본 끝", [sw(SW_IRIS_BACK)], [
      say(IRIS, "이 위가 두 번째 렌즈예요.\n…「집」으로 대답을 보내는 눈."),
      say(KAEL, "발렌 아저씨도 거기 있겠지. 가자."),
      fadeOut(1000),
      { kind: "recoverAll" } as unknown as Command,
      narrate("제2막 「빌린 불」 — 여기까지", { position: "center", context: "narration" }),
      narrate("두 번째 렌즈, 그리고 재의 회수자는\n다음 업데이트에서 이어집니다.", { position: "center", context: "narration" }),
      fadeIn(700),
      setSw(FS2_SW_STOP_B11),
      sys("지금 저장해 두면 다음 판본에서 하늘탑 4층부터 이어서 할 수 있다."),
      { kind: "openSaveMenu" } as unknown as Command,
    ], { trigger: { kind: "playerTouch" }, priority: "below" }),
    page("ev_fs2_t4_stair_next", "다음 업데이트", [sw(FS2_SW_STOP_B11)], [sys("꼭대기로 오르는 계단.\n(다음 업데이트에서 이어집니다.)")], { trigger: { kind: "playerTouch" }, priority: "below" }),
  ]);

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
      { ...P("ev_fs2_t4_coffin", "ev_fs2_t4_coffin_p", "품에 안고 있던 일지를"), action: "write", lineId: "fs2_first", writer: "kael", date: "별 떨어진 밤", text: "숲에 떨어진 아이가 깨어났다. 「잘 지내」라고 했더니 대답이 왔다." },
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

/** 탑 공통 — 전투 배경·같은 음악(층마다 곡이 바뀌던 것을 하나로)·알아채기·임무 줄기. */
function towerCommon(project: Project, exec: Exec): void {
  for (const mapId of [FS2_T1, FS2_T2, FS2_T3, FS2_T4]) {
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
    [SW_T2_DONE, "2층에서 갈린 두 쪽이 서로 쇠창살을 열어 다시 만난다"],
    [SW_T3_SOLVED, "3층 거울 두 개를 돌려 빛을 계단으로 보낸다"],
    [SW_IRIS_BACK, "4층 렌즈 대기실의 관에서 이리스를 찾는다"],
    [FS2_SW_STOP_B11, "이리스와 함께 꼭대기 계단 앞에 선다"],
  ];
  const start = nodes.length;
  const all = [...nodes, ...more.map(([switchId, description], i) => ({ id: `fs2-${start + i + 1}`, description, completesWhen: { kind: "switch", switchId, value: true } }))];
  exec(project, "define_quest", {
    id: "fs2_main", title: quest.title, summary: quest.summary,
    nodes: all, edges: all.slice(1).map((n, i) => ({ from: all[i]!.id, to: n.id })),
  });
}

export function applyFallenAct2Tower(project: Project, exec: Exec): void {
  towerData(project, exec);
  floorOne(project, exec);
  floorTwo(project, exec);
  floorThree(project, exec);
  floorFour(project, exec);
  towerCommon(project, exec);
}
