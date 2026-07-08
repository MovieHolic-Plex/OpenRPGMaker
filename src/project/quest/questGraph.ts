import { compareVariableValue } from "@/project/conditionEvaluation";
import { inBounds, isPassable } from "@/project/collision";
import { checkReachability } from "@/project/lint/reachability";
import { storyFlagById, targetShortLabel } from "@/project/storyFlags";
import { buildStoryFlagUsageIndex, usageBucketFor, type StoryFlagUsageSite } from "@/project/storyFlagUsage";
import type { Command, Dir, GameEvent, Project, StoryFlagKind } from "@/project/types";
import {
  isQuestGraphDef,
  questDefId,
  type AnyQuestDef,
  type QuestGraphCondition,
  type QuestGraphConditionExpression,
  type QuestGraphDef,
  type QuestGraphEdge,
  type QuestGraphNode,
  type QuestVariableOp,
} from "./questDef";

type ResolvedQuestCondition =
  | { readonly kind: "switch"; readonly targetId: string; readonly value: boolean; readonly flagId?: string }
  | { readonly kind: "variable"; readonly targetId: string; readonly op: QuestVariableOp; readonly value: number; readonly flagId?: string };

export interface QuestGraphValidationIssue {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly questId: string;
  readonly nodeId?: string;
  readonly message: string;
}

export interface QuestLintIssue {
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
}

export interface QuestWalkthroughScenario {
  readonly mapId: string;
  readonly start: { readonly x: number; readonly y: number };
  readonly steps: readonly Record<string, unknown>[];
}

export interface QuestWalkthroughNode {
  readonly nodeId: string;
  readonly description: string;
  readonly automatic: boolean;
  readonly manualHint?: string;
}

export interface QuestWalkthrough {
  readonly questId: string;
  readonly title: string;
  readonly scenario: QuestWalkthroughScenario;
  readonly nodes: readonly QuestWalkthroughNode[];
  readonly manualHints: readonly string[];
}

interface WalkthroughState {
  mapId: string;
  x: number;
  y: number;
  facing: Dir;
  readonly steps: Record<string, unknown>[];
  readonly manualHints: string[];
  readonly nodes: QuestWalkthroughNode[];
}

interface RootCommandContext {
  readonly commands: readonly Command[];
  readonly rootIndex: number;
  readonly command: Command | null;
}

const VARIABLE_OPS: readonly QuestVariableOp[] = ["==", ">=", "<=", ">", "<", "!="];

export function normalizeQuestGraph(project: Project, raw: unknown): QuestGraphDef {
  const record = requireRecord("quest", raw);
  const id = requiredString(record.id, "id");
  const title = requiredString(record.title, "title");
  const summary = optionalString(record.summary);
  const nodes = requireArray(record.nodes, "nodes").map((entry, index): QuestGraphNode => {
    const node = requireRecord(`nodes[${index}]`, entry);
    return {
      id: requiredString(node.id, `nodes[${index}].id`),
      description: requiredString(node.description, `nodes[${index}].description`),
      completesWhen: node.completesWhen as QuestGraphConditionExpression,
      ...(node.activatesFlags !== undefined
        ? { activatesFlags: requireStringArray(node.activatesFlags, `nodes[${index}].activatesFlags`) }
        : {}),
    };
  });
  const edges = requireArray(record.edges, "edges").map((entry, index): QuestGraphEdge => {
    const edge = requireRecord(`edges[${index}]`, entry);
    return {
      from: requiredString(edge.from, `edges[${index}].from`),
      to: requiredString(edge.to, `edges[${index}].to`),
    };
  });
  const graph: QuestGraphDef = { kind: "graph", id, title, ...(summary ? { summary } : {}), nodes, edges };
  const errors = validateQuestGraph(project, graph).filter((issue) => issue.severity === "error");
  if (errors.length > 0) throw new Error(errors[0].message);
  return graph;
}

export function validateQuestGraph(project: Project, quest: QuestGraphDef): QuestGraphValidationIssue[] {
  const issues: QuestGraphValidationIssue[] = [];
  const nodeIds = new Set<string>();
  if (quest.nodes.length === 0) {
    issues.push({ severity: "error", code: "quest-graph:empty", questId: quest.id, message: `퀘스트 그래프에 노드가 없습니다: ${quest.id}` });
  }
  for (const node of quest.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({ severity: "error", code: "quest-graph:duplicate-node", questId: quest.id, nodeId: node.id, message: `퀘스트 그래프 노드 id가 중복됩니다: ${quest.id}/${node.id}` });
    }
    nodeIds.add(node.id);
    const conditions = extractQuestGraphConditions(node.completesWhen);
    if (conditions.length === 0) {
      issues.push({ severity: "error", code: "quest-graph:missing-condition", questId: quest.id, nodeId: node.id, message: `퀘스트 노드 완료 조건이 없습니다: ${quest.id}/${node.id}` });
    }
    for (const condition of conditions) {
      try {
        resolveQuestGraphCondition(project, condition);
      } catch (cause) {
        issues.push({ severity: "error", code: "quest-graph:condition", questId: quest.id, nodeId: node.id, message: `퀘스트 노드 조건 오류 ${quest.id}/${node.id}: ${errorMessage(cause)}` });
      }
    }
    for (const flagId of node.activatesFlags ?? []) {
      if (!storyFlagById(project, flagId)) {
        issues.push({ severity: "error", code: "quest-graph:flag", questId: quest.id, nodeId: node.id, message: `활성 플래그를 찾을 수 없습니다: ${quest.id}/${node.id}/${flagId}` });
      }
    }
  }
  for (const edge of quest.edges) {
    if (!nodeIds.has(edge.from)) {
      issues.push({ severity: "error", code: "quest-graph:edge", questId: quest.id, message: `퀘스트 edge.from 노드가 없습니다: ${quest.id}/${edge.from}` });
    }
    if (!nodeIds.has(edge.to)) {
      issues.push({ severity: "error", code: "quest-graph:edge", questId: quest.id, message: `퀘스트 edge.to 노드가 없습니다: ${quest.id}/${edge.to}` });
    }
  }
  if (questHasCycle(quest)) {
    issues.push({ severity: "error", code: "quest-graph:cycle", questId: quest.id, message: `퀘스트 그래프에 사이클이 있습니다: ${quest.id}` });
  }
  return issues;
}

export function lintQuestGraph(project: Project, quest: QuestGraphDef): QuestLintIssue[] {
  const issues: QuestLintIssue[] = validateQuestGraph(project, quest).map((issue) => ({
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
  }));
  const index = buildStoryFlagUsageIndex(project);
  for (const node of quest.nodes) {
    const seenTargets = new Set<string>();
    for (const rawCondition of extractQuestGraphConditions(node.completesWhen)) {
      let condition: ResolvedQuestCondition;
      try {
        condition = resolveQuestGraphCondition(project, rawCondition);
      } catch {
        continue;
      }
      const targetKey = `${condition.kind}:${condition.targetId}`;
      if (seenTargets.has(targetKey)) continue;
      seenTargets.add(targetKey);
      const writes = usageBucketFor(index, condition.kind, condition.targetId).writes;
      if (writes.length > 0) continue;
      issues.push({
        severity: "error",
        code: "quest-graph:dead-end-node",
        message: `데드엔드 노드: ${quest.id}/${node.id} 완료 조건 ${formatResolvedCondition(project, condition)}에 write site가 없습니다.`,
      });
    }
  }
  issues.push(...questGraphStructureWarnings(quest));
  return issues;
}

export function lintQuestById(project: Project, questId: string): QuestLintIssue[] {
  const quest = findQuestGraph(project, questId);
  if (!quest) throw new Error(`퀘스트 그래프를 찾을 수 없습니다: ${questId}`);
  return lintQuestGraph(project, quest);
}

export function topologicalQuestNodes(quest: QuestGraphDef): QuestGraphNode[] {
  const ids = new Set(quest.nodes.map((node) => node.id));
  const indegree = new Map<string, number>(quest.nodes.map((node) => [node.id, 0]));
  const adjacency = new Map<string, string[]>(quest.nodes.map((node) => [node.id, []]));
  for (const edge of quest.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    adjacency.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }
  const queue = quest.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const ordered: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const to of adjacency.get(id) ?? []) {
      const next = (indegree.get(to) ?? 0) - 1;
      indegree.set(to, next);
      if (next === 0) queue.push(to);
    }
  }
  if (ordered.length !== quest.nodes.length) throw new Error(`퀘스트 그래프에 사이클이 있습니다: ${quest.id}`);
  const byId = new Map(quest.nodes.map((node) => [node.id, node]));
  return ordered.map((id) => byId.get(id)).filter((node): node is QuestGraphNode => node !== undefined);
}

export function generateQuestWalkthrough(project: Project, questId: string): QuestWalkthrough {
  const quest = findQuestGraph(project, questId);
  if (!quest) throw new Error(`퀘스트 그래프를 찾을 수 없습니다: ${questId}`);
  const blocking = lintQuestGraph(project, quest).filter((issue) => issue.severity === "error");
  if (blocking.length > 0) throw new Error(blocking[0].message);
  const usageIndex = buildStoryFlagUsageIndex(project);
  const state: WalkthroughState = {
    mapId: project.startMapId,
    x: project.startPos.x,
    y: project.startPos.y,
    facing: "down",
    steps: [],
    manualHints: [],
    nodes: [],
  };
  for (const node of topologicalQuestNodes(quest)) {
    const conditions = extractQuestGraphConditions(node.completesWhen).map((condition) => resolveQuestGraphCondition(project, condition));
    const grouped = groupConditionsByWriteSite(project, usageIndex, conditions);
    const nodeStartManualCount = state.manualHints.length;
    for (const group of grouped) {
      if (group.site) {
        const applied = appendPlayableSiteSteps(project, state, group.site, group.conditions);
        if (applied) continue;
      }
      const hint = group.site
        ? `자동 유도 불가: ${node.id} (${group.site.label})`
        : `write site 자동 유도 불가: ${node.id} (${group.conditions.map((condition) => formatResolvedCondition(project, condition)).join(", ")})`;
      appendManualSetSteps(state, group.conditions, hint);
    }
    state.nodes.push({
      nodeId: node.id,
      description: node.description,
      automatic: state.manualHints.length === nodeStartManualCount,
      ...(state.manualHints.length === nodeStartManualCount ? {} : { manualHint: state.manualHints[state.manualHints.length - 1] }),
    });
  }
  return {
    questId: quest.id,
    title: quest.title,
    scenario: { mapId: project.startMapId, start: project.startPos, steps: state.steps },
    nodes: state.nodes,
    manualHints: state.manualHints,
  };
}

export function findQuestById(project: Project, questId: string): AnyQuestDef | undefined {
  return (project.quests ?? []).find((quest) => questDefId(quest) === questId);
}

export function findQuestGraph(project: Project, questId: string): QuestGraphDef | undefined {
  const quest = findQuestById(project, questId);
  return isQuestGraphDef(quest) ? quest : undefined;
}

export function extractQuestGraphConditions(expression: QuestGraphConditionExpression): QuestGraphCondition[] {
  if (Array.isArray(expression)) return expression.slice();
  if (isRecord(expression) && Array.isArray((expression as unknown as { readonly all?: unknown }).all)) {
    return ((expression as unknown as { readonly all: readonly QuestGraphCondition[] }).all).slice();
  }
  if (isRecord(expression)) return [expression as QuestGraphCondition];
  return [];
}

export function resolveQuestGraphCondition(project: Project, raw: QuestGraphCondition): ResolvedQuestCondition {
  const record = requireRecord("condition", raw);
  const kind = requiredString(record.kind, "condition.kind");
  if (kind === "storyFlag") {
    const flagId = requiredString(record.flagId, "condition.flagId");
    const flag = storyFlagById(project, flagId);
    if (!flag) throw new Error(`storyFlag를 찾을 수 없습니다: ${flagId}`);
    if (flag.kind === "switch") {
      return { kind: "switch", targetId: flag.targetId, value: typeof record.value === "boolean" ? record.value : true, flagId };
    }
    return {
      kind: "variable",
      targetId: flag.targetId,
      op: parseVariableOp(record.op, ">="),
      value: requiredNumber(record.value, "condition.value"),
      flagId,
    };
  }
  if (kind === "switch") {
    const storyFlagId = optionalString(record.storyFlagId);
    if (storyFlagId) {
      const flag = storyFlagById(project, storyFlagId);
      if (!flag) throw new Error(`storyFlag를 찾을 수 없습니다: ${storyFlagId}`);
      if (flag.kind !== "switch") throw new Error(`storyFlag 종류가 switch가 아닙니다: ${storyFlagId}`);
      return { kind: "switch", targetId: flag.targetId, value: typeof record.value === "boolean" ? record.value : true, flagId: storyFlagId };
    }
    const switchId = requiredString(record.switchId, "condition.switchId");
    if (!project.switches.some((entry) => entry.id === switchId)) throw new Error(`스위치를 찾을 수 없습니다: ${switchId}`);
    return { kind: "switch", targetId: switchId, value: typeof record.value === "boolean" ? record.value : true };
  }
  if (kind === "variable") {
    const storyFlagId = optionalString(record.storyFlagId);
    if (storyFlagId) {
      const flag = storyFlagById(project, storyFlagId);
      if (!flag) throw new Error(`storyFlag를 찾을 수 없습니다: ${storyFlagId}`);
      if (flag.kind !== "variable") throw new Error(`storyFlag 종류가 variable이 아닙니다: ${storyFlagId}`);
      return {
        kind: "variable",
        targetId: flag.targetId,
        op: parseVariableOp(record.op, ">="),
        value: requiredNumber(record.value, "condition.value"),
        flagId: storyFlagId,
      };
    }
    const variableId = requiredString(record.variableId, "condition.variableId");
    if (!project.variables.some((entry) => entry.id === variableId)) throw new Error(`변수를 찾을 수 없습니다: ${variableId}`);
    return {
      kind: "variable",
      targetId: variableId,
      op: parseVariableOp(record.op, undefined),
      value: requiredNumber(record.value, "condition.value"),
    };
  }
  throw new Error(`지원하지 않는 조건 kind입니다: ${kind}`);
}

export function questGraphConditionMet(project: Project, session: { readonly switches: Record<string, boolean>; readonly variables: Record<string, number> }, raw: QuestGraphCondition): boolean {
  const condition = resolveQuestGraphCondition(project, raw);
  if (condition.kind === "switch") return session.switches[condition.targetId] === condition.value;
  return compareVariableValue(session.variables[condition.targetId] ?? 0, condition.op, condition.value);
}

function groupConditionsByWriteSite(
  project: Project,
  usageIndex: ReturnType<typeof buildStoryFlagUsageIndex>,
  conditions: readonly ResolvedQuestCondition[]
): Array<{ readonly key: string; readonly site: StoryFlagUsageSite | null; readonly conditions: ResolvedQuestCondition[] }> {
  const groups = new Map<string, { key: string; site: StoryFlagUsageSite | null; conditions: ResolvedQuestCondition[] }>();
  for (const condition of conditions) {
    const site = selectWriteSite(project, usageIndex, condition);
    const key = site
      ? siteKey(site)
      : `manual:${condition.kind}:${condition.targetId}:${condition.kind === "variable" ? condition.op : ""}:${condition.value}`;
    const group = groups.get(key) ?? { key, site, conditions: [] };
    group.conditions.push(condition);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function selectWriteSite(
  project: Project,
  usageIndex: ReturnType<typeof buildStoryFlagUsageIndex>,
  condition: ResolvedQuestCondition
): StoryFlagUsageSite | null {
  const writes = usageBucketFor(usageIndex, condition.kind, condition.targetId).writes;
  return writes.find((site) => !writeKnownNotToSatisfy(project, site, condition)) ?? null;
}

function writeKnownNotToSatisfy(project: Project, site: StoryFlagUsageSite, condition: ResolvedQuestCondition): boolean {
  const command = commandForSite(project, site);
  if (!command) return false;
  if (condition.kind === "switch" && command.kind === "setSwitch") return command.value !== condition.value;
  if (condition.kind === "variable" && command.kind === "setVariable" && command.op === "=" && typeof command.value === "number") {
    return !compareVariableValue(command.value, condition.op, condition.value);
  }
  return false;
}

function appendPlayableSiteSteps(
  project: Project,
  state: WalkthroughState,
  site: StoryFlagUsageSite,
  conditions: readonly ResolvedQuestCondition[]
): boolean {
  if (site.source !== "map-event" || !site.mapId || !site.eventId || !site.commandPath || site.commandPath.includes("moveRoute")) {
    appendManualSetSteps(state, conditions, `manualHint: ${site.label}는 직접 플레이 스텝으로 자동 유도할 수 없습니다.`);
    return true;
  }
  if (isBattleGatedWrite(project, site)) {
    appendManualSetSteps(state, conditions, `manualHint: ${site.label} 앞에 전투 승리가 필요해 디버그 set으로 대체합니다.`);
    return true;
  }
  const map = project.maps[site.mapId];
  const event = map?.events.find((entry) => entry.id === site.eventId);
  if (!map || !event) return false;
  const page = site.pageNumber ? event.pages?.[site.pageNumber - 1] : undefined;
  const trigger = page?.trigger ?? event.trigger;
  if (trigger.kind === "action") {
    const target = interactionPoint(project, state, map.id, event);
    if (!target) {
      appendManualSetSteps(state, conditions, `manualHint: ${site.label} 대화 위치로 자동 이동할 수 없어 디버그 set으로 대체합니다.`);
      return true;
    }
    appendMoveOrSetTo(project, state, map.id, target.x, target.y, target.dir, `manualHint: ${site.label} 위치 이동을 디버그 set으로 대체합니다.`);
    if (state.facing !== target.dir) {
      state.steps.push({ kind: "face", dir: target.dir });
      state.facing = target.dir;
    }
    state.steps.push({ kind: "interact" });
    appendChoiceIfNeeded(state, site);
    appendConditionExpectations(state, conditions);
    return true;
  }
  if (trigger.kind === "touch" || trigger.kind === "playerTouch") {
    appendMoveOrSetTo(project, state, map.id, event.x, event.y, state.facing, `manualHint: ${site.label} 접촉 위치 이동을 디버그 set으로 대체합니다.`);
    appendChoiceIfNeeded(state, site);
    appendConditionExpectations(state, conditions);
    return true;
  }
  return false;
}

function appendMoveOrSetTo(
  project: Project,
  state: WalkthroughState,
  mapId: string,
  x: number,
  y: number,
  facing: Dir,
  manualHint: string
): void {
  if (state.mapId === mapId && reachable(project, mapId, { x: state.x, y: state.y }, { x, y })) {
    if (state.x !== x || state.y !== y) state.steps.push({ kind: "move", to: { x, y } });
  } else {
    state.steps.push({ kind: "set", mapId, x, y, facing, manualHint });
    state.manualHints.push(manualHint);
  }
  state.mapId = mapId;
  state.x = x;
  state.y = y;
  state.facing = facing;
}

function appendManualSetSteps(
  state: WalkthroughState,
  conditions: readonly ResolvedQuestCondition[],
  manualHint: string
): void {
  const setStep: Record<string, unknown> = { kind: "set", manualHint };
  const switches: Record<string, boolean> = {};
  const variables: Record<string, number> = {};
  for (const condition of conditions) {
    if (condition.kind === "switch") switches[condition.targetId] = condition.value;
    else variables[condition.targetId] = satisfyingVariableValue(condition);
  }
  if (Object.keys(switches).length > 0) setStep.switches = switches;
  if (Object.keys(variables).length > 0) setStep.variables = variables;
  state.steps.push(setStep);
  state.manualHints.push(manualHint);
  appendConditionExpectations(state, conditions);
}

function appendConditionExpectations(state: WalkthroughState, conditions: readonly ResolvedQuestCondition[]): void {
  for (const condition of conditions) state.steps.push(conditionExpectation(condition));
}

function conditionExpectation(condition: ResolvedQuestCondition): Record<string, unknown> {
  if (condition.kind === "switch") {
    return condition.value ? { kind: "expect", switchOn: condition.targetId } : { kind: "expect", switchOff: condition.targetId };
  }
  if (condition.op === "==" || condition.op === "<=" || condition.op === "<" || condition.op === "!=") {
    return { kind: "expect", variableEquals: { variableId: condition.targetId, value: satisfyingVariableValue(condition) } };
  }
  return { kind: "expect", variableAtLeast: { variableId: condition.targetId, value: condition.op === ">" ? condition.value + 1 : condition.value } };
}

function satisfyingVariableValue(condition: Extract<ResolvedQuestCondition, { kind: "variable" }>): number {
  switch (condition.op) {
    case "==":
    case ">=":
    case "<=":
      return condition.value;
    case ">":
    case "!=":
      return condition.value + 1;
    case "<":
      return condition.value - 1;
  }
}

function appendChoiceIfNeeded(state: WalkthroughState, site: StoryFlagUsageSite): void {
  const optionIndex = choiceOptionIndex(site.commandPath);
  if (optionIndex !== null) state.steps.push({ kind: "choose", index: optionIndex });
}

function interactionPoint(
  project: Project,
  state: WalkthroughState,
  mapId: string,
  event: GameEvent
): { readonly x: number; readonly y: number; readonly dir: Dir } | null {
  const map = project.maps[mapId];
  if (!map) return null;
  const candidates: Array<{ readonly x: number; readonly y: number; readonly dir: Dir }> = [
    { x: event.x, y: event.y - 1, dir: "down" },
    { x: event.x + 1, y: event.y, dir: "left" },
    { x: event.x, y: event.y + 1, dir: "up" },
    { x: event.x - 1, y: event.y, dir: "right" },
  ];
  return candidates.find((point) =>
    inBounds(map, point.x, point.y) &&
    isPassable(project, map, point.x, point.y) &&
    (state.mapId !== mapId || reachable(project, mapId, { x: state.x, y: state.y }, point))
  ) ?? candidates.find((point) => inBounds(map, point.x, point.y) && isPassable(project, map, point.x, point.y)) ?? null;
}

function reachable(
  project: Project,
  mapId: string,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number }
): boolean {
  if (from.x === to.x && from.y === to.y) return true;
  return checkReachability(project, mapId, from, [to]).reachable;
}

function questHasCycle(quest: QuestGraphDef): boolean {
  try {
    topologicalQuestNodes(quest);
    return false;
  } catch {
    return true;
  }
}

function questGraphStructureWarnings(quest: QuestGraphDef): QuestLintIssue[] {
  const warnings: QuestLintIssue[] = [];
  if (quest.nodes.length === 0) return warnings;
  const ids = new Set(quest.nodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>(quest.nodes.map((node) => [node.id, []]));
  const degree = new Map<string, number>(quest.nodes.map((node) => [node.id, 0]));
  for (const edge of quest.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    adjacency.get(edge.from)?.push(edge.to);
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  const reachableIds = new Set<string>();
  const stack = [quest.nodes[0].id];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachableIds.has(id)) continue;
    reachableIds.add(id);
    stack.push(...(adjacency.get(id) ?? []));
  }
  for (const node of quest.nodes) {
    if ((degree.get(node.id) ?? 0) === 0) {
      warnings.push({ severity: "warning", code: "quest-graph:orphan-node", message: `고아 노드: ${quest.id}/${node.id}가 어떤 edge에도 연결되지 않았습니다.` });
    }
    if (!reachableIds.has(node.id)) {
      warnings.push({ severity: "warning", code: "quest-graph:unreachable-node", message: `시작 노드 ${quest.nodes[0].id}에서 도달 불가한 노드: ${quest.id}/${node.id}` });
    }
  }
  return warnings;
}

function isBattleGatedWrite(project: Project, site: StoryFlagUsageSite): boolean {
  const context = rootCommandContextForSite(project, site);
  if (!context) return false;
  return context.commands.slice(0, context.rootIndex).some(commandContainsBattle);
}

function commandContainsBattle(command: Command): boolean {
  if (command.kind === "battleProcessing") return true;
  if (command.kind === "choices") return command.options.some((option) => option.branch.some(commandContainsBattle)) || (command.cancelBranch ?? []).some(commandContainsBattle);
  if (command.kind === "fork") return command.then.some(commandContainsBattle) || (command.else ?? []).some(commandContainsBattle);
  if (command.kind === "loop") return command.body.some(commandContainsBattle);
  if (command.kind === "promoteActor") return (command.successBranch ?? []).some(commandContainsBattle) || (command.failureBranch ?? []).some(commandContainsBattle);
  if (command.kind === "evolveMonster") return (command.successBranch ?? []).some(commandContainsBattle) || (command.failureBranch ?? []).some(commandContainsBattle);
  return false;
}

function commandForSite(project: Project, site: StoryFlagUsageSite): Command | null {
  return rootCommandContextForSite(project, site)?.command ?? null;
}

function rootCommandContextForSite(project: Project, site: StoryFlagUsageSite): RootCommandContext | null {
  const path = site.commandPath;
  if (!path) return null;
  let commands: readonly Command[] | null = null;
  if (site.source === "map-event" && site.mapId && site.eventId) {
    const event = project.maps[site.mapId]?.events.find((entry) => entry.id === site.eventId);
    if (!event) return null;
    commands = site.pageNumber ? event.pages?.[site.pageNumber - 1]?.commands ?? null : event.commands;
  } else if (site.source === "common-event" && site.commonEventId) {
    commands = project.commonEvents.find((entry) => entry.id === site.commonEventId)?.commands ?? null;
  } else if (site.source === "troop-event" && site.troopId && site.pageNumber) {
    commands = project.database.troops.find((entry) => entry.id === site.troopId)?.battleEventPages?.[site.pageNumber - 1]?.commands ?? null;
  }
  if (!commands) return null;
  const rootIndex = rootCommandIndex(path);
  if (rootIndex === null || !commands[rootIndex]) return null;
  return { commands, rootIndex, command: commandAtNestedPath(commands[rootIndex], path) ?? commands[rootIndex] };
}

function rootCommandIndex(path: string): number | null {
  const match = path.match(/(?:^|\.)(?:event\.)?commands\[(\d+)\]|pages\[\d+\]\.commands\[(\d+)\]|battleEventPages\[\d+\]\.commands\[(\d+)\]/u);
  if (!match) return null;
  const value = match[1] ?? match[2] ?? match[3];
  return value === undefined ? null : Number(value);
}

function commandAtNestedPath(root: Command, path: string): Command | null {
  const tokens = [...path.matchAll(/\.(then|else|body|cancelBranch|successBranch|failureBranch)\[(\d+)\]|\.(options)\[(\d+)\]\.branch\[(\d+)\]/gu)];
  let current: Command = root;
  for (const token of tokens) {
    if (token[1]) {
      const branch = commandBranch(current, token[1]);
      const next = branch?.[Number(token[2])];
      if (!next) return null;
      current = next;
      continue;
    }
    if (token[3] === "options" && current.kind === "choices") {
      const option = current.options[Number(token[4])];
      const next = option?.branch[Number(token[5])];
      if (!next) return null;
      current = next;
    }
  }
  return current;
}

function commandBranch(command: Command, branch: string): readonly Command[] | undefined {
  if (command.kind === "fork" && branch === "then") return command.then;
  if (command.kind === "fork" && branch === "else") return command.else;
  if (command.kind === "loop" && branch === "body") return command.body;
  if (command.kind === "choices" && branch === "cancelBranch") return command.cancelBranch;
  if (command.kind === "promoteActor" && branch === "successBranch") return command.successBranch;
  if (command.kind === "promoteActor" && branch === "failureBranch") return command.failureBranch;
  if (command.kind === "evolveMonster" && branch === "successBranch") return command.successBranch;
  if (command.kind === "evolveMonster" && branch === "failureBranch") return command.failureBranch;
  return undefined;
}

function choiceOptionIndex(path: string | undefined): number | null {
  const match = path?.match(/options\[(\d+)\]\.branch/u);
  return match ? Number(match[1]) : null;
}

function siteKey(site: StoryFlagUsageSite): string {
  return `${site.source}:${site.mapId ?? ""}:${site.eventId ?? ""}:${site.pageNumber ?? ""}:${site.commonEventId ?? ""}:${site.troopId ?? ""}:${site.commandPath ?? ""}`;
}

function formatResolvedCondition(project: Project, condition: ResolvedQuestCondition): string {
  const kind: StoryFlagKind = condition.kind;
  const target = targetShortLabel(project, kind, condition.targetId);
  const flag = condition.flagId ? ` · ${condition.flagId}` : "";
  if (condition.kind === "switch") return `${target}${flag}=${condition.value ? "on" : "off"}`;
  return `${target}${flag} ${condition.op} ${condition.value}`;
}

function parseVariableOp(value: unknown, fallback: QuestVariableOp | undefined): QuestVariableOp {
  if (typeof value === "string" && VARIABLE_OPS.includes(value as QuestVariableOp)) return value as QuestVariableOp;
  if (fallback) return fallback;
  throw new Error(`variable op가 올바르지 않습니다: ${String(value)}`);
}

function requireRecord(label: string, value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label}는 객체여야 합니다.`);
  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}는 배열이어야 합니다.`);
  return value;
}

function requireStringArray(value: unknown, label: string): string[] {
  return requireArray(value, label).map((entry, index) => requiredString(entry, `${label}[${index}]`));
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} 문자열이 필요합니다.`);
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} 숫자가 필요합니다.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
