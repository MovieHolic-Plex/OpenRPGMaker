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
import skySummitBackdrop from "./backdrops/sky-summit.json" with { type: "json" };

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Cell = { x: number; y: number };
type Rec = Record<string, unknown>;

export const FS2_TOP = "fs2_sky_tower_top";
/** 꼭대기 기본 카메라 배율 — 렌즈실이 화면을 채운다(배율 1 은 둘레 허공이 많았다). */
/** 꼭대기 기본 배율 1(정수만 — #3950). 32×27 방이 30×17칸 시야보다 커서 1배로도 화면이 찬다. 대사 근접은 camTo 2배. */
const TOP_ZOOM = 1;
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
export const FS2_ENDING_TRUE = "end_fs_true";
export const FS2_ENDING_NORMAL = "end_fs_normal";
export const FS2_ENDING_CLOSED_SKY = "end_fs_closed_sky";

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
  // 하넬·브람이 서는 칸 — 일행(12줄 횡대) 두 줄 아래 양옆. 예전 (15,16)·(17,16)은 통로 안이라 대화창 밑·화면 밖에서 말했다(첫 플레이 검수 2026-10-31).
  hanel: { x: 14, y: 14 }, bram: { x: 18, y: 14 },
  // 끝 장면 — 렌즈 앞 한 줄. 카엘(16,10)이 위를 보면 동료가 (15,10)·(17,10)·(14,10)에 횡대로 선다. 그 칸을 비워야 동료가 카엘 밑에 겹치지 않는다
  // (예전엔 발렌 17,10·하넬 14,10 이 그 칸을 막아 여덟 명이 한 덩이로 뭉쳤다). 하넬은 왼쪽 끝, 발렌·브람은 오른쪽.
  hanelLens: { x: 13, y: 10 }, bramLens: { x: 19, y: 10 }, valenLens: { x: 18, y: 10 },
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
  const { actRow, ENEMY_TOOL_FIELDS, HERO, ELENA_ID, IRIS_ID, SARAH_ID } = towerKit;
  const skill = (s: Rec): void => { exec(project, "upsert_skill", { skill: { type: "normal", variance: 15, hitRate: 100, successRate: 100, stateEffects: [], ...s } }); };
  skill({ id: SK_ASH_SCATTER, name: "재 흩뿌리기", scope: "allEnemies", power: 38, description: "서른 해 묵은 재를 흩뿌린다. 아군 전체 피해, 실명.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, stateEffects: [{ stateId: "state_blind", chance: 35, operation: "add" }], animationId: "anim_gen_power_aura" });
  skill({ id: SK_GATHER_FIRE, name: "불 거두기", scope: "enemy", power: 58, drainPercent: 50, description: "거두는 눈이 붙잡은 상대의 기운을 빨아들인다. 준 피해의 절반을 회복.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_power_aura" });
  skill({ id: SK_RECALL, name: "재의 회수", scope: "allEnemies", power: 104, chargeTurns: 1,
    description: "한 차례 불을 모았다가 모두를 태워 거둔다. 모으는 동안 크게 때리거나 얼음·빛을 맞히면 끊긴다.",
    chargeBreak: { damage: 520, elementIds: ["ice", "holy"], message: "…회수, 중단. 재점화 필요.", stagger: true },
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire", animationId: "anim_gen_critical_burst" });
  skill({ id: SK_GAZE, name: "붙잡는 눈길", scope: "enemy", power: 30, description: "가만히 바라본다. 맞으면 몸이 굳는다.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, stateEffects: [{ stateId: "state_paralysis", chance: 25, operation: "add" }], animationId: "anim_gen_shadow_pulse" });
  skill({ id: SK_HEAT_RAY, name: "열선", scope: "enemy", power: 56, description: "눈동자에서 가는 불줄기를 쏜다. 불 속성.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire", stateEffects: [{ stateId: "fs_state_burn", chance: 30, operation: "add" }], animationId: "anim_gen_fire_burst" });
  skill({ id: SK_EMBER_BURST, name: "새벽샘의 불", scope: "allEnemies", power: 46, description: "삼켰던 불이 터져 나온다. 아군 전체 불 피해.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire", stateEffects: [{ stateId: "fs_state_burn", chance: 40, operation: "add" }], animationId: "anim_gen_fire_burst" });

  const base = project.database.enemies.find((e) => e.id === "enemy_fs_wolf");
  if (!base) throw new Error("[fallen-star summit] enemy_fs_wolf 가 없다");
  const elem = (base as unknown as Rec).elementRates as Rec;
  const foe = (f: { id: string; name: string; art: string; level: number; stats: Rec; actions: Rec[]; exp: number; gold: number; rates?: Rec; stateRates?: Rec; scale?: number; hideHp?: boolean; drops?: Rec[] }): void => {
    const rec = JSON.parse(JSON.stringify(base)) as Rec;
    Object.assign(rec, {
      id: f.id, name: f.name, level: f.level, monsterResourceId: f.art, stats: f.stats,
      skillIds: [...new Set(f.actions.map((a) => String(a.skillId)))], actions: f.actions,
      rewards: { exp: f.exp, gold: f.gold, dropRatePercent: 0, drops: f.drops ?? [] },
      elementRates: { ...elem, ...(f.rates ?? {}) },
      ...(f.stateRates ? { stateRates: f.stateRates } : {}),
      ...(f.scale ? { battleScalePercent: f.scale } : {}), ...(f.hideHp ? { hideHp: true } : {}),
    });
    for (const key of Object.keys(rec)) if (!ENEMY_TOOL_FIELDS.has(key)) delete rec[key];
    exec(project, "upsert_enemy", { enemy: rec });
  };
  const BOSS_CC_IMMUNE: Rec = { state_sleep: "E", state_stop: "E", state_paralysis: "E", state_silence: "E", state_fs_pierced: "E" };
  const PART_CC_RESIST: Rec = { state_sleep: "E", state_stop: "D", state_paralysis: "D", state_silence: "D" };
  // 몸통 — 큰 재 두건. 불은 안 듣고(삼킨다) 얼음·빛에 약하다. 「불 거두기」는 거두는 눈, 「재의 회수」는 태우는 눈이 살아 있어야 쓴다.
  foe({ id: E_COLLECTOR, name: "재의 회수자", art: "generated-enemy-wraith-dark", level: 15, scale: 190, hideHp: true,
    stats: { maxHp: 4600, maxMp: 200, attack: 124, defense: 60, mind: 108, agility: 50 },
    actions: [actRow("skill_attack", 4), actRow(SK_ASH_SCATTER, 5), { ...actRow(SK_GATHER_FIRE, 5), requiresPart: "grab" }, { ...actRow(SK_RECALL, 4), requiresPart: "furnace" }],
    rates: { fire: "E", ice: "A", holy: "A", dark: "D" }, stateRates: BOSS_CC_IMMUNE, exp: 1800, gold: 600,
    drops: [{ itemId: "item_potion", ratePercent: 100, quantity: 3, condition: { kind: "always" } }] });
  foe({ id: E_EYE_GRAB, name: "거두는 눈", art: "generated-enemy-eye-floating", level: 14, scale: 85,
    stats: { maxHp: 1100, maxMp: 40, attack: 96, defense: 44, mind: 80, agility: 70 },
    actions: [actRow("skill_attack", 5), actRow(SK_GAZE, 5)], rates: { fire: "E", thunder: "A" }, stateRates: PART_CC_RESIST, exp: 240, gold: 60 });
  foe({ id: E_EYE_BURN, name: "태우는 눈", art: "generated-enemy-eye-floating", level: 14, scale: 85,
    stats: { maxHp: 1100, maxMp: 40, attack: 96, defense: 44, mind: 92, agility: 64 },
    actions: [actRow("skill_attack", 4), actRow(SK_HEAT_RAY, 6)], rates: { fire: "E", ice: "A" }, stateRates: PART_CC_RESIST, exp: 240, gold: 60 });
  foe({ id: E_EMBER, name: "삼킨 불", art: "generated-enemy-spirit-fire", level: 14, scale: 110,
    stats: { maxHp: 700, maxMp: 60, attack: 90, defense: 36, mind: 100, agility: 76 },
    actions: [actRow("skill_attack", 4), actRow(SK_EMBER_BURST, 5)], rates: { fire: "E", ice: "A", water: "A" }, stateRates: PART_CC_RESIST, exp: 200, gold: 0 });
  // 꼭대기는 밤하늘 아래 돌 옥상이다 — 동굴 배경(battle-scenery-cave)이면 「탑 꼭대기」가 아니라 굴속에서 싸운다(2026-10-31 첫 플레이 검토).
  // 손 도트 배경 backdrops/draw_sky_summit.py → sky-summit.json. 낮 빛줄기(lightRays)는 밤과 안 맞아 뺐다.
  exec(project, "upsert_resource", { resource: skySummitBackdrop.resource });
  exec(project, "upsert_troop", { troop: {
    id: FS2_TROOP_COLLECTOR, name: "재의 회수자", autoAlign: false,
    previewBackgroundResourceId: skySummitBackdrop.resource.id, backdropLayers: [{ preset: "glow", opacity: 35 }],
    members: [
      { enemyId: E_COLLECTOR, x: 120, y: 120 },
      { enemyId: E_EYE_GRAB, x: 48, y: 70, partOf: 0, partTag: "grab" },
      { enemyId: E_EYE_BURN, x: 196, y: 70, partOf: 0, partTag: "furnace" },
      { enemyId: E_EMBER, x: 200, y: 168, hidden: true },
    ],
  } });
  ensureState(project, exec);
  exec(project, "author_boss_phases", { troopId: FS2_TROOP_COLLECTOR, enemyId: E_COLLECTOR, phases: [
    { atHpPercent: 60, name: "삼킨 불", message: "회수자의 가슴이 쩍 갈라진다.\n서른 해 전에 삼킨 불이 새어 나온다.", summonEnemyId: E_EMBER },
    { atHpPercent: 30, name: "마지막 회수", message: "회수 기한 초과. 남은 불을 전부 거둔다.", enrageStateId: "state_fs2_collector_overdrive" },
  ] });

  // 발렌 — 손님(선택하면 체력 70% 때 합류, 이 전투에만). 1막 보스 판 그림 그대로.
  const hero = project.database.actors.find((a) => a.id === HERO);
  if (!hero?.parameterCurves || !hero.expCurve) throw new Error("[fallen-star summit] 카엘 곡선이 없다");
  const hc = hero.parameterCurves as unknown as Record<string, number[]>;
  // 발렌은 거들 뿐 — 암흑기사 직업의 그라비티(적 모두 남은 체력 1/4)가 한 방 846(보스 HP 의 18%)으로 판을 끝내
  // 「손님이 이긴 싸움」으로 읽혔다(적대 검수 2026-11-01). 심문회 지휘관답게 장군 직업(지휘 검·격려·방진)으로 거들게 한다.
  const tweak: Record<string, (v: number) => number> = { maxHp: (v) => Math.round(v * 1.15), attack: (v) => v + 4, defense: (v) => v + 6, mind: (v) => Math.round(v * 0.75) };
  exec(project, "upsert_actor", { actor: {
    id: VALEN_ACTOR, name: VALEN, nickname: "심문관", classId: "class_general", initialLevel: 15, maxLevel: 99,
    faceResourceId: "easyrpg-faceset-actor1-04", characterResourceId: "easyrpg-charset-actor1", characterIndex: 4,
    battleCharacterResourceId: "charset-battler-fs-valen",
    initialEquipment: { weapon: "equip_gen_sword_steel", armor: "equip_gen_armor_plate" },
    parameterCurves: Object.fromEntries(Object.entries(hc).map(([k, arr]) => [k, arr.map((v) => (tweak[k] ?? ((x: number) => x))(v))])), expCurve: hero.expCurve,
    learnedSkills: [{ level: 1, skillId: "skill_attack" }, { level: 1, skillId: "skill_sword_slash" }],
  } });
  exec(project, "add_battle_guest", { troopId: FS2_TROOP_COLLECTOR, actorId: VALEN_ACTOR, atEnemyHpPercent: 70, enemyId: E_COLLECTOR,
    requireSwitchId: SW_VALEN_GUEST, requireSwitchName: "B13: 발렌과 함께 싸운다", tactic: "attackAll", message: "발렌이 칼을 뽑아 든다!" });
  // 넷 연계 — 「네 번째 대답」. 카엘·엘레나·새라·이리스가 모두 서 있어야 뜬다. 이리스 「광선 조준」이 돌아와야 열린다.
  exec(project, "upsert_combo_tech", {
    id: FS2_COMBO_FOURTH_ANSWER, name: "네 번째 대답",
    description: "넷의 힘을 한 번에 하늘로 쏘아 올리는 대답.\n적 전체 큰 빛 피해 · 행동 40% 지연 · 모으는 기술을 끊는다.",
    actorIds: [HERO, ELENA_ID, SARAH_ID, IRIS_ID],
    requires: [{ actorId: IRIS_ID, skillId: "skill_gunner_shot" }],
    mpCosts: [{ actorId: HERO, mp: 8 }, { actorId: ELENA_ID, mp: 10 }, { actorId: SARAH_ID, mp: 8 }, { actorId: IRIS_ID, mp: 10 }],
    scope: "allEnemies", kind: "damage", statistic: "mind", power: 160, elementId: "holy", combinedStats: true, gaugeShift: -40,
    choreographyId: "skill_mage_starfall",
    staging: { tint: "#fff3c0", shake: "heavy", slowMo: true, kicker: "잘 지내, 오늘도", partners: "auto" },
  });
  const fourth = project.database.skills.find((s) => s.id === FS2_COMBO_FOURTH_ANSWER);
  if (fourth) fourth.damageFormula = "power + (a.atk + a.mind) * 0.55 - b.def / 2";
}

/** 마지막 회수 — 공격 1.3배·민첩 1.25배 광폭(state_rage 는 forcedAction:'rage' 로 보스 AI 를 통째로 막아 전용 상태를 쓴다). */
function ensureState(project: Project, exec: Exec): void {
  exec(project, "upsert_state", { state: {
    id: "state_fs2_collector_overdrive", name: "마지막 회수",
    battleAura: "berserk-pulse", removalCondition: "전투 종료",
    runtimeEffects: { attackMultiplier: 1.3, agilityMultiplier: 1.25, removeOnBattleEnd: true },
    clearOnBattleEnd: true,
  } });
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
    // 렌즈는 거부 신호를 보내는 중이다 — 도착 대사(「위에서 붉은 빛이 새어 나와」)·고백(「렌즈 속 글자가 붉게 흐른다」)과 달리 하얗게 빛났다(첫 플레이 검수 2026-11-01).
    { id: "lens", at: { x: TOP.lens.x + 1, y: TOP.lens.y + 2 }, radius: 5, intensity: 1, color: "#ff9a84", flicker: true },
    { id: "ob_w", at: pt(obW, 0, 1), radius: 2, intensity: 0.6, color: "#a8c8ff", flicker: false },
    { id: "ob_e", at: pt(obE, 0, 1), radius: 2, intensity: 0.6, color: "#a8c8ff", flicker: false },
    { id: "orrery", at: pt(orrery, 1, 1), radius: 2, intensity: 0.55, color: "#ffd890", flicker: true },
    { id: "scope", at: pt(scope, 0, 1), radius: 2, intensity: 0.45, color: "#ffd890", flicker: true },
    { id: "landing", at: { x: 16, y: 21 }, radius: 3, intensity: 0.5, color: "#ffc070", flicker: true },
    { id: "player", at: { kind: "player" }, radius: 3, intensity: 0.45, color: "#ffc070", flicker: true },
  ].filter((s) => s.at);
  exec(project, "set_lighting_volume", { mapId: FS2_TOP, applyMode: "map", ambient: 0.5, color: "#0a1020", sources });
}

function summitEndings(project: Project, exec: Exec): void {
  const endingBgm = "cc0-bgm-rtp-emo-002";
  const baseCredits = [
    "카엘 — 견습 별지기",
    "엘레나 — 천문대의 마도학자",
    "이리스 — 넷째 아이, 별의 중계기",
    "새라 — 북방 관문의 창기사",
    "",
    "천문대장 하넬 · 숲지기 브람 · 심문관 발렌",
    "왕도 아스텔과 서리나루의 사람들",
    "",
    "OPRN Studio 대표 데모 · 폴른 스타",
    "Music: OPRN BGM (AI-generated, Google Lyria)",
  ];

  exec(project, "define_ending", {
    id: FS2_ENDING_TRUE,
    name: "진 엔딩 · 오늘도, 잘 지내",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "이리스", text: "카엘, 일지가 벌써 두꺼워졌어요. 이번엔 한 줄도 안 잊어버릴게요." },
      { kind: "say", speaker: "발렌", text: "세린… 문은 열어 뒀다. 이번엔 아무도 밖에 세워 두지 않아." },
      { kind: "say", speaker: "카엘", text: "서른 밤이나 남았어. 아스텔 빵집부터 다시 한 바퀴 돌자, 다 같이." },
    ],
    presentation: {
      kicker: "TRUE ENDING · 오늘도, 잘 지내",
      musicResourceId: endingBgm,
      credits: [
        ...baseCredits,
        "",
        "서른 해 만에 멈춰 있던 시계가 다시 돌았다.",
        "닫혔던 문이 열리고, 하늘의 흰 배가 천천히 내려온다.",
        "",
        "타이틀에서 「다시 별을 올려다본다(New Game+)」가 열렸습니다.",
      ].join("\n"),
    },
  });

  exec(project, "define_ending", {
    id: FS2_ENDING_NORMAL,
    name: "엔딩 · 빌린 불의 답장",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "이리스", text: "신호가 닿았어요. 서른 밤 뒤에 배가 내려온대요." },
      { kind: "say", speaker: "엘레나", text: "그동안 할 일이 산더미야. 왕도 불도 다시 켜야지." },
      { kind: "say", speaker: "카엘", text: "가자. 내려가면 토마 아저씨 빵부터 먹자." },
    ],
    presentation: {
      kicker: "ENDING · 빌린 불의 답장",
      musicResourceId: endingBgm,
      credits: [
        ...baseCredits,
        "",
        "하늘을 향해 쏘아 올린 네 번째 대답.",
        "서른 날의 약속을 안고, 일행은 아침이 밝아 오는 왕도로 발걸음을 옮겼다.",
        "",
        "타이틀에서 「다시 별을 올려다본다(New Game+)」로 다른 결말을 찾아보세요.",
      ].join("\n"),
    },
  });

  exec(project, "define_ending", {
    id: FS2_ENDING_CLOSED_SKY,
    name: "분기 엔딩 · 닫힌 하늘",
    conditions: [],
    epilogue: [
      { kind: "say", speaker: "발렌", text: "…네가 그 버튼을 누를 줄은 몰랐다. 손이 안 떨렸나." },
      { kind: "say", speaker: "이리스", text: "괜찮아요, 카엘. 이제 하늘이 안 부르면… 여기서 같이 늙어 가면 되죠." },
      { kind: "say", speaker: "카엘", text: "더는 누구도 불타지 않게. 이 땅은 이제 우리끼리 지켜." },
    ],
    presentation: {
      kicker: "ALTERNATE ENDING · 닫힌 하늘",
      musicResourceId: endingBgm,
      credits: [
        ...baseCredits,
        "",
        "렌즈의 빛이 꺼지자 북쪽 하늘의 흰 배가 구름 너머로 멀어졌다.",
        "다시는 별이 떨어지지 않는 밤. 땅의 사람들은 빌린 불 없이 스스로 불을 피우기 시작했다.",
        "",
        "타이틀에서 「다시 별을 올려다본다(New Game+)」로 진 엔딩에 도전해 보세요.",
      ].join("\n"),
    },
  });
}

function summitScenes(project: Project, exec: Exec): void {
  const k = towerKit;
  const { say, narrate, wait, sw, setSw, se, bgm, emote, route, walk, shake, flash, fx, letterbox, clearLetterbox, fadeOut, fadeIn,
    camTo, camBack, cutBegin, cutEnd, cutLabel, page, chip, addEv, ensureSwitch, mustWalk, KAEL, ELENA, IRIS, SARAH, IRIS_BGM, TOWER_BGM } = k;
  summitEndings(project, exec);
  for (const [id, name] of [
    [SW_TOP_ARRIVE, "B12: 꼭대기 렌즈실에 들어섬"], [SW_HANEL_COME, "B12: 하넬과 브람이 올라옴"], [FS2_SW_B12_DONE, "B12: 하넬의 고백 · 회수 기구 기동"],
    [SW_VALEN_GUEST, "B13: 발렌과 함께 싸운다"], [SW_BOSS_LOST, "B13: 회수자에게 한 번 졌다"], [FS2_SW_B13_WON, "B13: 재의 회수자를 쓰러뜨림"], [FS2_SW_STOP_B13, "판본 끝: 제2막 끝"],
  ] as const) ensureSwitch(project, id, name);
  for (const c of [TOP.arrive, ...TOP.trigger, TOP.valen, TOP.kael, TOP.hanelStart, TOP.bramStart, TOP.hanel, TOP.bram, TOP.hanelLens, TOP.bramLens, TOP.valenLens]) mustWalk(project, FS2_TOP, c, "꼭대기");
  const at = (id: string, c: Cell): Command => ({ kind: "m2Command", commandId: "m2-040-set-event-location", fields: { target: id, mapId: FS2_TOP, x: c.x, y: c.y } } as unknown as Command);
  const player = (moves: Rec[]): Command => route("@player", moves);
  const face = (id: string, dir: string): Command => route(id, [{ kind: "turn", dir }]);
  const fork = (condition: unknown, then: Command[], otherwise: Command[] = []): Command => ({ kind: "fork", condition, then, else: otherwise } as unknown as Command);
  const valenFacing = (dir: "up" | "down" | "left" | "right"): Rec => ({
    ...chip("oprn-charset-fs-valen", 0, dir),
    sprite: { type: "uploaded", id: "oprn-charset-fs-valen" },
  });
  const HANEL_CHIP: [string, number] = ["tex_easyrpg_charset_people3", 4];
  const BRAM_CHIP: [string, number] = ["tex_easyrpg_charset_actor2", 2];

  // B13 — 회수자. 발렌을 함께 세울지 고른 뒤 싸운다. 지면 정비 후 발렌에게 말 걸어 재도전할 수 있다(무한 자동 루프 방지).
  const win: Command[] = [setSw(FS2_SW_B13_WON), setSw(SW_BOSS_LOST, false)];
  const lose: Command[] = [
    fadeOut(900), { kind: "recoverAll" } as unknown as Command, setSw(SW_BOSS_LOST), fadeIn(700),
    say(HANEL, "…일어나라. 숨부터 고르고 장비도 챙겨라. 준비되면 발렌에게 말을 걸어."),
    { kind: "transfer", mapId: FS2_TOP, x: TOP.kael.x, y: TOP.kael.y, direction: "up", fade: "black" } as unknown as Command,
  ];
  const fight: Command[] = [
    { kind: "recoverAll" } as unknown as Command,
    cutBegin(),
    say(VALEN, "내가 저지른 판이야. 내 칼로 막는다."),
    cutLabel(), cutEnd(),
    { kind: "choices", prompt: "발렌에게 뭐라고 할까?", cancelBehavior: "disallow", options: [
      { text: "같이 막아요. 혼자 떠안지 말고", branch: [
        say(KAEL, "같이 막아요. 여기서 혼자 쓰러질 셈이에요?"),
        say(VALEN, "…어린 별지기한테 잔소리까지 듣네.\n알았다. 뒤는 맡겨."),
        setSw(SW_VALEN_GUEST),
      ] },
      { text: "뒤에서 단말을 지켜 주세요", branch: [
        say(KAEL, "단말 쪽을 막아 주세요.\n거부 신호가 더 나가지 않게."),
        say(VALEN, "알았다. 너희가 밀리면 내가 바로 뛰어든다."),
        setSw(SW_VALEN_GUEST, false),
      ] },
    ] } as unknown as Command,
    say(ELENA, "전부 재로 뭉친 괴물이야.\n…그래도 틈은 꼭 있어. 집중해!"),
    se("cc0-se-ors-creature-roar-02"), shake(5, 800), flash("red", 300),
    { kind: "battleProcessing", troopId: FS2_TROOP_COLLECTOR, canEscape: false, canLose: true, branchOnResult: true, victoryBranch: win, defeatBranch: lose, escapeBranch: [] } as unknown as Command,
  ];

  // 발렌 — 처음엔 렌즈를 본다(등). 패배 뒤엔 재도전 창구. 회수자를 쓰러뜨린 뒤엔 렌즈 곁.
  addEv(project, FS2_TOP, "ev_fs2_top_valen", VALEN, TOP.valen, [
    page("ev_fs2_top_valen_p", "단말 앞", [], [say(VALEN, "…비켜 서. 손이 떨려서 말을 안 들어.")], { graphic: valenFacing("up"), priority: "same", overlapForbidden: true }),
    page("ev_fs2_top_valen_retry", "재도전", [sw(FS2_SW_B12_DONE), sw(SW_BOSS_LOST)], [
      say(VALEN, "숨은 골랐나? 다시 막아 서자."),
      { kind: "choices", prompt: "재의 회수자에게 다시 도전할까?", cancelBehavior: "choice2", options: [
        { text: "지금 맞선다", branch: [setSw(SW_BOSS_LOST, false), ...fight] },
        { text: "조금 더 정비한다", branch: [say(VALEN, "서두를 것 없다. 4층 수정에서 숨 돌리고 와도 돼.")] },
      ] } as unknown as Command,
    ], { graphic: valenFacing("down"), priority: "same", overlapForbidden: true }),
    page("ev_fs2_top_valen_after", "렌즈 곁", [sw(FS2_SW_STOP_B13)], [say(VALEN, "…세린은 문을 세 번 두드렸지.\n이번엔 열어 둘게. 그 정도는 해야지.")], { graphic: valenFacing("down"), priority: "same", overlapForbidden: true }),
  ]);
  addEv(project, FS2_TOP, "ev_fs2_top_hanel", HANEL, TOP.hanel, [
    page("ev_fs2_top_hanel_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_top_hanel_on", "하넬", [sw(SW_HANEL_COME)], [say(HANEL, "일지 계속 써라.\n나도 오늘부터 한 줄씩 적을란다.")], { graphic: chip(HANEL_CHIP[0], HANEL_CHIP[1], "up"), priority: "same", overlapForbidden: true }),
  ]);
  addEv(project, FS2_TOP, "ev_fs2_top_bram", BRAM, TOP.bram, [
    page("ev_fs2_top_bram_none", "없음", [], [], { priority: "below" }),
    page("ev_fs2_top_bram_on", "브람", [sw(SW_HANEL_COME)], [say(BRAM, "저 늙은이, 서른 해 묵은 속말을 이제야 꺼내네.\n…속 다 시원하다.")], { graphic: chip(BRAM_CHIP[0], BRAM_CHIP[1], "up"), priority: "same", overlapForbidden: true }),
  ]);

  // B12 — 렌즈실에 들어서면(통로 끝 세 칸).
  const confession: Command[] = [
    cutBegin(), letterbox(),
    { kind: "stopAudio", channel: "bgm", fadeOutMs: 1200 } as unknown as Command,
    player(walk(["up", "up", "up"])),
    camTo("ev_fs2_top_valen", 1300, 2, 16),
    se("cc0-se-osx-machine-03"),
    narrate("거대한 렌즈 앞. 발렌이 단말에 손을 얹고 있다.\n렌즈 안쪽으로 붉은 글자가 쉼 없이 흐른다."),
    say(VALEN, "절반은 보냈어. 나머지 반만 밀어 넣으면\n달은 다시는 아이를 내려보내지 않아."),
    say(KAEL, "그 신호, 이리스한테\n다신 오지 말라고 내쫓는 거잖아요!"),
    say(IRIS, "들려요… 오지 말래요. 대답하지 말래요.\n…너무 차가워요."),
    face("ev_fs2_top_valen", "down"),
    say(VALEN, "서른 해 전에 새벽샘이 불탔다.\n대답한 대가였지. 두 번은 못 겪어."),
    say(SARAH, "발렌 님, 손 떼십시오.\n…명령 따위는 아닙니다. 부탁드리는 겁니다."),
    wait(400),
    setSw(SW_HANEL_COME),
    at("ev_fs2_top_hanel", TOP.hanelStart), at("ev_fs2_top_bram", TOP.bramStart),
    camTo("ev_fs2_top_valen", 900, 1, 32),
    route("ev_fs2_top_hanel", [...walk(["up", "up", "up", "up", "up", "up", "up", "left"]), { kind: "turn", dir: "up" }], false),
    route("ev_fs2_top_bram", [...walk(["up", "up", "up", "up", "up", "up", "up", "right"]), { kind: "turn", dir: "up" }]),
    wait(200),
    say(HANEL, "발렌."),
    emote("ev_fs2_top_valen", "exclamation", 800),
    say(VALEN, "…선생님?"),
    say(BRAM, "계단 오르다 숨 넘어가는 줄 알았네.\n하넬, 숨겨 둔 말 지금 다 털어놔."),
    camTo("ev_fs2_top_hanel", 1000, 2, 12),
    say(HANEL, "거부 신호를 보낸 건 나다, 발렌.\n별지기 회의가 정했고, 내 손으로 눌렀어. 떨리지도 않았지."),
    say(VALEN, "그럼 그날 밤 그 아이가 두드린 문은…\n선생님이 보낸 답장이었단 말입니까?"),
    say(HANEL, "그래. 그래서 서른 해 내내\n네한테 별 이름밖에 못 가르쳤다."),
    say(HANEL, "…다른 걸 입에 올릴 낯이 없어서."),
    camTo("ev_fs2_top_valen", 900, 2, 16),
    narrate("발렌이 왼손 장갑을 꽉 쥐었다 편다."),
    fork(sw("sw_fs2_valen_serin"), [
      say(VALEN, "…얼음 위에서 네가 보여 준 그 이름, 세린."),
      say(VALEN, "닫힌 문 너머에서 부르던 이름… 그게 전부 선생님이 보낸 답장이었군."),
    ], [
      say(VALEN, "세린."),
      say(VALEN, "…닫힌 문 너머에서 부르던 이름, 세린이었어."),
    ]),
    wait(600),
    se("cc0-se-osx-machine-03"), flash("red", 400), shake(4, 900),
    fx("fire", TOP.lens.x + 1, TOP.lens.y + 3, 1600),
    say(TERMINAL, "[접수 4/4]\n[거부 신호 50% ── 충돌]"),
    camBack(600, TOP_ZOOM),
    say(IRIS, "경고예요! 회수 기구가 깨어나고 있어요."),
    say(IRIS, "발밑에서… 불을 거두러 올라와요!"),
    shake(6, 1400), se("cc0-se-ors-creature-roar-03"),
    narrate("탑 깊은 곳에서 거대한 쇳소리가 울린다.\n돌바닥 틈으로 시커먼 재가 솟구친다."),
    setSw(FS2_SW_B12_DONE),
    cutLabel(), clearLetterbox(), cutEnd(), setSw(SW_HANEL_COME), setSw(FS2_SW_B12_DONE),
  ];
  TOP.trigger.forEach((c, i) => addEv(project, FS2_TOP, `ev_fs2_top_enter_${i}`, "렌즈실", c, [
    page(`ev_fs2_top_enter_${i}_p`, "고백", [], confession, { trigger: { kind: "playerTouch" }, priority: "below" }),
    page(`ev_fs2_top_enter_${i}_done`, "끝", [sw(FS2_SW_B12_DONE)], [], { priority: "below" }),
  ]));

  // B13 끝 — 최후의 선택 → 진 엔딩 / 보통 엔딩 / 닫힌 하늘 엔딩(3종 분기)
  const answerRoute: Command[] = [
    say(KAEL, "그럼 덮어쓰자. 대답 하나 더 얹으면 되잖아."),
    narrate("카엘이 따뜻한 렌즈 위에 손을 얹는다."),
    fx("sparkle", TOP.lens.x + 1, TOP.lens.y + 3, 1600),
    say(ELENA, "나도 얹을게. 불씨 지키는 사람도 한 줄은 써야지."),
    say(SARAH, "아버지 몫까지 같이 얹는다."),
    say(HANEL, "…서른 해 늦었지. 그래도 내 손도 보태마."),
    face("ev_fs2_top_valen", "up"),
    narrate("발렌이 왼손 장갑을 천천히 벗어 렌즈 위에 올려둔다."),
    say(VALEN, "…세린. 이번엔 문 열어 둘게."),
    wait(500),
    say(KAEL, "잘 지내. …오늘도."),
    se("easyrpg-sound-recovery7"), flash("white", 700),
    fx("sparkle", TOP.lens.x + 1, TOP.lens.y + 1, 2400),
    say(TERMINAL, "[정착 확인 재접수]\n[귀환선 하강 개시]"),
    say(TERMINAL, "[중계기 이리스 회수 예정 ── 현지 시각 30일]"),
    camBack(1200, TOP_ZOOM),
    narrate("북쪽 하늘의 흰 배가 천천히 방향을 튼다.\n사람들이 달이라 부르던 그것이, 마침내 대답을 들었다."),
    say(IRIS, "서른 밤이래요. 카엘, 그동안\n일지가 찢어질 만큼 빼곡하게 써 주세요."),
    say(KAEL, "응. 하루도 안 빼먹을게."),
    clearLetterbox(),
    { kind: "recoverAll" } as unknown as Command,
    setSw(FS2_SW_STOP_B13),
    // 진 엔딩 판정: 세린의 정착 확인서를 찾았고, 발렌과 함께 싸웠거나 이리스의 일지를 끝까지 복원했을 때.
    fork(
      { kind: "all", conditions: [sw("sw_fs2_serin_form"), { kind: "any", conditions: [sw(SW_VALEN_GUEST), sw("sw_fs2_iris_be_well")] }] },
      [{ kind: "triggerEnding", endingId: FS2_ENDING_TRUE } as unknown as Command],
      [{ kind: "triggerEnding", endingId: FS2_ENDING_NORMAL } as unknown as Command],
    ),
  ];

  const closeSkyRoute: Command[] = [
    say(KAEL, "…미안해, 이리스. 하늘이 계속 시험을 내려보낸다면,\n누군가는 또 불타고 말아."),
    say(ELENA, "카엘, 너 지금 진심이야?!"),
    say(VALEN, "…어린 별지기. 네 손으로 끊겠다는 건가."),
    say(KAEL, "내가 짊어질게. 빌린 불 따위 돌려주고,\n이 땅은 우리 손으로만 살아갈래."),
    narrate("카엘이 붉게 빛나는 거부 단말을 끝까지 밀어 넣는다."),
    se("cc0-se-osx-machine-03"), flash("red", 600), shake(4, 1000),
    say(TERMINAL, "[거부 신호 100% 송신 완료]\n[궤도 회선 영구 차단]"),
    camBack(1200, TOP_ZOOM),
    narrate("렌즈의 빛이 꺼지고, 탑 꼭대기에 차가운 밤바람만 남는다.\n하늘의 흰 배가 구름 너머로 천천히 멀어진다."),
    say(IRIS, "…신호가 끊겼어요. 이제 집에서 부르지 않아요.\n그래도 괜찮아요, 카엘. 여기 남아 있을게요."),
    clearLetterbox(),
    { kind: "recoverAll" } as unknown as Command,
    setSw(FS2_SW_STOP_B13),
    { kind: "triggerEnding", endingId: FS2_ENDING_CLOSED_SKY } as unknown as Command,
  ];

  const ending: Command[] = [
    cutBegin(), letterbox(),
    bgm(IRIS_BGM, 2500),
    narrate("거센 재가 천천히 가라앉는다.\n렌즈의 붉은 글자가 하나씩 희미해진다."),
    at("ev_fs2_top_hanel", TOP.hanelLens), at("ev_fs2_top_bram", TOP.bramLens), at("ev_fs2_top_valen", TOP.valenLens),
    face("ev_fs2_top_valen", "left"), face("ev_fs2_top_hanel", "up"), face("ev_fs2_top_bram", "up"),
    player(walk(["up", "up"])), player([{ kind: "turn", dir: "up" }]),
    camTo("ev_fs2_top_valen", 1400, 2, 16),
    say(IRIS, "거부 신호가 아직 반쯤 남아 있어요.\n지우지는 못해요… 덮어쓰거나, 끝까지 밀어 넣을 수밖에 없어요."),
    cutLabel(), cutEnd(),
    {
      kind: "choices",
      prompt: "렌즈 앞에서 마지막 결정을 내리자.",
      cancelBehavior: "disallow",
      options: [
        { text: "대답을 덮어쓴다 — 「잘 지내, 오늘도」", branch: answerRoute },
        { text: "거부 신호를 마저 보낸다 — 하늘을 닫는다", branch: closeSkyRoute },
      ],
    } as unknown as Command,
  ];
  addEv(project, FS2_TOP, "ev_fs2_top_collector", "재의 회수자", { x: 0, y: 1 }, [
    page("ev_fs2_top_collector_idle", "대기", [], [], { priority: "below" }),
    page("ev_fs2_top_collector_fight", "회수자", [sw(FS2_SW_B12_DONE), sw(SW_BOSS_LOST, false)], fight, { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_top_collector_end", "다시 대답한다", [sw(FS2_SW_B13_WON)], ending, { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_top_collector_done", "막 끝", [sw(FS2_SW_STOP_B13)], [], { priority: "below" }),
  ]);
  // 꼭대기에 들어서면 한 번 — 바람 소리, 위에서 내려오는 붉은 빛.
  addEv(project, FS2_TOP, "ev_fs2_top_arrive", "하늘탑 꼭대기", { x: 0, y: 1 }, [
    page("ev_fs2_top_arrive_p", "도착", [], [
      bgm(TOWER_BGM, 1200), wait(400),
      say(SARAH, "위에서 붉은 빛이 새어 나와.\n발렌 님이야."),
      say(IRIS, "렌즈가 뭔가를 쏘고 있어요.\n…차갑고, 무서운 말이에요."),
      setSw(SW_TOP_ARRIVE),
    ], { trigger: { kind: "auto" }, priority: "below" }),
    page("ev_fs2_top_arrive_done", "끝", [sw(SW_TOP_ARRIVE)], [], { priority: "below" }),
  ]);
}

export function applyFallenAct2Summit(project: Project, exec: Exec): void {
  summitData(project, exec);
  lensRoom(project, exec);
  summitScenes(project, exec);
  // 밸런스는 simulate_battle 로 쟀다(빌드마다 돌리지 않는다 — 브라우저에서 데모를 지을 때 느려진다):
  //   2026-10-31 완화(HP 5200→4900, 회수 132→118, 끊김 피해 650→520, 흩뿌리기 46→42) — scripts/qa/runtime/fs2-boss-sim.mts, Lv14 넷, 회복약 6, n=60:
  //   기술 쓰는 판 발렌 없이 85%·행동 46 / 발렌 손님 98%·행동 38. 「공격」만 누르는 판은 여전히 0% — 회수(힘 모으기)를 얼음·큰 기술로 끊어야 이긴다.
  //   2026-11-01 실제 도착 레벨로 다시(서리 가도 Lv9 → 탑 입구 Lv11 → 탑 다섯 판 뒤 Lv12): 그대로면 Lv12 발렌 없이 48%·발렌 85%.
  //   HP 4600·회수 104·흩뿌리기 38 → Lv12 발렌 없이 70%·발렌 93%(n=40, FS_LV=12). 「공격」만은 여전히 0%.
  //   그런데 출하 플레이어 QA(Lv14·발렌·계획대로 블리자드)에서 졌다 — 2막(삼킨 불)의 전체 불 피해가 모의전보다 아프다.
  //   삼킨 불 HP 900→700·새벽샘의 불 54→46·열선 64→56 → Lv12 발렌 없이 83%·발렌 100%.
  //   발렌 직업 암흑기사→장군(그라비티 빠짐) → 발렌 손님 95%·행동 42(발렌 없이 83% 그대로).
}
