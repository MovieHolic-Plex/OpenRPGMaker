/**
 * 『폴른 스타』 제1막 새 뼈대(2026-10-24).
 *
 * 1. 추락지 중간 보스 — 이리스가 합류하자마자 발렌이 숲길을 올라온다. 소환·「심판의 빛」·2페이즈는 그대로(수호상만 뺀 트룹),
 *    앞뒤 장면과 연막 퇴장. 지하의 발렌 결전·등장 신호는 걷어 낸다(발렌은 숲에서 물러난 뒤 마을 포위 때 다시 나온다).
 * 2. 지하 미궁 — 옛 별지기의 방 렌즈가 아래를 비추면 별 봉인이 열린다 → 지하 3층(가라앉은 회랑, 레버·쇠살문·막다른 길 보상·광신도)
 *    → 지하 4층(쉼터: 기록 결정·샘·다친 광신도 / 달비늘 용 / 기계 패널).
 * 3. 달비늘 용 — 마법 무효(damageTypeRates.magic 0). 카엘 「돌진 찌르기」·이리스 「충전 광선포」가 「관통상」을 남기면
 *    마법이 3배로 들어간다(상태 damageTypeRates.magic 300). 전투 중 알림은 enemyState 조건 페이지.
 * 4. 기계 패널 — 「달의 아이」 우화(단말 문체, 여러 쪽). 끝에 카엘이 살아 있는 손으로 대답하고, 소거 안내가 이리스에게 닿는다.
 * 5. 승강 장치로 천문대 → 광장. 기사 수십이 에워싸고, 발렌·하넬, 「잡아라」, 제1막 끝 카드.
 *
 * 사람 그림은 새로 만들지 않는다(RTP 걷기 칩: Actor1 #2 기사 · People3 #7 병사 · Monster2 #1 용 · Actor3 #2 광신도).
 * 모든 대사 편집 뒤, 얼굴(applySpeakerFaces) 앞에서 한 번 부른다.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { isPassable } from "@/project/collision";
import type { ActorRecord, Command, Condition, EnemyRecord, EventPage, GameEvent, GameMap, Project, SkillRecord, StateRecord, TroopRecord } from "@/project/types";
import { FS_NAMES, FS_PREFIX } from "../fallenStarStory";
import { build, lightRoom } from "../fallenStarRooms";
import { FS_VALEN_CHARSET_ID, FS_VALEN_CHARSET_INDEX } from "../fallenValenChip";
import { B3, B3_ROOM, B4, B4_ROOM, FS_B3_ID, FS_B3_NAME, FS_B4_ID, FS_B4_NAME } from "./vaultLabyrinthRooms";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => void;
type Cell = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
type Rec = Record<string, unknown>;

const H = `천문대장 ${FS_NAMES.master}`;
const KAEL = FS_NAMES.hero;
const ELENA = FS_NAMES.mage;
const IRIS = FS_NAMES.android;
const VALEN = FS_NAMES.inquisitor;
const FANATIC = "교단 광신도";

// ── 스위치 ─────────────────────────────────────────────────────────────
const SW_IRIS_JOINED = "sw_fs_iris_joined";
const SW_CRASH_ON = "sw_fs_valen_crash_on";
const SW_CRASH_MET = "sw_fs_valen_crash_met";
const SW_SOLDIERS_GONE = "sw_fs_valen_soldiers_gone";
const SW_STEP1 = "sw_fs_main_step1";
const SW_STEP2 = "sw_fs_main_step2";
const SW_STEP3 = "sw_fs_main_step3";
const SW_DONE = "sw_fs_main_done";
const SW_SEAL_OPEN = "sw_fs_vault_seal_open";
const SW_WEST_LEVER = "sw_fs_b3_west_lever";
const SW_SUN_LEVER = "sw_fs_b3_sun_lever";
const SW_MOON_LEVER = "sw_fs_b3_moon_lever";
const SW_ALARM = "sw_fs_b3_alarm_rung";
const SW_DRAGON_MET = "sw_fs_dragon_met";
const SW_DRAGON_DOWN = "sw_fs_dragon_down";
const SW_DRAGON_CRACK = "sw_fs_dragon_crack";
const SW_LIFTED = "sw_fs_act1_lifted";
const SW_SIEGE = "sw_fs_siege_on";
const SW_SIEGE_HANEL = "sw_fs_siege_hanel";
const SW_SIEGE_VALEN = "sw_fs_siege_valen";

// ── 데이터베이스 id ─────────────────────────────────────────────────────
export const FS_PIERCED_STATE = "state_fs_pierced";
export const FS_DRAGON_ENEMY = "enemy_fs_moon_dragon";
export const FS_DRAGON_TROOP = "troop_fs_dragon";
export const FS_VALEN_CRASH_TROOP = "troop_fs_valen_crash";
const PIERCE_SKILLS = ["skill_hero_rush_pierce", "skill_gunner_snipe"];

// ── 명령 조각 ───────────────────────────────────────────────────────────
const say = (speaker: string, body: string, extra: Rec = {}): Command => ({ kind: "text", speaker, body, ...extra } as unknown as Command);
const narrate = (body: string, extra: Rec = {}): Command => ({ kind: "text", body, ...extra } as unknown as Command);
const sign = (who: string, body: string): Command => say(who, body);
const term = (body: string): Command => ({ kind: "text", body, style: "terminal", position: "center" } as unknown as Command);
const wait = (ms: number): Command => ({ kind: "wait", ms } as Command);
const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value } as Condition);
const fork = (condition: unknown, then: Command[], otherwise: Command[] = []): Command => ({ kind: "fork", condition, then, else: otherwise } as unknown as Command);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
const m2 = (commandId: string, fields: Rec): Command => ({ kind: "m2Command", commandId, fields } as unknown as Command);
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as unknown as Command);
const bgm = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: true, channel: "bgm" } as unknown as Command);
const stopBgm = (): Command => ({ kind: "stopAudio", channel: "bgm" } as unknown as Command);
const emote = (target: string, kind: string, durationMs = 800): Command =>
  ({ kind: "showEmote", target: target === "player" ? "player" : { eventId: target }, emote: kind, durationMs } as unknown as Command);
const route = (eventId: string, moves: Rec[], waitFor = true): Command =>
  ({ kind: "moveEvent", eventId, route: { moves, repeat: false, wait: waitFor, skippable: true } } as unknown as Command);
const turnTo = (eventId: string, dir: Dir): Command => route(eventId, [{ kind: "turn", dir }]);
const walk = (dirs: Dir[]): Rec[] => dirs.map((dir) => ({ kind: "move", dir }));
/** 흔들림 세기는 카탈로그 값(1·3·6·10)만 — 1·2 약하게, 3 보통, 4 세게. */
const shake = (level = 3, durationMs = 500): Command =>
  m2("m2-048-shake-screen", { intensity: level <= 1 ? "1" : level <= 3 ? "3" : "6", durationMs, direction: "vertical" });
const flash = (color = "white", durationMs = 300): Command => m2("m2-047-flash-screen", { color, value: "flash", durationMs });
const fx = (preset: string, x: number, y: number, durationMs: number): Command =>
  m2("m2-224-particle-effect", { preset, target: "tile", x, y, durationMs, wait: false });
const letterbox = (): Command => m2("m2-202-screen-effect", { effect: "letterbox", value: "12", durationMs: 600 });
const clearLetterbox = (): Command => m2("m2-202-screen-effect", { effect: "clearLetterbox", value: "", durationMs: 500 });
const fadeOut = (ms = 1200): Command => m2("m2-202-screen-effect", { effect: "fadeOut", value: "", durationMs: ms });
const fadeIn = (ms = 900): Command => m2("m2-202-screen-effect", { effect: "fadeIn", value: "", durationMs: ms });
const scroll = (direction: Dir, distance: number, durationMs = 700): Command =>
  m2("m2-049-scroll-map", { direction, distance: String(distance), durationMs: String(durationMs), wait: "true" });
const scrollBack = (): Command => m2("m2-049-scroll-map", { mode: "return", durationMs: "500", wait: "true" });
const cutBegin = (): Command => ({ kind: "cutsceneControl", mode: "begin", skippable: true } as unknown as Command);
const cutEnd = (): Command => ({ kind: "cutsceneControl", mode: "end" } as unknown as Command);
const cutLabel = (): Command => ({ kind: "label", name: "cutscene_end" } as unknown as Command);
const transfer = (mapId: string, at: Cell, direction: Dir = "down"): Command =>
  ({ kind: "transfer", mapId, x: at.x, y: at.y, direction, fade: "black" } as unknown as Command);
const battleBgm = (resourceId: string): Command => m2("m2-027-change-system-bgm", { cue: "battle", operation: "set", resourceId, volume: "100" });
const battleBgmReset = (): Command => m2("m2-027-change-system-bgm", { cue: "battle", operation: "reset" });
const battle = (troopId: string, canLose: boolean, canEscape = false): Command => ({ kind: "battleProcessing", troopId, canEscape, canLose } as unknown as Command);
const won = (then: Command[], otherwise: Command[] = []): Command => fork({ kind: "battleResult", result: "victory" }, then, otherwise);
const item = (itemId: string, amount = 1): Command => ({ kind: "changeItem", itemId, op: "+=", amount } as unknown as Command);
const look = (eventId: string, fields: Rec): Command =>
  m2("m2-225-sprite-look", Object.fromEntries(Object.entries({ target: eventId ? "event" : "this-event", ...(eventId ? { eventId } : {}), ...fields }).map(([k, v]) => [k, typeof v === "boolean" ? v : String(v)])));

const fixedMove = { type: "fixed", speed: 3, frequency: 3 };
function page(id: string, name: string, conditions: Condition[], commands: Command[], extra: Rec = {}): EventPage {
  return {
    id, name, conditions, graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
    movement: fixedMove, commands, ...extra,
  } as unknown as EventPage;
}
function addEvent(map: GameMap, id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  map.events = map.events.filter((e) => e.id !== id);
  const event = { id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages } as unknown as GameEvent;
  map.events.push(event);
  return event;
}
const chip = (sprite: string, characterIndex: number, direction: Dir, uploaded = false): Rec => ({
  sprite: { type: uploaded ? "uploaded" : "bundled", id: sprite }, direction, pattern: charsetFrameIndex({ characterIndex, direction, pattern: 1 }),
});
const valenChip = (direction: Dir): Rec => chip(FS_VALEN_CHARSET_ID, FS_VALEN_CHARSET_INDEX, direction, true);
const KNIGHT: [string, number] = ["tex_easyrpg_charset_actor1", 2];
const SOLDIER: [string, number] = ["tex_easyrpg_charset_people3", 7];
const HANEL_CHIP: [string, number] = ["tex_easyrpg_charset_people3", 4];

function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
function M(project: Project, id: string): GameMap {
  const map = project.maps[id];
  if (!map) throw new Error(`[fallen-star act1] 맵이 없다: ${id}`);
  return map;
}
function eachList(commands: Command[], visit: (list: Command[]) => void): void {
  visit(commands);
  for (const cmd of commands) {
    const rec = cmd as unknown as Rec;
    for (const key of ["then", "else", "cancelBranch", "commands"]) if (Array.isArray(rec[key])) eachList(rec[key] as Command[], visit);
    for (const option of (rec.options as { branch?: Command[] }[] | undefined) ?? []) if (Array.isArray(option.branch)) eachList(option.branch, visit);
  }
}
const bodyOf = (c: Command | undefined): string => (c && c.kind === "text" ? String((c as { body?: string }).body ?? "") : "");

// ── 길 찾기(칸 통행만 본다) ───────────────────────────────────────────
const STEPS: Array<[Dir, number, number]> = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
function bfs(project: Project, map: GameMap, from: Cell, blocked: Set<string> = new Set()): Map<string, { d: number; prev?: string; dir?: Dir }> {
  const seen = new Map<string, { d: number; prev?: string; dir?: Dir }>();
  const key = (x: number, y: number) => `${x},${y}`;
  seen.set(key(from.x, from.y), { d: 0 });
  const queue: Cell[] = [from];
  while (queue.length) {
    const c = queue.shift()!;
    const d = seen.get(key(c.x, c.y))!.d;
    for (const [dir, dx, dy] of STEPS) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const k = key(nx, ny);
      if (seen.has(k) || blocked.has(k) || !isPassable(project, map, nx, ny)) continue;
      seen.set(k, { d: d + 1, prev: key(c.x, c.y), dir });
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}
function pathTo(project: Project, map: GameMap, from: Cell, to: Cell, blocked: Set<string> = new Set()): Dir[] {
  const tree = bfs(project, map, from, blocked);
  let k = `${to.x},${to.y}`;
  if (!tree.has(k)) throw new Error(`[fallen-star act1] ${map.id} 에서 ${from.x},${from.y} → ${to.x},${to.y} 길이 없다`);
  const dirs: Dir[] = [];
  while (tree.get(k)!.prev) { dirs.unshift(tree.get(k)!.dir!); k = tree.get(k)!.prev!; }
  return dirs;
}

/** 맵 한 칸의 타일이 몇 층에 있는지(changeTile 층 이름). */
function layerOf(map: GameMap, at: Cell, tile: number): "lower" | "upper" | "lower2" | "upper2" {
  const i = at.y * map.width + at.x;
  const m = map as unknown as Record<string, number[] | undefined>;
  if (m.upperTiles?.[i] === tile) return "upper";
  if (m.lowerTiles?.[i] === tile) return "lower";
  if (m.lowerOverlayTiles?.[i] === tile) return "lower2";
  if (m.upperOverlayTiles?.[i] === tile) return "upper2";
  throw new Error(`[fallen-star act1] ${map.id} ${at.x},${at.y} 에 타일 ${tile} 이 없다`);
}
/** from 그림 칸들을 to 그림으로 바꾸는 changeTile 묶음(같은 순서의 타일 쌍). */
function swapTiles(map: GameMap, cells: Array<Cell & { from: number; to: number }>): Command[] {
  return cells.map((c) => ({ kind: "changeTile", mapId: map.id, layer: layerOf(map, c, c.from), x: c.x, y: c.y, tile: c.to } as unknown as Command));
}

// ════════════════════════════════════════════════════════════════════
// 1. 데이터베이스 — 관통상·용·추락지 발렌 트룹
// ════════════════════════════════════════════════════════════════════

function upsert<T extends { id: string }>(list: T[], record: T): void {
  const at = list.findIndex((r) => r.id === record.id);
  if (at >= 0) list[at] = record; else list.push(record);
}
const act = (skillId: string, priority: number, condition: Rec = { kind: "always" }) =>
  ({ skillId, priority, condition, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });

function database(project: Project): void {
  const db = project.database;
  // 관통상 — 그 자체로는 아무것도 아니다. 「마법 무효」 비늘(받는 마법 0%)을 이 상태가 300% 로 갈아 끼운다.
  upsert(db.states as StateRecord[], {
    id: FS_PIERCED_STATE, name: "관통상", restriction: "없음", removalCondition: "전투 종료",
    recoverNaturallyFromTurn: 3, recoverNaturallyChance: 100, battleAura: "paralyze-spark",
    runtimeEffects: { damageTypeRates: { magic: 300 }, removeOnBattleEnd: true },
  } as StateRecord);
  for (const id of PIERCE_SKILLS) {
    const skill = db.skills.find((s) => s.id === id) as SkillRecord | undefined;
    if (!skill) throw new Error(`[fallen-star act1] 기술 ${id} 이 없다`);
    skill.stateEffects = [...(skill.stateEffects ?? []).filter((e) => e.stateId !== FS_PIERCED_STATE), { stateId: FS_PIERCED_STATE, chance: 100, operation: "add" }];
    if (!skill.description?.includes("관통상")) skill.description = `${skill.description ?? ""}\n맞은 곳에 「관통상」을 남긴다 — 단단한 비늘도 마법이 스미게 된다.`.trim();
  }
  // 다른 적은 관통상에 걸리지 않는다(마법 3배는 용의 비늘에만 뜻이 있다).
  for (const enemy of db.enemies) enemy.stateRates = { ...(enemy.stateRates ?? {}), [FS_PIERCED_STATE]: "E" } as EnemyRecord["stateRates"];

  const base = db.skills.find((s) => s.id === "skill_fs_judgment") as SkillRecord;
  const skill = (id: string, fields: Partial<SkillRecord>): SkillRecord => ({ ...(JSON.parse(JSON.stringify(base)) as SkillRecord), id, stateEffects: [], ...fields } as SkillRecord);
  upsert(db.skills, skill("skill_fs_dragon_bite", {
    name: "물어뜯기", scope: "enemy", power: 90, chargeTurns: undefined, animationId: "anim_gen_claw_rake", elementId: undefined,
    description: "달비늘 용이 한 사람을 문다.", effect: { kind: "damage", statistic: "attack", affects: "hp" },
  } as Partial<SkillRecord>));
  upsert(db.skills, skill("skill_fs_dragon_tail", {
    name: "꼬리 휩쓸기", scope: "allEnemies", power: 50, chargeTurns: undefined, animationId: "anim_gen_tackle_impact", elementId: undefined,
    description: "꼬리로 앞줄을 쓸어 낸다.", effect: { kind: "damage", statistic: "attack", affects: "hp" },
  } as Partial<SkillRecord>));
  upsert(db.skills, skill("skill_fs_dragon_breath", {
    name: "달빛 숨결", scope: "allEnemies", power: 110, chargeTurns: 1, animationId: "anim_gen_ice_shatter", elementId: "ice",
    description: "한 차례 숨을 모은 뒤 서리 빛을 내뿜는다. 모으는 동안 방어하라.", effect: { kind: "damage", statistic: "mind", affects: "hp" },
  } as Partial<SkillRecord>));
  upsert(db.skills, skill("skill_fs_dragon_scales", {
    name: "비늘 세우기", scope: "self", power: 0, chargeTurns: undefined, animationId: "anim_gen_power_aura", elementId: undefined,
    description: "갈라진 비늘을 다시 닫고 몸을 굳힌다.", effect: { kind: "support" },
    stateEffects: [{ stateId: FS_PIERCED_STATE, chance: 100, operation: "remove" }, { stateId: "state_defense_up", chance: 100, operation: "add" }],
  } as Partial<SkillRecord>));

  const template = db.enemies.find((e) => e.id === "enemy_dragon_blue") ?? db.enemies.find((e) => e.id === "enemy_fs_guardian");
  if (!template) throw new Error("[fallen-star act1] 용 견본 적이 없다");
  const neutral = Object.fromEntries(Object.keys(template.elementRates ?? {}).map((k) => [k, "C"]));
  upsert(db.enemies, {
    ...(JSON.parse(JSON.stringify(template)) as EnemyRecord),
    id: FS_DRAGON_ENEMY, name: "달비늘 용", level: 10, monsterResourceId: "generated-enemy-dragon-blue", battleScalePercent: 150,
    skillIds: ["skill_fs_dragon_bite", "skill_fs_dragon_tail", "skill_fs_dragon_breath", "skill_fs_dragon_scales"],
    stats: { maxHp: 3200, maxMp: 99, attack: 165, defense: 160, mind: 130, agility: 40 },
    damageTypeRates: { magic: 0 },
    actions: [
      act("skill_fs_dragon_bite", 6), act("skill_fs_dragon_tail", 5),
      act("skill_fs_dragon_breath", 10, { kind: "turn", start: 3, interval: 4 }),
      // 오래 끌면(기믹 없이 평타로 버티면) 숨결이 두 차례마다 — 비늘을 가르지 않으면 이길 수 없게 하는 시계.
      act("skill_fs_dragon_breath", 11, { kind: "turn", start: 14, interval: 2 }),
      act("skill_fs_dragon_scales", 9, { kind: "turn", start: 5, interval: 4 }),
    ],
    stateRates: { [FS_PIERCED_STATE]: "A", state_sleep: "E", state_stop: "E", state_paralysis: "E", state_poison: "D", state_defense_down: "C" },
    elementRates: { ...neutral, ice: "E", fire: "C" },
    collapseEffect: "bossSink",
    rewards: { exp: 520, gold: 420, dropRatePercent: 0, drops: [{ itemId: "item_scale", ratePercent: 100, quantity: 1, condition: { kind: "always" } }] },
  } as unknown as EnemyRecord);
  db.enemies.find((e) => e.id === FS_DRAGON_ENEMY)!.stateRates = { [FS_PIERCED_STATE]: "A", state_sleep: "E", state_stop: "E", state_paralysis: "E", state_poison: "D", state_defense_down: "C" } as EnemyRecord["stateRates"];

  const text = (body: string, speaker?: string): Command => (speaker ? say(speaker, body) : narrate(body));
  upsert(db.troops, {
    id: FS_DRAGON_TROOP, name: "달비늘 용", enemyIds: [FS_DRAGON_ENEMY],
    members: [{ enemyId: FS_DRAGON_ENEMY, x: 0, y: 0, hidden: false }], autoAlign: true, uncapturable: true,
    backdropLayers: [{ preset: "glow", opacity: 70 }, { preset: "fog", opacity: 40 }, { preset: "embers", opacity: 30 }],
    battleEventPages: [
      { id: "troop_fs_dragon_open", name: "시작 — 마력이 미끄러진다", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }],
        commands: [text("비늘이 마력을 먹어요…!\n주문은 그냥 미끄러질 거예요.", IRIS), text("수첩에 적혀 있던 대로야.\n비늘부터 가른다!", KAEL)] },
      { id: "troop_fs_dragon_crack", name: "관통상 — 비늘이 갈라졌다", span: "battle", runOnce: false,
        conditions: [{ kind: "enemyState", enemyId: FS_DRAGON_ENEMY, stateId: FS_PIERCED_STATE }, sw(SW_DRAGON_CRACK, false)],
        commands: [setSw(SW_DRAGON_CRACK), text("비늘이 갈라졌다!\n갈라진 틈으로 마력이 스며든다.")] },
      { id: "troop_fs_dragon_close", name: "관통상 풀림 — 비늘이 닫혔다", span: "battle", runOnce: false,
        conditions: [{ kind: "enemyState", enemyId: FS_DRAGON_ENEMY, stateId: FS_PIERCED_STATE, present: false }, sw(SW_DRAGON_CRACK, true)],
        commands: [setSw(SW_DRAGON_CRACK, false), text("갈라진 비늘이 다시 닫혔다.")] },
      { id: "troop_fs_dragon_phase2", name: "2페이즈 — 체력 절반", span: "battle", runOnce: true,
        conditions: [{ kind: "enemyHpBelow", enemyId: FS_DRAGON_ENEMY, percent: 50 }],
        commands: [text("달비늘 용이 몸을 웅크리고\n등줄기의 비늘을 곤두세운다."),
          m2("m2-100-change-enemy-state", { target: FS_DRAGON_ENEMY, operation: "add", value: "state_agility_up" })] },
    ],
  } as unknown as TroopRecord);

  valenCrash(project, text);
}

// ── 추락지 발렌 — 세 단계(병사 8 → 발렌 → 금단의 주술·기계) ─────────────────────────
export const FS_VALEN_ENEMY = "enemy_fs_valen";
export const FS_VALEN_SOLDIER = "enemy_fs_valen_soldier";
export const FS_VALEN_CROSSBOW = "enemy_fs_valen_crossbow";
export const FS_VALEN_GOLEM = "enemy_fs_valen_golem";
export const FS_VALEN_STANDBY_STATE = "state_fs_valen_standby";
export const FS_VALEN_MACHINE_STATE = "state_fs_valen_machine";
export const FS_CIRCUIT_ITEM = "item_fs_circuit";
export const FS_IRIS_SHOCK_SKILL = "skill_fs_iris_shock";
const SW_VALEN_P2 = "sw_fs_valen_p2";
const SW_VALEN_P3 = "sw_fs_valen_p3";

function valenCrash(project: Project, text: (body: string, speaker?: string) => Command): void {
  const db = project.database;
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  const valen = db.enemies.find((e) => e.id === FS_VALEN_ENEMY);
  if (!valen) throw new Error("[fallen-star act1] enemy_fs_valen 이 없다");
  // 사람 크기(아군과 같은 걷기 칩 비율) · 보스라 HP 를 숨긴다.
  delete (valen as Partial<EnemyRecord>).battleScalePercent;
  (valen as EnemyRecord & { hideHp?: boolean }).hideHp = true;
  valen.stats = { ...valen.stats, maxHp: 2600, attack: 135, defense: 75, mind: 108, agility: 48 };
  // 같은 사람 모양 적(광신도·설교자)도 사람 크기로.
  for (const id of ["enemy_fs_fanatic", "enemy_fs_fanatic_preacher"]) {
    const e = db.enemies.find((x) => x.id === id);
    if (e) delete (e as Partial<EnemyRecord>).battleScalePercent;
  }
  // 심판의 빛 — 얼음이 아니라 빛기둥.
  const judgment = db.skills.find((x) => x.id === "skill_fs_judgment") as SkillRecord | undefined;
  if (!judgment) throw new Error("[fallen-star act1] skill_fs_judgment 가 없다");
  judgment.animationId = "anim_gen_holy_beam";
  judgment.elementId = "holy";

  // 기다림 — 병사들이 싸우는 동안 발렌은 뒤에서 지켜본다(행동하지 않고, 어떤 피해도 받지 않는다).
  upsert(db.states as StateRecord[], {
    id: FS_VALEN_STANDBY_STATE, name: "지휘", restriction: "없음", removalCondition: "전투 종료",
    runtimeEffects: { restrictsAction: true, damageTypeRates: { physical: 0, magic: 0 }, removeOnBattleEnd: true },
  } as StateRecord);
  // 금단의 주술 — 기계의 몸. 물리 무효 · 마법 1/4 · 번개(전기)만 두 배로 들어간다.
  upsert(db.states as StateRecord[], {
    id: FS_VALEN_MACHINE_STATE, name: "기계화", restriction: "없음", removalCondition: "전투 종료", battleAura: "paralyze-spark",
    runtimeEffects: {
      transformResourceId: "generated-enemy-golem-iron", attackMultiplier: 1.15, removeOnBattleEnd: true,
      damageTypeRates: { physical: 0, magic: 25, elements: { thunder: 200 } },
    },
  } as unknown as StateRecord);

  const base = db.skills.find((x) => x.id === "skill_fs_judgment") as SkillRecord;
  const skill = (id: string, fields: Partial<SkillRecord>): SkillRecord => ({ ...clone(base), id, stateEffects: [], chargeTurns: undefined, ...fields } as SkillRecord);
  upsert(db.skills, skill("skill_fs_valen_piston", {
    name: "강철 주먹", scope: "enemy", power: 70, animationId: "anim_gen_tackle_impact", elementId: undefined,
    description: "쇳덩이가 된 팔로 내리친다.", effect: { kind: "damage", statistic: "attack", affects: "hp" },
  } as Partial<SkillRecord>));
  upsert(db.skills, skill("skill_fs_valen_overload", {
    name: "과부하", scope: "allEnemies", power: 58, chargeTurns: 1, animationId: "anim_gen_thunder_strike", elementId: "thunder",
    description: "몸 안의 회로를 한꺼번에 터뜨린다. 모으는 동안 방어하라.", effect: { kind: "damage", statistic: "mind", affects: "hp" },
  } as Partial<SkillRecord>));
  // 이리스 「전격탄」 — 별빛 사수의 전기 탄환(공격력 계열·번개). 기계의 몸을 태운다.
  const shot = db.skills.find((x) => x.id === "skill_gunner_shot") as SkillRecord | undefined;
  if (!shot) throw new Error("[fallen-star act1] skill_gunner_shot 이 없다");
  upsert(db.skills, {
    ...clone(shot), id: FS_IRIS_SHOCK_SKILL, name: "전격탄", power: 62, elementId: "thunder", animationId: "anim_gen_thunder_strike",
    mpCost: { flat: 5, percentMax: 0 }, criticalRate: 10, weaponAffinity: undefined,
    description: "번개를 실은 탄환. 기계·쇠붙이에 잘 듣는다.",
  } as unknown as SkillRecord);
  const iris = db.actors.find((a) => a.id === "actor_fs_iris") as (ActorRecord & { learnedSkills?: { level: number; skillId: string }[] }) | undefined;
  if (!iris) throw new Error("[fallen-star act1] actor_fs_iris 가 없다");
  iris.learnedSkills = [...(iris.learnedSkills ?? []).filter((l) => l.skillId !== FS_IRIS_SHOCK_SKILL), { level: 1, skillId: FS_IRIS_SHOCK_SKILL }];

  const act3 = (skillId: string, priority: number) => act(skillId, priority, { kind: "status", stateId: FS_VALEN_MACHINE_STATE, present: true });
  valen.skillIds = [...new Set([...(valen.skillIds ?? []), "skill_fs_valen_piston", "skill_fs_valen_overload"])];
  valen.actions = [
    ...(valen.actions ?? []).filter((a) => !["skill_fs_valen_piston", "skill_fs_valen_overload"].includes(a.skillId)),
    act3("skill_fs_valen_piston", 12) as EnemyRecord["actions"][number],
    act3("skill_fs_valen_overload", 11) as EnemyRecord["actions"][number],
  ];
  // 회로 — 발렌이 사라진 자리에 떨어진다(이벤트가 준다). 검은 그대로 떨군다.
  upsert(db.items, {
    ...clone(db.items.find((i) => i.id === "item_fs_star_key")!), id: FS_CIRCUIT_ITEM, name: "회로",
    description: "발렌이 사라진 자리에 떨어져 있던 손바닥만 한 판. 금빛 선이 아직 희미하게 맥박친다. 이 땅의 누구도 이런 것을 만들지 못한다.",
  } as unknown as typeof db.items[number]);

  // 병사·석궁병·골렘.
  const fanatic = db.enemies.find((e) => e.id === "enemy_fs_fanatic");
  const golem = db.enemies.find((e) => e.id === "enemy_golem_stone") ?? db.enemies.find((e) => e.id === "enemy_fs_guardian");
  if (!fanatic || !golem) throw new Error("[fallen-star act1] 병사·골렘 견본이 없다");
  const human = (id: string, name: string, battler: string, stats: EnemyRecord["stats"], exp: number): EnemyRecord => {
    const e = clone(fanatic) as EnemyRecord;
    delete (e as Partial<EnemyRecord>).battleScalePercent;
    return { ...e, id, name, monsterResourceId: battler, stats, collapseEffect: "pixelBreak",
      rewards: { exp, gold: 12, dropRatePercent: 0, drops: [{ itemId: "item_potion", ratePercent: 10, quantity: 1, condition: { kind: "always" } }] } } as EnemyRecord;
  };
  upsert(db.enemies, human(FS_VALEN_SOLDIER, "심문회 병사", "charset-battler-actor1-2", { maxHp: 150, maxMp: 0, attack: 64, defense: 26, mind: 10, agility: 38 }, 28));
  upsert(db.enemies, human(FS_VALEN_CROSSBOW, "심문회 석궁병", "charset-battler-people3-7", { maxHp: 120, maxMp: 0, attack: 70, defense: 18, mind: 10, agility: 46 }, 28));
  upsert(db.enemies, {
    ...clone(golem), id: FS_VALEN_GOLEM, name: "심문회 골렘", monsterResourceId: "generated-enemy-golem-stone", battleScalePercent: undefined,
    stats: { maxHp: 340, maxMp: 0, attack: 78, defense: 70, mind: 20, agility: 20 }, collapseEffect: "pixelBreak",
    rewards: { exp: 40, gold: 0, dropRatePercent: 0, drops: [] },
  } as unknown as EnemyRecord);
  for (const e of db.enemies) if ([FS_VALEN_SOLDIER, FS_VALEN_CROSSBOW, FS_VALEN_GOLEM].includes(e.id)) e.stateRates = { ...(e.stateRates ?? {}), [FS_PIERCED_STATE]: "E" } as EnemyRecord["stateRates"];

  const st = (target: string, operation: "add" | "remove", value: string): Command => m2("m2-100-change-enemy-state", { target, operation, value });
  const appear = (target: string): Command => m2("m2-101-enemy-encounter", { target });
  const anim = (target: string, animationId: string): Command => m2("m2-103-show-animation", { target, animationId });
  const hp = (target: string, value: number): Command => m2("m2-098-change-enemy-hp", { target, operation: "add", value });
  const soldiers: Array<[string, number, number]> = [
    [FS_VALEN_SOLDIER, 150, 40], [FS_VALEN_SOLDIER, 210, 60], [FS_VALEN_SOLDIER, 150, 110], [FS_VALEN_SOLDIER, 210, 130],
    [FS_VALEN_SOLDIER, 150, 180], [FS_VALEN_CROSSBOW, 95, 30], [FS_VALEN_CROSSBOW, 95, 150], [FS_VALEN_CROSSBOW, 210, 200],
  ];
  upsert(db.troops, {
    id: FS_VALEN_CRASH_TROOP, name: "심문관 발렌",
    enemyIds: [FS_VALEN_ENEMY, ...soldiers.map((m) => m[0]), FS_VALEN_GOLEM, FS_VALEN_GOLEM],
    members: [
      { enemyId: FS_VALEN_ENEMY, x: 40, y: 100, hidden: false },
      ...soldiers.map(([enemyId, x, y]) => ({ enemyId, x, y, hidden: false })),
      { enemyId: FS_VALEN_GOLEM, x: 110, y: 70, hidden: true },
      { enemyId: FS_VALEN_GOLEM, x: 110, y: 160, hidden: true },
    ],
    autoAlign: false, uncapturable: true,
    backdropLayers: [{ preset: "fog", opacity: 45 }, { preset: "embers", opacity: 40 }, { preset: "stars", opacity: 40 }],
    battleEventPages: [
      { id: "troop_fs_valen_crash_open", name: "1단계 — 병사들이 먼저", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }],
        commands: [setSw(SW_VALEN_P2, false), setSw(SW_VALEN_P3, false), st(FS_VALEN_ENEMY, "add", FS_VALEN_STANDBY_STATE),
          text("심문회, 앞으로.\n인형만 데려오면 된다.", VALEN),
          text("발렌은 뒤에 서 있어요…!\n기사들부터 뚫어야 해요.", IRIS)] },
      { id: "troop_fs_valen_crash_p2", name: "2단계 — 발렌이 직접", span: "battle", runOnce: true,
        conditions: [{ kind: "enemiesAlive", atMost: 1 }],
        commands: [setSw(SW_VALEN_P2), text("…쓸모없는 것들.", VALEN), anim(FS_VALEN_ENEMY, "anim_gen_power_aura"),
          st(FS_VALEN_ENEMY, "remove", FS_VALEN_STANDBY_STATE),
          text("심문관이 장검을 고쳐 쥐고 걸어 나온다.")] },
      { id: "troop_fs_valen_crash_summon1", name: "2단계 — 골렘 하나", span: "battle", runOnce: true,
        conditions: [sw(SW_VALEN_P2), { kind: "enemyHpBelow", enemyId: FS_VALEN_ENEMY, percent: 85 }],
        commands: [text("흙이여, 일어나 방패가 되어라.", VALEN), appear(FS_VALEN_GOLEM)] },
      { id: "troop_fs_valen_crash_summon2", name: "2단계 — 골렘 둘", span: "battle", runOnce: true,
        conditions: [sw(SW_VALEN_P2), { kind: "enemyHpBelow", enemyId: FS_VALEN_ENEMY, percent: 55 }],
        commands: [text("하나 더.", VALEN), appear(FS_VALEN_GOLEM)] },
      { id: "troop_fs_valen_crash_phase2", name: "2단계 — 장갑을 벗는다", span: "battle", runOnce: true,
        conditions: [sw(SW_VALEN_P2), { kind: "enemyHpBelow", enemyId: FS_VALEN_ENEMY, percent: 50 }],
        commands: [text("…장갑을 벗을 때가 됐군.", VALEN), st(FS_VALEN_ENEMY, "add", "state_agility_up")] },
      { id: "troop_fs_valen_crash_p3", name: "3단계 — 금단의 주술", span: "battle", runOnce: true,
        conditions: [sw(SW_VALEN_P2), { kind: "enemyHpBelow", enemyId: FS_VALEN_ENEMY, percent: 30 }],
        commands: [
          setSw(SW_VALEN_P3),
          text("…이것만은 쓰지 않으려 했다.", VALEN),
          text("별지기의 금단의 주술 ──\n몸을 내주고, 쇠를 입는다.", VALEN),
          anim(FS_VALEN_ENEMY, "anim_gen_holy_beam"),
          m2("m2-046-tint-screen", { color: "white", durationMs: 120 }), wait(260),
          st(FS_VALEN_ENEMY, "add", FS_VALEN_MACHINE_STATE),
          anim(FS_VALEN_ENEMY, "anim_gen_thunder_strike"),
          hp(FS_VALEN_ENEMY, 900),
          m2("m2-046-tint-screen", { color: "neutral", durationMs: 700 }),
          text("살갗이 갈라지고, 그 밑에서\n톱니와 금빛 선이 드러난다."),
          text("저건… 저랑 같은 거예요.\n칼도 주문도 튕겨 나가요!", IRIS),
          text("회로라면 번개에 약해요.\n전기로 태워요!", IRIS),
        ] },
    ],
  } as unknown as TroopRecord);
}

// ════════════════════════════════════════════════════════════════════
// 2. 추락지 — 발렌 중간 보스
// ════════════════════════════════════════════════════════════════════

function crashSite(project: Project, forestId: string): void {
  const forest = M(project, forestId);
  const podId = `ev_${FS_PREFIX}_main_inspect1`;
  const pod = forest.events.find((e) => e.id === podId);
  if (!pod) throw new Error("[fallen-star act1] 떨어진 별 이벤트가 없다");
  // 합류 줄 바로 뒤(진행 스위치 다음)에 「발렌이 올라온다」 스위치를 켠다.
  let hooked = false;
  for (const p of pod.pages ?? []) eachList(p.commands as Command[], (list) => {
    if (hooked) return;
    const joined = list.findIndex((c) => bodyOf(c) === "이리스가 동료가 되었다.");
    if (joined < 0) return;
    let at = joined + 1;
    while (at < list.length && (list[at]!.kind === "setSwitch" || list[at]!.kind === "setVariable")) at += 1;
    list.splice(at, 0, setSw(SW_CRASH_ON));
    hooked = true;
  });
  if (!hooked) throw new Error("[fallen-star act1] 이리스 합류 줄을 찾지 못했다");

  const stop: Cell = { x: pod.x + 1, y: pod.y + 4 };
  const start: Cell = { x: stop.x, y: stop.y + 6 };
  const up = pathTo(project, forest, start, stop);
  const id = `ev_${FS_PREFIX}_valen_crash`;
  const at = stop;
  const puff = (dx: number, dy: number, ms: number): Command => fx("smoke", at.x + dx, at.y + dy, ms);
  const vanish: Command[] = [
    narrate("쇠가 식는 소리. 톱니가 살갗 밑으로 가라앉고,\n발렌은 다시 사람의 모습으로 무릎을 짚는다."),
    say(VALEN, "삼십 년 전에도 그랬다.\n모두가 자기만 옳다고 믿었지."),
    say(VALEN, "…네가 틀렸기를 바란다.\n정말로."),
    narrate("발렌이 장갑 낀 왼손을 땅으로 내리친다."),
    se("easyrpg-sound-fog1"),
    fx("dust", at.x, at.y, 700), puff(0, 0, 3200), puff(0, 0, 3000), puff(0, 0, 2800), puff(-1, 0, 2600), puff(1, 0, 2600), puff(0, -1, 2400),
    fx("magic", at.x, at.y, 1200),
    wait(550),
    flash("white", 120),
    look(id, { tint: "gray", opacity: 55 }),
    puff(-1, -1, 2200), puff(1, -1, 2200), puff(0, 0, 2400), puff(0, 1, 2000),
    wait(500),
    look(id, { opacity: 20 }),
    fx("dust", at.x, at.y, 700),
    wait(450),
    setSw(SW_STEP2),
    { kind: "setVariable", variableId: "var_fs_main_progress", op: "+=", value: 1 } as unknown as Command,
    look(id, { reset: true }),
    wait(1500),
    narrate("연기가 걷혔을 때, 발렌은 그 자리에 없었다."),
    se("cc0-se-orp-inventory-metal-small2"),
    narrate("그가 서 있던 자리에\n손바닥만 한 금속판이 떨어져 있다."),
    item(FS_CIRCUIT_ITEM),
    narrate("「회로」를 손에 넣었다."),
    say(IRIS, "그 사람 몸 안에서… 저랑 같은 소리가 났어요.\n이건 그 사람한테서 떨어진 거예요."),
    say(ELENA, "새벽샘… 선생님 일기장에 있던 이름이야."),
    say(KAEL, "천문대로 가자.\n선생님은 뭔가 알고 계셔."),
  ];
  const fight = (): Command[] => [
    setSw(SW_CRASH_MET),
    battleBgm("cc0-bgm-rtp-btl-002"),
    battle(FS_VALEN_CRASH_TROOP, true),
    battleBgmReset(),
    won([setSw(SW_SOLDIERS_GONE), ...vanish], [
      { kind: "recoverAll" } as unknown as Command,
      say(ELENA, "일단 물러서! 숨 고르고 다시 붙자."),
      route("@player", [{ kind: "turn", dir: "down" }]),
    ]),
  ];
  // 병사 넷 — 발렌 뒤를 따라 올라와 길을 막는다(전투의 병사 여덟 중 앞줄). 전투에 이기면 사라진다.
  const soldierWalks: Command[] = [];
  const soldierSpots: Cell[] = [{ x: stop.x - 1, y: stop.y + 1 }, { x: stop.x, y: stop.y + 2 }, { x: stop.x - 1, y: stop.y + 3 }, { x: stop.x, y: stop.y + 4 }];
  soldierSpots.forEach((spot, i) => {
    const from: Cell = { x: spot.x, y: Math.min(forest.height - 1, spot.y + 6) };
    let dirs: Dir[];
    try { dirs = pathTo(project, forest, from, spot); } catch { return; }
    const sid = `ev_${FS_PREFIX}_valen_soldier_${i + 1}`;
    const [sheet, index] = i % 2 === 0 ? KNIGHT : SOLDIER;
    addEvent(forest, sid, "심문회 병사", from, [
      page(`${sid}_hidden`, "아직 오지 않음", [], []),
      page(`${sid}_on`, "발렌을 따라 올라온다", [sw(SW_CRASH_ON), sw(SW_SOLDIERS_GONE, false), sw(SW_STEP2, false)], [],
        { graphic: chip(sheet, index, "up"), priority: "same", overlapForbidden: true, animationType: "normal" }),
    ]);
    soldierWalks.push(route(sid, [...walk(dirs), { kind: "turn", dir: "up" }], false));
  });
  const intro: Command[] = [
    cutBegin(),
    letterbox(),
    se("cc0-se-orp-inventory-metal-small2"),
    narrate("숲길 아래에서 쇠 장화 소리가 올라온다."),
    emote("player", "exclamation", 700),
    scroll("down", 4),
    ...soldierWalks,
    route(id, walk(up)),
    route(id, [{ kind: "turn", dir: "up" }]),
    narrate("발렌 뒤로 심문회 병사들이 숲길을 메운다."),
    scrollBack(),
    route("@player", [{ kind: "turnToward", target: id }]),
    say(VALEN, "쇠 긁는 소리를 따라왔더니\n아이들이 먼저 와 있군."),
    say(VALEN, "그 관에서 나온 것을 넘겨라.\n하늘에서 온 것은 교단이 거둔다."),
    emote("player", "sweat", 700),
    say(IRIS, "인형이 아니에요. 이리스예요.\n집에 대답만 하면 떠날게요."),
    emote(id, "ellipsis", 900),
    say(VALEN, "…대답. 그 말을 믿은 마을이 있었다.\n새벽샘이라는 곳이었지."),
    say(KAEL, "못 넘겨요.\n이리스는 저희가 데려온 동료예요."),
    say(ELENA, "카엘, 저 사람 심문관이야.\n…정말 싸울 거야?"),
    say(KAEL, "응."),
    say(VALEN, "좋다. 그럼 배워라.\n하늘의 것을 감싼 손이 무엇을 치르는지."),
    se("cc0-se-orp-battle-sword-unsheathe"),
    shake(3, 500),
    narrate("발렌이 장검을 뽑는다. 칼날에 하얀 빛이 고인다."),
    cutLabel(),
    clearLetterbox(),
    cutEnd(),
    ...fight(),
  ];
  const retry: Command[] = [
    say(VALEN, "숨은 골랐나.\n그 인형을 두고 가면 쫓지 않는다."),
    say(KAEL, "안 둬요."),
    ...fight(),
  ];
  addEvent(forest, id, VALEN, start, [
    page(`${id}_hidden`, "아직 오지 않음", [], []),
    page(`${id}_intro`, "추락지에 올라온다", [sw(SW_CRASH_ON), sw(SW_CRASH_MET, false), sw(SW_STEP2, false)], intro,
      { graphic: valenChip("up"), trigger: { kind: "auto" }, priority: "same", overlapForbidden: true, animationType: "normal" }),
    page(`${id}_retry`, "다시 붙는다", [sw(SW_CRASH_ON), sw(SW_CRASH_MET), sw(SW_STEP2, false)], retry,
      { graphic: valenChip("up"), priority: "same", overlapForbidden: true }),
    page(`${id}_gone`, "물러남", [sw(SW_STEP2)], []),
  ]);
  // 재도전 페이지는 멈춘 자리(stop)에 있어야 한다 — 인트로가 걸어 올린 뒤 그 자리에 남는다. 처음 위치는 start.
}

// ════════════════════════════════════════════════════════════════════
// 3. 옛 별지기의 방 — 발렌 결전 걷기, 렌즈가 별 봉인을 연다
// ════════════════════════════════════════════════════════════════════

const SEAL: Cell = { x: 26, y: 7 };
const SEAL_TILES = { closed: [7482, 7483, 7484, 7485], open: [7486, 7487, 7488, 7489] };
const SEAL_CELLS = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];

function vaultSeal(project: Project, vaultId: string): void {
  const vault = M(project, vaultId);
  vault.events = vault.events.filter((e) => e.id !== `ev_${FS_PREFIX}_main_kill2` && !e.id.startsWith(`ev_${FS_PREFIX}_valen_cue`));
  const openSeal = swapTiles(vault, SEAL_CELLS.map((d, i) => ({ x: SEAL.x + d.x, y: SEAL.y + d.y, from: SEAL_TILES.closed[i]!, to: SEAL_TILES.open[i]! })));
  const lensId = `ev_${FS_PREFIX}_vault_lens`;
  addEvent(vault, lensId, "별지기의 렌즈", { x: 16, y: 6 }, [
    page(`${lensId}_p0`, "렌즈", [], [narrate("거대한 렌즈가 바닥을 향해 기울어 있다.\n먼지 낀 유리 속에 희미한 빛이 고여 있다.")]),
    page(`${lensId}_p1`, "렌즈 — 이리스", [sw(SW_IRIS_JOINED)], [
      fork(sw(SW_SEAL_OPEN, false), [
        cutBegin(),
        say(IRIS, "이 렌즈… 아직 살아 있어요.\n그런데 하늘이 아니라 아래를 보고 있어요."),
        say(ELENA, "아래? 여기가 제일 깊은 방인데."),
        say(IRIS, "신호가 아래에서 와요.\n아주 깊은 데서, 아주 작게."),
        se("easyrpg-sound-chime2"),
        fx("sparkle", 15, 5, 1600),
        flash("white", 400),
        narrate("렌즈가 방 안의 빛을 모아\n동쪽 바닥의 별 봉인으로 쏘아 내렸다."),
        fx("magic", SEAL.x, SEAL.y, 1600), fx("sparkle", SEAL.x + 1, SEAL.y + 1, 1600),
        shake(2, 700),
        se("cc0-se-ors-stones-02"),
        ...openSeal,
        setSw(SW_SEAL_OPEN),
        wait(500),
        narrate("돌뚜껑이 갈라지며\n아래로 내려가는 돌계단이 드러났다."),
        say(KAEL, "…천문대 밑에 이런 게 더 있었어?"),
        say(ELENA, "선생님도 모르셨을 거야.\n아니면… 알면서 닫아 두셨거나."),
        cutLabel(),
        cutEnd(),
      ], [narrate("렌즈의 빛은 동쪽 별 봉인을 가리키고 있다.")]),
    ]),
  ]);
  const toB3 = transfer(FS_B3_ID, B3.arrive, "down");
  SEAL_CELLS.forEach((d, i) => {
    const sid = `ev_${FS_PREFIX}_vault_seal_${i}`;
    addEvent(vault, sid, "별 봉인", { x: SEAL.x + d.x, y: SEAL.y + d.y }, [
      page(`${sid}_closed`, "닫힌 봉인", [], [narrate("별 무늬 돌뚜껑이 바닥에 박혀 있다.\n홈마다 빛이 닿아야 열릴 것 같다.")], { priority: "below" }),
      page(`${sid}_open`, "열린 봉인", [sw(SW_SEAL_OPEN)], [toB3], { priority: "below", trigger: { kind: "playerTouch" } }),
    ]);
  });
}

// ════════════════════════════════════════════════════════════════════
// 4. 지하 3층 · 가라앉은 회랑
// ════════════════════════════════════════════════════════════════════

function makeMap(project: Project, exec: Exec, id: string, name: string, like: GameMap, bgmId: string): GameMap {
  exec(project, "create_map", { id, name, width: 20, height: 15, tilesetId: like.tilesetId });
  const map = M(project, id);
  const rec = map as unknown as Rec;
  const src = like as unknown as Rec;
  for (const key of ["mapRole", "climate"]) if (src[key] !== undefined) rec[key] = JSON.parse(JSON.stringify(src[key]));
  rec.bgm = { mode: "custom", resourceId: bgmId };
  return map;
}

function stairsTo(map: GameMap, cells: Cell[], key: string, name: string, dest: Command): void {
  cells.forEach((c, i) => {
    const id = `ev_${FS_PREFIX}_${key}_${i}`;
    addEvent(map, id, name, c, [page(`${id}_p`, name, [], [dest], { priority: "below", trigger: { kind: "playerTouch" } })]);
  });
}

function leverEvent(map: GameMap, key: string, name: string, lever: Cell, pages: EventPage[]): void {
  // 레버 그림은 벽면 두 줄(lever.y, lever.y+1) — 이벤트는 아랫줄, 플레이어는 그 아래 바닥에서 위를 보고 당긴다.
  addEvent(map, `ev_${FS_PREFIX}_${key}`, name, { x: lever.x, y: lever.y + 1 }, pages);
}
function pullLever(map: GameMap, lever: Cell): Command[] {
  return [
    se("cc0-se-osx-switch-02"),
    ...swapTiles(map, [{ x: lever.x, y: lever.y, from: 6542, to: 6544 }, { x: lever.x, y: lever.y + 1, from: 6543, to: 6545 }]),
    wait(300),
  ];
}
function openGate(map: GameMap, cells: Cell[]): Command[] {
  return [
    se("cc0-se-osx-machine-01"),
    shake(1, 400),
    // 열린 문 아래 칸(6424)은 칩셋 통행이 막혀 있다 — 들어 올린 문짝(6423)만 남기고 발밑은 비운다(-1).
    ...swapTiles(map, cells.flatMap((c) => [{ x: c.x, y: c.y - 1, from: 6421, to: 6423 }, { x: c.x, y: c.y, from: 6422, to: -1 }])),
    se("cc0-se-osx-metal-03"),
  ];
}

function chest(map: GameMap, key: string, at: Cell, gains: Array<[string, number, string]>): void {
  const id = `ev_${FS_PREFIX}_${key}`;
  const g = { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down", pattern: 82 };
  addEvent(map, id, "보물상자", at, [
    page(`${id}_closed`, "던전 상자(닫힘)", [{ kind: "selfSwitch", key: "A", value: false } as unknown as Condition], [
      { kind: "playAudio", resourceId: "cc0-se-osx-wooded-box-open", loop: false } as unknown as Command,
      { kind: "setEventGraphicPattern", eventId: id, pattern: 70 } as unknown as Command, wait(120),
      { kind: "setEventGraphicPattern", eventId: id, pattern: 58 } as unknown as Command, wait(260),
      { kind: "playAudio", resourceId: "cc0-se-osx-bell-01", loop: false } as unknown as Command,
      ...gains.map(([itemId, n]) => item(itemId, n)),
      narrate(`보물상자를 열었다!\n${gains.map(([, n, label]) => (n > 1 ? `${label} ×${n}` : label)).join(" · ")} 획득.`, { context: "system" }),
      { kind: "setSelfSwitch", key: "A", value: true } as unknown as Command,
    ], { graphic: g, overlapForbidden: true, animationType: "fixedGraphic" }),
    page(`${id}_opened`, "던전 상자(열림)", [{ kind: "selfSwitch", key: "A", value: true } as unknown as Condition],
      [narrate("상자는 비어 있다.", { context: "system" })], { graphic: { ...g, direction: "up", pattern: 58 }, overlapForbidden: true, animationType: "fixedGraphic" }),
  ]);
}

function foe(project: Project, map: GameMap, template: GameEvent, key: string, at: Cell, troopId: string, chipOf: [string, number], shout: [string, string]): void {
  const id = `ev_${FS_PREFIX}_${key}`;
  let json = JSON.stringify(template).split(template.id).join(id);
  const event = JSON.parse(json) as GameEvent & Rec;
  event.x = at.x; event.y = at.y;
  ensureSwitch(project, `sw_${id}_clear`, `${map.name}: ${shout[0]} 쓰러짐`);
  // 순찰: 좌우 두 칸이 막혔으면 위아래, 그것도 막혔으면 제자리.
  const free = (dx: number, dy: number) => isPassable(project, map, at.x + dx, at.y + dy) && isPassable(project, map, at.x + 2 * dx, at.y + 2 * dy);
  const axis: [Dir, Dir] | null = free(1, 0) ? ["right", "left"] : free(-1, 0) ? ["left", "right"] : free(0, 1) ? ["down", "up"] : free(0, -1) ? ["up", "down"] : null;
  for (const p of event.pages ?? []) {
    const rec = p as unknown as Rec;
    if (p.graphic?.sprite) {
      const direction = (p.graphic.direction ?? "down") as Dir;
      p.graphic = { ...p.graphic, ...chip(chipOf[0], chipOf[1], direction) } as EventPage["graphic"];
    }
    const mv = rec.movement as Rec | undefined;
    if (mv?.type === "chase" && mv.route) {
      const moves = axis
        ? [axis[0], "w", "w", axis[0], "w", "w", axis[1], "w", "w", axis[1], "w", "w"].map((d) => (d === "w" ? { kind: "wait" } : { kind: "move", dir: d }))
        : [{ kind: "wait" }, { kind: "turnRandom" }, { kind: "wait" }];
      (mv.route as Rec).moves = moves;
    }
    eachList(p.commands as Command[], (list) => {
      for (const c of list) {
        const r = c as unknown as Rec;
        if (r.kind === "battleProcessing") r.troopId = troopId;
        if (r.kind === "text" && r.speaker) { r.speaker = shout[0]; r.body = shout[1]; }
      }
    });
  }
  map.events = map.events.filter((e) => e.id !== id);
  map.events.push(event);
}

/** 두 층의 맵·방·빛을 먼저 짓는다 — 층 사이 이동 이벤트가 목적지 맵을 요구하므로 이벤트보다 앞. */
function shells(project: Project, exec: Exec, vault: GameMap): void {
  makeMap(project, exec, FS_B3_ID, FS_B3_NAME, vault, "cc0-bgm-rtp-dng-001");
  build(project, exec, FS_B3_ID, B3_ROOM);
  lightRoom(project, exec, FS_B3_ID, B3_ROOM, 0.6, "#121a36", [
    { x: 21, y: 4, radius: 3, color: "#a8d8f0", intensity: 0.6 },
    { x: 21, y: 29, radius: 2.6, color: "#88b3ca", intensity: 0.6 },
  ]);
  makeMap(project, exec, FS_B4_ID, FS_B4_NAME, vault, "cc0-bgm-rtp-mys-001");
  build(project, exec, FS_B4_ID, B4_ROOM);
  lightRoom(project, exec, FS_B4_ID, B4_ROOM, 0.55, "#10182e", [
    { x: 14, y: 3, radius: 2.6, color: "#7cf0b0", intensity: 0.8 },
    { x: 11, y: 3, radius: 1.6, color: "#a8d8f0", intensity: 0.7 },
    { x: 18, y: 3, radius: 1.6, color: "#a8d8f0", intensity: 0.7 },
    { x: 15, y: 11, radius: 4.5, color: "#9cc8ff", intensity: 0.5 },
    { x: 10, y: 27, radius: 2.4, color: "#88c8ff", intensity: 0.9 },
    { x: 18, y: 27, radius: 2.4, color: "#88f0e0", intensity: 0.8 },
  ]);
}

function floorB3(project: Project, vault: GameMap): GameMap {
  const map = M(project, FS_B3_ID);
  stairsTo(map, B3.stairsUp, "b3_up", "올라가는 돌계단", transfer(vault.id, { x: SEAL.x, y: SEAL.y + 2 }, "down"));
  const downCells: Cell[] = [];
  for (let dx = 0; dx < 3; dx += 1) for (let dy = 0; dy < 2; dy += 1) downCells.push({ x: B3.stairsDown.x + dx, y: B3.stairsDown.y + dy });
  stairsTo(map, downCells, "b3_down", "내려가는 계단통", transfer(FS_B4_ID, B4.arrive, "up"));

  // 첫걸음 — 층의 이름과 목표 한 줄(한 번만).
  const arriveId = `ev_${FS_PREFIX}_b3_arrive`;
  addEvent(map, arriveId, "회랑 입구", { x: 0, y: 0 }, [
    page(`${arriveId}_p`, "첫걸음", [{ kind: "selfSwitch", key: "A", value: false } as unknown as Condition], [
      narrate("물에 잠겼다 마른 돌 냄새.\n별지기의 방 아래로, 또 하나의 층이 있었다."),
      say(IRIS, "신호는 더 아래예요.\n이 층을 지나야 해요."),
      say(ELENA, "벽마다 교단 인장이 새겨져 있어.\n…우리보다 먼저 온 사람들이 있었네."),
      { kind: "setSelfSwitch", key: "A", value: true } as unknown as Command,
    ], { trigger: { kind: "auto" } }),
    page(`${arriveId}_done`, "지남", [{ kind: "selfSwitch", key: "A", value: true } as unknown as Condition], []),
  ]);

  // 읽을거리.
  const read = (key: string, name: string, at: Cell, lines: Command[]) => addEvent(map, `ev_${FS_PREFIX}_lore_${key}`, name, at, [page(`ev_${FS_PREFIX}_lore_${key}_p`, name, [], lines)]);
  read("b3_hall", "층 안내 석판", B3.hallTablet, [
    sign("석판", "(석판) 가라앉은 회랑.\n아래로 가는 길은 「달의 문」 하나뿐이다."),
    sign("석판", "(석판) 달의 문은 동쪽 손잡이 방에서 연다.\n동쪽 길은 서쪽 달의 방이 연다."),
  ]);
  read("b3_levers", "손잡이 방 석판", B3.leverTablet, [
    sign("석판", "(석판) 해가 누운 뒤에야\n달이 길을 연다."),
    sign("석판", "(석판) 순서를 어긴 손에는 종이 운다."),
  ]);
  read("b3_orders", "심문회 명령서", B3.ordersNE, [
    sign("명령서", "(명령서) 심문회 지하반에 명한다.\n심문관께서 숲에서 돌아오시기 전에 「문지기의 방」을 연다."),
    sign("명령서", "(명령서) 달의 문 손잡이는 해 다음 달.\n거꾸로 당기면 경종이 울려 경비가 모인다. 다시는 틀리지 마라."),
    sign("명령서", "(명령서) 최하층의 짐승에게는 접근 금지.\n성광 주문이 듣지 않는다. 이미 셋을 잃었다."),
  ]);
  read("b3_diary", "찢긴 수첩", B3.diarySW, [
    sign("수첩", "(찢긴 수첩) 아래층 비늘 짐승에게는\n기도도, 불도, 성광도 미끄러진다."),
    sign("수첩", "(찢긴 수첩) 마르코가 창을 비늘 틈에 박아 넣었다.\n갈라진 자리로 설교자님의 성광이 처음으로 스몄다."),
    sign("수첩", "(찢긴 수첩) 세 배는 아팠을 거라고\n설교자님이 웃었다. 마르코는 돌아오지 않았다."),
    say(ELENA, "창으로 비늘을 가르면… 마법이 들어간다는 거네."),
    say(IRIS, "제 광선도 꿰뚫을 수 있어요.\n기억해 둘게요."),
  ]);

  // 쇠살문과 레버.
  leverEvent(map, "b3_lever_west", "녹슨 손잡이", B3.westLever, [
    page(`ev_${FS_PREFIX}_b3_lever_west_p0`, "손잡이", [], [
      narrate("벽에 녹슨 쇠 손잡이가 박혀 있다.\n손잡이 위에 초승달이 새겨져 있다."),
      ...pullLever(map, B3.westLever),
      setSw(SW_WEST_LEVER),
      narrate("철컥— 멀리 동쪽에서\n쇠살문이 끌려 올라가는 소리가 울린다."),
      ...openGate(map, B3.eastGate),
      say(KAEL, "동쪽 길이 열렸어."),
    ]),
    page(`ev_${FS_PREFIX}_b3_lever_west_p1`, "당긴 손잡이", [sw(SW_WEST_LEVER)], [narrate("손잡이는 이미 내려가 있다.")]),
  ]);
  leverEvent(map, "b3_lever_sun", "해 손잡이", B3.sunLever, [
    page(`ev_${FS_PREFIX}_b3_lever_sun_p0`, "해 손잡이", [], [
      narrate("해 문양이 새겨진 손잡이다."),
      ...pullLever(map, B3.sunLever),
      setSw(SW_SUN_LEVER),
      narrate("톱니 하나가 깊은 곳에서 맞물렸다."),
    ]),
    page(`ev_${FS_PREFIX}_b3_lever_sun_p1`, "당긴 해 손잡이", [sw(SW_SUN_LEVER)], [narrate("해 손잡이는 이미 누워 있다.")]),
  ]);
  const ambushTemplate = vault.events.find((e) => e.id === `ev_${FS_PREFIX}_vault_foe1`);
  leverEvent(map, "b3_lever_moon", "달 손잡이", B3.moonLever, [
    page(`ev_${FS_PREFIX}_b3_lever_moon_p0`, "달 손잡이", [], [
      narrate("초승달 문양이 새겨진 손잡이다."),
      fork(sw(SW_SUN_LEVER), [
        ...pullLever(map, B3.moonLever),
        setSw(SW_MOON_LEVER),
        narrate("해 다음에 달. 두 톱니가 맞물리며\n남쪽 깊은 곳에서 무거운 문이 올라간다."),
        cutBegin(),
        scroll("left", 14, 900),
        ...openGate(map, B3.moonGate),
        wait(600),
        scrollBack(),
        cutLabel(),
        cutEnd(),
        say(ELENA, "달의 문이야. 회랑 남쪽!"),
      ], [
        se("cc0-se-osx-switch-01"),
        narrate("손잡이가 헛돈다.\n…그리고 천장 어딘가에서 종이 울린다."),
        fork(sw(SW_ALARM, false), [
          se("cc0-se-osx-bell-02"),
          shake(2, 600),
          setSw(SW_ALARM),
          emote("player", "exclamation", 700),
          say(FANATIC, "경종이다! 순서를 모르는 쥐새끼들이\n손잡이를 건드렸다!"),
          battle("troop_fs_fanatic_cell", false, true),
          narrate("손잡이가 철컥, 제자리로 돌아갔다."),
        ], [narrate("손잡이가 철컥, 제자리로 돌아갔다.")]),
      ]),
    ]),
    page(`ev_${FS_PREFIX}_b3_lever_moon_p1`, "당긴 달 손잡이", [sw(SW_MOON_LEVER)], [narrate("달 손잡이는 이미 누워 있다.")]),
  ]);

  // 막다른 길의 보상.
  chest(map, "b3_chest_sw", B3.chestSW, [["item_elixir", 1, "엘릭서"], ["item_phoenix_down", 1, "불사조 깃"]]);
  chest(map, "b3_chest_ne", B3.chestNE, [["item_ether", 2, "마력약"], ["item_hi_potion", 2, "상급 회복약"]]);

  // 광신도 넷 — 지하 2층 견본(추격·도망·쓰러진 자리 페이지)을 그대로 복제.
  if (!ambushTemplate) throw new Error("[fallen-star act1] 광신도 견본(ev_fs_vault_foe1)이 없다");
  const ACTOR3: [string, number] = ["tex_easyrpg_charset_actor3", 2];
  const PEOPLE2: [string, number] = ["tex_easyrpg_charset_people2", 2];
  foe(project, map, ambushTemplate, "b3_foe_gallery", B3.foes.gallery!, "troop_fs_fanatics", ACTOR3, [FANATIC, "회랑은 교단이 접수했다!\n돌아가라, 별지기 쥐들아!"]);
  foe(project, map, ambushTemplate, "b3_foe_west", B3.foes.west!, "troop_fs_fanatic_sermon", PEOPLE2, ["광신도 설교자", "달의 방에 손대지 마라.\n그 손잡이는 심문관님의 것이다."]);
  foe(project, map, ambushTemplate, "b3_foe_east", B3.foes.east!, "troop_fs_fanatic_cell", ACTOR3, [FANATIC, "문이 열렸다고?\n누가 서쪽 손잡이를…!"]);
  foe(project, map, ambushTemplate, "b3_foe_levers", B3.foes.levers!, "troop_fs_fanatic_sermon", PEOPLE2, ["광신도 설교자", "해와 달의 순서는\n믿는 자에게만 가르쳐 준다."]);
  return map;
}

// ════════════════════════════════════════════════════════════════════
// 5. 지하 4층 · 달비늘의 자리 — 쉼터·용·기계 패널
// ════════════════════════════════════════════════════════════════════


/** 「달의 아이」 — 기계 패널의 기록. 짧은 우화 → 지워진 쪽 → 수신 대기열(질문만 남긴다). */
export const MOON_CHILD_FABLE: string[] = [
  "[별지기 단말]\n기록 1건 ──「달의 아이」",
  "옛날, 하늘을 건너던 배의 맏딸이\n잠든 이들을 푸른 땅에 내려놓고\n손마다 불씨를 쥐여 주었다.\n빌려 준 불이었다.",
  "맏딸은 배와 함께 하늘로 돌아갔다.\n사람들은 그 흰 배를 달이라 불렀다.",
  "지켜보는 일은 외로웠다.\n달은 가끔 아이를 하나 떨어뜨렸다.\n아이는 한 가지만 물었다.\n\n「잘 지내나요?」",
  "대답을 품은 아이는 달로 돌아가며\n땅에서 본 것을 모두 잊었다.\n대답만 남았다.",
  "첫째 아이에겐 어부의 딸이,\n둘째 아이에겐 숲의 젊은이 셋이 대답했다.",
  "셋째 아이는 샘가 마을의 잠긴 문을\n세 번 두드렸다. ▒▒▒\n대답이 없으면 빌려 준 불을 ▒▒ 돌려받",
  "[이하 삭제 ── 별지기 회의]\n정착 확인 3/4 ▒ 미완료\n넷째 아이 · 중계기 이리스. 응답 대기.",
];

function floorB4(project: Project): GameMap {
  const map = M(project, FS_B4_ID);
  stairsTo(map, B4.upExit, "b4_up", "올라가는 통로", transfer(FS_B3_ID, { x: B3.stairsDown.x + 1, y: B3.stairsDown.y - 1 }, "up"));

  // 쉼터 — 기록 결정(회복 + 기록)·샘(회복)·다친 광신도(힌트).
  const crystalId = `ev_${FS_PREFIX}_b4_crystal`;
  addEvent(map, crystalId, "푸른 별빛 결정", B4.crystal, [page(`${crystalId}_p`, "기록 결정", [], [
    se("easyrpg-sound-recovery7"), flash("blue", 300), m2("m2-224-particle-effect", { preset: "heal", target: "player", durationMs: 800, wait: false }),
    narrate("푸른 결정에 손을 대자, 지친 몸에 힘이 차올랐다."),
    { kind: "recoverAll" } as unknown as Command,
    { kind: "choices", prompt: "여기까지를 기록할까?", cancelBehavior: "branch", options: [
      { text: "기록한다", branch: [{ kind: "openSaveMenu" } as unknown as Command] },
      { text: "그만둔다", branch: [] },
    ], cancelBranch: [] } as unknown as Command,
  ], { overlapForbidden: true })]);
  const springId = `ev_${FS_PREFIX}_b4_spring`;
  addEvent(map, springId, "치유의 샘", B4.spring, [page(`${springId}_p`, "샘", [], [
    se("easyrpg-sound-recovery7"), m2("m2-224-particle-effect", { preset: "heal", target: "player", durationMs: 800, wait: false }),
    narrate("차가운 샘물이 손끝을 타고 올라온다.\n상처가 아물고 마력이 다시 고였다."),
    { kind: "recoverAll" } as unknown as Command,
  ], { overlapForbidden: true })]);
  const woundedId = `ev_${FS_PREFIX}_b4_wounded`;
  addEvent(map, woundedId, "다친 광신도", B4.wounded, [
    page(`${woundedId}_p0`, "다친 광신도", [], [
      say(FANATIC, "…쫓아온 거냐. 상관없다.\n나는 더 못 걷는다."),
      say(FANATIC, "들어가지 마라. 저놈 비늘은\n주문을 먹는다. 형제 셋이 불 주문을 외다 쓰러졌다."),
      say(KAEL, "어떻게 하면 이길 수 있어?"),
      say(FANATIC, "…창. 마르코가 창으로 비늘을 가르자,\n그 틈으로만 성광이 들어갔다. 잠깐뿐이었지만."),
      say(FANATIC, "틈은 금방 닫힌다.\n가르고, 바로 쳐라. …그게 다다."),
      say(ELENA, "샘물 좀 떠다 줄게요.\n여기서 기다려요."),
      { kind: "setSelfSwitch", key: "A", value: true } as unknown as Command,
    ], { graphic: chip("tex_easyrpg_charset_actor3", 2, "left"), overlapForbidden: true, animationType: "fixedGraphic" }),
    page(`${woundedId}_p1`, "다친 광신도(물 받음)", [{ kind: "selfSwitch", key: "A", value: true } as unknown as Condition], [
      fork(sw(SW_DRAGON_DOWN), [say(FANATIC, "…정말 쓰러뜨렸나.\n그럼 나도 위로 기어 올라가 보지.")],
        [say(FANATIC, "가르고, 바로 쳐라.\n…살아서 돌아와라. 이상한 말이지만.")]),
    ], { graphic: chip("tex_easyrpg_charset_actor3", 2, "left"), overlapForbidden: true, animationType: "fixedGraphic" }),
  ]);

  // 용 — 잠든 모습 / 깨어 쓰러짐.
  const dragonId = `ev_${FS_PREFIX}_b4_dragon`;
  // 필드에도 전투 그림 그대로(걷기 칩이 없는 적은 전투 도트에서 필드 그림을 얻는다) — 보스답게 2.2배.
  const dragonGfx = { sprite: { type: "bundled", id: "generated-enemy-dragon-blue" }, direction: "down", pattern: 0, scale: 2.2, scaleMode: "manual" };
  const dragonFight = (): Command[] => [
    setSw(SW_DRAGON_CRACK, false),
    battleBgm("cc0-bgm-rtp-btl-001"),
    battle(FS_DRAGON_TROOP, true),
    battleBgmReset(),
    won([
      se("cc0-se-ors-creature-roar-03"),
      shake(4, 900),
      look(dragonId, { tint: "gray", opacity: 70 }),
      fx("sparkle", B4.dragon.x, B4.dragon.y - 1, 1800), fx("dust", B4.dragon.x, B4.dragon.y, 900),
      wait(700),
      look(dragonId, { opacity: 25 }),
      wait(500),
      setSw(SW_DRAGON_DOWN),
      look(dragonId, { reset: true }),
      narrate("달비늘 용이 비늘을 떨구며\n푸른 빛가루로 흩어졌다."),
      say(IRIS, "…문지기였어요. 무언가를 지키고 있었어요."),
      say(ELENA, "저 안쪽, 벽에서 빛이 깜빡여."),
    ], [
      { kind: "recoverAll" } as unknown as Command,
      say(ELENA, "물러서! 그냥 주문으론 안 돼.\n…수첩 내용, 기억하지?"),
      route("@player", walk(["down", "down", "down"])),
    ]),
  ];
  addEvent(map, dragonId, "달비늘 용", B4.dragon, [
    page(`${dragonId}_sleep`, "잠든 용", [], [
      narrate("거대한 짐승이 몸을 말고 잠들어 있다.\n숨결마다 비늘 틈으로 푸른 빛이 샌다."),
    ], { graphic: dragonGfx, footprint: { width: 3, height: 2 }, overlapForbidden: true, animationType: "fixedGraphic" }),
    page(`${dragonId}_awake`, "깨어난 용", [sw(SW_DRAGON_MET)], [
      narrate("달비늘 용이 낮게 으르렁거린다."),
      ...dragonFight(),
    ], { graphic: { ...dragonGfx, direction: "down" }, footprint: { width: 3, height: 2 }, overlapForbidden: true, animationType: "step" }),
    page(`${dragonId}_down`, "흩어짐", [sw(SW_DRAGON_DOWN)], []),
  ]);
  B4.wakeLine.forEach((c, i) => {
    const wid = `ev_${FS_PREFIX}_b4_wake_${i}`;
    addEvent(map, wid, "용의 잠자리 앞", c, [
      page(`${wid}_on`, "깨운다", [sw(SW_DRAGON_MET, false)], [
        cutBegin(),
        letterbox(),
        stopBgm(),
        narrate("발밑의 뼈가 바스락 부서졌다."),
        wait(600),
        se("cc0-se-ors-creature-roar-02"),
        shake(4, 900),
        emote(dragonId, "exclamation", 900),
        emote("player", "exclamation", 700),
        say(ELENA, "…용이야. 수첩에 있던\n비늘 짐승이 이거였어!"),
        say(IRIS, "저 뒤에 기계가 있어요.\n신호는 거기서 나와요."),
        say(KAEL, "창으로 비늘을 가르고,\n엘레나가 바로 친다. 간다!"),
        setSw(SW_DRAGON_MET),
        cutLabel(),
        clearLetterbox(),
        cutEnd(),
        setSw(SW_DRAGON_MET),
        ...dragonFight(),
      ], { priority: "below", trigger: { kind: "playerTouch" } }),
      page(`${wid}_off`, "지남", [sw(SW_DRAGON_MET)], [], { priority: "below" }),
    ]);
  });

  // 기계 패널 — 「달의 아이」.
  const panelCmds: Command[] = [
    fork(sw(SW_STEP3, false), [
      cutBegin(),
      se("cc0-se-osx-machine-02"),
      narrate("카엘이 패널에 손을 얹자,\n유리 밑에서 녹색 글자가 깨어났다."),
      ...MOON_CHILD_FABLE.slice(0, 1).map(term),
      say(ELENA, "이야기…? 이렇게 깊은 데 묻어 둔 게\n아이들 옛날이야기라고?"),
      ...MOON_CHILD_FABLE.slice(1, 4).map(term),
      say(IRIS, "…「잘 지내나요?」\n제가 처음 받은 명령문이에요."),
      ...MOON_CHILD_FABLE.slice(4, 6).map(term),
      say(KAEL, "둘째 아이… 숲, 셋이 대답했다.\n숲의 표지석에 하넬 선생님 이름이 있었어."),
      ...MOON_CHILD_FABLE.slice(6, 7).map(term),
      say(ELENA, "샘가 마을… 새벽샘.\n발렌이 걸어 나왔다는 곳이야."),
      say(ELENA, "빌려 준 불… 우리가 쓰는 마력이\n원래 달의 것이었다는 거야?"),
      ...MOON_CHILD_FABLE.slice(7, 8).map(term),
      say(IRIS, "넷째 아이. …저예요."),
      wait(400),
      term("[응답 요청]\n이 땅에 사는 손을 패널에 얹고\n대답하십시오.\n\n「잘 지내나요?」"),
      emote("player", "ellipsis", 900),
      say(KAEL, "…잘 지내.\n오늘은."),
      se("easyrpg-sound-chime2"),
      flash("white", 500),
      fx("sparkle", 14, 3, 1800), fx("sparkle", 15, 3, 1800),
      term("[정착 확인 4/4 접수]\n응답자: 이 땅의 손 하나.\n신호 송신 ── 북방 중계탑."),
      narrate("천장 너머로 가느다란 빛줄기가\n북쪽을 향해 솟아올랐다."),
      say(IRIS, "…답이 왔어요! 북쪽이에요.\n제 배의 나머지, 하늘탑이 아직 살아 있어요."),
      wait(500),
      term("[중계기 이리스 수신 확인]\n귀환 시 현지 기록을 소거합니다."),
      say(KAEL, "소거? 기억을 지운다는 거야?"),
      say(IRIS, "이야기 속 아이들처럼요.\n돌아가면 오늘 일도 지워져요. 카엘이 한 대답도."),
      say(KAEL, "…그래도 갈 거야?"),
      say(IRIS, "네. 가서 확인해야 해요.\n지워지는 게 정말 「저」인지."),
      say(KAEL, "그럼 가기 전에 일지에 한 줄 더 쓰자.\n네가 잊으면, 내가 읽어 줄게."),
      setSw(SW_STEP3),
      { kind: "setVariable", variableId: "var_fs_main_progress", op: "+=", value: 1 } as unknown as Command,
      se("cc0-se-osx-machine-03"),
      shake(2, 900),
      narrate("패널 옆 벽이 갈라지며\n좁은 승강 장치가 드러났다."),
      say(ELENA, "위로 이어져 있어. 천문대 쪽이야.\n…선생님께 전부 말씀드려야 해."),
      cutLabel(),
      cutEnd(),
    ], []),
    narrate("승강 장치에 오른다."),
    se("cc0-se-osx-machine-02"),
    fadeOut(1000),
    wait(1000),
    setSw(SW_LIFTED),
    transfer("fs_observatory", { x: 4, y: 18 }, "down"),
  ];
  B4.panel.forEach((c, i) => {
    const pid = `ev_${FS_PREFIX}_b4_panel_${i}`;
    addEvent(map, pid, "기계 패널", c, [
      page(`${pid}_off`, "잠긴 패널", [], [narrate("녹색 빛이 짐승의 숨결에 맞춰 깜빡인다.\n유리 밑 글자는 아직 잠들어 있다.")]),
      page(`${pid}_on`, "깨어난 패널", [sw(SW_DRAGON_DOWN)], panelCmds.map((cmd) => JSON.parse(JSON.stringify(cmd)) as Command)),
    ]);
  });
  return map;
}

// ════════════════════════════════════════════════════════════════════
// 6. 하넬 — 추락지 뒤, 결말은 하넬이 아니라 포위다
// ════════════════════════════════════════════════════════════════════

function hanelAfterCrash(project: Project, obsId: string): void {
  const obs = M(project, obsId);
  const hanel = obs.events.find((e) => e.id === `ev_${FS_PREFIX}_hanel`);
  if (!hanel) throw new Error("[fallen-star act1] 하넬 이벤트가 없다");
  let replaced = 0;
  for (const p of hanel.pages ?? []) eachList(p.commands as Command[], (list) => {
    for (let i = 0; i < list.length; i += 1) {
      const rec = list[i] as unknown as Rec;
      const cond = rec.condition as Rec | undefined;
      if (rec.kind !== "fork" || cond?.kind !== "switch" || cond.switchId !== SW_STEP2 || cond.value !== true) continue;
      // step2 갈래(옛 결말) → 하넬이 이리스를 처음 보고, 숲의 발렌 이야기를 듣는다. else 갈래(이리스 합류 전 안내)는 그대로.
      const otherwise = (rec.else as Command[]) ?? [];
      const meet = JSON.parse(JSON.stringify(otherwise)) as Command[];
      let met = false;
      eachList(meet, (l) => {
        const at = l.findIndex((c) => (c as unknown as Rec).kind === "setSwitch" && (c as unknown as Rec).switchId === "sw_fs_hanel_met_iris");
        if (at < 0 || met) return;
        // 하넬 「…그 아이가」·이리스 자기소개 두 줄 뒤, 렌즈 안내 앞에 숲의 발렌 보고를 끼운다.
        const textsBefore = l.slice(0, at).filter((c) => c.kind === "text").length;
        let insertAt = at;
        if (textsBefore >= 2) { let seen = 0; insertAt = l.findIndex((c) => c.kind === "text" && ++seen === 2) + 1; }
        l.splice(insertAt, 0,
          say(KAEL, "선생님, 추락지에 심문관이 왔어요.\n발렌이요. 싸워서… 물리쳤어요."),
          emote(hanel.id, "exclamation", 700),
          say(H, "…발렌이."),
          say(H, "그 아이는 물러설 줄은 알아도\n그만둘 줄은 모른다. 다시 온다."),
          say(ELENA, "새벽샘 얘기를 했어요.\n그 말을 믿은 마을이 있었다고."),
          say(H, "…서른 해 전 일이다.\n돌아오면 다 말하마."),
          say(KAEL, "발렌이 사라진 자리에 이게 떨어져 있었어요."),
          narrate("카엘이 「회로」를 내밀었다.\n금빛 선이 아직 희미하게 맥박친다."),
          emote(hanel.id, "exclamation", 700),
          say(H, "…회로다. 별지기들이 「옛것」이라 부르던 물건이지.\n지금 이 땅의 누구도 이걸 만들지 못한다."),
          say(H, "발렌이 이런 걸 품고 있었다면…\n진짜 비밀은 하늘이 아니라 땅 밑에 있다."),
          say(H, "옛 별지기의 방 아래로 길이 이어진다.\n다만 그 밑엔 짐승이 산다. 비늘 덮인 것이."),
          say(ELENA, "짐승이요…?"),
          say(H, "그래서 아무도 가까이 가지 못했다.\n렌즈가 문을 열거든, 서두르지 말거라."),
        );
        met = true;
      });
      if (!met) throw new Error("[fallen-star act1] 하넬 첫 만남 갈래를 찾지 못했다");
      list[i] = fork(sw(SW_STEP3, false), meet, [say(H, "북쪽이라… 그래. 하늘탑이다.")]);
      replaced += 1;
    }
  });
  if (!replaced) throw new Error("[fallen-star act1] 하넬 step2 갈래를 찾지 못했다");
  // 렌즈 안내 줄 — 이제 아래로 더 내려간다.
  for (const p of hanel.pages ?? []) eachList(p.commands as Command[], (list) => {
    for (const c of list) if (bodyOf(c) === "서고 바닥 돌뚜껑이다.\n조심해 내려가거라.") (c as { body: string }).body = "서고 바닥 돌뚜껑이다.\n렌즈가 무엇을 비추는지 보고 오너라.";
  });
}

// ════════════════════════════════════════════════════════════════════
// 7. 승강 장치 → 천문대 → 광장 포위 → 제1막 끝
// ════════════════════════════════════════════════════════════════════

function observatoryAlarm(project: Project, obsId: string, hubId: string, siegeFront: Cell): void {
  const obs = M(project, obsId);
  const hanelId = `ev_${FS_PREFIX}_hanel`;
  const id = `ev_${FS_PREFIX}_lift_arrival`;
  addEvent(obs, id, "승강 장치 도착", { x: 0, y: 0 }, [
    page(`${id}_wait`, "대기", [], []),
    page(`${id}_run`, "도착", [sw(SW_LIFTED), sw(SW_SIEGE, false)], [
      fadeIn(800),
      wait(400),
      se("cc0-se-osx-gong-02"),
      shake(2, 600),
      emote(hanelId, "exclamation", 800),
      emote("player", "exclamation", 700),
      say(H, "카엘! 엘레나! …살아 있었구나.", { calling: true }),
      say(H, "방금 북쪽으로 빛이 솟았다.\n온 마을이 봤을 게다. 그리고—", { calling: true }),
      se("cc0-se-osx-bell-02"),
      say(H, "…발렌이 기사단을 데려왔다.\n천문대 앞이 에워싸였다.", { calling: true }),
      say(KAEL, "숲에서 물러난 게 아니었어.\n기다린 거야."),
      say(IRIS, "제가 나가면 돼요.\n그럼 아무도 다치지 않아요."),
      say(KAEL, "안 돼."),
      say(H, "앞장서거라. 뒤는 내가 맡으마."),
      setSw(SW_SIEGE),
      fadeOut(900),
      wait(900),
      transfer(hubId, siegeFront, "down"),
    ], { trigger: { kind: "auto" } }),
  ]);
}

function siege(project: Project, hubId: string, front: Cell): void {
  const hub = M(project, hubId);
  const door: Cell = { x: front.x, y: front.y - 2 };
  const hanelStop: Cell = { x: front.x, y: front.y - 1 };
  // 발렌 자리: 주인공 남쪽 2~3칸의 빈 칸(아래로 내려가며 첫 통행 칸, 없으면 옆 줄).
  const cand: Cell[] = [];
  for (let dy = 2; dy <= 4; dy += 1) for (const dx of [0, -1, 1, -2, 2]) cand.push({ x: front.x + dx, y: front.y + dy });
  const valenStop = cand.find((c) => isPassable(project, hub, c.x, c.y));
  if (!valenStop) throw new Error("[fallen-star act1] 광장에 발렌이 설 칸이 없다");
  const key = (c: Cell) => `${c.x},${c.y}`;
  const reserved = new Set([key(front), key(hanelStop), key(door), key(valenStop)]);
  const fromFront = bfs(project, hub, front);
  // 발렌이 들어오는 길: 남쪽 먼 칸(거리 13~16)에서.
  const far = [...fromFront.entries()].map(([k, v]) => ({ x: Number(k.split(",")[0]), y: Number(k.split(",")[1]), d: v.d }))
    .filter((c) => c.d >= 13 && c.d <= 17);
  const valenSpawn = far.filter((c) => c.y > front.y + 3).sort((a, b) => Math.abs(a.x - front.x) - Math.abs(b.x - front.x))[0] ?? far[0];
  if (!valenSpawn) throw new Error("[fallen-star act1] 발렌이 걸어 들어올 칸이 없다");
  const valenPath = pathTo(project, hub, valenSpawn, valenStop, new Set([key(front)]));
  const valenCells = new Set<string>();
  { let c = { ...valenSpawn }; for (const d of valenPath) { const s = STEPS.find((t) => t[0] === d)!; c = { x: c.x + s[1], y: c.y + s[2] }; valenCells.add(key(c)); } }
  // 에워싸는 자리: 주인공에서 2~4칸, 통행 칸, 발렌 길·이벤트 칸이 아닌 곳을 각도 고르게 24곳.
  const occupied = new Set(hub.events.map((e) => key(e)));
  const ring = [...fromFront.entries()].map(([k, v]) => ({ x: Number(k.split(",")[0]), y: Number(k.split(",")[1]), d: v.d }))
    .filter((c) => {
      const cheb = Math.max(Math.abs(c.x - front.x), Math.abs(c.y - front.y));
      return cheb >= 2 && cheb <= 4 && c.d <= 7 && !reserved.has(key(c)) && !valenCells.has(key(c)) && !occupied.has(key(c));
    })
    .map((c) => ({ ...c, a: Math.atan2(c.y - front.y, c.x - front.x) }))
    .sort((a, b) => a.a - b.a);
  const COUNT = 24;
  if (ring.length < COUNT) throw new Error(`[fallen-star act1] 광장에 에워쌀 칸이 ${ring.length}곳뿐이다`);
  const picked: typeof ring = [];
  for (let i = 0; i < COUNT; i += 1) picked.push(ring[Math.floor((i * ring.length) / COUNT)]!);
  // 각 병사는 같은 방향의 먼 칸(거리 12~17)에서 길을 따라 들어온다.
  const spawns = [...fromFront.entries()].map(([k, v]) => ({ x: Number(k.split(",")[0]), y: Number(k.split(",")[1]), d: v.d }))
    .filter((c) => c.d >= 11 && c.d <= 20 && (Math.abs(c.x - front.x) > 10 || Math.abs(c.y - front.y) > 7))
    .map((c) => ({ ...c, a: Math.atan2(c.y - front.y, c.x - front.x) }));
  if (!spawns.length) throw new Error("[fallen-star act1] 병사가 걸어 들어올 칸이 없다");
  const used = new Set<string>();
  const soldiers: Array<{ id: string; spawn: Cell; stop: Cell; path: Dir[]; face: Dir; look: [string, number] }> = [];
  picked.forEach((stop, i) => {
    const angDiff = (a: number) => Math.abs(Math.atan2(Math.sin(a - stop.a), Math.cos(a - stop.a)));
    const spawn = spawns.filter((s) => !used.has(key(s))).sort((p, q) => angDiff(p.a) - angDiff(q.a) || p.d - q.d)[0]!;
    used.add(key(spawn));
    const path = pathTo(project, hub, spawn, stop);
    const dx = front.x - stop.x, dy = front.y - stop.y;
    const face: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    soldiers.push({ id: `ev_${FS_PREFIX}_siege_soldier_${String(i).padStart(2, "0")}`, spawn, stop, path, face, look: i % 3 === 2 ? SOLDIER : KNIGHT });
  });
  for (const s of soldiers) {
    addEvent(hub, s.id, s.look === KNIGHT ? "심문회 기사" : "왕도 병사", s.spawn, [
      page(`${s.id}_off`, "아직", [], [], { priority: "below" }),
      page(`${s.id}_on`, "포위", [sw(SW_SIEGE)], [], { graphic: chip(s.look[0], s.look[1], "down"), priority: "same", overlapForbidden: false, animationType: "normal",
        movement: { ...fixedMove, speed: 4 } }),
    ]);
  }
  const hanelId = `ev_${FS_PREFIX}_siege_hanel`;
  addEvent(hub, hanelId, H, door, [
    page(`${hanelId}_off`, "아직", [], [], { priority: "below" }),
    page(`${hanelId}_on`, "나온다", [sw(SW_SIEGE_HANEL)], [], { graphic: chip(HANEL_CHIP[0], HANEL_CHIP[1], "down"), priority: "same", animationType: "normal" }),
  ]);
  const valenId = `ev_${FS_PREFIX}_siege_valen`;
  addEvent(hub, valenId, VALEN, valenSpawn, [
    page(`${valenId}_off`, "아직", [], [], { priority: "below" }),
    page(`${valenId}_on`, "들어온다", [sw(SW_SIEGE_VALEN)], [], { graphic: valenChip("up"), priority: "same", animationType: "normal" }),
  ]);

  // 무리별로 걸어 들어온다 — 먼 길부터 출발해 거의 같이 닿게.
  const marching = [...soldiers].sort((a, b) => a.path.length - b.path.length);
  const march: Command[] = [];
  marching.forEach((s, i) => {
    march.push(route(s.id, [{ kind: "setThrough", enabled: true }, ...walk(s.path), { kind: "turn", dir: s.face }, { kind: "setThrough", enabled: false }], i === marching.length - 1));
    if (i % 6 === 5) { march.push(se("cc0-se-orp-inventory-metal-small2")); march.push(wait(250)); }
  });
  const tighten: Command[] = soldiers.map((s) => {
    const dx = Math.sign(front.x - s.stop.x), dy = Math.sign(front.y - s.stop.y);
    const dir: Dir = Math.abs(front.x - s.stop.x) >= Math.abs(front.y - s.stop.y) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    const nx = s.stop.x + (dir === "right" ? 1 : dir === "left" ? -1 : 0), ny = s.stop.y + (dir === "down" ? 1 : dir === "up" ? -1 : 0);
    const ok = isPassable(project, hub, nx, ny) && !reserved.has(`${nx},${ny}`) && Math.max(Math.abs(nx - front.x), Math.abs(ny - front.y)) >= 2;
    return route(s.id, ok ? [{ kind: "move", dir }] : [{ kind: "turn", dir }], false);
  });

  const director = `ev_${FS_PREFIX}_siege_director`;
  addEvent(hub, director, "포위", { x: 0, y: 0 }, [
    page(`${director}_wait`, "대기", [], []),
    page(`${director}_run`, "포위", [sw(SW_SIEGE), sw(SW_DONE, false)], [
      cutBegin(),
      letterbox(),
      stopBgm(),
      fadeIn(900),
      wait(500),
      narrate("천문대 문을 나서자, 광장이 조용했다.\n…너무 조용했다."),
      se("cc0-se-osx-gong-02"),
      shake(2, 600),
      bgm("cc0-bgm-rtp-mys-002"),
      emote("player", "exclamation", 700),
      ...march,
      wait(400),
      say(ELENA, "…사방이야."),
      se("cc0-se-orp-battle-sword-unsheathe"), wait(150), se("cc0-se-orp-battle-sword-unsheathe3"), wait(150), se("cc0-se-orp-battle-sword-unsheathe5"),
      narrate("수십 자루의 칼이 한꺼번에 뽑혔다."),
      setSw(SW_SIEGE_VALEN),
      route(valenId, [{ kind: "setThrough", enabled: true }, ...walk(valenPath), { kind: "turn", dir: "up" }, { kind: "setThrough", enabled: false }]),
      say(VALEN, "말했지. 교단은 잊지 않는다고."),
      say(VALEN, "천문대장 하넬의 제자 카엘, 마도학자 엘레나.\n금지된 봉인을 열고, 하늘의 것을 숨긴 죄."),
      say(VALEN, "그리고 오늘 밤, 누군가 하늘에 대답했다.\n그 빛을 이 마을 모두가 보았다."),
      say(IRIS, "…제가 물었기 때문이에요?"),
      emote(valenId, "ellipsis", 900),
      say(VALEN, "아니. 너는 묻기만 했다.\n대답한 것은 저 아이다."),
      say(KAEL, "대답하면 안 되는 거였어요?\n「잘 지내」 한마디가?"),
      say(VALEN, "새벽샘도 그 한마디를 기다렸다.\n…아무도 하지 않았지. 그래서 탔다."),
      se("cc0-se-osx-door-open"),
      setSw(SW_SIEGE_HANEL),
      route(hanelId, [{ kind: "setThrough", enabled: true }, { kind: "move", dir: "down" }, { kind: "setThrough", enabled: false }, { kind: "turn", dir: "down" }]),
      say(H, "그 아이들에게서 물러서라, 발렌."),
      emote(valenId, "ellipsis", 1000),
      say(VALEN, "…선생님."),
      say(H, "새벽샘에서 걸어 나온 열 살 아이에게\n나는 별 이름을 가르쳤다. 사람 잡는 법이 아니라."),
      say(VALEN, "그래서 저는 지금도 별을 셉니다.\n떨어지는 것까지, 하나도 빠짐없이."),
      wait(500),
      say(VALEN, "…잡아라."),
      se("cc0-se-orp-battle-sword-unsheathe2"),
      ...tighten,
      shake(4, 700),
      flash("white", 200),
      fadeOut(1600),
      wait(1600),
      narrate("그날 밤, 별을 보던 마을의 불이\n하나씩 꺼졌다."),
      cutLabel(),
      setSw(SW_DONE),
      { kind: "triggerEnding", endingId: "end_fs_act1" } as unknown as Command,
    ], { trigger: { kind: "auto" } }),
  ]);
}

function ending(project: Project): void {
  const end = (project.endings ?? []).find((e) => e.id === "end_fs_act1") as (Rec & { presentation?: Rec }) | undefined;
  if (!end) throw new Error("[fallen-star act1] 제1막 엔딩이 없다");
  end.epilogue = [
    { kind: "say", speaker: KAEL, text: "잘 지내. …오늘은." },
    { kind: "say", speaker: IRIS, text: "북쪽 하늘에서 아직 대답이 들려요. 아주 작게." },
  ];
  end.presentation = {
    ...(end.presentation ?? {}),
    kicker: "제1막 끝",
    credits: [
      "카엘 — 견습 별지기", "엘레나 — 천문대의 마도학자", "이리스 — 넷째 아이, 중계기", "",
      "천문대장 하넬", "숲지기 브람", "심문관 발렌", "교단 광신도들", "달비늘 용 — 문지기", "",
      "그날 밤 북쪽 숲에 떨어진 것은 별이 아니었다.", "달이 보낸 넷째 아이였고,", "누군가 그 아이에게 대답했다.", "",
      "OPRN Studio 공식 데모", "", "제2막에서 계속됩니다.",
    ].join("\n"),
  };
}

function quest(project: Project): void {
  const q = (project.quests ?? []).find((x) => (x as { key?: string }).key === "fs_main") as Rec | undefined;
  if (!q) throw new Error("[fallen-star act1] 퀘스트 fs_main 이 없다");
  const steps = q.steps as Rec[];
  const kill = steps.find((s) => s.kind === "kill");
  if (!kill) throw new Error("[fallen-star act1] 퀘스트 kill 단계가 없다");
  kill.troopId = FS_VALEN_CRASH_TROOP;
  kill.at = { ...(kill.at as Rec), mapId: "fs_forest", x: 16, y: 11 };
  if (!steps.some((s) => s.kind === "inspect" && (s.at as Rec | undefined)?.mapId === FS_B4_ID)) {
    steps.push({ kind: "inspect", at: { mapId: FS_B4_ID, x: B4.panel[0]!.x, y: B4.panel[0]!.y }, label: "기계 패널", lines: ["녹색 글자가 깨어난다. 「달의 아이」."] });
  }
  q.blueprint = ["talk", "inspect", "kill", "inspect"];
  q.summary = "북쪽 숲에 떨어진 별을 심문관보다 먼저 찾고, 천문대 지하 깊은 곳의 신호를 따라간다.";
  const dialogue = (q.dialogue ?? {}) as Rec;
  dialogue.completed = "천문대장 하넬: 그 아이들에게서 물러서라, 발렌.";
  q.dialogue = dialogue;
}

function mapTree(project: Project, vaultId: string): void {
  const visit = (node: { mapId: string; children: unknown[] } | undefined): boolean => {
    if (!node) return false;
    if (node.mapId === vaultId) {
      node.children = (node.children as Array<{ mapId: string }>).filter((c) => c.mapId !== FS_B3_ID);
      node.children.push({ mapId: FS_B3_ID, children: [{ mapId: FS_B4_ID, children: [] }] });
      return true;
    }
    return (node.children as Array<{ mapId: string; children: unknown[] }>).some((c) => visit(c));
  };
  if (!visit(project.mapTree as unknown as { mapId: string; children: unknown[] })) throw new Error("[fallen-star act1] 맵 나무에서 지하 묘소를 못 찾았다");
}

export interface FallenAct1Ids { hub: string; observatory: string; forest: string; vault: string }

export function applyFallenAct1Finale(project: Project, exec: Exec, ids: FallenAct1Ids): void {
  for (const [id, name] of [
    [SW_CRASH_ON, "추락지: 발렌이 올라온다"], [SW_CRASH_MET, "추락지: 발렌과 맞섰다"], [SW_STEP3, "떨어진 별: 기계 패널"],
    [SW_SEAL_OPEN, "지하: 별 봉인 열림"], [SW_WEST_LEVER, "지하 3층: 서쪽 손잡이"], [SW_SUN_LEVER, "지하 3층: 해 손잡이"],
    [SW_MOON_LEVER, "지하 3층: 달 손잡이"], [SW_ALARM, "지하 3층: 경종"], [SW_DRAGON_MET, "지하 4층: 용이 깼다"],
    [SW_DRAGON_DOWN, "지하 4층: 용 쓰러짐"], [SW_DRAGON_CRACK, "전투: 용 비늘 갈라짐"], [SW_LIFTED, "승강 장치로 올라옴"],
    [SW_SIEGE, "광장 포위"], [SW_SIEGE_HANEL, "포위: 하넬 나옴"], [SW_SIEGE_VALEN, "포위: 발렌 등장"],
    [SW_SOLDIERS_GONE, "추락지: 병사들 물러남"], [SW_VALEN_P2, "전투: 발렌 2단계"], [SW_VALEN_P3, "전투: 발렌 기계화"],
  ] as const) ensureSwitch(project, id, name);
  database(project);
  crashSite(project, ids.forest);
  const vault = M(project, ids.vault);
  shells(project, exec, vault);
  vaultSeal(project, ids.vault);
  floorB3(project, vault);
  floorB4(project);
  hanelAfterCrash(project, ids.observatory);
  const door = M(project, ids.hub).events.find((e) => JSON.stringify(e).includes(`"mapId":"${ids.observatory}"`));
  if (!door) throw new Error("[fallen-star act1] 광장의 천문대 문이 없다");
  const front: Cell = { x: door.x, y: door.y + 2 };
  observatoryAlarm(project, ids.observatory, ids.hub, front);
  siege(project, ids.hub, front);
  ending(project);
  quest(project);
  mapTree(project, ids.vault);
}

/** 시뮬레이터용 — 관통상을 거는 기술 id. */
export const FS_PIERCE_SKILL_IDS = PIERCE_SKILLS;
