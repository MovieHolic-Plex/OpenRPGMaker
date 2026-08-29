import { commandBranches, visitProjectCommands } from "@/editor/tools/commandTraversal";
import { projectLint } from "@/project/lint/projectLint";
import { buildStoryFlagUsageIndex, type StoryFlagUsageSite } from "@/project/storyFlagUsage";
import type { Command, Condition, Project, StoryFlagKind } from "@/project/types";
import type { AuthoredEventShape, AuthoredPageShape, FlagLiteracyMetrics } from "./types";

const ARITHMETIC_OPS = new Set(["+=", "-=", "*=", "/="]);

function flagKey(kind: StoryFlagKind, id: string): string {
  return `${kind}:${id}`;
}

function ownerKey(site: StoryFlagUsageSite): string {
  if (site.source === "map-event") return `map:${site.mapId ?? "?"}/${site.eventId ?? "?"}`;
  if (site.source === "common-event") return `common:${site.commonEventId ?? "?"}`;
  return `troop:${site.troopId ?? "?"}`;
}

function walkCondition(condition: Condition | undefined, visit: (leaf: Condition) => void): void {
  if (!condition) return;
  visit(condition);
  if (condition.kind === "all" || condition.kind === "any") {
    for (const child of condition.conditions) walkCondition(child, visit);
  }
  if (condition.kind === "not") walkCondition(condition.condition, visit);
}

function conditionGatesFlag(conditions: readonly Condition[]): boolean {
  let gated = false;
  for (const condition of conditions) {
    walkCondition(condition, (leaf) => {
      if (leaf.kind === "switch" || leaf.kind === "variable" || leaf.kind === "selfSwitch") gated = true;
    });
  }
  return gated;
}

function describeCondition(condition: Condition): string {
  switch (condition.kind) {
    case "switch":
      return `${condition.switchId} == ${condition.value ? "ON" : "OFF"}`;
    case "variable":
      return `${condition.variableId} ${condition.op} ${condition.value}`;
    case "selfSwitch":
      return `self:${condition.key} == ${condition.value ? "ON" : "OFF"}`;
    case "all":
      return `모두(${condition.conditions.map(describeCondition).join(", ")})`;
    case "any":
      return `하나(${condition.conditions.map(describeCondition).join(", ")})`;
    case "not":
      return `아님(${describeCondition(condition.condition)})`;
    default:
      return condition.kind;
  }
}

function collectFlagWrites(commands: readonly Command[], out: string[]): void {
  for (const command of commands) {
    if (command.kind === "setSwitch") out.push(`${command.switchId} := ${String(typeof command.value === "object" ? "var" : command.value)}`);
    if (command.kind === "setVariable") out.push(`${command.variableId} ${command.op} ${typeof command.value === "object" ? `var(${command.value.id})` : command.value}`);
    if (command.kind === "setSelfSwitch") out.push(`self:${command.key} := ${command.value ? "ON" : "OFF"}`);
    for (const branch of commandBranches(command)) collectFlagWrites(branch.commands as readonly Command[], out);
  }
}

export function summarizeAuthoredEvents(project: Project): AuthoredEventShape[] {
  const shapes: AuthoredEventShape[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const pages: AuthoredPageShape[] = (event.pages ?? []).map((page, index) => {
        const flagWrites: string[] = [];
        collectFlagWrites(page.commands, flagWrites);
        return {
          name: page.name?.trim() || `page ${index + 1}`,
          conditions: page.conditions.map(describeCondition),
          flagWrites,
          commandKinds: [...new Set(page.commands.map((command) => command.kind))],
          spriteId: page.graphic.sprite?.id,
          frameIndex: page.graphic.pattern,
        };
      });
      if (pages.length === 0 && event.commands.length > 0) {
        const flagWrites: string[] = [];
        collectFlagWrites(event.commands, flagWrites);
        pages.push({
          name: "legacy",
          conditions: event.condition ? [describeCondition(event.condition)] : [],
          flagWrites,
          commandKinds: [...new Set(event.commands.map((command) => command.kind))],
        });
      }
      shapes.push({
        mapId: map.id,
        eventId: event.id,
        x: event.x,
        y: event.y,
        spriteId: event.sprite?.id ?? (event.pages ?? [])[0]?.graphic.sprite?.id,
        frameIndex: (event.pages ?? [])[0]?.graphic.pattern,
        pages,
      });
    }
  }
  return shapes;
}

export function analyzeFlagLiteracy(project: Project): FlagLiteracyMetrics {
  const usage = buildStoryFlagUsageIndex(project);
  const declaredSwitches = new Set(project.switches.map((entry) => entry.id));
  const declaredVariables = new Set(project.variables.map((entry) => entry.id));
  const switchNames = new Map(project.switches.map((entry) => [entry.id, entry.name?.trim() ?? ""]));
  const variableNames = new Map(project.variables.map((entry) => [entry.id, entry.name?.trim() ?? ""]));

  const registered = new Set(
    (project.storyFlags ?? [])
      .filter((flag) => flag.retired !== true && flag.description.trim().length > 0)
      .map((flag) => flagKey(flag.kind, flag.targetId))
  );

  const usedSwitchIds = Object.keys(usage.switches).sort();
  const usedVariableIds = Object.keys(usage.variables).sort();

  const danglingSwitchRefs = usedSwitchIds.filter((id) => !declaredSwitches.has(id));
  const danglingVariableRefs = usedVariableIds.filter((id) => !declaredVariables.has(id));

  const namedUsedSwitches = usedSwitchIds.filter((id) => (switchNames.get(id) ?? "").length >= 2).length;
  const namedUsedVariables = usedVariableIds.filter((id) => (variableNames.get(id) ?? "").length >= 2).length;
  const registeredUsedFlags =
    usedSwitchIds.filter((id) => registered.has(flagKey("switch", id))).length +
    usedVariableIds.filter((id) => registered.has(flagKey("variable", id))).length;

  // self-switch 는 스위치 번호를 쓰지 않아 usage index 가 추적하지 못한다 — 직접 센다.
  let selfSwitchWrites = 0;
  let variableArithmeticWrites = 0;
  let forkFlagConditions = 0;
  let compoundConditions = 0;
  visitProjectCommands(project, ({ command }) => {
    if (command.kind === "setSelfSwitch") selfSwitchWrites += 1;
    if (command.kind === "setVariable" && ARITHMETIC_OPS.has(command.op)) variableArithmeticWrites += 1;
    if (command.kind === "fork") {
      walkCondition(command.condition, (leaf) => {
        if (leaf.kind === "switch" || leaf.kind === "variable" || leaf.kind === "selfSwitch") forkFlagConditions += 1;
        if (leaf.kind === "all" || leaf.kind === "any" || leaf.kind === "not") compoundConditions += 1;
      });
    }
  });

  let selfSwitchReads = 0;
  let variableComparisonReads = 0;
  let totalEvents = 0;
  let multiPageEvents = 0;
  let totalPages = 0;
  let flagGatedPages = 0;
  const countConditionReads = (conditions: readonly Condition[]): void => {
    for (const condition of conditions) {
      walkCondition(condition, (leaf) => {
        if (leaf.kind === "selfSwitch") selfSwitchReads += 1;
        if (leaf.kind === "variable") variableComparisonReads += 1;
        if (leaf.kind === "all" || leaf.kind === "any" || leaf.kind === "not") compoundConditions += 1;
      });
    }
  };

  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      totalEvents += 1;
      const pages = event.pages ?? [];
      if (pages.length > 1) multiPageEvents += 1;
      if (event.condition) countConditionReads([event.condition]);
      for (const page of pages) {
        totalPages += 1;
        countConditionReads(page.conditions);
        if (conditionGatesFlag(page.conditions)) flagGatedPages += 1;
      }
    }
  }
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) {
      for (const condition of page.conditions) {
        if (condition.kind === "variable") variableComparisonReads += 1;
      }
    }
  }
  visitProjectCommands(project, ({ command }) => {
    if (command.kind === "fork") {
      walkCondition(command.condition, (leaf) => {
        if (leaf.kind === "selfSwitch") selfSwitchReads += 1;
        if (leaf.kind === "variable") variableComparisonReads += 1;
      });
    }
  });

  const writeOnlyFlagIds: string[] = [];
  const readOnlyFlagIds: string[] = [];
  const eventLocalLatchCandidates: string[] = [];
  for (const [kind, table] of [
    ["switch", usage.switches] as const,
    ["variable", usage.variables] as const,
  ]) {
    for (const [id, bucket] of Object.entries(table)) {
      const key = flagKey(kind, id);
      if (bucket.writes.length > 0 && bucket.reads.length === 0) writeOnlyFlagIds.push(key);
      if (bucket.reads.length > 0 && bucket.writes.length === 0) readOnlyFlagIds.push(key);
      if (kind !== "switch") continue;
      const owners = new Set([...bucket.reads, ...bucket.writes].map(ownerKey));
      const mapEventOnly = [...bucket.reads, ...bucket.writes].every((site) => site.source === "map-event");
      if (owners.size === 1 && mapEventOnly) eventLocalLatchCandidates.push(id);
    }
  }

  const lintIssues = projectLint(project);
  return {
    usedSwitchIds,
    usedVariableIds,
    danglingSwitchRefs,
    danglingVariableRefs,
    namedUsedSwitches,
    namedUsedVariables,
    registeredUsedFlags,
    selfSwitchWrites,
    selfSwitchReads,
    eventLocalLatchCandidates: eventLocalLatchCandidates.sort(),
    variableArithmeticWrites,
    variableComparisonReads,
    totalEvents,
    multiPageEvents,
    flagGatedPages,
    totalPages,
    forkFlagConditions,
    compoundConditions,
    writeOnlyFlagIds: writeOnlyFlagIds.sort(),
    readOnlyFlagIds: readOnlyFlagIds.sort(),
    orphanFlagIds: [...writeOnlyFlagIds, ...readOnlyFlagIds].sort(),
    lintErrors: lintIssues.filter((issue) => issue.severity === "error").length,
    flagLintWarnings: lintIssues.filter((issue) => issue.code.startsWith("story-flag:")).length,
  };
}
