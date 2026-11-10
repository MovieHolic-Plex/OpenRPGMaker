/**
 * 『폴른 스타』 2막 B3 — 우물 밑 갱도(wellShaftRooms.ts)의 장치·읽을거리·상자와 중간 보스 「우물 밑 눈먼 영주」.
 *
 * 2026-11-09 오너: 「우물 갱도도 좀 ... 복잡하고 우물 밑에 사는 괴물 이런 중간보스도 좀 만들고」.
 *
 * 보스 — 우물 밑 눈먼 영주(동굴 도롱뇽). 눈이 없어 소리로 사냥한다.
 *   1페이즈: 물어뜯기·꼬리 휩쓸기. 「아가미 노래」는 한 차례 모았다가(chargeTurns 1) 파티 전체를 울려 둔하게 만든다.
 *   2페이즈(HP 50% 이하): 아가미가 붉게 선다 — 공격이 오르고 노래가 두 차례마다.
 *   약점(모르면 손해): 아가미가 젖어 있어 번개가 두 배(elementRates thunder A), 불은 반감(D). 그리고 노래를 모으는 동안
 *     번개에 맞거나 큰 피해를 받으면 노래가 끊긴다(chargeBreak) — 첫 비문(R5)·둘째 비문(R4)·저수조 일지가 미리 귀띔한다.
 *     엘레나 「연쇄 번개」(1막 Lv5 습득)·번개석이 답이다. 불 주문만 쓰던 플레이어는 손해를 본다.
 * 진행 — 보스는 이야기 길 밖(R4)이다. 이기면 sw_fs2_well_beast_down + 「눈먼 영주의 아가미」(장신구, 둔화 막기)와
 *   하넬 대사 한 줄이 덧붙는다(하넬 대화의 분기 — 이긴 뒤에만). 지면 전멸이 아니라 R1 로 물러난다(이야기 진행 불변).
 * 무대는 왕도 옛 상수도의 가장 오래된 저수조(R4) — 영주는 녹슨 관 사이 물가에 산다(뼈·둥지 소품 없음).
 */
import type { Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { FS_NAMES } from "../fallenStarStory";
import { WELL } from "./wellShaftRooms";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Cell = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
type Rec = Record<string, unknown>;

const KAEL = FS_NAMES.hero;
const ELENA = FS_NAMES.mage;

export const FS2_WELL_BEAST_ENEMY = "enemy_fs2_well_beast";
export const FS2_WELL_BEAST_TROOP = "troop_fs2_well_beast";
export const FS2_WELL_BEAST_ART = "generated-enemy-well-olm";
export const SW_WELL_GATE = "sw_fs2_well_gate";
export const SW_WELL_CRACK = "sw_fs2_well_crack";
export const SW_WELL_BEAST_MET = "sw_fs2_well_beast_met";
export const SW_WELL_BEAST_DOWN = "sw_fs2_well_beast_down";
const SW_WELL_SONG = "sw_fs2_well_beast_song";
export const FS2_WELL_GILL = "equip_fs2_well_gill";
const SKILL_BITE = "skill_fs2_well_bite";
const SKILL_TAIL = "skill_fs2_well_tail";
const SKILL_SONG = "skill_fs2_well_gill_song";
const SKILL_ROAR = "skill_fs2_well_roar";
const SKILL_SHELL = "skill_fs2_well_shell";
const SKILL_MUD = "skill_fs2_well_mud";
const SKILL_MOLT = "skill_fs2_well_molt";
const SKILL_ECHO = "skill_fs2_well_echo";
const SKILL_FLOOD = "skill_fs2_well_flood";
const STATE_SHELL = "state_fs2_well_shell";
const STATE_MOLT = "state_fs2_well_molt";
const SW_WELL_P2 = "sw_fs2_well_beast_p2";
const SW_WELL_ECHO = "sw_fs2_well_beast_echo";
const SW_WELL_FLOOD = "sw_fs2_well_beast_flood";
const SW_WELL_SHELL2 = "sw_fs2_well_beast_shell2";
const SW_WELL_BITE2 = "sw_fs2_well_beast_bite2";
const SW_WELL_MUD2 = "sw_fs2_well_beast_mud2";
/** 1페이즈 기본 행동은 2페이즈 스위치가 꺼져 있을 때만. 2페이즈 기본 행동은 켜져 있을 때만. */
const P1 = { kind: "switch", switchId: SW_WELL_P2, value: false } as const;
const P2 = { kind: "switch", switchId: SW_WELL_P2, value: true } as const;
const SHAFT_BGM = "cc0-bgm-rtp-mys-002";
const BOSS_BGM = "cc0-bgm-rtp-btl-002";

// ── 명령 조각(act2Opening.ts 와 같은 꼴) ─────────────────────────────────────
const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as unknown as Command);
const narrate = (body: string, extra: Rec = {}): Command => ({ kind: "text", body, ...extra } as unknown as Command);
const sign = (title: string, body: string): Command => ({ kind: "text", speaker: title, body, context: "sign" } as unknown as Command);
const m2 = (commandId: string, fields: Rec): Command => ({ kind: "m2Command", commandId, fields } as unknown as Command);
const wait = (ms: number): Command => ({ kind: "wait", ms } as Command);
const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value } as Condition);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as Command);
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as unknown as Command);
const bgm = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: true, channel: "bgm" } as unknown as Command);
const stopBgm = (): Command => ({ kind: "stopAudio", channel: "bgm" } as unknown as Command);
const shake = (level = 3, durationMs = 500): Command =>
  m2("m2-048-shake-screen", { intensity: level <= 1 ? "1" : level <= 3 ? "3" : "6", durationMs, direction: "vertical" });
const emote = (target: string, kind: string, durationMs = 800): Command =>
  ({ kind: "showEmote", target: target === "player" ? "player" : { eventId: target }, emote: kind, durationMs } as unknown as Command);
const cutBegin = (): Command => ({ kind: "cutsceneControl", mode: "begin", skippable: true } as unknown as Command);
const cutEnd = (): Command => ({ kind: "cutsceneControl", mode: "end" } as unknown as Command);
const cutLabel = (): Command => ({ kind: "label", name: "cutscene_end" } as unknown as Command);
const item = (itemId: string, amount = 1): Command => ({ kind: "changeItem", itemId, op: "+=", amount } as unknown as Command);
const transfer = (mapId: string, at: Cell, direction: Dir = "down"): Command =>
  ({ kind: "transfer", mapId, x: at.x, y: at.y, direction, fade: "black" } as unknown as Command);

const fixedMove = { type: "fixed", speed: 3, frequency: 3 };
function page(id: string, name: string, conditions: Condition[], commands: Command[], extra: Rec = {}): EventPage {
  return {
    id, name, conditions, graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
    movement: fixedMove, commands, ...extra,
  } as unknown as EventPage;
}
function M(project: Project, id: string): GameMap {
  const map = project.maps[id];
  if (!map) throw new Error(`[fallen-star well] 맵이 없다: ${id}`);
  return map;
}
function addEv(project: Project, mapId: string, id: string, name: string, at: Cell, pages: EventPage[]): GameEvent {
  const map = M(project, mapId);
  map.events = map.events.filter((e) => e.id !== id);
  const event = { id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages } as unknown as GameEvent;
  map.events.push(event);
  return event;
}
function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}
const act = (skillId: string, priority: number, condition: Rec = { kind: "always" }, after?: { on?: string; off?: string }) =>
  ({ skillId, priority, condition,
    switchOnAfterAction: after?.on ? { enabled: true, switchId: after.on } : { enabled: false },
    switchOffAfterAction: after?.off ? { enabled: true, switchId: after.off } : { enabled: false } });

/**
 * 능력치 — 우물 밑은 2막 B3(이어 하기 도착 Lv13~14, 카엘+엘레나 둘). 같은 구간 우두머리 「달아오른 숯덩이 골렘」 다음 단계의
 * 결투 보스. scripts/qa/fallen-battle-sim.mts(FS_SIM_ONLY=well_beast)로 잰 값은 PR 본문에 적는다.
 */
export function wellData(project: Project, exec: Exec): void {
  for (const [id, name] of [[SW_WELL_GATE, "B3 우물 밑: 저수조 쇠살문"], [SW_WELL_CRACK, "B3 우물 밑: 금 간 벽"],
    [SW_WELL_BEAST_MET, "B3 우물 밑: 눈먼 영주가 깼다"], [SW_WELL_BEAST_DOWN, "B3 우물 밑: 눈먼 영주를 쓰러뜨렸다"],
    [SW_WELL_P2, "B3 우물 밑 전투: 붉은 아가미(2페이즈)"], [SW_WELL_ECHO, "B3 우물 밑 전투: 순환 ① 메아리"], [SW_WELL_FLOOD, "B3 우물 밑 전투: 순환 ② 해일"],
    [SW_WELL_BITE2, "B3 우물 밑 전투: 순환 ③ 물어뜯기"], [SW_WELL_SONG, "B3 우물 밑 전투: 순환 ④ 노래"], [SW_WELL_SHELL2, "B3 우물 밑 전투: 순환 ⑤ 비늘"],
    [SW_WELL_MUD2, "B3 우물 밑 전투: 순환 ⑥ 흙탕물"]] as const) {
    ensureSwitch(project, id, name);
  }
  // 상태 — 「껍질 세우기」 반격 자세(물리에 맞으면 꼬리로 되받아친다)와 「물 속 탈피」 재생은 이 보스만 쓴다.
  exec(project, "upsert_state", { state: { id: STATE_SHELL, name: "곤두선 비늘", restriction: "없음", removalCondition: "전투 종료",
    recoverNaturallyFromTurn: 2, recoverNaturallyChance: 50, battleAura: "shield-shimmer",
    runtimeEffects: { maxTurns: 2, counterChance: 100, physicalDefenseMultiplier: 1.6, removeOnBattleEnd: true } } });
  exec(project, "upsert_state", { state: { id: STATE_MOLT, name: "물 속 탈피", restriction: "없음", removalCondition: "전투 종료",
    recoverNaturallyFromTurn: 3, recoverNaturallyChance: 40, battleAura: "regen-sparkle",
    runtimeEffects: { maxTurns: 3, hpHealPercentPerTurn: 6, removeOnBattleEnd: true } } });
  const skill = (s: Rec) => exec(project, "upsert_skill", { skill: { variance: 12, hitRate: 95, mpCost: { flat: 0, percentMax: 0 }, stateEffects: [], ...s } });
  // ① 물어뜯기 — 한 사람, 독.
  skill({ id: SKILL_BITE, name: "물어뜯기", scope: "enemy", type: "normal", power: 78, description: "넓은 입으로 한 사람을 문다. 이빨의 물때가 독이 된다.",
    effect: { kind: "damage", statistic: "attack", affects: "hp" }, stateEffects: [{ stateId: "state_poison", chance: 45, operation: "add" }], animationId: "anim_gen_claw_rake" });
  // ② 꼬리 휩쓸기 — 파티 전체.
  skill({ id: SKILL_TAIL, name: "꼬리 휩쓸기", scope: "allEnemies", type: "normal", power: 52, hitRate: 90, description: "굵은 꼬리로 앞을 쓸어 낸다.",
    effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_tackle_impact" });
  // ③ 아가미 노래 — 한 차례 모은 뒤 전체 큰 피해 + 둔화. 번개 한 번 또는 큰 피해로 끊긴다(예고: 「준비한다!」).
  skill({ id: SKILL_SONG, name: "아가미 노래", scope: "allEnemies", type: "normal", power: 150, variance: 8, hitRate: 100,
    description: "아가미를 펴 소리를 모았다가 갱도를 울린다. 맞으면 둔해진다.\n모으는 동안 번개에 맞거나 크게 다치면 끊긴다.",
    effect: { kind: "damage", statistic: "mind", affects: "hp" }, stateEffects: [{ stateId: "state_agility_down", chance: 90, operation: "add" }], animationId: "anim_gen_power_aura",
    // 끊어도 비틀지는 않는다 — 비틀면 아는 플레이어가 영주의 차례를 통째로 빼앗아 승률이 100%가 됐다(시뮬 80판).
    chargeTurns: 1, chargeBreak: { damage: 380, elementIds: ["thunder"], message: "아가미가 번개에 오그라든다! 노래가 끊겼다.", stagger: false } });
  // ④ 비늘 곤두세우기 — 예고 없는 자세. 두 차례 동안 물리 반격(100%)·물리 방어 1.6배. 마구 치는 플레이어를 벌한다.
  skill({ id: SKILL_SHELL, name: "비늘 곤두세우기", scope: "self", type: "normal", power: 0, variance: 0, hitRate: 100,
    description: "등비늘을 칼날처럼 세운다. 그 사이 몸을 치면 꼬리가 되받아친다.",
    effect: { kind: "support" }, stateEffects: [{ stateId: STATE_SHELL, chance: 100, operation: "add" }], animationId: "anim_gen_power_aura" });
  // ⑤ 흙탕물 뿜기 — 한 사람 암흑 + 젖음(젖으면 번개를 맞는 쪽이 된다 — 엘레나에게 쏘면 번개 운용이 꼬인다).
  skill({ id: SKILL_MUD, name: "흙탕물 뿜기", scope: "enemy", type: "normal", power: 40, description: "썩은 흙탕물을 얼굴에 뿜는다. 눈이 흐려지고 몸이 젖는다.",
    effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "water",
    stateEffects: [{ stateId: "state_blind", chance: 80, operation: "add" }, { stateId: "state_silence", chance: 50, operation: "add" }], animationId: "anim_gen_power_aura" });
  // ⑥ 물 속 탈피 — 예고(물에 몸을 담근다) 뒤 재생. 크게 때리면 끊긴다.
  skill({ id: SKILL_MOLT, name: "물 속 탈피", scope: "self", type: "normal", power: 0, variance: 0, hitRate: 100,
    description: "물에 몸을 담그고 허물을 벗는다. 새 살이 돋는 동안 상처가 아문다.\n담그는 동안 크게 다치면 물 밖으로 뛰쳐나온다.",
    effect: { kind: "support" }, stateEffects: [{ stateId: STATE_MOLT, chance: 100, operation: "add" }], animationId: "anim_gen_power_aura",
    chargeTurns: 1, chargeBreak: { damage: 300, elementIds: ["thunder"], message: "물속에서 번개를 맞고 뛰쳐나온다! 탈피가 끊겼다.", stagger: false } });
  // ⑦ 붉은 아가미 — 2페이즈 들어설 때 성을 낸다(공격 상승).
  skill({ id: SKILL_ROAR, name: "붉은 아가미", scope: "self", type: "normal", power: 0, variance: 0, hitRate: 100,
    description: "아가미를 곧추세우고 성을 낸다. 공격이 오른다.", effect: { kind: "support" },
    stateEffects: [{ stateId: "state_attack_up", chance: 100, operation: "add" }], animationId: "anim_gen_power_aura" });
  // ⑧ 메아리 사냥 — 2페이즈. 두 차례 모았다가 한 사람에게 큰 피해(가장 약한 쪽). 번개로만 끊긴다 — 피해로는 안 끊긴다.
  skill({ id: SKILL_ECHO, name: "메아리 사냥", scope: "enemy", type: "normal", power: 230, variance: 8, hitRate: 100,
    description: "울음을 벽에 튕겨 숨은 먹이를 찾는다. 두 차례 소리를 모은 뒤 한 사람을 덮친다.\n번개만이 소리를 흩는다.",
    effect: { kind: "damage", statistic: "attack", affects: "hp" }, animationId: "anim_gen_claw_rake",
    chargeTurns: 2, chargeBreak: { elementIds: ["thunder"], message: "번개 소리에 메아리가 흩어졌다!", stagger: true } });
  // ⑨ 저수조 해일 — 2페이즈. 한 차례 모은 뒤 전체 물 피해 + 젖음(다음 노래·번개에 약해진다). 큰 피해로 끊긴다.
  skill({ id: SKILL_FLOOD, name: "저수조 해일", scope: "allEnemies", type: "normal", power: 120, variance: 10, hitRate: 100,
    description: "꼬리로 저수조 물을 퍼올려 덮친다. 젖은 몸은 소리와 번개를 더 맞는다.\n퍼올리는 동안 크게 다치면 물이 흩어진다.",
    effect: { kind: "damage", statistic: "attack", affects: "hp" }, elementId: "water",
    stateEffects: [{ stateId: "state_wet", chance: 100, operation: "add" }], animationId: "anim_gen_tackle_impact",
    chargeTurns: 1, chargeBreak: { damage: 420, message: "퍼올린 물이 흩어졌다!", stagger: false } });

  exec(project, "upsert_enemy", { enemy: {
    id: FS2_WELL_BEAST_ENEMY, name: "우물 밑 눈먼 영주", level: 18, monsterResourceId: "generated-enemy-golem-clay", battleScalePercent: 125,
    collapseEffect: "bossSink", hideHp: true,
    // 숨은 보스 — Lv14 두 사람 기준 시뮬 80판(scripts/qa/zz-well-beast-sim.mts)으로 맞춘 값. 민첩은 몇 포인트에도 승률이 크게 흔들린다.
    stats: { maxHp: 7280, maxMp: 0, attack: 298, defense: 74, mind: 153, agility: 56 },
    skillIds: ["skill_attack", SKILL_BITE, SKILL_TAIL, SKILL_SONG, SKILL_SHELL, SKILL_MUD, SKILL_MOLT, SKILL_ROAR, SKILL_ECHO, SKILL_FLOOD],
    actions: [
      // 1페이즈(아가미 노래가 리듬의 중심 — 석판 「셋째 숨마다 노래」): 2·5·8…번째 차례에 노래를 모은다.
      act(SKILL_BITE, 5, P1), act(SKILL_TAIL, 4, P1), act(SKILL_MUD, 3, P1),
      act(SKILL_SONG, 20, { kind: "turn", start: 2, interval: 3 }),  // 2페이즈에 들어서면 순환 칸(40)이 이긴다
      // 비늘은 노래 직후(3·6·9…) — 노래를 끊으려고 칼을 휘두르던 손이 비늘에 걸린다.
      act(SKILL_SHELL, 18, { kind: "turn", start: 3, interval: 3 }),
      // 피가 절반 아래로 내려가기 전, 크게 다쳤다 싶으면 물에 든다.
      act(SKILL_MOLT, 15, { kind: "hp", minPercent: 51, maxPercent: 75 }),
      // 2페이즈(붉은 아가미, 스위치) — 패턴이 바뀐다: 메아리 사냥(2차례 예고)·해일·노래가 번갈아, 비늘은 해일 뒤.
      // 순환의 각 칸은 쓰고 나면 자기 스위치를 끄고 다음 칸을 켠다(행동 뒤 스위치 — 적 차례마다 한 칸). 그 사이에 기본 행동이 끼지 않는다.
      act(SKILL_ECHO, 40, { kind: "switch", switchId: SW_WELL_ECHO, value: true }, { off: SW_WELL_ECHO, on: SW_WELL_FLOOD }),
      act(SKILL_FLOOD, 40, { kind: "switch", switchId: SW_WELL_FLOOD, value: true }, { off: SW_WELL_FLOOD, on: SW_WELL_BITE2 }),
      act(SKILL_BITE, 40, { kind: "switch", switchId: SW_WELL_BITE2, value: true }, { off: SW_WELL_BITE2, on: SW_WELL_SONG }),
      act(SKILL_SONG, 40, { kind: "switch", switchId: SW_WELL_SONG, value: true }, { off: SW_WELL_SONG, on: SW_WELL_SHELL2 }),
      act(SKILL_SHELL, 40, { kind: "switch", switchId: SW_WELL_SHELL2, value: true }, { off: SW_WELL_SHELL2, on: SW_WELL_MUD2 }),
      act(SKILL_MUD, 40, { kind: "switch", switchId: SW_WELL_MUD2, value: true }, { off: SW_WELL_MUD2, on: SW_WELL_ECHO }),
      act(SKILL_TAIL, 6, P2),
    ],
    // 아가미가 젖은 물짐승 — 번개 두 배, 불은 반감, 물은 흡수 가까이. 수면·정지·암흑은 안 먹는다(눈이 없다).
    elementRates: { thunder: "A", fire: "D", water: "E" },
    stateRates: { state_sleep: "E", state_stop: "E", state_blind: "E", state_paralysis: "D", state_poison: "D", state_wet: "E", state_silence: "E" },
    rewards: { exp: 1800, gold: 600, dropRatePercent: 0, drops: [] },
  } });

  exec(project, "upsert_troop", { troop: {
    id: FS2_WELL_BEAST_TROOP, name: "우물 밑 눈먼 영주", enemyIds: [FS2_WELL_BEAST_ENEMY], uncapturable: true,
    previewBackgroundResourceId: "battle-scenery-cave",
    backdropLayers: [{ preset: "fog", opacity: 45 }, { preset: "glow", opacity: 30 }],
  } });
  const troop = project.database.troops.find((t) => t.id === FS2_WELL_BEAST_TROOP) as unknown as Rec;
  troop.battleEventPages = [
    { id: "troop_fs2_well_open", name: "시작 — 소리로 사냥한다", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }],
      commands: [say(ELENA, "눈이 없어… 소리로 우리를 찾는 거야."), say(KAEL, "아가미가 펴지면 조심해!")] },
    { id: "troop_fs2_well_phase2", name: "2페이즈 — 붉은 아가미", span: "battle", runOnce: true,
      conditions: [{ kind: "enemyHpBelow", enemyId: FS2_WELL_BEAST_ENEMY, percent: 50 }],
      commands: [
        narrate("눈먼 영주가 몸을 일으킨다.\n아가미가 핏빛으로 곧추선다!"),
        m2("m2-100-change-enemy-state", { target: FS2_WELL_BEAST_ENEMY, operation: "add", value: "state_attack_up" }),
        m2("m2-100-change-enemy-state", { target: FS2_WELL_BEAST_ENEMY, operation: "remove", value: STATE_MOLT }),
        setSw(SW_WELL_P2), setSw(SW_WELL_ECHO),
        say(ELENA, "소리를 두 번 모으고 있어 — 저건 피해로는 안 끊겨. 번개로만!"),
      ] },
  ];
  // 전리품 — 아가미 장신구(소리 공격 「둔함」 막기 + 마력). 보스 드롭은 확정이라 이벤트에서 준다.
  const wearers = ["actor_hero", "actor_fs_elena", "actor_fs2_sarah", "actor_fs_iris"].filter((id) => project.database.actors.some((a) => a.id === id));
  const classes = [...new Set(wearers.map((id) => project.database.actors.find((a) => a.id === id)?.classId).filter((c): c is string => !!c))];
  exec(project, "upsert_equipment", { equipment: {
    id: FS2_WELL_GILL, name: "눈먼 영주의 아가미", slot: "accessory", price: 0, iconResourceId: "cc0-jetrel-necklace", imageResourceId: "cc0-jetrel-necklace",
    description: "우물 밑 영주의 붉은 아가미 한 가닥을 말려 엮은 목걸이.\n둔해지지 않고, 마력이 조금 오른다.",
    statBonuses: { attack: 0, defense: 4, mind: 10, agility: 2 }, equippableActorIds: wearers, equippableClassIds: classes,
    stateDefenseIds: ["state_agility_down"],
  } });
}

/** wellShaftRooms 평면으로 지은 갱도에 장치·읽을거리·상자·보스를 단다. ret = 보스에게 지면 물러날 자리. */
export function applyFallenWellBeast(project: Project, exec: Exec, mapId: string, ret: { mapId: string; at: Cell }): void {
  wellData(project, exec);
  const map = (): GameMap => M(project, mapId);

  // 읽을거리 — 약점을 세 번 나눠 귀띔한다(모르면 손해: 비문을 안 읽으면 불만 쓰다 길어진다).
  addEv(project, mapId, "ev_fs2_well_tablet_1", "물지기 석판", WELL.tabletWell, [page("ev_fs2_well_tablet_1_p", "비문", [], [
    sign("물지기 석판", "왕도 상수도를 지키는 물지기들이 새긴다.\n가장 오래된 저수조에는 눈 없는 주인이 산다."),
    sign("물지기 석판", "주인은 소리로 본다. 아가미를 펴면 노래가 온다.\n노래를 들은 자는 발이 무거워진다."),
  ])]);
  addEv(project, mapId, "ev_fs2_well_ledger", "저수조 일지", WELL.ledger, [page("ev_fs2_well_ledger_p", "일지", [], [
    sign("물지기 일지", "셋째 해. 장마에 저수조가 넘쳤다.\n쇠살문은 서쪽 무너진 밑동의 고패로 올린다."),
    sign("물지기 일지", "다섯째 해. 영주에게 횃불을 던졌더니 웃는 것 같았다.\n젖은 몸에 불은 소용없다."),
    sign("물지기 일지", "여섯째 해. 천둥 치던 밤, 영주가 사흘을 숨어 나오지 않았다.\n…번개를 싫어하는 걸까."),
    sign("물지기 일지", "일곱째 해. 셋째 숨마다 아가미가 열린다. 노래가 끝나면 등비늘이 선다.\n선 비늘을 창으로 찌른 바르그는 꼬리에 맞아 갈비가 나갔다."),
    sign("물지기 일지", "아홉째 해. 영주가 물에 몸을 담그면 상처가 아문다. 그때 크게 쳐서 끌어내라.\n(이 장 아래는 물에 번져 읽을 수 없다.)"),
  ])]);
  addEv(project, mapId, "ev_fs2_well_tablet_2", "옛 저수조 석판", WELL.tabletNest, [page("ev_fs2_well_tablet_2_p", "비문", [], [
    sign("옛 저수조 석판", "노래가 차오를 때 하늘의 불로 아가미를 지져라.\n노래는 목에서 끊긴다."),
    sign("옛 저수조 석판", "아가미가 피로 물들면 주인은 벽에 소리를 두 번 튕겨 한 사람을 찾는다.\n그 메아리는 칼로는 못 끊는다. 하늘의 불만이 흩는다."),
    say(ELENA, "하늘의 불… 번개 말이야.\n내 연쇄 번개라면 닿을 거야."),
  ])]);

  // 고패 — 저수조 남쪽 쇠살문을 감아 올린다(고리: R1 → R5 → R3 → R2 → R1).
  addEv(project, mapId, "ev_fs2_well_winch", "녹슨 고패", WELL.winch, [
    page("ev_fs2_well_winch_p0", "고패", [], [
      narrate("굵은 쇠사슬을 감는 고패다.\n사슬이 벽을 타고 동쪽 저수조로 이어진다."),
      { kind: "choices", cancelBehavior: "branch", options: [
        { text: "감는다", branch: [se("cc0-se-osx-tools-02"), wait(300),
        narrate("끼긱, 끼긱. 사슬이 팽팽해진다."),
        se("cc0-se-osx-machine-01"), shake(1, 400),
        setSw(SW_WELL_GATE),
        se("cc0-se-osx-metal-04"),
        narrate("멀리 동쪽에서 쇠살문 올라가는 소리가 울린다."),
        say(KAEL, "저수조 남쪽 문이 열렸나 봐.")] },
        { text: "그만둔다", branch: [] },
      ], cancelBranch: [] } as unknown as Command,
    ], { overlapForbidden: false }),
    page("ev_fs2_well_winch_p1", "감긴 고패", [sw(SW_WELL_GATE)], [narrate("사슬은 끝까지 감겨 있다.")]),
  ]);
  // 쇠살문 — lay_dungeon_layout 이 잠긴 문 칸에 단 쇠창살 이벤트(그림·막힘)를 그대로 쓰고, 고패 스위치가 켜지면 열린 페이지로 넘긴다.
  // 두 칸 폭 통로라 옆 칸에도 같은 쇠창살을 하나 더 세운다.
  {
    const m = map();
    const lock = m.events.find((e) => /_locked\d+$/.test(e.id) && WELL.gate.some((g) => g.x === e.x && g.y === e.y));
    if (!lock?.pages?.[0]) throw new Error(`[fallen-star well] 쇠살문 잠긴 문 이벤트가 없다: ${m.events.filter((e) => /_locked/.test(e.id)).map((e) => `${e.id}@${e.x},${e.y}`).join(" ")}`);
    // 그림 고정(fixedGraphic) — 없으면 조사할 때 대화 방향 맞추기가 문을 플레이어 쪽으로 돌려 문짝 반쪽만 남았다(fs-vqa-well D3).
    const closed = { ...structuredClone(lock.pages[0]), animationType: "fixedGraphic", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [narrate("굵은 쇠살문이 내려와 있다.\n쇠사슬이 서쪽 배수 갱 쪽 벽 속으로 들어간다.")] } as EventPage;
    m.events = m.events.filter((e) => e !== lock);
    WELL.gate.forEach((g, i) => addEv(project, mapId, `ev_fs2_well_gate_${i}`, "쇠살문", g, [
      { ...structuredClone(closed), id: `ev_fs2_well_gate_${i}_p0` } as EventPage,
      page(`ev_fs2_well_gate_${i}_p1`, "열린 쇠살문", [sw(SW_WELL_GATE)], [], { priority: "below" }),
    ]));
  }

  // 무너진 돌 더미 — 배수로 남쪽 통로 두 칸을 막아 두었다가 조사해 치우면 정비 벽감이 열린다.
  // 돌 더미 그림 — 통로 두 칸 폭을 덮는 2×2 돌무더기(윗면 보이는 덩이)를 통로 첫 줄부터 두 줄 찍고, 치우면 그 네 칸 그림을 지운다.
  // 예전에는 1×1 바닥 자갈 조각이라 「통로를 막은 돌 더미」가 자갈 두 개로 보였다(fs-vqa-well D4).
  const rubbleCells: Cell[] = [...WELL.crack, ...WELL.crack.map((c) => ({ x: c.x, y: c.y + 1 }))];
  exec(project, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-dungeon-theme-rubble-heap", mapId, x: WELL.crack[0]!.x, y: WELL.crack[0]!.y });
  const clearRubble: Command[] = rubbleCells.flatMap((c) => {
    const m = map(); const i = c.y * m.width + c.x;
    const L = m as unknown as Record<string, number[] | undefined>;
    return (["upperTiles", "upperOverlayTiles", "lowerOverlayTiles"] as const).filter((k) => (L[k]?.[i] ?? -1) >= 0)
      .map((k) => ({ kind: "changeTile", mapId, layer: { upperTiles: "upper", upperOverlayTiles: "upper2", lowerOverlayTiles: "lower2" }[k], x: c.x, y: c.y, tile: -1 } as unknown as Command));
  });
  if (!clearRubble.length) throw new Error("[fallen-star well] 돌 더미 그림이 찍히지 않았다");
  const crackPage0 = (i: number): EventPage => page(`ev_fs2_well_crack_${i}_p0`, "무너진 돌 더미", [], [
    narrate("무너진 돌 더미가 통로를 막고 있다.\n틈으로 찬바람이 샌다. 안쪽이 비어 있는 것 같다."),
    { kind: "choices", cancelBehavior: "branch", options: [
        { text: "치운다", branch: [se("cc0-se-osx-metal-04"), shake(3, 700),
      narrate("우르르 — 돌 더미가 물길로 굴러떨어졌다!"),
      ...clearRubble,
      setSw(SW_WELL_CRACK),
      say(ELENA, "물지기들 연장 창고야. 벽으로 막아 뒀었네.")] },
        { text: "그만둔다", branch: [] },
      ], cancelBranch: [] } as unknown as Command,
  ], { priority: "same", overlapForbidden: true, graphic: { transparent: true } });
  WELL.crack.forEach((c, i) => addEv(project, mapId, `ev_fs2_well_crack_${i}`, "무너진 돌 더미", c, [
    crackPage0(i),
    page(`ev_fs2_well_crack_${i}_p1`, "무너진 벽", [sw(SW_WELL_CRACK)], [], { priority: "below" }),
  ]));

  // 보스 — 둥지 한가운데 웅크린 영주. 깨우는 줄을 밟으면 한 번 연출 뒤 조사로 싸운다(이기기 전까지 다시 도전).
  const beastId = "ev_fs2_well_beast";
  const beastGfx = { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, direction: "down", pattern: 0, scale: 1.4, scaleMode: "manual" };
  // 전투 스위치(2페이즈·순환)는 세션 스위치라 지고 다시 붙으면 남아 있다 — 싸움마다 처음 상태로 돌린다.
  const resetFight = [SW_WELL_P2, SW_WELL_ECHO, SW_WELL_FLOOD, SW_WELL_BITE2, SW_WELL_SONG, SW_WELL_SHELL2, SW_WELL_MUD2].map((id) => setSw(id, false));
  const fight: Command[] = [
    ...resetFight,
    bgm(BOSS_BGM),
    { kind: "battleProcessing", troopId: FS2_WELL_BEAST_TROOP, canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch: [
        se("cc0-se-ors-creature-roar-03"), shake(4, 900),
        narrate("눈먼 영주가 물속으로 무너져 내린다.\n아가미 한 가닥이 돌바닥에 남았다."),
        setSw(SW_WELL_BEAST_DOWN),
        item(FS2_WELL_GILL, 1),
        narrate("「눈먼 영주의 아가미」를 얻었다.", { context: "system" }),
        say(ELENA, "…우물이 이제 조용하겠네.\n광장 사람들, 밤마다 이 울음을 들었을 거야."),
        say(KAEL, "하넬 선생님한테 말씀드리자."),
        bgm(SHAFT_BGM),
      ],
      defeatBranch: [
        { kind: "recoverAll" } as unknown as Command,
        narrate("정신을 차려 보니 승강구까지 끌려 나와 있다.\n아가미 노래가 아직 귓가에 맴돈다."),
        bgm(SHAFT_BGM),
        transfer(ret.mapId, ret.at, "down"),
      ],
      escapeBranch: [] } as unknown as Command,
  ];
  addEv(project, mapId, beastId, "우물 밑 눈먼 영주", WELL.beast, [
    page(`${beastId}_sleep`, "웅크린 영주", [], [narrate("녹슨 관 사이 물가에 희고 커다란 짐승이 웅크려 있다.\n숨 쉴 때마다 붉은 아가미가 일렁인다.")],
      { graphic: beastGfx, footprint: { width: 3, height: 2 }, overlapForbidden: true, animationType: "fixedGraphic" }),
    // 말을 걸어야만 싸운다(조사 버튼) — 닿거나 지나가면 아무 일도 없다. 싸울지 한 번 더 묻는다.
    page(`${beastId}_awake`, "깨어난 영주", [sw(SW_WELL_BEAST_MET)], [
      narrate("눈먼 영주가 소리 나는 쪽으로 고개를 돌린다."),
      { kind: "choices", prompt: "싸울까?", cancelBehavior: "branch", options: [
        { text: "싸운다", branch: fight },
        { text: "아직이다", branch: [say(ELENA, "…천천히 물러나. 소리 내지 말고.")] },
      ], cancelBranch: [say(ELENA, "…천천히 물러나. 소리 내지 말고.")] } as unknown as Command,
    ],
      { graphic: beastGfx, footprint: { width: 3, height: 2 }, overlapForbidden: true, animationType: "step" }),
    page(`${beastId}_down`, "물러간 자리", [sw(SW_WELL_BEAST_DOWN)], [narrate("물가에 허옇게 벗겨진 허물만 남아 있다.\n관 속으로 물 흐르는 소리가 다시 고르다.")], { priority: "below" }),
  ]);
  WELL.wakeLine.forEach((c, i) => addEv(project, mapId, `ev_fs2_well_wake_${i}`, "옛 저수조 어귀", c, [
    page(`ev_fs2_well_wake_${i}_on`, "깨운다", [sw(SW_WELL_BEAST_MET, false)], [
      cutBegin(),
      stopBgm(),
      narrate("발밑 웅덩이가 찰박 울린다."),
      m2("m2-201-camera-control", { mode: "panTo", targetEventId: beastId, durationMs: "1000", wait: "true" }),
      se("cc0-se-ors-creature-roar-02"), shake(3, 800),
      emote(beastId, "exclamation", 900), emote("player", "exclamation", 700),
      say(KAEL, "…우물 밑에 이런 게 살았어?"),
      say(ELENA, "눈이 없어. 소리로 우리를 찾고 있어."),
      setSw(SW_WELL_BEAST_MET),
      m2("m2-201-camera-control", { mode: "return", durationMs: "500", wait: "true" }),
      cutLabel(),
      cutEnd(),
    ], { trigger: { kind: "playerTouch" }, priority: "below" }),
    page(`ev_fs2_well_wake_${i}_done`, "지남", [sw(SW_WELL_BEAST_MET)], [], { priority: "below" }),
  ]));

  // 쉼터 결정 — 보스 앞.
  exec(project, "place_savepoint", { mapId, x: WELL.save.x, y: WELL.save.y, id: "ev_fs2_well_save", name: "별빛 결정", heal: true, mode: "both",
    sparkleRadius: 2 });

  // 상자 — 구석(R5)·숨은 방(R6) 둘.
  exec(project, "place_chest", { mapId, x: WELL.chestCorner.x, y: WELL.chestCorner.y, contents: { itemId: "item_thunder_stone" }, name: "배수 갱 궤짝", id: "ev_fs2_well_chest_corner" });
  exec(project, "place_chest", { mapId, x: WELL.chestHidden.x, y: WELL.chestHidden.y, contents: { itemId: "item_hi_potion", gold: 200 }, name: "물지기 연장 궤짝", id: "ev_fs2_well_chest_hidden" });
  exec(project, "place_chest", { mapId, x: WELL.chestHidden2.x, y: WELL.chestHidden2.y, contents: { itemId: "item_ether" }, name: "물지기 연장 궤짝", id: "ev_fs2_well_chest_hidden2" });
}

/** 하넬 대화 끝에 덧붙일 한 줄 — 영주를 쓰러뜨렸으면. */
export function wellBeastHanelLine(hanel: string): Command {
  return { kind: "fork", condition: { kind: "switch", switchId: SW_WELL_BEAST_DOWN, value: true }, then: [
    say(hanel, "…그 울음이 멎었구나. 우물 밑 영주를 만났느냐.\n서른 해 동안 광장 아이들이 무서워하던 소리다."),
  ], else: [] } as unknown as Command;
}

/**
 * 그림은 monsterArt16(굽기 끝 단계)이 uploaded 리소스로 넣는다. 그 전에는 리소스가 없어 도구·무결성 검사가 이 id 를 거절하므로
 * 지을 때는 자리 그림(돌 골렘·몬스터 칩)으로 두고, 그림 설치 바로 뒤(chronoBell, applyFallenMonsterArt16 다음)에 여기서 바꿔 끼운다.
 */
export function finishFallenWellBeastArt(project: Project, mapId: string): void {
  if (!Object.hasOwn(project.assets.uploaded, FS2_WELL_BEAST_ART)) throw new Error(`[fallen-star well] 눈먼 영주 그림 ${FS2_WELL_BEAST_ART} 가 설치되지 않았다 — applyFallenMonsterArt16 다음에 부른다`);
  const beast = project.database.enemies.find((e) => e.id === FS2_WELL_BEAST_ENEMY);
  if (!beast) throw new Error("[fallen-star well] 눈먼 영주 적 레코드가 없다");
  beast.monsterResourceId = FS2_WELL_BEAST_ART;
  const ev = project.maps[mapId]?.events.find((e) => e.id === "ev_fs2_well_beast");
  if (!ev?.pages?.length) throw new Error("[fallen-star well] 잠든 영주 이벤트(페이지)가 없다");
  for (const pg of ev.pages) {
    const g = pg.graphic as { sprite?: { type: string; id: string } } | undefined;
    if (g?.sprite) g.sprite = { type: "uploaded", id: FS2_WELL_BEAST_ART };
  }
}
