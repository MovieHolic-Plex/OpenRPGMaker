import { withOpenEventDrafts } from "@/ai/smallTaskReferences";
import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { projectSwitchVariableReferenceMessage } from "@/editor/databaseRecordReferences";
import { eventCommandBranches, type EventCommandBranch } from "@/editor/eventCommandBranches";
import { newCommand } from "@/editor/eventCommandFactory";
import { shortRecordName } from "@/editor/shortRecordName";
import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import type { JsonSchema } from "@/editor/tools/types";
import { COMPANION_SCENE_FLAG } from "@/player/playSceneFollowers";
import { NEW_GAME_PLUS_SESSION_FLAG } from "@/project/conditionActorQueries";
import { compareVariableValue } from "@/project/conditionEvaluation";
import { eventCommandHash, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { OPENING_STAGE_FLAG_PREFIX } from "@/project/openingStage";
import { VARIABLE_MAX, VARIABLE_MIN } from "@/project/session";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import type { BattleEventCondition, Command, GameEvent, GameMap, Project, SwitchDef, VariableDef } from "@/project/types";
import { roJosa, withJosa } from "@/util/josa";
import { displayText } from "../../target";
import { commandListAt, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError, STALE_COMMAND_LIST } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "03-cmd-switch-var";

type Args = Record<string, unknown>;
type StateKind = "setSwitch" | "setVariable" | "setSelfSwitch" | "setFlag";
type StateCommand = Extract<Command, { kind: StateKind }>;
type VariableCommand = Extract<StateCommand, { kind: "setVariable" }>;
type SelfSwitchCommand = Extract<StateCommand, { kind: "setSelfSwitch" }>;
type SelfSwitchValues = Partial<Record<SelfSwitchCommand["key"], boolean>>;
type ConditionMatch = boolean | undefined;
type PageScope = Extract<SmallTaskScope, { kind: "eventPage" }>;

const selfSwitchKeys = ["A", "B", "C", "D"] as const;

const variableActions = {
  "=": (name: string, value: string) => `${name}에 ${withJosa(value, "을/를")} 저장합니다.`,
  "+=": (name: string, value: string) => `${name} 값에 ${withJosa(value, "을/를")} 더합니다.`,
  "-=": (name: string, value: string) => `${name} 값에서 ${withJosa(value, "을/를")} 뺍니다.`,
  "*=": (name: string, value: string) => `${name} 값에 ${withJosa(value, "을/를")} 곱합니다.`,
  "/=": (name: string, value: string) => `${name} 값을 ${value}${/[036]$/u.test(value) ? "으로" : roJosa(value)} 나눕니다.`,
} satisfies Record<VariableCommand["op"], (name: string, value: string) => string>;

const recordField = (label: string): JsonSchema => ({
  type: "string", minLength: 1, description: `자료집에 있는 ${label}의 정확한 이름 또는 식별자.`,
});
const booleanValue: JsonSchema = { type: "boolean", description: "켜기는 참, 끄기는 거짓." };
const sourceField: JsonSchema = {
  ...recordField("원본 변수"),
  description: "사용할 값을 읽을 변수의 정확한 이름 또는 식별자. 고정값과 함께 지정할 수 없습니다.",
};
const fields = {
  setSwitch: {
    switchId: recordField("스위치"),
    value: {
      type: ["boolean", "string"],
      oneOf: [booleanValue, { type: "string", enum: ["toggle"], description: "현재 상태를 반전합니다." }],
      description: "켜기는 참, 끄기는 거짓, 반전은 문자열 toggle. 삽입할 때 기본은 켜기.",
    },
    operandVariableId: sourceField,
  },
  setVariable: {
    variableId: recordField("변수"),
    op: { type: "string", enum: Object.keys(variableActions), description: "대입, 더하기, 빼기, 곱하기, 나누기의 연산 기호. 기본은 대입." },
    value: { type: "number", description: "계산에 쓸 숫자. -9,999,999부터 9,999,999까지 입력할 수 있습니다. 추가할 때 기본은 0입니다." },
    operandVariableId: sourceField,
  },
  setSelfSwitch: {
    key: { type: "string", enum: [...selfSwitchKeys], description: "이 이벤트의 셀프 스위치 문자. 삽입할 때 기본은 A." },
    value: booleanValue,
  },
  setFlag: {
    flag: { type: "string", minLength: 1, description: "옛 기억의 새 이름. 다른 곳에서 쓰는 기억은 이름을 바꿀 수 없습니다." },
    value: booleanValue,
  },
} satisfies Record<StateKind, Record<string, JsonSchema>>;

function selectedPage(ctx: PrimitiveContext) {
  const selected = scopedPage(ctx);
  const { map, event, page } = selected;
  if (ctx.target.kind !== "event" || map.id !== ctx.target.mapId) {
    throw new PrimitiveError("선택한 지도 정보를 확인할 수 없습니다. 이벤트를 다시 골라 주세요.");
  }
  if (map.events.filter(entry => entry.id === event.id).length !== 1 ||
      event.pages!.filter(entry => entry.id === page.id).length !== 1) {
    throw new PrimitiveError("이벤트나 페이지의 식별자가 겹쳐 수정할 대상을 하나로 정할 수 없습니다.");
  }
  return selected;
}

function pageScope(ctx: PrimitiveContext): PageScope {
  const { map, event, page } = selectedPage(ctx);
  return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
}

function recordId(records: readonly (SwitchDef | VariableDef)[], input: string, label: string): string {
  const name = input.trim();
  if (!name) throw new PrimitiveError(`${label} 이름을 입력하세요.`);
  if (records.some(record => record.id === input)) return input;
  if (records.some(record => record.id === name)) return name;
  const matches = records.filter(record => record.id.trim() && record.name.trim() === name);
  if (matches.length === 1) return matches[0]!.id;
  if (matches.length > 1) throw new PrimitiveError(`같은 이름의 ${label} 항목이 여럿 있습니다. 자료집에서 대상을 확인하세요.`);
  throw new PrimitiveError(`범위 밖입니다. 등록된 ${label} 항목이 없어서 이 페이지에서 새로 만들 수 없습니다.`);
}

function isEngineFlag(flag: string): boolean {
  return typeof flag === "string" && (flag === NEW_GAME_PLUS_SESSION_FLAG || flag === COMPANION_SCENE_FLAG ||
    flag.startsWith(OPENING_STAGE_FLAG_PREFIX) || flag.startsWith("cutscene:"));
}

function projectViewsWithOpenDrafts(ctx: PrimitiveContext, project: Project): Project[] {
  const working = withOpenEventDrafts(project, ctx.live, ctx.target.kind === "event" ? ctx.target : undefined);
  const saved = projectViewWithoutEventDrafts(working);
  return saved === working ? [working] : [working, saved];
}

function validateFlagRename(ctx: PrimitiveContext, previous: string, next: string): void {
  const { project } = ctx;
  const isUsedByGame = (flag: string) => Object.hasOwn(project.flags, flag) || isEngineFlag(flag);
  if (isUsedByGame(previous) || isUsedByGame(next)) {
    throw new PrimitiveError("게임이 사용하는 기억 이름은 바꾸거나 새 이름으로 쓸 수 없습니다.");
  }
  if (projectViewsWithOpenDrafts(ctx, project).some(view => {
    let previousUses = 0;
    let nextUsed = false;
    visitProjectCommands(view, ({ command }) => {
      if (command.kind !== "setFlag") return;
      if (command.flag === previous) previousUses++;
      if (command.flag === next) nextUsed = true;
    });
    return previousUses > 1 || nextUsed;
  })) {
    throw new PrimitiveError("이 기억 이름을 다른 명령에서도 쓰고 있어 바꿀 수 없습니다.");
  }
}

function canRunLegacyCommands(event: GameEvent): boolean {
  // 맵 이벤트 호출도 활성 페이지가 없을 때만 최상위 명령으로 돌아간다.
  return !event.pages?.some(page => page.conditions.length === 0);
}

function branchEnabled(command: Command, branch: EventCommandBranch): boolean {
  switch (command.kind) {
    case "choices": return branch.kind !== "choiceCancel" || command.cancelBehavior === "branch";
    case "shop": return branch.kind === "shopTransaction"
      ? command.branchOnTransaction === true : command.branchOnFailedTransaction === true;
    case "inn": return command.branchOnNotEnoughGold === true;
    case "battleProcessing": return command.branchOnResult === true;
    default: return true;
  }
}

function allMatch(results: readonly ConditionMatch[]): ConditionMatch {
  return results.includes(false) ? false : results.includes(undefined) ? undefined : true;
}

function matchCondition(
  condition: BattleEventCondition | undefined,
  matchLeaf: (condition: BattleEventCondition) => ConditionMatch,
): ConditionMatch {
  if (condition === undefined) return undefined;
  switch (condition.kind) {
    case "all": return allMatch(condition.conditions.map(child => matchCondition(child, matchLeaf)));
    case "any": {
      const results = condition.conditions.map(child => matchCondition(child, matchLeaf));
      return results.includes(true) ? true : results.includes(undefined) ? undefined : false;
    }
    case "not": {
      const result = matchCondition(condition.condition, matchLeaf);
      return result === undefined ? undefined : !result;
    }
    default: return matchLeaf(condition);
  }
}

function sharedSelfSwitchValues(states: readonly SelfSwitchValues[]): SelfSwitchValues {
  const known = { ...states[0] };
  for (const key of selfSwitchKeys) {
    if (states.some(values => values[key] !== known[key])) delete known[key];
  }
  return known;
}

function validateSelfSwitchChange(project: Project, map: GameMap, event: GameEvent, current: SelfSwitchCommand, next: SelfSwitchCommand): void {
  if (current.key === next.key && current.value === next.value) return;
  function readsKey(condition: BattleEventCondition | undefined): boolean {
    switch (condition?.kind) {
      case "selfSwitch": return condition.key === current.key;
      case "all":
      case "any": return condition.conditions.some(readsKey);
      case "not": return readsKey(condition.condition);
      default: return false;
    }
  }

  function matchSelfSwitch(condition: BattleEventCondition | undefined, known: SelfSwitchValues): ConditionMatch {
    return matchCondition(condition, leaf => {
      if (leaf.kind !== "selfSwitch" || known[leaf.key] === undefined) return undefined;
      return known[leaf.key] === leaf.value;
    });
  }

  let linked = readsKey(event.condition);
  let hasReplacementWrite = false;
  const calledLists = new Set<readonly Command[]>();
  function visitCall(commands: readonly Command[]): void {
    if (calledLists.has(commands)) return;
    calledLists.add(commands);
    visit(commands, false, {});
  }
  function visit(commands: readonly Command[], canReplace: boolean, initial: SelfSwitchValues): SelfSwitchValues {
    let known = { ...initial };
    for (const command of commands) {
      if (command.kind === "setSelfSwitch") {
        if (canReplace && command.key === current.key && command.value === current.value) hasReplacementWrite = true;
        known[command.key] = command.value;
      }
      if (command.kind === "fork" && readsKey(command.condition)) linked = true;
      if (command.kind === "choices" && command.options.some(option => readsKey(option.showWhen) || readsKey(option.enableWhen))) linked = true;
      // 호출된 명령은 호출한 이벤트의 셀프 스위치를 읽는다.
      if (!linked && command.kind === "callCommonEvent") {
        const common = project.commonEvents.find(entry => entry.id === command.commonEventId);
        if (common) visitCall(common.commands);
      }
      if (!linked && command.kind === "callMapEvent") {
        const called = map.events.find(entry => entry.id === command.eventId);
        if (called) {
          if (canRunLegacyCommands(called)) visitCall(called.commands);
          for (const page of called.pages ?? []) visitCall(page.commands);
        }
      }
      if (!linked && command.kind === "battleProcessing") {
        // 부대의 전투 이벤트도 전투를 시작한 이벤트의 셀프 스위치를 읽는다.
        for (const troop of project.database.troops) {
          if (command.troopSource !== "variable" && troop.id !== command.troopId) continue;
          for (const page of troop.battleEventPages ?? []) {
            linked ||= page.conditions.some(readsKey);
            if (!linked) visitCall(page.commands);
          }
        }
      }
      // Called commands and scripts can change the caller's self-switches.
      if (command.kind === "callCommonEvent" || command.kind === "callMapEvent"
          || command.kind === "script" || command.kind === "battleProcessing" || command.kind === "gotoLabel") known = {};
      const forkMatch = command.kind === "fork" ? matchSelfSwitch(command.condition, known) : undefined;
      const outcomes: SelfSwitchValues[] = [];
      const branches = eventCommandBranches(command);
      for (const branch of branches) {
        if (!branchEnabled(command, branch)) continue;
        let reachable = forkMatch === undefined || forkMatch === (branch.kind === "forkThen");
        if (reachable && command.kind === "choices" && branch.kind === "choiceOption") {
          const option = command.options[branch.branchIndex]!;
          reachable = matchSelfSwitch(option.showWhen, known) !== false && matchSelfSwitch(option.enableWhen, known) !== false;
        }
        const result = visit(branch.commands, canReplace && reachable, command.kind === "loop" ? {} : known);
        if (reachable) outcomes.push(result);
      }
      if (outcomes.length) {
        // Keep only values shared by every possible continuation of the list.
        if (command.kind !== "fork" || (forkMatch === undefined && !command.else)) outcomes.push(known);
        known = sharedSelfSwitchValues(outcomes);
      }
    }
    return known;
  }
  // The four self-switches have eight possible states before the write being replaced.
  let remainingStates: SelfSwitchValues[] = [{ [current.key]: !current.value }];
  for (const key of selfSwitchKeys) {
    if (key !== current.key) remainingStates = remainingStates.flatMap(values => [
      { ...values, [key]: false }, { ...values, [key]: true },
    ]);
  }
  for (const page of [...(event.pages ?? [])].reverse()) {
    linked ||= page.conditions.some(readsKey);
    const matches = remainingStates.map(values => allMatch(page.conditions.map(condition => matchSelfSwitch(condition, values))));
    const pageStates = remainingStates.filter((_, index) => matches[index] !== false);
    visit(page.commands, pageStates.length > 0, sharedSelfSwitchValues(pageStates));
    // Lower-priority pages can run only if this page might fail to match.
    remainingStates = remainingStates.filter((_, index) => matches[index] !== true);
  }
  if (linked && !hasReplacementWrite) {
    throw new PrimitiveError(`이 이벤트의 다른 페이지나 명령에서 셀프 스위치 ${current.key}를 조건으로 써서 이 줄을 바꿀 수 없습니다.`);
  }
}

function withoutInactiveLegacyCommands(project: Project): Project {
  const maps = { ...project.maps };
  for (const [mapId, map] of Object.entries(project.maps)) {
    if (!map.events.some(event => event.commands.length && !canRunLegacyCommands(event))) continue;
    maps[mapId] = {
      ...map,
      events: map.events.map(event => canRunLegacyCommands(event) ? event : { ...event, commands: [] }),
    };
  }
  return { ...project, maps };
}

function validateStateRetarget(ctx: PrimitiveContext, edited: Project, current: StateCommand, next: StateCommand): void {
  const previous = current.kind === "setSwitch" && next.kind === "setSwitch" && current.switchId !== next.switchId
    ? { kind: "switch", id: current.switchId } as const
    : current.kind === "setVariable" && next.kind === "setVariable" && current.variableId !== next.variableId
      ? { kind: "variable", id: current.variableId } as const : undefined;
  if (!previous) return;
  const { kind, id } = previous;
  if (projectViewsWithOpenDrafts(ctx, edited).some(view => {
    const project = withoutInactiveLegacyCommands(view);
    const index = buildStoryFlagUsageIndex(project);
    const { reads, writes } = Object.hasOwn(kind === "switch" ? index.switches : index.variables, id.trim())
      ? usageBucketFor(index, kind, id.trim()) : { reads: [], writes: [] };
    const matchInitialValue = (leaf: BattleEventCondition): ConditionMatch => {
      if (kind === "switch" && leaf.kind === "switch" && leaf.switchId === id) {
        return (project.session.switches?.[id] ?? false) === leaf.value;
      }
      if (kind === "variable" && leaf.kind === "variable" && leaf.variableId === id) {
        return compareVariableValue(project.session.variables?.[id] ?? 0, leaf.op, leaf.value);
      }
      return undefined;
    };
    const hasReachableWriter = writes.some(site => {
      if (site.pageNumber === undefined) return true;
      const map = site.mapId === undefined ? undefined : project.maps[site.mapId];
      const event = map?.events.find(row => row.id === site.eventId);
      const pageIndex = site.pageNumber - 1;
      const page = site.source === "troop-event"
        ? project.database.troops.find(troop => troop.id === site.troopId)?.battleEventPages?.[pageIndex]
        : event?.pages?.[pageIndex];
      // A page that needs the flag to change first cannot supply its first write.
      return !page?.conditions.some(condition => matchCondition(condition, matchInitialValue) === false);
    });
    if (hasReachableWriter) return false;
    const field = kind === "switch" ? "switchId" : "variableId";
    return reads.length > 0 || index.scriptDynamic[kind].read || projectSwitchVariableReferenceMessage(project, kind, id) ||
      project.endings?.some(ending => ending.conditions.some(condition =>
        kind === "switch" ? condition.kind === "switch" && condition.switchId === id
          : condition.kind === "variable" && condition.variableId === id)) ||
      Object.values(project.maps).some(map => map.encounterTable?.some(entry => entry.conditions?.[field] === id));
  })) {
    const label = kind === "switch" ? "스위치를 확인" : "변수 값을 읽";
    throw new PrimitiveError(`다른 곳에서 기존 ${label}는데 값을 바꾸는 명령이 이 줄뿐입니다.`);
  }
}

function commandFromArgs(ctx: PrimitiveContext, current: StateCommand, args: Args): StateCommand {
  const { project } = ctx;
  const { value, operandVariableId } = args;
  if (value !== undefined && operandVariableId !== undefined) {
    throw new PrimitiveError("값을 직접 입력하거나 다른 변수에서 가져오는 방법 중 하나만 골라 주세요.");
  }
  const operand = operandVariableId === undefined ? undefined : {
    kind: "var" as const,
    id: recordId(project.variables, operandVariableId as string, "변수"),
  };
  switch (current.kind) {
    case "setSwitch":
      return {
        ...current,
        switchId: args.switchId === undefined ? current.switchId : recordId(project.switches, args.switchId as string, "스위치"),
        value: operand ?? (value as boolean | "toggle" | undefined) ?? current.value,
      };
    case "setVariable":
      if (typeof value === "number" && (value < VARIABLE_MIN || value > VARIABLE_MAX)) {
        throw new PrimitiveError("숫자는 -9,999,999부터 9,999,999까지 입력하세요.");
      }
      return {
        ...current,
        variableId: args.variableId === undefined ? current.variableId : recordId(project.variables, args.variableId as string, "변수"),
        op: (args.op as VariableCommand["op"] | undefined) ?? current.op,
        value: operand ?? (value as number | undefined) ?? current.value,
      };
    case "setSelfSwitch":
      return { ...current, key: (args.key as typeof current.key | undefined) ?? current.key, value: (value as boolean | undefined) ?? current.value };
    case "setFlag": {
      const flag = (args.flag as string | undefined) ?? current.flag;
      if (typeof flag !== "string" || !flag.trim()) throw new PrimitiveError("기억 이름을 입력하세요.");
      if (Object.hasOwn(Object.prototype, flag)) throw new PrimitiveError("이 이름은 기억에 사용할 수 없습니다.");
      if (flag !== current.flag) validateFlagRename(ctx, current.flag, flag);
      if (typeof (value ?? current.value) !== "boolean") throw new PrimitiveError("기억을 켤지 끌지 지정하세요.");
      if (value !== undefined && value !== current.value && isEngineFlag(current.flag)) {
        throw new PrimitiveError("게임이 제어하는 기억의 켜짐 상태는 바꿀 수 없습니다.");
      }
      return { ...current, flag, value: (value as boolean | undefined) ?? current.value };
    }
  }
}

const unusedIds = new Set<string>();

function recordIds(records: readonly (SwitchDef | VariableDef)[]): Set<string> {
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  for (const { id } of records) {
    if (!id.trim() || Object.hasOwn(Object.prototype, id) || duplicates.has(id)) continue;
    if (ids.delete(id)) duplicates.add(id);
    else ids.add(id);
  }
  return ids;
}

function validateCommand(project: Project, command: StateCommand): void {
  try {
    validateCommandArray("명령", [command]);
  } catch {
    throw new PrimitiveError("명령에 넣을 값의 형식을 확인하세요.");
  }
  if (command.kind !== "setSwitch" && command.kind !== "setVariable") return;
  if (command.kind === "setVariable" && (
    !Object.hasOwn(variableActions, command.op) || (typeof command.value === "number" && !Number.isFinite(command.value))
  )) {
    throw new PrimitiveError("변수의 계산 방법과 숫자를 확인하세요.");
  }
  if (command.kind === "setVariable" && command.op === "/=" && command.value === 0) {
    throw new PrimitiveError("0으로 나눌 수 없습니다. 나누는 수를 바꿔 주세요.");
  }
  // 이 두 명령의 참조 검증은 스위치와 변수만 읽는다.
  const context: ReferenceContext = {
    switchIds: recordIds(project.switches),
    variableIds: recordIds(project.variables),
    actorIds: unusedIds, classIds: unusedIds, enemyIds: unusedIds, itemIds: unusedIds, equipmentIds: unusedIds,
    skillIds: unusedIds, animationIds: unusedIds, commonEventIds: unusedIds, endingIds: unusedIds,
    mapIds: unusedIds, troopIds: unusedIds, speciesIds: unusedIds, resourceIds: unusedIds,
  };
  try {
    validateCommands([command], context);
  } catch {
    throw new PrimitiveError("스위치나 변수를 자료집에서 찾을 수 없습니다. 이름과 식별자가 겹치지 않는지 확인해 주세요.");
  }
}

function displayName(records: readonly (SwitchDef | VariableDef)[], id: string, label: string): string {
  const name = records.find(record => record.id === id)?.name ?? "";
  const safe = displayText(name === id ? "" : shortRecordName(name).replace(/[{}\[\]]/gu, ""), label);
  return safe.length > 22 ? `${safe.slice(0, 21)}…` : safe;
}

function describeCommand(project: Project, command: StateCommand, current: StateCommand): string {
  const onOff = (value: boolean) => value ? "켭니다." : "끕니다.";
  const variable = (id: string) => displayName(project.variables, id, "변수");
  switch (command.kind) {
    case "setSwitch": {
      const name = displayName(project.switches, command.switchId, "스위치");
      if (typeof command.value === "object") {
        return `『${variable(command.value.id)}』 값에 따라 『${name}』 스위치를 켜거나 끕니다.`;
      }
      return `『${name}』 스위치를 ${command.value === "toggle" ? "현재 상태와 반대로 바꿉니다." : onOff(command.value)}`;
    }
    case "setVariable": {
      const value = typeof command.value === "number" ? String(command.value) : `『${variable(command.value.id)}』 값`;
      return variableActions[command.op](`『${variable(command.variableId)}』 변수`, value);
    }
    case "setSelfSwitch":
      return `이 이벤트의 셀프 스위치 ${command.key}를 ${onOff(command.value)}`;
    case "setFlag": {
      if (current.kind === "setFlag" && current.flag !== command.flag) {
        return `이전 방식의 기억 이름을 ${current.value === command.value ? "바꿉니다." : `바꾸고 ${onOff(command.value)}`}`;
      }
      return `이전 방식의 기억을 ${onOff(command.value)}`;
    }
  }
}

// 한 번에 복제한 명령 목록은 공유 배열도 그대로 공유하므로, 자식 목록을 수정하기 전에 확인한다.
function hasSharedList(root: readonly Command[], target: readonly Command[]): boolean {
  let count = 0;
  function visit(commands: readonly Command[]): boolean {
    if (commands === target && ++count > 1) return true;
    return commands.some(command => eventCommandBranches(command).some(branch => visit(branch.commands)));
  }
  return visit(root);
}

function prepareCommand(ctx: PrimitiveContext, args: Args, kind: StateKind, update: boolean) {
  const { map, event, page } = selectedPage(ctx);
  if (kind === "setSelfSwitch" && Object.hasOwn(Object.prototype, event.id)) {
    throw new PrimitiveError("이 이벤트에는 셀프 스위치를 쓸 수 없습니다. 이벤트 식별자를 확인해 주세요.");
  }
  if (kind === "setSelfSwitch" && Object.entries(ctx.project.maps).some(([id, other]) => id !== map.id && other.events.some(entry => entry.id === event.id))) {
    throw new PrimitiveError("다른 지도에 같은 식별자의 이벤트가 있어 두 이벤트의 셀프 스위치가 함께 바뀝니다.");
  }
  const branchPath = (args.branchPath as number[] | undefined) ?? [];
  const list = commandListAt(page, branchPath);
  if (branchPath.length && hasSharedList(page.commands, list)) {
    throw new PrimitiveError("여러 분기가 같은 명령 목록을 쓰고 있어 이 분기만 고칠 수 없습니다.");
  }
  const index = (args.index as number | undefined) ?? list.length;
  if (!Number.isSafeInteger(index) || index < 0 || (!update && index > list.length)) {
    throw new PrimitiveError("명령 줄을 찾을 수 없습니다. 페이지를 다시 확인하세요.");
  }
  const current = update ? list[index] : newCommand(kind);
  if (update && (!current || args.expectedHash !== eventCommandHash(current))) {
    throw new PrimitiveError(STALE_COMMAND_LIST);
  }
  if (current?.kind !== kind) throw new PrimitiveError("선택한 줄에서 같은 종류의 명령을 찾을 수 없습니다.");
  const command = commandFromArgs(ctx, current, args);
  validateCommand(ctx.project, command);
  return { path: [...branchPath, index], current, command };
}

function primitive(kind: StateKind, name: string, update: boolean): SmallTaskPrimitive {
  const required = update ? ["index", "expectedHash"] : kind === "setSwitch" ? ["switchId"] : kind === "setVariable" ? ["variableId"] : [];
  return {
    id: `cmd.${kind}.${update ? "update" : "insert"}`,
    unit: UNIT,
    title: `${name} ${update ? "수정" : "추가"}`,
    covers: { commandKinds: [kind] },
    targets: ["event"],
    args: {
      type: "object",
      additionalProperties: false,
      required,
      properties: {
        index: { type: "integer", minimum: 0, description: "목록에서 첫 줄은 0. 추가할 때 생략하면 맨 끝에 넣습니다." },
        branchPath: {
          type: "array", items: { type: "integer" },
          description: "이미 만들어진 분기 안의 명령이면 이벤트 조회에서 읽은 분기 경로. 바깥 목록이면 생략합니다.",
        },
        ...(update ? { expectedHash: { type: "string", minLength: 1, description: "get_event에서 includeCommandHashes를 켜고 이 줄에서 읽은 hash 값." } } : {}),
        ...fields[kind],
      },
    },
    scope: pageScope,
    describe(ctx, args) {
      const { command, current } = prepareCommand(ctx, args, kind, update);
      return describeCommand(ctx.project, command, current);
    },
    apply(ctx, args) {
      const { path, current, command } = prepareCommand(ctx, args, kind, update);
      const edited = updateScopedPage(ctx, page => update
        ? updateEventCommand(page, path, command, args.expectedHash as string)
        : insertEventCommand(page, path, command));
      if (update && current.kind === "setSelfSwitch" && command.kind === "setSelfSwitch") {
        const { map, event } = selectedPage({ ...ctx, project: edited });
        validateSelfSwitchChange(edited, map, event, current, command);
      }
      if (update) validateStateRetarget(ctx, edited, current, command);
      return edited;
    },
  };
}

const switchInsert = primitive("setSwitch", "스위치 조작", false);

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  switchInsert,
  primitive("setSwitch", "스위치 조작", true),
  primitive("setVariable", "변수 조작", false),
  primitive("setVariable", "변수 조작", true),
  primitive("setSelfSwitch", "셀프 스위치", false),
  primitive("setSelfSwitch", "셀프 스위치", true),
  // 새 기억은 기존 자료집 스위치를 사용한다. 저장된 옛 기억은 그 종류를 유지하며 고친다.
  { ...switchInsert, id: "cmd.setFlag.insert", title: "기억 추가 (스위치 사용)", aliasOf: switchInsert.id, covers: {} },
  primitive("setFlag", "이전 방식의 기억", true),
];
