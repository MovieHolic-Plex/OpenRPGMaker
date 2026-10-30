/**
 * 주 계약 A — 「셋째 날 밤에 오는 것」(갈대늪, 설계 3.1). 작업자 W 가 M2 를 앞당겨 지었다.
 *
 * 흐름(변수 var_hc_a 하나가 쥔다):
 *   0 게시판 앞 → 1 마르타에게 조건을 들음 → 2 단서 둘 이상(뱃사공·장례 마당·끈 자국·세나) → 3 밤 사냥 준비 끝(밤 + 둥지 입장)
 *   → 4 어미를 쓰러뜨림 → 5 선택 끝(a_choice 1·2·3).
 *
 * 엔진 공백 우회(공백마다 함수 하나 — main PR 이 머지되면 그 함수만 바꿔 끼운다):
 *   - 흔적 감각(공백 A)  → trailMark(): ▼ 조사 표식(nearSparkle) 세 칸.
 *   - 괴물 도감(공백 B)  → bestiaryLine(): 일지 「계약」 쪽에 한 줄.
 *   - 칼 기름(공백 D)    → db.applyOil(): 무기 바꿔치기.
 *   - 명상(공백 E)       → waitForNight(): 여관 침대에서 setTime 20시.
 *   - 선택지 조건(공백 C1) → fork 로 고를 수 있는 줄만 다시 묻는다(지금은 셋 다 언제나 열림).
 */
import type { Command, EventPageCondition, Project } from "@/project/types";
import { applyOil, ACTOR, ITEM, oilBurnsOff, TROOP } from "./db";
import {
  bgm, caption, choices, event, execTool, faceHero, fadeIn, fadeOut, gone, ifCond, note, page, playSe, say, setSw, setVar, shake,
  stopBgm, swOff, swOn, think, varAtLeast, varIs, wait, type Cell,
} from "./kit";
import { BGM, M, type Stage } from "./maps";

// ── 상태(부록 A)
export const V = {
  stage: "var_hc_stage",
  contracts: "var_hc_contracts_done",
  a: "var_hc_a",
  aChoice: "var_hc_a_choice",
  aClues: "var_hc_a_clues",
  mercy: "var_hc_mercy",
} as const;
export const SW = {
  aDone: "sw_hc_a_done",
  clueBoat: "sw_hc_clue_a_1",
  clueBody: "sw_hc_clue_a_2",
  clueTrail: "sw_hc_clue_a_3",
  clueWidow: "sw_hc_clue_a_4",
  bestiaryA: "sw_hc_bestiary_drowner",
  aPack1: "sw_hc_a_pack_1",
  aPack2: "sw_hc_a_pack_2",
  aPack3: "sw_hc_a_pack_3",
  aBoss: "sw_hc_a_boss",
  refugees: "sw_hc_refugees_at_dock",
  offering: "sw_hc_offering_body",
  swampFriend: "sw_hc_swamp_friend",
  oilBought: "sw_hc_oil_bought",
  /** 칼에 기름을 바른 채다(공백 D 우회 — 장비 조건이 없어 스위치로 든다). */
  oiled: "sw_hc_blade_oiled",
} as const;
const SE = { paper: "cc0-se-osx-paper-04", splash: "cc0-se-osx-splash-01", coin: "cc0-se-osx-metal-03", bell: "cc0-se-osx-bell-02" } as const;

const objective = (message: string): Command =>
  ({ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message, durationMs: 0 } } as Command);
const gold = (amount: number): Command => ({ kind: "changeGold", op: "+=", amount } as Command);
const giveItem = (itemId: string, amount = 1): Command => ({ kind: "changeItem", itemId, op: "+=", amount } as Command);
const hasItem = (itemId: string): EventPageCondition => ({ kind: "item", itemId, present: true } as EventPageCondition);
const night: EventPageCondition = { kind: "timePhase", phase: "night" } as EventPageCondition;
const all = (...conditions: EventPageCondition[]): EventPageCondition => ({ kind: "all", conditions } as EventPageCondition);
const not = (condition: EventPageCondition): EventPageCondition => ({ kind: "not", condition } as EventPageCondition);

/** 일지 「계약」 한 줄(공백 B 도감 대신). */
export function journal(lineId: string, text: string, writer = "doran"): Command {
  return { kind: "m2Command", commandId: "m2-227-journal-line", fields: { action: "write", lineId, writer, date: "", text } } as Command;
}
/** 공백 B 우회 — 괴물 도감 항목 대신 일지 한 줄. 도감 PR 이 오면 이 함수가 「도감 칸 열기」를 부른다. */
export function bestiaryLine(): Command[] {
  return [
    setSw(SW.bestiaryA),
    playSe(SE.paper),
    journal("hc_bestiary_drowner", "익사귀. 물에 빠져 죽은 것이 셋째 날 밤에 올라온다. 불에 약하고 은을 싫어한다. 쇠는 가죽에서 미끄러진다. 낮에는 물 밑에 있다."),
    ...caption("일지에 익사귀를 적었다. 불에 약하고, 밤에 나온다."),
  ];
}
/** 단서 하나 — 스위치를 켜고 단서 수를 올린다. 둘째 단서에서 도감 줄이 열린다. */
function clue(sw: string, journalId: string, text: string): Command[] {
  return [
    setSw(sw), setVar(V.aClues, "+=", 1), journal(journalId, text),
    ifCond(all(varIs(V.aClues, 2), swOff(SW.bestiaryA)), bestiaryLine()),
    ifCond(all(varAtLeast(V.aClues, 2), varIs(V.a, 1)), [setVar(V.a, "=", 2), objective("밤까지 기다린다. 불씨 기름을 챙긴다.")]),
  ];
}
/** 공백 A 우회 — 흔적 감각 대신 ▼ 조사 표식. 감각 PR(place_track_trail)이 오면 이 함수를 바꾼다. */
function trailMark(id: string, at: Cell, lines: Command[], conditions: EventPageCondition[]) {
  const p = page(`${id}_p`, conditions, lines, { trigger: "action", priority: "below" });
  (p as unknown as { nearSparkle: unknown }).nearSparkle = { radius: 2, preset: "sparkle" };
  return event(id, "끈 자국", at, [gone(`${id}_none`, []), p, gone(`${id}_done`, [swOn(SW.clueTrail)])]);
}
/** 공백 E 우회 — 명상 대신 여관 침대에서 밤까지 쉰다. */
function waitForNight(): Command[] {
  return [
    ...fadeOut(700),
    { kind: "setTime", hour: 21 } as Command,
    { kind: "recoverAll", actorId: ACTOR.doran } as Command,
    wait(500),
    ...fadeIn(700),
    ...caption("밤이 됐다. 창밖 물이 검다."),
  ];
}

export function buildContractA(project: Project, s: Stage): void {
  const swamp = project.maps[M.swamp]!;
  const inn = project.maps[M.inn]!;
  const nest = project.maps[M.nest]!;
  swamp.bgm = { mode: "custom", resourceId: BGM.swamp } as typeof swamp.bgm;
  inn.bgm = { mode: "custom", resourceId: BGM.inn } as typeof inn.bgm;
  nest.bgm = { mode: "custom", resourceId: BGM.nest } as typeof nest.bgm;

  // ── 늪 여관: 게시판 · 주인 베일 · 마르타 · 침대
  inn.events.push(event("ev_hc_a_board", "게시판", s.inn.board, [
    page("board_new", [], [
      playSe(SE.paper),
      ...note("익사자 처리. 머리 하나에 은화 30.", "셋째 날 밤 전에 끝낼 것.", "여관에 묻는다. 마르타."),
      ...think("리스크의 사본과 같은 글이다. 글씨만 다르다."),
      ifCond(varIs(V.a, 0), [setVar(V.a, "=", 1), objective("의뢰인 마르타를 찾는다."),
        journal("hc_a_board", "갈대늪 여관 게시판. 익사자 처리, 머리 하나에 은화 30. 의뢰인 마르타.")]),
    ], { priority: "below" }),
    page("board_taken", [varAtLeast(V.a, 5)], [...caption("게시판에서 종이가 떼어졌다. 못 자국만 남았다.")], { priority: "below" }),
  ]));

  inn.events.push(event("ev_hc_a_keeper", "베일", s.inn.keeper, [
    page("keeper", [], [
      faceHero("ev_hc_a_keeper"),
      ...say("keeper", "base", "방은 은화 다섯. 밥은 없소. 늪이 굶은 지 두 해요."),
      choices([
        { text: "불씨 기름을 산다 (은화 40)", then: [
          ifCond({ kind: "gold", op: ">=", amount: 40 } as EventPageCondition, [
            { kind: "changeGold", op: "-=", amount: 40 } as Command, giveItem(ITEM.oil), setSw(SW.oilBought), playSe(SE.coin),
            ...say("keeper", "base", "송진하고 유황이오. 칼에 바르면 한 번은 탄다."),
          ], [...say("keeper", "annoyed", "은화 마흔. 깎지 마시오. 기름도 굶었소.")]),
        ] },
        { text: "물약을 산다 (은화 20)", then: [
          ifCond({ kind: "gold", op: ">=", amount: 20 } as EventPageCondition, [
            { kind: "changeGold", op: "-=", amount: 20 } as Command, giveItem(ITEM.potion), playSe(SE.coin),
          ], [...say("keeper", "base", "스물이오.")]),
        ] },
        { text: "그만둔다", then: [] },
      ]),
    ], { who: "keeper", dir: "down" }),
    page("keeper_friend", [swOn(SW.swampFriend)], [
      faceHero("ev_hc_a_keeper"),
      ...say("keeper", "smile", "사냥꾼 양반. 기름은 서른만 받겠소."),
      choices([
        { text: "불씨 기름을 산다 (은화 30)", then: [
          ifCond({ kind: "gold", op: ">=", amount: 30 } as EventPageCondition, [
            { kind: "changeGold", op: "-=", amount: 30 } as Command, giveItem(ITEM.oil), playSe(SE.coin),
          ], [...say("keeper", "base", "서른이오.")]),
        ] },
        { text: "그만둔다", then: [] },
      ]),
    ], { who: "keeper", dir: "down" }),
  ]));

  const MARTA = "ev_hc_a_marta";
  inn.events.push(event(MARTA, "마르타", s.inn.marta, [
    page("marta_wait", [], [
      ...say("marta", "base", "사냥꾼이오? 앉으시오. 일어나기 힘들어서."),
      ...think("늪 촌장. 손가락이 앙상하다. 반지 자국만 굵다."),
    ], { who: "marta", dir: "left" }),
    page("marta_terms", [varIs(V.a, 1)], [
      faceHero(MARTA),
      ...say("marta", "base", "게시판 보고 왔소? 삯은 머리를 가져오면 준다.\n반은 지금. 나머지는 냄새가 빠지고 나서."),
      ...say("doran", "serious", "몇 구요."),
      ...say("marta", "base", "보름 동안 넷. 다 물에서 올라왔소.\n장례 마당에 하나 눕혀 놨소. 보시오."),
      ...say("doran", "base", "물에 빠진 놈들은 늪에서 나온 적이 없소.\n누가 늪에 빠졌소?"),
      ...say("marta", "doubtful", "떠돌이들이오. 늪 길을 모르고 들어오지."),
      gold(15), playSe(SE.coin), ...caption("은화 열다섯을 받았다."),
      setVar(V.a, "=", 1), setSw("sw_hc_a_terms"),
      objective("뱃사공과 장례 마당, 이웃들에게 묻는다."),
      journal("hc_a_terms", "마르타. 보름에 넷. 떠돌이들이라 한다. 선금 열다섯."),
    ], { who: "marta", dir: "left" }),
    page("marta_after_terms", [swOn("sw_hc_a_terms")], [
      ...say("marta", "base", "머리를 가져오시오. 그 전에는 할 말이 없소."),
    ], { who: "marta", dir: "left" }),
    page("marta_gone", [varAtLeast(V.a, 4)], [], { priority: "below" }),
  ]));

  inn.events.push(event("ev_hc_a_bed", "침대", s.inn.bed, [
    page("bed_day", [], [
      ...caption("짚 침대. 늪 냄새가 밴 담요."),
      ifCond(varAtLeast(V.a, 2), [
        choices([
          { text: "밤까지 쉰다", then: waitForNight() },
          { text: "그만둔다", then: [] },
        ]),
      ], [...think("아직 잘 때가 아니다. 덜 물어봤다.")]),
    ], { priority: "below" }),
    page("bed_night", [night], [...caption("밤이다. 더 누워 있을 이유가 없다.")], { priority: "below" }),
  ]));

  // ── 늪 마을: 뱃사공 · 장례 마당 시체 · 끈 자국 · 세나 · 늪 사람
  swamp.events.push(event("ev_hc_a_boatman", "뱃사공", s.swamp.boat, [
    page("boat_idle", [], [
      ...say("boatman", "base", "배는 안 띄우오. 물이 무거워."),
    ], { who: "boatman", dir: "left" }),
    page("boat_clue", [varAtLeast(V.a, 1), swOff(SW.clueBoat)], [
      faceHero("ev_hc_a_boatman"),
      ...say("boatman", "base", "물에 빠진 놈들은 셋째 날 밤에 올라온다.\n그 전에 오면 헛걸음이고, 그 뒤에 오면 장례가 늘지."),
      ...say("doran", "base", "낮에는."),
      ...say("boatman", "base", "물 밑에 있지. 밤에 가시오. 늪 깊은 곳, 남쪽 물가 너머."),
      ...say("boatman", "doubtful", "떠돌이라. 떠돌이가 늪 길을 모르면\n누가 그 길로 데려갔겠소."),
      ...clue(SW.clueBoat, "hc_a_clue_boat", "뱃사공 오그. 셋째 날 밤에 올라온다. 낮엔 물 밑. 떠돌이를 누가 데려갔는지 묻지 않는다."),
    ], { who: "boatman", dir: "left" }),
    page("boat_done", [swOn(SW.clueBoat)], [
      ...say("boatman", "base", "밤에 가시오."),
    ], { who: "boatman", dir: "left" }),
  ]));

  swamp.events.push(event("ev_hc_a_body", "시체", s.swamp.funeral, [
    page("body_wait", [], [
      ...caption("거적 아래 사람 하나. 다리가 하나 없었다."),
    ], { priority: "below" }),
    page("body_clue", [varAtLeast(V.a, 1), swOff(SW.clueBody)], [
      ...caption("거적을 들췄다. 다리가 하나 없었다.\n종아리에 물린 자국이 줄지어 있다."),
      ...think("짐승 이빨이 아니다. 사람 이빨이다.\n작다. 아이 입이다."),
      ...caption("발목에서 남쪽 물가 쪽으로 진흙이 끌려 있다."),
      ...clue(SW.clueBody, "hc_a_clue_body", "장례 마당 시체. 다리 하나 없음. 사람 이빨, 작은 입. 남쪽으로 끈 자국."),
    ], { priority: "below" }),
    page("body_done", [swOn(SW.clueBody)], [...caption("거적. 파리.")], { priority: "below" }),
  ]));
  const [t1, t2, t3] = s.swamp.dragTrail;
  const trailOpen = [swOn(SW.clueBody), swOff(SW.clueTrail)];
  swamp.events.push(trailMark("ev_hc_a_trail1", t1!, [...caption("진흙이 고랑처럼 패였다. 무거운 것을 끌었다.")], trailOpen));
  swamp.events.push(trailMark("ev_hc_a_trail2", t2!, [...caption("갈대가 한쪽으로 누웠다. 진흙에 손톱 자국이 있다.")], trailOpen));
  swamp.events.push(trailMark("ev_hc_a_trail3", t3!, [
    ...caption("자국이 물가에서 끊긴다. 끌고 간 것은 물로 들어갔다."),
    ...think("끌고 들어간 쪽이 둥지다. 늪 깊은 곳."),
    ...clue(SW.clueTrail, "hc_a_clue_trail", "끈 자국. 장례 마당에서 남쪽 물가까지. 물 아래로 들어간다. 늪 깊은 곳."),
  ], trailOpen));

  const widowAt = { x: s.swamp.widowDoor.x, y: s.swamp.widowDoor.y + 1 };
  swamp.events.push(event("ev_hc_a_widow", "세나", widowAt, [
    page("widow_idle", [], [
      ...say("widow", "worried", "문 앞에 서지 마세요. 애가 무서워해요."),
    ], { who: "widow", dir: "down" }),
    page("widow_clue", [varAtLeast(V.a, 1), swOff(SW.clueWidow)], [
      faceHero("ev_hc_a_widow"),
      ...say("widow", "worried", "그 애가 먼저 문을 열었어요. 나는 닫으라고 했어요.\n그 뒤로는 못 봤어요."),
      ...say("doran", "base", "누구 말이오."),
      ...say("widow", "sad", "딸이요. 밤마다 물가에 밥을 놔요. 생선 꼬리,\n보리 한 줌. 우리 먹을 것도 없는데."),
      ...say("widow", "sad", "누구 주냐고 물으면 동생들 준대요.\n그 애는 동생이 없어요."),
      ...clue(SW.clueWidow, "hc_a_clue_widow", "세나. 딸이 밤마다 물가에 밥을 놓는다. 「동생들」 준다고. 그 애는 동생이 없다."),
    ], { who: "widow", dir: "down" }),
    page("widow_done", [swOn(SW.clueWidow)], [
      ...say("widow", "base", "밤에 가실 거면 물가 밥그릇은 건드리지 마세요."),
    ], { who: "widow", dir: "down" }),
  ]));

  swamp.events.push(event("ev_hc_a_villager", "늪 사람", nearPlaza(s), [
    page("vill", [], [
      ...say("villager", "base", "사냥꾼이 오면 촌장이 밥을 낸다더니. 밥은?"),
    ], { who: "villager", dir: "down" }),
    page("vill_after", [varAtLeast(V.a, 5)], [
      ifCond(varIs(V.aChoice, 2), [...say("villager", "angry", "떠돌이들 일, 우리도 알았소. 다 알았소.\n…가시오.")],
        [...say("villager", "base", "물이 가벼워졌소. 오늘은 배를 띄우겠소.")]),
    ], { who: "villager", dir: "down" }),
  ]));

  // ── 늪 깊은 곳 입구 — 밤이 아니면 물이 높다(시간대 관문).
  const gateEv = swamp.events.find((e) => JSON.stringify(e.pages ?? []).includes(`"mapId":"${M.nest}"`));
  if (!gateEv) throw new Error("[hunter] 늪 마을에 둥지로 가는 출입구가 없다");
  const goPage = gateEv.pages![0]!;
  const dayBlock = page("nest_day", [not(night)], [
    ...caption("물이 허리까지 찬다. 바닥에서 뭔가 움직인다."),
    ...think("낮에는 물 밑에 있다. 밤에 와야 보인다."),
  ], { trigger: goPage.trigger.kind as "action" | "playerTouch", priority: goPage.priority as "below" | "same" });
  const nightGo = { ...structuredClone(goPage), id: "nest_night", conditions: [night] };
  (nightGo.commands as Command[]).unshift(
    ifCond(all(hasItem(ITEM.oil), swOff(SW.oiled)), [
      ...think("기름을 바를까. 한 번 싸우면 다 탄다."),
      choices([
        { text: "칼에 불씨 기름을 바른다", then: [...applyOil(), setSw(SW.oiled), playSe("easyrpg-sound-fire1"), ...caption("칼날에 기름이 먹었다. 송진 냄새.")] },
        { text: "아끼고 들어간다", then: [] },
      ]),
    ]),
  );
  gateEv.pages = [dayBlock, nightGo];

  const BOSS = "ev_hc_a_mother";
  const motherFight = (troop: string): Command[] => [
    bgm(BGM.boss, 200),
    { kind: "battleProcessing", troopId: troop, canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch: [setSw(SW.aBoss), setVar(V.a, "=", 4)],
      defeatBranch: [
        ...fadeOut(600), { kind: "recoverAll", actorId: ACTOR.doran } as Command,
        { kind: "transfer", mapId: M.inn, x: s.inn.bed.x, y: s.inn.bed.y, direction: "down", fade: "black" } as Command,
      ] } as Command,
  ];
  nest.events.push(event(BOSS, "물에 잠긴 어미", s.nest.boss, [
    page("mother_meet", [swOff(SW.aBoss)], [
      stopBgm(), playSe(SE.splash), shake(500, "3"), wait(400),
      ...caption("물이 부풀었다. 머리카락이 먼저 올라왔다."),
      ...caption("여자다. 아니, 여자였다. 품에 작은 것들을 안았다."),
      ...say("doran", "serious", "은을 바르고 들어가. 쇠는 그놈 가죽에서 미끄러진다.\n…은은 없다. 불은 있나."),
      // 칼에 기름을 발랐으면(무기 바꿔치기) 상처가 마르는 판, 아니면 늪물로 메우는 판.
      ifCond(swOn(SW.oiled), motherFight(TROOP.motherDry), [
        ...think("기름 없이 들어왔다. 상처가 물로 메워진다. 오래 걸린다."),
        ...motherFight(TROOP.mother),
      ]),
    ], { trigger: "playerTouch", priority: "same" }),
    gone("mother_gone", [swOn(SW.aBoss)]),
  ]));
  // 어미의 필드 그림 — 전투 도트에서 뽑는 걷기 칩(place_field_enemy 와 같은 규칙).
  const motherEv = nest.events.find((e) => e.id === BOSS)!;
  motherEv.pages![0]!.graphic = { sprite: { type: "bundled", id: "generated-enemy-ghoul-grave" }, direction: "down", pattern: 0 } as never;

  // 어미가 쓰러진 뒤 — 진실과 선택(자동 실행, 같은 맵).
  const truthAt = { x: s.nest.boss.x, y: s.nest.boss.y + 2 };
  nest.events.push(event("ev_hc_a_truth", "물가", truthAt, [
    gone("truth_wait", []),
    page("truth", [varIs(V.a, 4)], [
      ifCond(swOn(SW.oiled), [...oilBurnsOff(), setSw(SW.oiled, false)]),
      bgm(BGM.sorrow, 900), wait(600),
      ...caption("어미가 물에 가라앉는다. 손가락에서 뼈 반지가 빠졌다."),
      giveItem(ITEM.ring), playSe(SE.paper),
      ...caption("반지 안쪽에 이름이 셋 긁혀 있다. 하나는 「마르타」."),
      ...think("굶은 해에 누가 아이들을 물에 버렸다.\n어미가 따라 들어갔다. 아이들이 올라온다."),
      ...think("떠돌이들은 길을 몰라 빠진 게 아니다.\n누가 데려와 물가에 세웠다. 해마다."),
      ...caption("물가에 보리 한 줌과 생선 꼬리가 놓여 있다."),
      wait(500),
      ...think("머리를 가져가면 삯을 받는다.\n이 반지를 가져가면 마을이 안다."),
      choices([
        { text: "어미의 머리를 잘라 삯을 받는다", then: [setVar(V.aChoice, "=", 1), setSw(SW.swampFriend),
          ...caption("머리를 거적에 쌌다. 무거웠다.")] },
        { text: "반지를 들고 가 마을에 보인다", then: [setVar(V.aChoice, "=", 2), setVar(V.mercy, "+=", 1), setSw(SW.refugees),
          ...caption("어미를 물에 두었다. 반지만 챙겼다.")] },
        { text: "반지를 마르타에게 돌려주고 두 배를 받는다", then: [setVar(V.aChoice, "=", 3), setSw(SW.offering),
          ...caption("반지를 주머니 깊이 넣었다. 값이 오를 물건이다.")] },
      ]),
      setVar(V.a, "=", 5), setSw(SW.aDone), setVar(V.contracts, "+=", 1),
      objective("여관으로 돌아가 마르타를 만난다."),
    ], { trigger: "auto", priority: "below" }),
    gone("truth_done", [varAtLeast(V.a, 5)]),
  ]));

  // 마르타의 마무리(선택마다) — 여관.
  const marta = inn.events.find((e) => e.id === MARTA)!;
  marta.pages!.splice(marta.pages!.length - 1, 1,
    page("marta_end", [varIs(V.a, 5), swOff("sw_hc_a_paid")], [
      faceHero(MARTA),
      ifCond(varIs(V.aChoice, 1), [
        ...say("marta", "base", "냄새가 빠질 때까지 기다리려 했는데.\n됐소. 나머지 열다섯."),
        gold(15), playSe(SE.coin),
        ...say("marta", "smile", "마을이 사냥꾼 양반을 잊지 않을 거요. 베일한테 말해 두겠소."),
      ]),
      ifCond(varIs(V.aChoice, 2), [
        ...say("doran", "base", "반지에 당신 이름이 있었소."),
        ...say("marta", "sad", "…두 해 전 겨울이었소. 보리가 떨어졌소.\n입 셋을 물에 보내면 나머지가 살았소."),
        ...say("marta", "base", "떠돌이들은 그 뒤요. 어미가 배고파했소.\n누군가는 먹여야 했소."),
        ...say("doran", "base", "마을에 말하겠소."),
        ...say("marta", "base", "말하시오. 삯은 없소."),
        ...caption("다음 날 아침, 늪 사람 몇이 짐을 쌌다.\n버들항으로 간다고 했다."),
      ]),
      ifCond(varIs(V.aChoice, 3), [
        ...say("doran", "base", "반지에 당신 이름이 있었소. 마을은 아직 모르오."),
        ...say("marta", "base", "…예순이오. 은화 예순. 입은 다무시오."),
        gold(45), playSe(SE.coin),
        ...say("marta", "base", "늪은 다음 해에도 굶을 거요.\n그때는 사냥꾼을 안 부르겠소."),
      ]),
      setSw("sw_hc_a_paid"),
      journal("hc_a_done", "갈대늪. 끝났다. 리스크의 사본 한 장을 지웠다."),
      objective("다음 사본을 따라간다. 버들항, 회색봉."),
      setVar(V.stage, "=", 2),
    ], { who: "marta", dir: "left" }),
    page("marta_gone", [swOn("sw_hc_a_paid")], [
      ifCond(varIs(V.aChoice, 2), [...caption("마르타는 창밖 물만 본다. 말이 없다.")],
        [...say("marta", "base", "가시오. 늪은 사냥꾼한테 좋은 데가 아니오.")]),
    ], { who: "marta", dir: "left" }),
  );
  // ── 둥지: 익사귀 셋(필드 적, place_field_enemy) — 밤에만 물 밖에 있다(설계 3.6). 둥지 입구가 낮에는 막혀 있으니 둥지 안은 늘 밤이다.
  for (const [i, at] of s.nest.packs.entries()) {
    const r = execTool(project, "place_field_enemy", { mapId: M.nest, x: at.x, y: at.y, troopId: TROOP.drowners, behavior: "chase", sightRange: 4, canEscape: true });
    const id = (r.data as { eventId: string }).eventId;
    const ev = project.maps[M.nest]!.events.find((e) => e.id === id)!;
    ev.name = `익사귀 ${i + 1}`;
  }
}

function nearPlaza(s: Stage): Cell { return { x: s.swamp.plaza.x - 2, y: s.swamp.plaza.y + 2 }; }
