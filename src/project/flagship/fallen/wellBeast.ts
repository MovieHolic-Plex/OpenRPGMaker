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
const SHAFT_BGM = "cc0-bgm-rtp-mys-002";
const BOSS_BGM = "cc0-bgm-rtp-btl-004";

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
/** 쇠살문 그림(Object1 걷기 칩 — lay_dungeon_layout 의 잠긴 문과 같은 그림). 열리면 그 페이지가 꺼져 지나간다. */
const BARS = { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down", pattern: 1 } as const;
const act = (skillId: string, priority: number, condition: Rec = { kind: "always" }) =>
  ({ skillId, priority, condition, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });

/**
 * 능력치 — 우물 밑은 2막 B3(이어 하기 도착 Lv13~14, 카엘+엘레나 둘). 같은 구간 우두머리 「달아오른 숯덩이 골렘」 다음 단계의
 * 결투 보스. scripts/qa/fallen-battle-sim.mts(FS_SIM_ONLY=well_beast)로 잰 값은 PR 본문에 적는다.
 */
function wellData(project: Project, exec: Exec): void {
  exec(project, "upsert_skill", { skill: {
    id: SKILL_BITE, name: "물어뜯기", scope: "enemy", type: "normal", power: 62, variance: 15, hitRate: 95,
    description: "넓은 입으로 한 사람을 문다.", mpCost: { flat: 0, percentMax: 0 },
    effect: { kind: "damage", statistic: "attack", affects: "hp" }, stateEffects: [], animationId: "anim_gen_claw_rake",
  } });
  exec(project, "upsert_skill", { skill: {
    id: SKILL_TAIL, name: "꼬리 휩쓸기", scope: "allEnemies", type: "normal", power: 40, variance: 15, hitRate: 90,
    description: "굵은 꼬리로 앞을 쓸어 낸다.", mpCost: { flat: 0, percentMax: 0 },
    effect: { kind: "damage", statistic: "attack", affects: "hp" }, stateEffects: [], animationId: "anim_gen_tackle_impact",
  } });
  exec(project, "upsert_skill", { skill: {
    id: SKILL_SONG, name: "아가미 노래", scope: "allEnemies", type: "normal", power: 70, variance: 10, hitRate: 100,
    description: "한 차례 아가미를 펴 소리를 모았다가 갱도를 울린다. 맞으면 둔해진다.\n모으는 동안 번개에 맞거나 크게 다치면 끊긴다.",
    mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" },
    stateEffects: [{ stateId: "state_agility_down", chance: 70, operation: "add" }], animationId: "anim_gen_power_aura",
    chargeTurns: 1,
    chargeBreak: { damage: 260, elementIds: ["thunder"], message: "아가미가 번개에 오그라든다! 노래가 끊겼다.", stagger: true },
  } });
  exec(project, "upsert_skill", { skill: {
    id: SKILL_ROAR, name: "붉은 아가미", scope: "self", type: "normal", power: 0, variance: 0, hitRate: 100,
    description: "아가미를 곧추세우고 성을 낸다. 공격이 오른다.", mpCost: { flat: 0, percentMax: 0 },
    effect: { kind: "support" }, stateEffects: [{ stateId: "state_attack_up", chance: 100, operation: "add" }], animationId: "anim_gen_power_aura",
  } });

  exec(project, "upsert_enemy", { enemy: {
    id: FS2_WELL_BEAST_ENEMY, name: "우물 밑 눈먼 영주", level: 14, monsterResourceId: "generated-enemy-golem-clay", battleScalePercent: 125,
    collapseEffect: "bossSink", hideHp: true,
    stats: { maxHp: 2600, maxMp: 0, attack: 118, defense: 62, mind: 96, agility: 44 },
    skillIds: ["skill_attack", SKILL_BITE, SKILL_TAIL, SKILL_SONG, SKILL_ROAR],
    actions: [
      act(SKILL_BITE, 6), act(SKILL_TAIL, 4),
      act(SKILL_SONG, 9, { kind: "turn", start: 2, interval: 3 }),
      // 2페이즈 — 노래가 잦아지고 성을 낸다.
      act(SKILL_SONG, 10, { kind: "switch", switchId: SW_WELL_SONG, value: true }),
      act(SKILL_ROAR, 8, { kind: "turn", start: 6, interval: 5 }),
    ],
    // 아가미가 젖은 물짐승 — 번개 두 배, 불은 반감, 얼음 보통. 수면·정지는 안 먹는다(눈이 없어 잠들지 않는다).
    elementRates: { thunder: "A", fire: "D", water: "E" },
    stateRates: { state_sleep: "E", state_stop: "E", state_blind: "E", state_paralysis: "C", state_poison: "C", state_wet: "E" },
    rewards: { exp: 900, gold: 360, dropRatePercent: 0, drops: [] },
  } });

  // 그림은 monsterArt16(굽기 끝 단계)이 uploaded 로 넣는다 — 도구는 아직 없는 그림 id 를 거절하므로 자리 그림으로 만들고 바로 바꿔 끼운다.
  const beast = project.database.enemies.find((e) => e.id === FS2_WELL_BEAST_ENEMY);
  if (!beast) throw new Error("[fallen-star well] 눈먼 영주 적 레코드가 없다");
  beast.monsterResourceId = FS2_WELL_BEAST_ART;
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
        setSw(SW_WELL_SONG),
        m2("m2-100-change-enemy-state", { target: FS2_WELL_BEAST_ENEMY, operation: "add", value: "state_attack_up" }),
        say(ELENA, "노래를 또 모을 거야. 그때 번개로 끊어!"),
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
  for (const [id, name] of [[SW_WELL_GATE, "B3 우물 밑: 저수조 쇠살문"], [SW_WELL_CRACK, "B3 우물 밑: 금 간 벽"],
    [SW_WELL_BEAST_MET, "B3 우물 밑: 눈먼 영주가 깼다"], [SW_WELL_BEAST_DOWN, "B3 우물 밑: 눈먼 영주를 쓰러뜨렸다"], [SW_WELL_SONG, "B3 우물 밑: 붉은 아가미(전투)"]] as const) {
    ensureSwitch(project, id, name);
  }
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
  ])]);
  addEv(project, mapId, "ev_fs2_well_tablet_2", "옛 저수조 석판", WELL.tabletNest, [page("ev_fs2_well_tablet_2_p", "비문", [], [
    sign("옛 저수조 석판", "노래가 차오를 때 하늘의 불로 아가미를 지져라.\n노래는 목에서 끊긴다."),
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
  // 쇠살문 — 도구가 단 잠긴 문 이벤트를 걷어 내고, 고패 스위치가 켜질 때까지 몸으로 막는 문으로 바꿔 단다.
  { const m = map(); m.events = m.events.filter((e) => !/_locked\d+$/.test(e.id)); }
  WELL.gate.forEach((g, i) => addEv(project, mapId, `ev_fs2_well_gate_${i}`, "쇠살문", g, [
    page(`ev_fs2_well_gate_${i}_p0`, "닫힌 쇠살문", [], [narrate("굵은 쇠살문이 내려와 있다.\n쇠사슬이 서쪽 배수 갱 쪽 벽 속으로 들어간다.")],
      { graphic: { ...BARS }, overlapForbidden: true, animationType: "fixedGraphic" }),
    page(`ev_fs2_well_gate_${i}_p1`, "열린 쇠살문", [sw(SW_WELL_GATE)], [], { priority: "below" }),
  ]));

  // 무너진 돌 더미 — 배수로 남쪽 통로 두 칸을 막아 두었다가 조사해 치우면 정비 벽감이 열린다.
  const crackPage0 = (i: number): EventPage => page(`ev_fs2_well_crack_${i}_p0`, "무너진 돌 더미", [], [
    narrate("무너진 돌 더미가 통로를 막고 있다.\n틈으로 찬바람이 샌다. 안쪽이 비어 있는 것 같다."),
    { kind: "choices", cancelBehavior: "branch", options: [
        { text: "치운다", branch: [se("cc0-se-osx-metal-04"), shake(3, 700),
      narrate("우르르 — 돌 더미가 물길로 굴러떨어졌다!"),
      setSw(SW_WELL_CRACK),
      say(ELENA, "물지기들 연장 창고야. 벽으로 막아 뒀었네.")] },
        { text: "그만둔다", branch: [] },
      ], cancelBranch: [] } as unknown as Command,
  ], { priority: "same", overlapForbidden: true, graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down", pattern: 4 }, animationType: "fixedGraphic" });
  WELL.crack.forEach((c, i) => addEv(project, mapId, `ev_fs2_well_crack_${i}`, "무너진 돌 더미", c, [
    crackPage0(i),
    page(`ev_fs2_well_crack_${i}_p1`, "무너진 벽", [sw(SW_WELL_CRACK)], [], { priority: "below" }),
  ]));

  // 보스 — 둥지 한가운데 웅크린 영주. 깨우는 줄을 밟으면 한 번 연출 뒤 조사로 싸운다(이기기 전까지 다시 도전).
  const beastId = "ev_fs2_well_beast";
  const beastGfx = { sprite: { type: "uploaded", id: FS2_WELL_BEAST_ART }, direction: "down", pattern: 0, scale: 1.4, scaleMode: "manual" };
  const fight: Command[] = [
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
    page(`${beastId}_awake`, "깨어난 영주", [sw(SW_WELL_BEAST_MET)], [narrate("눈먼 영주가 소리 나는 쪽으로 고개를 돌린다."), ...fight],
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
