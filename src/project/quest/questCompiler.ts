// project/quest/questCompiler.ts
// QuestDef → 스위치/변수 + 기버 다중 페이지 + 수집물/블로커/게이트/도달 이벤트로 결정적 컴파일.
// emberQuestGame.ts의 chief/herbalist 페이지 구조(제안→진행→턴인→완료)를 템플릿화한다.
// 산출물은 draft(Project)에 직접 적용되며, def는 project.quests에 메타로 보존된다.
// 모든 스위치/변수는 사용 전에 등록되어 projectLint 참조 검증을 통과한다.

import { upsertEventIntoMap } from "@/editor/tools/eventTools";
import { ensureNamedSwitch, ensureNamedVariable } from "@/editor/tools/flagHelpers";
import { resolveGraphic, type GraphicSpec } from "@/editor/tools/eventCompile";
import type { Command, EventPage, EventPageCondition, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
import {
  isValidQuestKey,
  questFlagIds,
  type CollectSource,
  type QuestDef,
  type QuestFlagIds,
  type QuestGate,
  type QuestNpcSpec,
  type QuestStep,
} from "./questDef";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

export interface QuestCompileResult {
  readonly flags: QuestFlagIds;
  readonly eventsCreated: number;
  readonly switchesRegistered: number;
  readonly variablesRegistered: number;
}

export class QuestCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestCompileError";
  }
}

function requireMap(project: Project, mapId: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new QuestCompileError(`퀘스트가 참조하는 맵이 없습니다: ${mapId}`);
  return map;
}

function text(body: string, speaker?: string): Command {
  return speaker ? { kind: "text", speaker, body } : { kind: "text", body };
}

function switchCond(switchId: string, value = true): EventPageCondition {
  return { kind: "switch", switchId, value };
}

function selfSwitchCond(key: "A" | "B" | "C" | "D", value = true): EventPageCondition {
  return { kind: "selfSwitch", key, value };
}

function page(
  id: string,
  name: string,
  conditions: EventPageCondition[],
  commands: Command[],
  graphic: EventPageGraphic,
  options: { trigger?: EventPage["trigger"]["kind"]; priority?: EventPage["priority"] } = {}
): EventPage {
  const trigger = options.trigger ?? "action";
  const priority = options.priority ?? "same";
  return {
    id,
    name,
    conditions,
    graphic,
    trigger: { kind: trigger },
    priority,
    overlapForbidden: priority === "same",
    movement: PASSIVE,
    commands,
  };
}

function event(id: string, x: number, y: number, trigger: GameEvent["trigger"]["kind"], pages: EventPage[]): GameEvent {
  return { id, x, y, trigger: { kind: trigger }, commands: [], pages };
}

function npcGraphic(spec: QuestNpcSpec): EventPageGraphic {
  const graphicSpec: GraphicSpec | undefined =
    spec.textureKey !== undefined && spec.characterIndex !== undefined
      ? { textureKey: spec.textureKey, characterIndex: spec.characterIndex }
      : spec.graphicQuery
        ? { query: spec.graphicQuery }
        : undefined;
  return resolveGraphic(graphicSpec);
}

function graphicFromQuery(query: string | undefined): EventPageGraphic {
  return resolveGraphic(query ? { query } : undefined);
}

// 각 단계의 "완료 조건"과 그 완료를 유발하는 이벤트를 draft에 생성한다.
function materializeStep(
  project: Project,
  def: QuestDef,
  flags: QuestFlagIds,
  step: QuestStep,
  index: number,
  counters: { events: number; variables: number }
): void {
  const stepSwitch = flags.stepSwitches[index];
  switch (step.kind) {
    case "talk": {
      const targetMap = "create" in step.target ? requireMap(project, step.target.create.mapId) : requireMap(project, step.target.mapId);
      if ("create" in step.target) {
        // 대화 대상 NPC 신규 생성.
        const spec = step.target.create;
        const graphic = npcGraphic(spec);
        const id = `ev_${def.key}_talk${index}`;
        const lines = (step.lines ?? [`${spec.name}와 대화했다.`]).map((line) => text(line, spec.name));
        const talkNow = page(`${id}_talk`, spec.name, [switchCond(flags.started)], [
          ...lines,
          { kind: "setSwitch", switchId: stepSwitch, value: true },
          { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
          { kind: "setSelfSwitch", key: "A", value: true },
        ], graphic);
        const already = page(`${id}_done`, spec.name, [selfSwitchCond("A")], [text("고맙네, 잘 부탁하지.", spec.name)], graphic);
        const idle = page(`${id}_idle`, spec.name, [], [text("...", spec.name)], graphic);
        upsertEventIntoMap(targetMap, event(id, spec.x, spec.y, "action", [idle, talkNow, already]));
        counters.events += 1;
      } else {
        // 기존 이벤트에 퀘스트 대화 페이지를 덧붙인다(높은 인덱스가 우선 해석됨).
        const target = targetMap.events.find((entry) => entry.id === (step.target as { eventId: string }).eventId);
        if (!target) throw new QuestCompileError(`talk 대상 이벤트가 없습니다: ${(step.target as { eventId: string }).eventId}`);
        const graphic = target.pages?.[0]?.graphic ?? { transparent: true };
        const lines = (step.lines ?? ["부탁한 일을 확인했다."]).map((line) => text(line));
        target.pages = target.pages ?? [];
        target.pages.push(
          page(`${target.id}_${def.key}_talk${index}`, target.pages[0]?.name ?? "대화", [switchCond(flags.started)], [
            ...lines,
            { kind: "setSwitch", switchId: stepSwitch, value: true },
            { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
            { kind: "setSelfSwitch", key: "A", value: true },
          ], graphic),
          page(`${target.id}_${def.key}_talkdone${index}`, target.pages[0]?.name ?? "대화", [selfSwitchCond("A")], [text("고맙네.")], graphic)
        );
      }
      break;
    }
    case "collect": {
      // 단계 전용 카운트 변수: count에 도달하면 stepSwitch 세팅.
      const countVar = `var_${def.key}_c${index}`;
      ensureNamedVariable(project, countVar, `${def.title} 수집 진행 ${index}`);
      counters.variables += 1;
      step.sources.forEach((source, sourceIndex) => {
        materializeCollectSource(project, def, flags, step.itemId, step.count, countVar, stepSwitch, source, index, sourceIndex, counters);
      });
      break;
    }
    case "kill": {
      // 전투 블로커: 클리어 스위치를 stepSwitch로 직접 사용.
      const map = requireMap(project, step.at.mapId);
      const id = `ev_${def.key}_kill${index}`;
      const graphic = graphicFromQuery(step.at.graphicQuery ?? "몬스터");
      const intro = (step.at.intro ?? ["적이 앞을 가로막았다!"]).map((line) => text(line));
      const victory = (step.at.victory ?? ["길이 열렸다."]).map((line) => text(line));
      const fight = page(`${id}_fight`, "전투", [switchCond(flags.started)], [
        ...intro,
        { kind: "battleProcessing", troopId: step.troopId, canEscape: true, canLose: false },
        { kind: "setSwitch", switchId: stepSwitch, value: true },
        { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
        ...victory,
      ], graphic);
      const cleared = page(`${id}_cleared`, "정리된 자리", [switchCond(stepSwitch)], [], { transparent: true }, { priority: "below" });
      const idle = page(`${id}_idle`, "휴식", [], [text("아직은 조용하다.")], graphic);
      upsertEventIntoMap(map, event(id, step.at.x, step.at.y, "action", [idle, fight, cleared]));
      counters.events += 1;
      break;
    }
    case "reach": {
      const map = requireMap(project, step.mapId);
      const id = `ev_${def.key}_reach${index}`;
      const arrive = page(`${id}_arrive`, "도착", [switchCond(flags.started)], [
        { kind: "setSwitch", switchId: stepSwitch, value: true },
        { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
      ], { transparent: true }, { trigger: "playerTouch", priority: "below" });
      upsertEventIntoMap(map, event(id, step.x, step.y, "playerTouch", [arrive]));
      counters.events += 1;
      break;
    }
  }
}

function materializeCollectSource(
  project: Project,
  def: QuestDef,
  flags: QuestFlagIds,
  itemId: string,
  count: number,
  countVar: string,
  stepSwitch: string,
  source: CollectSource,
  stepIndex: number,
  sourceIndex: number,
  counters: { events: number; variables: number }
): void {
  const map = requireMap(project, source.mapId);
  // count 도달 시 stepSwitch를 세우는 공통 커맨드.
  const grantAndCheck: Command[] = [
    { kind: "changeItem", itemId, op: "+=", amount: 1 },
    { kind: "setVariable", variableId: countVar, op: "+=", value: 1 },
    {
      kind: "fork",
      condition: { kind: "variable", variableId: countVar, op: ">=", value: count },
      then: [
        { kind: "setSwitch", switchId: stepSwitch, value: true },
        { kind: "setVariable", variableId: flags.progress, op: "+=", value: 1 },
      ],
    },
  ];
  if (source.kind === "pickup") {
    const id = `ev_${def.key}_pick${stepIndex}_${sourceIndex}`;
    const look = page(`${id}_look`, "빛나는 것", [], [text(source.lookText ?? "무언가 반짝인다.")], { transparent: true }, {
      trigger: "action",
      priority: "below",
    });
    const pick = page(`${id}_pick`, "습득", [switchCond(flags.started)], [
      text("조심스럽게 손에 넣었다."),
      ...grantAndCheck,
      { kind: "setSelfSwitch", key: "A", value: true },
    ], { transparent: true }, { priority: "below" });
    const empty = page(`${id}_empty`, "빈 자리", [selfSwitchCond("A")], [], { transparent: true }, { priority: "below" });
    upsertEventIntoMap(map, event(id, source.x, source.y, "action", [look, pick, empty]));
    counters.events += 1;
  } else {
    // drop: 전투 블로커가 승리 시 아이템 지급 + 카운트.
    const id = `ev_${def.key}_drop${stepIndex}_${sourceIndex}`;
    const graphic = graphicFromQuery(source.graphicQuery ?? "몬스터");
    const clearSwitch = `sw_${def.key}_drop${stepIndex}_${sourceIndex}`;
    ensureNamedSwitch(project, clearSwitch, `${def.title} 전투 처치 ${stepIndex}-${sourceIndex}`);
    const fight = page(`${id}_fight`, "전투", [switchCond(flags.started)], [
      text("적이 나타났다!"),
      { kind: "battleProcessing", troopId: source.troopId, canEscape: true, canLose: false },
      { kind: "setSwitch", switchId: clearSwitch, value: true },
      ...grantAndCheck,
    ], graphic);
    const cleared = page(`${id}_cleared`, "정리됨", [switchCond(clearSwitch)], [], { transparent: true }, { priority: "below" });
    const idle = page(`${id}_idle`, "휴식", [], [text("조용하다.")], graphic);
    upsertEventIntoMap(map, event(id, source.x, source.y, "action", [idle, fight, cleared]));
    counters.events += 1;
  }
}

// 기버 NPC의 제안/진행/턴인/완료 페이지를 조립한다.
function buildGiverEvent(project: Project, def: QuestDef, flags: QuestFlagIds): GameEvent {
  const isCreate = "create" in def.giver;
  const spec = isCreate ? (def.giver as { create: QuestNpcSpec }).create : null;
  const map = requireMap(project, isCreate ? spec!.mapId : (def.giver as { mapId: string }).mapId);
  const graphic: EventPageGraphic = isCreate ? npcGraphic(spec!) : (findGiverGraphic(map, (def.giver as { eventId: string }).eventId) ?? { transparent: true });
  const giverName = isCreate ? spec!.name : "의뢰인";
  const id = isCreate ? `ev_${def.key}_giver` : (def.giver as { eventId: string }).eventId;

  // 턴인 조건: 모든 stepSwitch가 true → 보상 지급 + done.
  const rewardCommands: Command[] = [];
  if (def.rewards?.gold) rewardCommands.push({ kind: "changeGold", op: "+=", amount: def.rewards.gold });
  for (const reward of def.rewards?.items ?? []) rewardCommands.push({ kind: "changeItem", itemId: reward.itemId, op: "+=", amount: reward.count });
  rewardCommands.push({ kind: "setSwitch", switchId: flags.done, value: true });
  rewardCommands.push(text(`의뢰 '${def.title}'을 완수했다!`, giverName));

  // 모든 단계 완료 여부를 중첩 fork로 검사.
  const allDone: Command = flags.stepSwitches.reduceRight<Command>(
    (inner, switchId) => ({
      kind: "fork",
      condition: { kind: "switch", switchId, value: true },
      then: [inner],
      else: [text("아직 할 일이 남은 것 같군.", giverName)],
    }),
    { kind: "fork", condition: { kind: "switch", switchId: flags.done, value: false }, then: rewardCommands } as Command
  );

  const proposal = page(`${id}_offer`, giverName, [], [
    text(def.summary, giverName),
    {
      kind: "choices",
      prompt: `의뢰 '${def.title}'을 수락할까요?`,
      options: [
        { text: "수락한다", branch: [{ kind: "setSwitch", switchId: flags.started, value: true }, text("고맙네! 잘 부탁하지.", giverName)] },
        { text: "다음에", branch: [text("마음이 바뀌면 다시 오게.", giverName)] },
      ],
      cancelBehavior: "choice2",
    },
  ], graphic);
  const active = page(`${id}_active`, giverName, [switchCond(flags.started)], [allDone], graphic);
  const done = page(`${id}_done`, giverName, [switchCond(flags.done)], [text("자네 덕분에 살았어. 정말 고맙네.", giverName)], graphic);

  if (isCreate) {
    const giverEvent = event(id, spec!.x, spec!.y, "action", [proposal, active, done]);
    upsertEventIntoMap(map, giverEvent);
    return giverEvent;
  }
  // 기존 이벤트에 페이지 병합.
  const existing = map.events.find((entry) => entry.id === id);
  if (!existing) throw new QuestCompileError(`기버 이벤트가 없습니다: ${id}`);
  existing.pages = [...(existing.pages ?? []), proposal, active, done];
  return existing;
}

function findGiverGraphic(map: GameMap, eventId: string): EventPageGraphic | null {
  const target = map.events.find((entry) => entry.id === eventId);
  return target?.pages?.[0]?.graphic ?? null;
}

// 게이트: 특정 단계 완료 전까지 lockedText로 막고, 완료 후 통과 가능(투명·하단).
function buildGate(project: Project, def: QuestDef, flags: QuestFlagIds, gate: QuestGate, gateIndex: number): void {
  const map = requireMap(project, gate.mapId);
  const stepSwitch = flags.stepSwitches[gate.requiresStep];
  if (!stepSwitch) throw new QuestCompileError(`gate.requiresStep 범위 오류: ${gate.requiresStep}`);
  const id = `ev_${def.key}_gate${gateIndex}`;
  const locked = page(`${id}_locked`, "잠긴 길", [], [text(gate.lockedText)], { transparent: true }, { trigger: "playerTouch", priority: "same" });
  const open = page(`${id}_open`, "열린 길", [switchCond(stepSwitch)], [], { transparent: true }, { trigger: "playerTouch", priority: "below" });
  upsertEventIntoMap(map, event(id, gate.x, gate.y, "playerTouch", [locked, open]));
}

// QuestDef를 draft에 컴파일한다.
export function compileQuest(project: Project, def: QuestDef): QuestCompileResult {
  if (!isValidQuestKey(def.key)) throw new QuestCompileError(`questKey는 영문/숫자/밑줄만 허용합니다: ${def.key}`);
  if (def.steps.length === 0) throw new QuestCompileError("퀘스트에는 최소 1개의 단계가 필요합니다.");
  const flags = questFlagIds(def.key, def.steps.length);

  // 1) 플래그 등록.
  ensureNamedSwitch(project, flags.started, `${def.title} 시작`);
  ensureNamedSwitch(project, flags.done, `${def.title} 완료`);
  ensureNamedVariable(project, flags.progress, `${def.title} 진행도`);
  for (let i = 0; i < flags.stepSwitches.length; i += 1) {
    ensureNamedSwitch(project, flags.stepSwitches[i], `${def.title} 단계 ${i}`);
  }
  let switchesRegistered = 2 + flags.stepSwitches.length;

  const counters = { events: 0, variables: 1 };

  // 2) 단계별 이벤트/조건 생성.
  def.steps.forEach((step, index) => materializeStep(project, def, flags, step, index, counters));

  // 3) 기버 페이지.
  buildGiverEvent(project, def, flags);
  counters.events += 1;

  // 4) 게이트.
  (def.gates ?? []).forEach((gate, index) => {
    buildGate(project, def, flags, gate, index);
    counters.events += 1;
  });

  // 5) 메타 보존.
  project.quests = [...(project.quests ?? []).filter((quest) => quest.key !== def.key), def];

  // drop 소스가 만든 클리어 스위치까지 대략 반영(정확 카운트는 중요치 않음).
  switchesRegistered += def.steps.filter((step) => step.kind === "collect").reduce((sum, step) => sum + (step.kind === "collect" ? step.sources.filter((s) => s.kind === "drop").length : 0), 0);

  return { flags, eventsCreated: counters.events, switchesRegistered, variablesRegistered: counters.variables };
}
