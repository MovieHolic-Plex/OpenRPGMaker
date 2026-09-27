// test/fixtures/conditionFixtures.ts
//
// 조건/열거값 표면 축(패키지 E)의 입력 픽스처.
//
// 왜 이 축이 필요한가 (실측):
//   기존 폼 표면 축은 `fork` 를 minimalCommands.ts 의 단일 픽스처
//   `{ kind:"fork", condition:{ kind:"switch", … } }` 하나로만 렌더한다.
//   CONDITION_KINDS 는 16종이므로 **15종이 축 밖**이었고, conditionForm.ts 의
//   `switch (cond.kind)` 분기를 15개 통째로 지워도 모든 게이트가 초록이었다.
//   같은 구멍이 "하나의 kind 안에서 필드 값으로 폼이 갈리는" 커맨드에도 있다
//   (cutsceneControl.mode, runControl.action, setSwitch.value …).
//
// 참조 id 정책 — 없는 id 를 쓰지 않고 캡처 프로젝트의 실제 앞 레코드를 쓴다:
//   minimalCommands.ts 는 "sw1" / "troop1" 처럼 존재하지 않는 id 를 쓴다. 그러면 폼이
//   검증 경고 노드를 띄우고, 조건 편집기에서는 그 경고가 곧 `event-condition-*-error` 다.
//   에러 노드는 항상 렌더되고 `hidden` 만 토글되므로(conditionForm.ts 의 syncError) 존재
//   자체는 id 유효성과 무관하지만, **hidden 플래그**는 유효성에 따라 갈린다.
//   즉 가짜 id 를 쓰면 16종 전부가 "에러 표시 중" 상태로 굳고, 정상 편집 상태(에러 숨김)의
//   표면은 영구히 무보증이 된다. 그래서 실제 id 를 쓴다 — 정상 상태를 정본으로 삼고,
//   에러 상태는 conditionForm 의 syncError 를 통해 diff 가 잡는다.
//   (실제 id 라도 캡처 프로젝트는 앞 3개로 절단돼 있어 카탈로그 증감에 흔들리지 않는다.)
import { createCaptureProject } from "./captureProject";
import type { Command, Condition } from "@/project/types";
import type { ConditionKind } from "@/project/commandKindRegistry";

const CAPTURE = createCaptureProject();

function firstId(list: readonly { readonly id: string }[] | undefined, fallback: string): string {
  return list?.[0]?.id ?? fallback;
}

/**
 * 캡처 프로젝트의 실제 앞 레코드 id. 폴백 문자열은 "그 컬렉션이 비어 버렸다"는 사고를
 * 조용히 통과시키지 않기 위해 명백히 가짜인 값으로 둔다(그 경우 에러 노드가 보이게 되고
 * 기준선 diff 가 hidden 플래그 변화로 지목한다).
 */
export const CONDITION_REFS = {
  switchId: firstId(CAPTURE.switches, "sw_missing"),
  variableId: firstId(CAPTURE.variables, "var_missing"),
  actorId: firstId(CAPTURE.database.actors, "actor_missing"),
  itemId: firstId(CAPTURE.database.items, "item_missing"),
  troopId: firstId(CAPTURE.database.troops, "troop_missing"),
  skillId: firstId(CAPTURE.database.skills, "skill_missing"),
  mapId: CAPTURE.startMapId || Object.keys(CAPTURE.maps)[0] || "map_missing",
} as const;

/** 그룹 조건의 리프로 재사용하는 최소 조건들. */
const LEAF_SWITCH: Condition = { kind: "switch", switchId: CONDITION_REFS.switchId, value: true };
const LEAF_VARIABLE: Condition = {
  kind: "variable",
  variableId: CONDITION_REFS.variableId,
  op: ">=",
  value: 1,
};
const LEAF_ITEM: Condition = { kind: "item", itemId: CONDITION_REFS.itemId, present: true };
const LEAF_GOLD: Condition = { kind: "gold", op: ">=", amount: 500 };

/**
 * CONDITION_KINDS 전량 × 최소 유효 조건.
 *
 * optional 필드도 값을 채운다(friendshipAtLeast.npcKey, run.value). 비워두면 폼이 조용히
 * 축소 렌더되거나(자리표시자 경로) 경고 노드가 끼어 "정상 편집 상태"의 표면이 아니게 된다.
 *
 * all/any 는 여기서는 **자식 1개**의 최소형이다. 자식 2개 이상과 중첩은
 * CONDITION_GROUP_FIXTURES 가 따로 담당한다(중첩이 별도 렌더 경로다).
 */
export const CONDITION_FIXTURES: Readonly<Record<ConditionKind, Condition>> = {
  switch: LEAF_SWITCH,
  variable: LEAF_VARIABLE,
  selfSwitch: { kind: "selfSwitch", key: "A", value: true },
  actor: { kind: "actor", actorId: CONDITION_REFS.actorId, present: true },
  item: LEAF_ITEM,
  gold: LEAF_GOLD,
  // seconds 는 분/초 두 입력으로 갈라 렌더된다(minutesSeconds: true) — 60 을 넘겨 둘 다 채운다.
  timer: { kind: "timer", timerId: "timer1", seconds: 90 },
  timePhase: { kind: "timePhase", phase: "day" },
  season: { kind: "season", season: "spring" },
  npcActivity: { kind: "npcActivity", activity: "work" },
  insideLocation: {
    kind: "insideLocation",
    locationId: firstId(CAPTURE.maps[CONDITION_REFS.mapId]?.locations, "loc_missing"),
    inside: true,
  },
  friendshipAtLeast: { kind: "friendshipAtLeast", npcKey: "npc_condition_probe", value: 200 },
  // CONDITION_KINDS 에 relationshipAtLeast 가 들어왔는데 픽스처가 없어 undefined 가 렌더로
  // 들어갔다 — fork 축이 «컨트롤 0개» 로 죽었다(게이트가 잡은 실측 결함).
  relationshipAtLeast: { kind: "relationshipAtLeast", npcKey: "npc_condition_probe", state: "dating" },
  battleResult: { kind: "battleResult", result: "victory" },
  run: { kind: "run", query: "active", value: true },
  difficulty: { kind: "difficulty", difficultyId: "normal" },
  itemUsed: { kind: "itemUsed", itemId: CONDITION_REFS.itemId },
  all: { kind: "all", conditions: [LEAF_SWITCH] },
  any: { kind: "any", conditions: [LEAF_SWITCH] },
  not: { kind: "not", condition: LEAF_SWITCH },
};

/**
 * 조건 그룹(중첩) 픽스처. labeledGroup 은 자식마다 conditionForm 을 재귀 호출하므로
 * 자식 수와 중첩 깊이가 각각 별개의 렌더 경로다.
 *   - group-all-two / group-any-two : 자식 2개(깊이 1)
 *   - group-all-nested             : all(switch, any(variable, item)) — 깊이 2
 *   - group-not-nested             : not(all(switch, gold)) — not 은 자식 1개만 받으므로
 *                                    중첩으로 깊이를 만든다
 */
export const CONDITION_GROUP_FIXTURES: Readonly<Record<string, Condition>> = {
  "group-all-two": { kind: "all", conditions: [LEAF_SWITCH, LEAF_VARIABLE] },
  "group-any-two": { kind: "any", conditions: [LEAF_SWITCH, LEAF_GOLD] },
  "group-all-nested": {
    kind: "all",
    conditions: [LEAF_SWITCH, { kind: "any", conditions: [LEAF_VARIABLE, LEAF_ITEM] }],
  },
  "group-not-nested": {
    kind: "not",
    condition: { kind: "all", conditions: [LEAF_SWITCH, LEAF_GOLD] },
  },
};

/**
 * run 조건의 query 변형 — 하나의 조건 kind 안에서 폼이 갈리는 유일한 사례다(labeledRun 의
 * `switch (cond.query)`).
 *
 * `query=active` 는 여기 없다 — CONDITION_FIXTURES.run 이 곧 query=active 이고, 넣으면 기준선에
 * 똑같은 표면이 두 번 박힌다(실측으로 잡았다). 비교 계약에서는 `fork:run` 을 active 대표로 끌어와
 * 4종을 전부 대조한다.
 */
export const RUN_QUERY_FIXTURES: Readonly<Record<string, Condition>> = {
  "run.query=floor": { kind: "run", query: "floor", op: ">=", value: 3 },
  "run.query=flag": { kind: "run", query: "flag", flag: "run_flag_probe", value: true },
  "run.query=result": { kind: "run", query: "result", result: "completed" },
};

/**
 * 열거값 변형 — 하나의 command kind 안에서 필드 값에 따라 폼이 갈리는 것만 담는다.
 *
 * 선정 절차(추측이 아니라 측정): 아래 후보 전량을 실제로 렌더해 표면 다이제스트를 비교했고,
 * **같은 kind 안의 변형끼리 표면이 서로 다른 것만** 남겼다. 기각된 후보와 근거는
 * eventEditorConditionSurface.baseline.test.ts 의 REJECTED_ENUM_CANDIDATES 에 적혀 있다.
 *
 * 키 형식: `<kind>:<field>=<value>`
 */
export const ENUM_VARIANT_FIXTURES: Readonly<Record<string, Command>> = {
  // schemaCommandBody: skippable 필드가 `when: (c) => c.mode === "begin"` 이라 mode=end 에서 사라진다.
  "cutsceneControl:mode=begin": { kind: "cutsceneControl", mode: "begin", skippable: true },
  "cutsceneControl:mode=end": { kind: "cutsceneControl", mode: "end" },

  // commandBodyAdvanced runControlBody: `switch (cmd.action)` 로 5개 분기가 서로 다른 필드를 낸다.
  "runControl:action=start": { kind: "runControl", action: "start", seed: 7, startFloor: 1 },
  "runControl:action=advance": { kind: "runControl", action: "advance", amount: 2 },
  "runControl:action=end": { kind: "runControl", action: "end", result: "completed" },
  "runControl:action=setFlag": { kind: "runControl", action: "setFlag", flag: "run_flag", value: true },
  "runControl:action=resetRoom": { kind: "runControl", action: "resetRoom" },

  // commandBodyCore setSwitchBody: syncVisibility 가 변수 피커의 hidden 을 값 종류로 토글한다.
  "setSwitch:value=true": { kind: "setSwitch", switchId: CONDITION_REFS.switchId, value: true },
  "setSwitch:value=toggle": { kind: "setSwitch", switchId: CONDITION_REFS.switchId, value: "toggle" },
  "setSwitch:value=var": {
    kind: "setSwitch",
    switchId: CONDITION_REFS.switchId,
    value: { kind: "var", id: CONDITION_REFS.variableId },
  },

  // commandBodyVariable: initialSource 가 value 의 타입(number | {kind:"var"})으로 갈린다.
  "setVariable:value=number": {
    kind: "setVariable",
    variableId: CONDITION_REFS.variableId,
    op: "=",
    value: 5,
  },
  "setVariable:value=var": {
    kind: "setVariable",
    variableId: CONDITION_REFS.variableId,
    op: "=",
    value: { kind: "var", id: CONDITION_REFS.variableId },
  },

  // commandBodyAdvanced waitBody: currentMode 가 variableId 유무로 갈린다.
  "wait:mode=time": { kind: "wait", ms: 500 },
  "wait:mode=variable": { kind: "wait", ms: 500, variableId: CONDITION_REFS.variableId },

  // commandBodyDatabase: troopSource 가 고정 피커/변수 피커의 가시성을 갈라 놓는다.
  "battleProcessing:troopSource=fixed": {
    kind: "battleProcessing",
    troopId: CONDITION_REFS.troopId,
    canEscape: true,
    canLose: false,
    troopSource: "fixed",
  },
  "battleProcessing:troopSource=variable": {
    kind: "battleProcessing",
    troopId: CONDITION_REFS.troopId,
    canEscape: true,
    canLose: false,
    troopSource: "variable",
    troopVariableId: CONDITION_REFS.variableId,
  },

  // commandBodyDatabase: amountMode 가 flat/percent 세그먼트 + 프리셋 구성을 갈라 놓는다.
  "changeActorHp:amountMode=flat": {
    kind: "changeActorHp",
    actorId: CONDITION_REFS.actorId,
    op: "+=",
    amount: 10,
    amountMode: "flat",
  },
  "changeActorHp:amountMode=percent": {
    kind: "changeActorHp",
    actorId: CONDITION_REFS.actorId,
    op: "+=",
    amount: 10,
    amountMode: "percent",
  },

  // schemaCommandBody f.operand: 숫자/변수 두 위젯을 함께 내고 hidden 으로 갈라 놓는다.
  "changeGold:amount=number": { kind: "changeGold", op: "+=", amount: 100 },
  "changeGold:amount=var": {
    kind: "changeGold",
    op: "+=",
    amount: { kind: "var", id: CONDITION_REFS.variableId },
  },
  "changeItem:amount=number": {
    kind: "changeItem",
    itemId: CONDITION_REFS.itemId,
    op: "+=",
    amount: 1,
  },
  "changeItem:amount=var": {
    kind: "changeItem",
    itemId: CONDITION_REFS.itemId,
    op: "+=",
    amount: { kind: "var", id: CONDITION_REFS.variableId },
  },

  // renderTransferPicker: fade/direction 은 라디오 그룹이라 필드 집합은 같고 **checked 플래그와
  // 요약문**이 갈린다. 즉 "현재 값을 UI 로 되비추는" 경로의 보증이다 — 이게 죽으면 폼을 열 때마다
  // 저장된 페이드/방향이 사라진 것처럼 보인다(실측: 두 변형이 checked 2개 + 요약 1줄에서 갈렸다).
  //
  // 두 족(族) 모두 **기본값을 피해** 고른다. fade 미지정=black, direction 미지정=retain 이므로
  // `fade=black` 과 `direction=retain` 은 서로 완전히 같은 표면이 된다(실측으로 잡았다).
  // 기본값 표면은 폼 축의 `transfer` 항목이 이미 감시한다.
  "transfer:fade=white": {
    kind: "transfer",
    mapId: CONDITION_REFS.mapId,
    x: 1,
    y: 1,
    fade: "white",
  },
  "transfer:fade=none": { kind: "transfer", mapId: CONDITION_REFS.mapId, x: 1, y: 1, fade: "none" },
  "transfer:direction=down": {
    kind: "transfer",
    mapId: CONDITION_REFS.mapId,
    x: 1,
    y: 1,
    direction: "down",
  },
  "transfer:direction=left": {
    kind: "transfer",
    mapId: CONDITION_REFS.mapId,
    x: 1,
    y: 1,
    direction: "left",
  },

  // commandBodyAdvanced learnSkillBody: actionValue 로 미리보기 문구와 gain/loss 클래스가 갈린다.
  "learnSkill:action=learn": {
    kind: "learnSkill",
    actorId: CONDITION_REFS.actorId,
    skillId: CONDITION_REFS.skillId,
    action: "learn",
  },
  "learnSkill:action=forget": {
    kind: "learnSkill",
    actorId: CONDITION_REFS.actorId,
    skillId: CONDITION_REFS.skillId,
    action: "forget",
  },
};

/** fork 껍데기. then/else 를 모든 항목에서 동일하게 고정해 diff 가 조건만 반영하게 한다. */
export function forkWith(condition: Condition): Command {
  return { kind: "fork", condition, then: [], else: [] };
}
