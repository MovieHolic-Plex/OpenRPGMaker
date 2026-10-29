/**
 * 『폴른 스타』 제2막 — B12 두 번째 렌즈(탑 꼭대기, 하넬의 고백) · B13 재의 회수자(보스) → 다시 대답한다 → 막 끝.
 * 기획 docs/fallen-star/act2-plan.md B12·B13.
 *
 * 꼭대기 맵은 author_dungeon(tower, 방 넷: 층계참 → 렌즈실 → 양옆 보물 방·서고)으로 짓고 entrance 로 4층 계단과 잇는다.
 * 렌즈실 기물은 stamp_object, 빛은 set_lighting_volume, 보스는 upsert_enemy·upsert_skill(chargeTurns·chargeBreak)·
 * upsert_troop(partOf/partTag·숨은 멤버)·author_boss_phases·add_battle_guest(발렌 손님)·upsert_combo_tech(넷 연계 「네 번째 대답」)·
 * simulate_battle. 장면은 upsert_event. 새 그림은 없다 — 버들항 키트·RTP 칩·기존 전투 도트만.
 *
 * 주의: act2Tower.ts 와 서로 부른다(순환 import) — towerKit 은 함수 안에서만 꺼낸다.
 */
import type { Command, Project } from "@/project/types";
import { towerKit } from "./act2Tower";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Cell = { x: number; y: number };
type Rec = Record<string, unknown>;

export const FS2_TOP = "fs2_sky_tower_top";
/** 꼭대기 기본 카메라 배율 — 렌즈실이 화면을 채운다(배율 1 은 둘레 허공이 많았다). */
const TOP_ZOOM = 1.4;
const FS2_T4 = "fs2_sky_tower_f4";
const VALEN = "발렌";
const HANEL = "천문대장 하넬";
const BRAM = "숲지기 브람";
const TERMINAL = "단말";

const SW_TOP_ARRIVE = "sw_fs2_top_arrive";
const SW_HANEL_COME = "sw_fs2_top_hanel_come";
export const FS2_SW_B12_DONE = "sw_fs2_b12_confession";
const SW_VALEN_GUEST = "sw_fs2_b13_valen_guest";
const SW_BOSS_LOST = "sw_fs2_b13_lost";
export const FS2_SW_B13_WON = "sw_fs2_b13_collector_down";
export const FS2_SW_STOP_B13 = "sw_fs2_release_stop_b13";

const VALEN_ACTOR = "actor_fs2_valen_guest";
const E_COLLECTOR = "enemy_fs2_ash_collector";
const E_EYE_GRAB = "enemy_fs2_collector_eye_grab";
const E_EYE_BURN = "enemy_fs2_collector_eye_burn";
const E_EMBER = "enemy_fs2_swallowed_fire";
export const FS2_TROOP_COLLECTOR = "troop_fs2_ash_collector";
const SK_ASH_SCATTER = "skill_fs2_ash_scatter";
const SK_GATHER_FIRE = "skill_fs2_gather_fire";
const SK_RECALL = "skill_fs2_ash_recall";
const SK_GAZE = "skill_fs2_collector_gaze";
const SK_HEAT_RAY = "skill_fs2_collector_heat_ray";
const SK_EMBER_BURST = "skill_fs2_swallowed_flare";
export const FS2_COMBO_FOURTH_ANSWER = "combo_fs2_fourth_answer";

/** 꼭대기 좌표(author_dungeon 방 문법 + seed 91 로 고정된 판). */
export const TOP = {
  arrive: { x: 16, y: 23 },          // 4층에서 올라오면 서는 칸(계단 앞)
  trigger: [{ x: 15, y: 15 }, { x: 16, y: 15 }, { x: 17, y: 15 }],
  lens: { x: 15, y: 6 },             // 큰 렌즈(3×4) 왼쪽 위
  valen: { x: 16, y: 10 },           // 렌즈 앞 단말에 선 발렌
  kael: { x: 16, y: 12 },            // 장면에서 카엘이 서는 칸
  hanelStart: { x: 15, y: 21 }, bramStart: { x: 17, y: 21 },
  hanel: { x: 15, y: 16 }, bram: { x: 17, y: 16 },
  hanelLens: { x: 14, y: 10 }, bramLens: { x: 18, y: 11 }, valenLens: { x: 17, y: 10 },
};

const ROOMS = [
  { id: "landing", kind: "entrance", w: 9, h: 6, shape: "round" },
  { id: "lens", kind: "shrine", w: 12, h: 9, from: "landing", dir: "N", shift: 0, len: 4, shape: "round" },
  { id: "vault_w", kind: "vault", w: 6, h: 5, from: "lens", dir: "W", shape: "round" },
  { id: "study", kind: "library", w: 6, h: 5, from: "lens", dir: "E", shape: "round" },
];

/** 꼭대기 맵 — 4층 둥근 방 계단(4층 사건 이벤트보다 먼저: 문 이벤트가 생기면 계단 쪽이 갈려 연결 도구가 거절한다). */
export function buildSummitMap(project: Project, exec: Exec, fromStair: Cell): void {
  exec(project, "author_dungeon", {
    type: "tower", adapter: "beodeul", genre: "rpg", floors: 1, rooms: ROOMS, id: FS2_TOP, name: "하늘탑 꼭대기",
    populate: false, gimmick: "none", entrance: { fromMapId: FS2_T4, x: fromStair.x, y: fromStair.y }, seed: 91,
  });
  exec(project, "set_map_properties", { mapId: FS2_TOP, zoom: TOP_ZOOM });
}

/** 4층 → 꼭대기 계단: 이리스 전에는 한 줄만, 뒤에는 도구가 만든 이동 그대로. */
export function gateSummitStair(project: Project, exec: Exec, irisBackSwitch: string): void {
  const { M, page, narrate, sw } = towerKit;
  const gate = M(project, FS2_T4).events.find((e) => (e.pages ?? []).some((p) => p.commands.some((c) => c.kind === "transfer" && (c as unknown as Rec).mapId === FS2_TOP)));
  if (!gate) throw new Error("[fallen-star summit] 4층 → 꼭대기 계단 이벤트가 없다");
  const go = gate.pages![0]!;
  exec(project, "upsert_event", { mapId: FS2_T4, replacePages: true, event: { id: gate.id, name: "꼭대기 계단", x: gate.x, y: gate.y, trigger: go.trigger, commands: [], pages: [
    page(`${gate.id}_wait`, "아직", [], [narrate("위로 오르는 계단. 바람 소리가 내려온다.\n…이리스부터 찾자.")], { trigger: go.trigger, priority: go.priority }),
    { ...go, id: `${gate.id}_go`, name: "꼭대기로", conditions: [...(go.conditions ?? []), sw(irisBackSwitch)] },
  ] } });
}

function summitData(project: Project, exec: Exec): void {
  const { actRow, ENEMY_TOOL_FIELDS, HERO, ELENA_ID, IRIS_ID, SARAH_ID, TOWER_LAYERS } = towerKit;
  const skill = (s: Rec): void => { exec(project, "upsert_skill", { skill: { type: "normal", variance: 15, hitRate: 100, successRate: 100, stateEffects: [], ...s } }); };
  skill({ id: SK_ASH_SCATTER, name: "재 흩뿌리기", scope: "allEnemies", power: 46, description: "서른 해 묵은 재를 흩뿌린다. 아군 전체 피해, 실명.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, stateEffects: [{ stateId: "state_blind", chance: 35, operation: "add" }], animationId: "anim_gen_power_aura" });
  skill({ id: SK_GATHER_FIRE, name: "불 거두기", scope: "enemy", power: 58, drainPercent: 50, description: "거두는 눈이 붙잡은 상대의 기운을 빨아들인다. 준 피해의 절반을 회복.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_power_aura" });
  skill({ id: SK_RECALL, name: "재의 회수", scope: "allEnemies", power: 132, chargeTurns: 1,
    description: "한 차례 불을 모았다가 모두를 태워 거둔다. 모으는 동안 크게 때리거나 얼음을 맞히면 끊긴다.",
    chargeBreak: { damage: 650, elementIds: ["ice"], message: "…회수, 중단. 재점화 필요.", stagger: true },
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire", animationId: "anim_gen_critical_burst" });
  skill({ id: SK_GAZE, name: "붙잡는 눈길", scope: "enemy", power: 30, description: "가만히 바라본다. 맞으면 몸이 굳는다.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, stateEffects: [{ stateId: "state_paralysis", chance: 25, operation: "add" }] });
  skill({ id: SK_HEAT_RAY, name: "열선", scope: "enemy", power: 64, description: "눈동자에서 가는 불줄기를 쏜다. 불 속성.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire", stateEffects: [{ stateId: "fs_state_burn", chance: 30, operation: "add" }] });
  skill({ id: SK_EMBER_BURST, name: "새벽샘의 불", scope: "allEnemies", power: 54, description: "삼켰던 불이 터져 나온다. 아군 전체 불 피해.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire", stateEffects: [{ stateId: "fs_state_burn", chance: 40, operation: "add" }] });

  const base = project.database.enemies.find((e) => e.id === "enemy_fs_wolf");
  if (!base) throw new Error("[fallen-star summit] enemy_fs_wolf 가 없다");
  const elem = (base as unknown as Rec).elementRates as Rec;
  const foe = (f: { id: string; name: string; art: string; level: number; stats: Rec; actions: Rec[]; exp: number; gold: number; rates?: Rec; scale?: number; hideHp?: boolean; drops?: Rec[] }): void => {
    const rec = JSON.parse(JSON.stringify(base)) as Rec;
    Object.assign(rec, {
      id: f.id, name: f.name, level: f.level, monsterResourceId: f.art, stats: f.stats,
      skillIds: [...new Set(f.actions.map((a) => String(a.skillId)))], actions: f.actions,
      rewards: { exp: f.exp, gold: f.gold, dropRatePercent: 0, drops: f.drops ?? [] },
      elementRates: { ...elem, ...(f.rates ?? {}) }, ...(f.scale ? { battleScalePercent: f.scale } : {}), ...(f.hideHp ? { hideHp: true } : {}),
    });
    for (const key of Object.keys(rec)) if (!ENEMY_TOOL_FIELDS.has(key)) delete rec[key];
    exec(project, "upsert_enemy", { enemy: rec });
  };
  // 몸통 — 큰 재 두건. 불은 안 듣고(삼킨다) 얼음·빛에 약하다. 「불 거두기」는 거두는 눈, 「재의 회수」는 태우는 눈이 살아 있어야 쓴다.
  foe({ id: E_COLLECTOR, name: "재의 회수자", art: "generated-enemy-wraith-dark", level: 15, scale: 190, hideHp: true,
    stats: { maxHp: 5200, maxMp: 200, attack: 124, defense: 60, mind: 108, agility: 50 },
    actions: [actRow("skill_attack", 4), actRow(SK_ASH_SCATTER, 5), { ...actRow(SK_GATHER_FIRE, 5), requiresPart: "grab" }, { ...actRow(SK_RECALL, 4), requiresPart: "furnace" }],
    rates: { fire: "E", ice: "A", holy: "A", dark: "D" }, exp: 1800, gold: 600,
    drops: [{ itemId: "item_potion", ratePercent: 100, quantity: 3, condition: { kind: "always" } }] });
  foe({ id: E_EYE_GRAB, name: "거두는 눈", art: "generated-enemy-eye-floating", level: 14, scale: 85,
    stats: { maxHp: 1100, maxMp: 40, attack: 96, defense: 44, mind: 80, agility: 70 },
    actions: [actRow("skill_attack", 5), actRow(SK_GAZE, 5)], rates: { fire: "E", thunder: "A" }, exp: 240, gold: 60 });
  foe({ id: E_EYE_BURN, name: "태우는 눈", art: "generated-enemy-eye-floating", level: 14, scale: 85,
    stats: { maxHp: 1100, maxMp: 40, attack: 96, defense: 44, mind: 92, agility: 64 },
    actions: [actRow("skill_attack", 4), actRow(SK_HEAT_RAY, 6)], rates: { fire: "E", ice: "A" }, exp: 240, gold: 60 });
  foe({ id: E_EMBER, name: "삼킨 불", art: "generated-enemy-spirit-fire", level: 14, scale: 110,
    stats: { maxHp: 900, maxMp: 60, attack: 90, defense: 36, mind: 100, agility: 76 },
    actions: [actRow("skill_attack", 4), actRow(SK_EMBER_BURST, 5)], rates: { fire: "E", ice: "A", water: "A" }, exp: 200, gold: 0 });
  exec(project, "upsert_troop", { troop: {
    id: FS2_TROOP_COLLECTOR, name: "재의 회수자", autoAlign: false,
    previewBackgroundResourceId: "battle-scenery-cave", backdropLayers: TOWER_LAYERS,
    members: [
      { enemyId: E_COLLECTOR, x: 120, y: 120 },
      { enemyId: E_EYE_GRAB, x: 48, y: 70, partOf: 0, partTag: "grab" },
      { enemyId: E_EYE_BURN, x: 196, y: 70, partOf: 0, partTag: "furnace" },
      { enemyId: E_EMBER, x: 200, y: 168, hidden: true },
    ],
  } });
  ensureState(project);
  exec(project, "author_boss_phases", { troopId: FS2_TROOP_COLLECTOR, enemyId: E_COLLECTOR, phases: [
    { atHpPercent: 60, name: "삼킨 불", message: "회수자의 가슴이 갈라진다.\n서른 해 전에 삼킨 불이 새어 나온다.", summonEnemyId: E_EMBER },
    { atHpPercent: 30, name: "마지막 회수", message: "회수 기한 초과. 남은 불을 전부 거둔다.", enrageStateId: "state_rage" },
  ] });

  // 발렌 — 손님(선택하면 체력 70% 때 합류, 이 전투에만). 1막 보스 판 그림 그대로.
  const hero = project.database.actors.find((a) => a.id === HERO);
  if (!hero?.parameterCurves || !hero.expCurve) throw new Error("[fallen-star summit] 카엘 곡선이 없다");
  const hc = hero.parameterCurves as unknown as Record<string, number[]>;
  const tweak: Record<string, (v: number) => number> = { maxHp: (v) => Math.round(v * 1.15), attack: (v) => v + 8, defense: (v) => v + 6, mind: (v) => v + 10 };
  exec(project, "upsert_actor", { actor: {
    id: VALEN_ACTOR, name: VALEN, nickname: "심문관", classId: "class_dark_knight", initialLevel: 15, maxLevel: 99,
    faceResourceId: "easyrpg-faceset-actor1-04", characterResourceId: "easyrpg-charset-actor1", characterIndex: 4,
    battleCharacterResourceId: "charset-battler-fs-valen",
    parameterCurves: Object.fromEntries(Object.entries(hc).map(([k, arr]) => [k, arr.map((v) => (tweak[k] ?? ((x: number) => x))(v))])), expCurve: hero.expCurve,
    learnedSkills: [{ level: 1, skillId: "skill_attack" }, { level: 1, skillId: "skill_fs_judgment" }, { level: 1, skillId: "skill_sword_slash" }],
  } });
  exec(project, "add_battle_guest", { troopId: FS2_TROOP_COLLECTOR, actorId: VALEN_ACTOR, atEnemyHpPercent: 70, enemyId: E_COLLECTOR,
    requireSwitchId: SW_VALEN_GUEST, requireSwitchName: "B13: 발렌과 함께 싸운다", tactic: "attackAll", message: "발렌이 칼을 뽑아 들었다!" });
  // 넷 연계 — 「네 번째 대답」. 카엘·엘레나·새라·이리스가 모두 서 있어야 뜬다. 이리스 「광선 조준」이 돌아와야 열린다.
  exec(project, "upsert_combo_tech", {
    id: FS2_COMBO_FOURTH_ANSWER, name: "네 번째 대답",
    description: "넷이 한 번에 하늘로 쏘아 올리는 대답. 적 전체 빛 피해, 모으는 기술을 끊는다.",
    actorIds: [HERO, ELENA_ID, SARAH_ID, IRIS_ID],
    requires: [{ actorId: IRIS_ID, skillId: "skill_gunner_shot" }],
    mpCosts: [{ actorId: HERO, mp: 8 }, { actorId: ELENA_ID, mp: 10 }, { actorId: SARAH_ID, mp: 8 }, { actorId: IRIS_ID, mp: 10 }],
    scope: "allEnemies", kind: "damage", statistic: "mind", power: 46, elementId: "holy", combinedStats: true, gaugeShift: -40,
    choreographyId: "skill_mage_starfall",
    staging: { tint: "#fff3c0", shake: "heavy", slowMo: true, kicker: "잘 지내 ── 오늘도", partners: "auto" },
  });
}

/** 마지막 회수 — 공격 1.3배 광폭(없으면 만든다). */
function ensureState(project: Project): void {
  if (!project.database.states.some((s) => s.id === "state_rage")) throw new Error("[fallen-star summit] state_rage 가 없다");
}

function lensRoom(project: Project, exec: Exec): void {
  const { stamp, firstOk } = towerKit;
  if (!stamp(project, exec, FS2_TOP, "bd-pick-headland-lighthouse-lamp-lens", TOP.lens)) throw new Error("[fallen-star summit] 꼭대기 렌즈를 못 놓았다");
  const placed = (kit: string, cands: Cell[]): Cell | null => firstOk(cands, (c) => { if (!stamp(project, exec, FS2_TOP, kit, c)) throw new Error("x"); return true; })?.at ?? null;
  const obW = placed("bd-pick-wizard-tower-moon-obelisk", [{ x: 13, y: 6 }, { x: 13, y: 7 }, { x: 12, y: 8 }]);
  const obE = placed("bd-pick-wizard-tower-moon-obelisk", [{ x: 18, y: 6 }, { x: 19, y: 7 }, { x: 18, y: 7 }]);
  const orrery = placed("bd-pick-wizard-tower-orrery", [{ x: 11, y: 12 }, { x: 10, y: 12 }, { x: 11, y: 11 }]);
  const scope = placed("bd-pick-headland-lighthouse-telescope", [{ x: 20, y: 11 }, { x: 20, y: 10 }, { x: 19, y: 11 }]);
  placed("bd-pick-wizard-tower-starmap", [{ x: 13, y: 4 }, { x: 18, y: 4 }, { x: 13, y: 5 }]);
  const pt = (c: Cell | null, dx: number, dy: number): Rec | null => (c ? { x: c.x + dx, y: c.y + dy } : null);
  const sources = [
    { id: "lens", at: { x: TOP.lens.x + 1, y: TOP.lens.y + 2 }, radius: 5, intensity: 1, color: "#e8fff6", flicker: false },
    { id: "ob_w", at: pt(obW, 0, 1), radius: 2, intensity: 0.6, color: "#a8c8ff", flicker: false },
    { id: "ob_e", at: pt(obE, 0, 1), radius: 2, intensity: 0.6, color: "#a8c8ff", flicker: false },
    { id: "orrery", at: pt(orrery, 1, 1), radius: 2, intensity: 0.55, color: "#ffd890", flicker: true },
    { id: "scope", at: pt(scope, 0, 1), radius: 2, intensity: 0.45, color: "#ffd890", flicker: true },
    { id: "landing", at: { x: 16, y: 21 }, radius: 3, intensity: 0.5, color: "#ffc070", flicker: true },
    { id: "player", at: { kind: "player" }, radius: 3, intensity: 0.45, color: "#ffc070", flicker: true },
  ].filter((s) => s.at);
  exec(project, "set_lighting_volume", { mapId: FS2_TOP, applyMode: "map", ambient: 0.5, color: "#0a1020", sources });
}

function summitScenes(project: Project): void {
  const k = towerKit;
  const { say, narrate, sys, wait, sw, setSw, se, bgm, emote, route, walk, shake, flash, fx, letterbox, clearLetterbox, fadeOut, fadeIn,
    camTo, camBack, cutBegin, cutEnd, cutLabel, page, chip, addEv, ensureSwitch, mustWalk, KAEL, ELENA, IRIS, SARAH, IRIS_BGM, TOWER_BGM } = k;
  for (const [id, name] of [
    [SW_TOP_ARRIVE, "B12: 꼭대기 렌즈실에 들어섬"], [SW_HANEL_COME, "B12: 하넬과 브람이 올라옴"], [FS2_SW_B12_DONE, "B12: 하넬의 고백 · 회수 기구 기동"],
    [SW_VALEN_GUEST, "B13: 발렌과 함께 싸운다"], [SW_BOSS_LOST, "B13: 회수자에게 한 번 졌다"], [FS2_SW_B13_WON, "B13: 재의 회수자를 쓰러뜨림"], [FS2_SW_STOP_B13, "판본 끝: 제2막 끝"],
  ] as const) ensureSwitch(project, id, name);
  for (const c of [TOP.arrive, ...TOP.trigger, TOP.valen, TOP.kael, TOP.hanelStart, TOP.bramStart, TOP.hanel, TOP.bram, TOP.hanelLens, TOP.bramLens, TOP.valenLens]) mustWalk(project, FS2_TOP, c, "꼭대기");
  const at = (id: string, c: Cell): Command => ({ kind: "m2Command", commandId: "m2-040-set-event-location", fields: { target: id, mapId: FS2_TOP, x: c.x, y: c.y } } as unknown as Command);
  const player = (moves: Rec[]): Command => route("@player", moves);
  const face = (id: string, dir: string): Command => route(id, [{ kind: "turn", dir }]);
  // 칩은 이미 나온 이벤트 그림(발렌: 서리나루 호수 · 하넬: 천문대 · 브람: 광장)과 같은 칸.
  const valenFacing = (dir: "up" | "down" | "left" | "right"): Rec => chip("oprn-charset-fs-valen", 0, dir);
  const HANEL_CHIP: [string, number] = ["tex_easyrpg_charset_people3", 4];
  const BRAM_CHIP: [string, number] = ["tex_easyrpg_charset_actor2", 2];

  // 발렌 — 처음엔 렌즈를 본다(등). 회수자를 쓰러뜨린 뒤엔 렌즈 곁.
  addEv(project, FS2_TOP, "ev_fs2_top_valen", VALEN, TOP.valen, [
    page("ev_fs2_top_valen_p", "단말 앞", [], [say(VALEN, "…물러서라. 손이 떨린다.")], { graphic: valenFacing("up"), priority: "same", overlapForbidden: true }),
    page("ev_fs2_top_valen_after", "렌즈 곁", [sw(FS2_SW_STOP_B13)], [say(VALEN, "…세린은 문을 세 번 두드렸다.\n이번엔 열어 둔다. 그것만 하마.")], { graphic: valenFacing("down"), priority: "same", overlapForbidden: true }),
  ]);
  addEv(project, FS2_TOP, "ev_fs2_top_hanel", HANEL, TOP.hanel, [
    page("ev_fs2_top_hanel_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_top_hanel_on", "하넬", [sw(SW_HANEL_COME)], [say(HANEL, "…일지는 계속 쓰거라.\n나도 이제 한 줄씩 쓰마.")], { graphic: chip(HANEL_CHIP[0], HANEL_CHIP[1], "up"), priority: "same", overlapForbidden: true }),
  ]);
  addEv(project, FS2_TOP, "ev_fs2_top_bram", BRAM, TOP.bram, [
    page("ev_fs2_top_bram_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_top_bram_on", "브람", [sw(SW_HANEL_COME)], [say(BRAM, "그 늙은이, 서른 해 묵은 말을 이제야 했군.\n…잘했다.")], { graphic: chip(BRAM_CHIP[0], BRAM_CHIP[1], "up"), priority: "same", overlapForbidden: true }),
  ]);

  // B12 — 렌즈실에 들어서면(통로 끝 세 칸).
  const confession: Command[] = [
    cutBegin(), letterbox(),
    { kind: "stopAudio", channel: "bgm", fadeOutMs: 1200 } as unknown as Command,
    player(walk(["up", "up", "up"])),
    camTo("ev_fs2_top_valen", 1300, 1.8),
    se("cc0-se-osx-metal-03"),
    narrate("커다란 렌즈 앞, 발렌이 단말에 손을 얹고 있다.\n렌즈 속 글자가 붉게 흐른다."),
    say(VALEN, "반은 보냈다. 나머지 반만 넣으면\n달은 다시는 아이를 내려보내지 않는다."),
    say(KAEL, "그 신호, 이리스한테 「오지 마」라고 하는 거잖아요."),
    say(IRIS, "들려요. 「돌아오지 마」, 「대답하지 마」.\n…차가운 말이에요."),
    face("ev_fs2_top_valen", "down"),
    say(VALEN, "삼십 년 전에 새벽샘이 탔다.\n대답한 값이었다. 두 번은 없다."),
    say(SARAH, "발렌 님. 그 손 떼십시오.\n…이건 명령이 아니라 부탁입니다."),
    wait(400),
    // 하넬·브람 — 아래 계단에서 올라온다.
    setSw(SW_HANEL_COME),
    at("ev_fs2_top_hanel", TOP.hanelStart), at("ev_fs2_top_bram", TOP.bramStart),
    camBack(700, TOP_ZOOM),
    say(HANEL, "발렌."),
    route("ev_fs2_top_hanel", walk(["up", "up", "up", "up", "up"]), false),
    route("ev_fs2_top_bram", walk(["up", "up", "up", "up", "up"])),
    emote("ev_fs2_top_valen", "exclamation", 800),
    say(VALEN, "…선생님."),
    say(BRAM, "숨 차서 죽는 줄 알았다.\n하넬, 할 말 있으면 지금 해라."),
    camTo("ev_fs2_top_hanel", 1000, 1.6),
    say(HANEL, "거부를 보낸 건 나다, 발렌.\n회의가 시켰고, 나는 손을 떨지 않았다."),
    say(VALEN, "그럼 그 아이가 두드린 문은…\n선생님이 보낸 답장이었습니까."),
    say(HANEL, "그래. 그래서 나는 서른 해 동안\n너에게 별 이름만 가르쳤다."),
    say(HANEL, "…다른 걸 가르칠 낯이 없어서."),
    camTo("ev_fs2_top_valen", 900, 2),
    narrate("발렌이 왼손 장갑을 쥐었다 편다."),
    say(VALEN, "세린."),
    say(VALEN, "…문 너머에서, 그 아이 이름이 세린이었다."),
    wait(600),
    // 반쯤 나간 거부와 넷째 접수가 겹친다.
    se("cc0-se-osx-machine-03"), flash("red", 400), shake(4, 900),
    fx("fire", TOP.lens.x + 1, TOP.lens.y + 3, 1600),
    say(TERMINAL, "[접수 4/4]\n[거부 신호 50% ── 충돌]"),
    camBack(600, TOP_ZOOM),
    say(IRIS, "경고. 회수 기구 기동."),
    say(IRIS, "저 아래에서, 불을 거두러 와요."),
    shake(6, 1400), se("cc0-se-ors-creature-roar-03"),
    narrate("탑 깊은 곳에서 무언가가 올라온다.\n바닥 틈으로 재가 솟는다."),
    setSw(FS2_SW_B12_DONE),
    cutLabel(), clearLetterbox(), cutEnd(), setSw(SW_HANEL_COME), setSw(FS2_SW_B12_DONE),
  ];
  TOP.trigger.forEach((c, i) => addEv(project, FS2_TOP, `ev_fs2_top_enter_${i}`, "렌즈실", c, [
    page(`ev_fs2_top_enter_${i}_p`, "고백", [], confession, { trigger: { kind: "playerTouch" }, priority: "below" }),
    page(`ev_fs2_top_enter_${i}_done`, "끝", [sw(FS2_SW_B12_DONE)], [], { priority: "below" }),
  ]));

  // B13 — 회수자. 발렌을 함께 세울지 고른 뒤 싸운다. 지면 하넬이 일으켜 다시.
  const win: Command[] = [setSw(FS2_SW_B13_WON)];
  const lose: Command[] = [
    fadeOut(900), { kind: "recoverAll" } as unknown as Command, setSw(SW_BOSS_LOST), fadeIn(700),
    say(HANEL, "…일어나거라. 아직 대답 안 했다."),
    { kind: "transfer", mapId: FS2_TOP, x: TOP.kael.x, y: TOP.kael.y, direction: "up", fade: "black" } as unknown as Command,
  ];
  const fight: Command[] = [
    cutBegin(),
    say(VALEN, "…내가 연 일이다. 내 칼로 막는다."),
    { kind: "choices", prompt: "발렌을 어떻게 할까?", options: [
      { text: "같이 싸워요", branch: [
        say(KAEL, "같이 막아요. 혼자 하지 마요."),
        say(VALEN, "…어린 별지기가 날 부리는군.\n좋다. 등은 맡겨라."),
        setSw(SW_VALEN_GUEST),
      ] },
      { text: "물러나 계세요", branch: [
        say(KAEL, "단말 지켜 주세요.\n거부 신호, 더 나가지 않게요."),
        say(VALEN, "…알았다. 쓰러지면 바로 나간다."),
        setSw(SW_VALEN_GUEST, false),
      ] },
    ] } as unknown as Command,
    say(ELENA, "재야, 전부. 불은 안 먹혀.\n…서리로 끊자."),
    cutLabel(), cutEnd(),
    se("cc0-se-ors-creature-roar-02"), shake(5, 800), flash("red", 300),
    { kind: "battleProcessing", troopId: FS2_TROOP_COLLECTOR, canEscape: false, canLose: true, branchOnResult: true, victoryBranch: win, defeatBranch: lose, escapeBranch: [] } as unknown as Command,
  ];
  // B13 끝 — 다시 대답한다 → 막 끝.
  const ending: Command[] = [
    cutBegin(), letterbox(),
    bgm(IRIS_BGM, 2500),
    narrate("재가 가라앉는다.\n렌즈의 붉은 글자가 하나씩 꺼진다."),
    // 렌즈 앞을 비운다 — 발렌은 동쪽으로 한 칸, 하넬·브람은 양옆. 카엘이 렌즈 바로 앞(발렌이 섰던 칸)까지 걸어간다.
    at("ev_fs2_top_hanel", TOP.hanelLens), at("ev_fs2_top_bram", TOP.bramLens), at("ev_fs2_top_valen", TOP.valenLens),
    face("ev_fs2_top_valen", "left"),
    player(walk(["up", "up"])), player([{ kind: "turn", dir: "up" }]),
    camTo("ev_fs2_top_valen", 1400, 1.8),
    say(IRIS, "거부 신호, 아직 반이 남아 있어요.\n…지울 수는 없어요. 덮을 수만 있어요."),
    say(KAEL, "그럼 덮자. 대답 하나 더 하면 되잖아."),
    narrate("카엘이 렌즈에 손을 얹는다."),
    fx("sparkle", TOP.lens.x + 1, TOP.lens.y + 3, 1600),
    say(ELENA, "나도. 불씨 지키는 사람도 한 줄은 써야지."),
    say(SARAH, "아버지 몫까지 얹는다."),
    say(HANEL, "…서른 해 늦었다. 그래도 얹으마."),
    face("ev_fs2_top_valen", "up"),
    narrate("발렌이 장갑을 벗어 렌즈 위에 얹는다."),
    say(VALEN, "…세린. 이번엔 문을 열어 두마."),
    wait(500),
    say(KAEL, "잘 지내. …오늘도."),
    se("easyrpg-sound-recovery7"), flash("white", 700),
    fx("sparkle", TOP.lens.x + 1, TOP.lens.y + 1, 2400),
    say(TERMINAL, "[정착 확인 재접수]\n[귀환선 하강 개시]"),
    say(TERMINAL, "[중계기 이리스 회수 예정 ── 현지 시각 30일]"),
    camBack(1200, TOP_ZOOM),
    narrate("북쪽 하늘의 흰 배가 움직인다.\n사람들이 달이라 부르던 것이."),
    say(IRIS, "30일이에요. 카엘, 그동안\n일지를 아주 두껍게 써 주세요."),
    say(KAEL, "응. 매일 쓸게."),
    cutLabel(), clearLetterbox(), cutEnd(),
    fadeOut(1200),
    { kind: "recoverAll" } as unknown as Command,
    narrate("제2막 「빌린 불」 끝", { position: "center", context: "narration" }),
    narrate("제3막 「귀환선」은\n다음 업데이트에서 이어집니다.", { position: "center", context: "narration" }),
    fadeIn(800),
    setSw(FS2_SW_STOP_B13),
    sys("지금 저장해 두면 다음 판본에서 하늘탑 꼭대기부터 이어서 할 수 있다."),
    { kind: "openSaveMenu" } as unknown as Command,
  ];
  addEv(project, FS2_TOP, "ev_fs2_top_collector", "재의 회수자", { x: 0, y: 1 }, [
    page("ev_fs2_top_collector_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_top_collector_fight", "회수자", [sw(FS2_SW_B12_DONE)], fight, { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_top_collector_end", "다시 대답한다", [sw(FS2_SW_B13_WON)], ending, { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_top_collector_done", "막 끝", [sw(FS2_SW_STOP_B13)], [], { priority: "below" }),
  ]);
  // 꼭대기에 들어서면 한 번 — 바람 소리, 위에서 내려오는 붉은 빛.
  addEv(project, FS2_TOP, "ev_fs2_top_arrive", "하늘탑 꼭대기", { x: 0, y: 1 }, [
    page("ev_fs2_top_arrive_p", "도착", [], [
      bgm(TOWER_BGM, 1200), wait(400),
      say(SARAH, "위에서 붉은 빛이 새어 나와.\n발렌 님이다."),
      say(IRIS, "렌즈가 뭔가 보내고 있어요.\n…나쁜 말이에요."),
      setSw(SW_TOP_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_top_arrive_done", "끝", [sw(SW_TOP_ARRIVE)], [], { priority: "below" }),
  ]);
}

export function applyFallenAct2Summit(project: Project, exec: Exec): void {
  summitData(project, exec);
  lensRoom(project, exec);
  summitScenes(project);
  // 밸런스는 simulate_battle 로 쟀다(빌드마다 돌리지 않는다 — 브라우저에서 데모를 지을 때 느려진다):
  //   Lv14 넷, 회복약 6, n=40 — 발렌 없이 승률 72.5%·행동 48·회복약 4.2 / 발렌 손님 95%·행동 38. 「재의 회수」 63회 중 42회 끊김.
}
