import type {
  BattleEventCondition,
  Command,
  Condition,
  MoveRoute,
  Project,
  StoryFlagKind,
} from "@/project/types";

export type StoryFlagAccess = "read" | "write";
export type StoryFlagUsageSource = "map-event" | "common-event" | "troop-event";

export interface StoryFlagUsageSite {
  readonly access: StoryFlagAccess;
  readonly kind: StoryFlagKind;
  readonly targetId: string;
  readonly source: StoryFlagUsageSource;
  readonly mapId?: string;
  readonly eventId?: string;
  readonly pageId?: string;
  readonly pageNumber?: number;
  readonly commonEventId?: string;
  readonly troopId?: string;
  readonly commandPath?: string;
  readonly conditionPath?: string;
  readonly label: string;
  readonly detail: string;
}

export interface StoryFlagUsageBucket {
  readonly reads: StoryFlagUsageSite[];
  readonly writes: StoryFlagUsageSite[];
}

export interface StoryFlagUsageIndex {
  readonly switches: Record<string, StoryFlagUsageBucket>;
  readonly variables: Record<string, StoryFlagUsageBucket>;
  readonly sites: StoryFlagUsageSite[];
}

type UsageOwner = {
  readonly source: StoryFlagUsageSource;
  readonly mapId?: string;
  readonly eventId?: string;
  readonly pageId?: string;
  readonly pageNumber?: number;
  readonly commonEventId?: string;
  readonly troopId?: string;
};

type UsageLocation = UsageOwner & {
  readonly commandPath?: string;
  readonly conditionPath?: string;
  readonly detail: string;
};

export function buildStoryFlagUsageIndex(project: Project): StoryFlagUsageIndex {
  const mutable = {
    switches: {} as Record<string, { reads: StoryFlagUsageSite[]; writes: StoryFlagUsageSite[] }>,
    variables: {} as Record<string, { reads: StoryFlagUsageSite[]; writes: StoryFlagUsageSite[] }>,
    sites: [] as StoryFlagUsageSite[],
  };

  const add = (access: StoryFlagAccess, kind: StoryFlagKind, targetId: string | undefined, location: UsageLocation): void => {
    const cleanTarget = targetId?.trim();
    if (!cleanTarget) return;
    const site: StoryFlagUsageSite = {
      access,
      kind,
      targetId: cleanTarget,
      source: location.source,
      mapId: location.mapId,
      eventId: location.eventId,
      pageId: location.pageId,
      pageNumber: location.pageNumber,
      commonEventId: location.commonEventId,
      troopId: location.troopId,
      commandPath: location.commandPath,
      conditionPath: location.conditionPath,
      label: usageLabel(location),
      detail: location.detail,
    };
    const table = kind === "switch" ? mutable.switches : mutable.variables;
    table[cleanTarget] ??= { reads: [], writes: [] };
    table[cleanTarget][access === "read" ? "reads" : "writes"].push(site);
    mutable.sites.push(site);
  };

  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const owner: UsageOwner = { source: "map-event", mapId: map.id, eventId: event.id };
      if (event.condition) addConditionReads(event.condition, add, { ...owner, conditionPath: "event.condition", detail: "legacy event condition" });
      scanMoveRoute(event.moveRoute, add, { ...owner, commandPath: "event.moveRoute", detail: "event move route" });
      scanCommands(event.commands, add, owner, "event.commands");
      for (const [pageIndex, page] of (event.pages ?? []).entries()) {
        const pageOwner: UsageOwner = {
          source: "map-event",
          mapId: map.id,
          eventId: event.id,
          pageId: page.id,
          pageNumber: pageIndex + 1,
        };
        for (const [conditionIndex, condition] of page.conditions.entries()) {
          addConditionReads(condition, add, {
            ...pageOwner,
            conditionPath: `pages[${pageIndex}].conditions[${conditionIndex}]`,
            detail: "event page condition",
          });
        }
        scanMoveRoute(page.movement.route, add, {
          ...pageOwner,
          commandPath: `pages[${pageIndex}].movement.route`,
          detail: "page move route",
        });
        scanCommands(page.commands, add, pageOwner, `pages[${pageIndex}].commands`);
      }
    }
  }

  for (const commonEvent of project.commonEvents) {
    const owner: UsageOwner = { source: "common-event", commonEventId: commonEvent.id };
    add("read", "switch", commonEvent.conditionSwitchId, {
      ...owner,
      conditionPath: "conditionSwitchId",
      detail: "common event trigger switch",
    });
    scanCommands(commonEvent.commands, add, owner, "commands");
  }

  for (const troop of project.database.troops) {
    for (const [pageIndex, page] of (troop.battleEventPages ?? []).entries()) {
      const owner: UsageOwner = {
        source: "troop-event",
        troopId: troop.id,
        pageId: page.id,
        pageNumber: pageIndex + 1,
      };
      for (const [conditionIndex, condition] of page.conditions.entries()) {
        addBattleConditionReads(condition, add, {
          ...owner,
          conditionPath: `battleEventPages[${pageIndex}].conditions[${conditionIndex}]`,
          detail: "troop battle event condition",
        });
      }
      scanCommands(page.commands, add, owner, `battleEventPages[${pageIndex}].commands`);
    }
  }

  return mutable;
}

export function usageBucketFor(
  index: StoryFlagUsageIndex,
  kind: StoryFlagKind,
  targetId: string
): StoryFlagUsageBucket {
  const table = kind === "switch" ? index.switches : index.variables;
  return table[targetId] ?? { reads: [], writes: [] };
}

export function declaredStoryFlagTargets(project: Project): ReadonlySet<string> {
  return new Set((project.storyFlags ?? [])
    .filter((flag) => flag.retired !== true)
    .map((flag) => `${flag.kind}:${flag.targetId}`));
}

function scanCommands(
  commands: unknown,
  add: (access: StoryFlagAccess, kind: StoryFlagKind, targetId: string | undefined, location: UsageLocation) => void,
  owner: UsageOwner,
  path: string
): void {
  if (!Array.isArray(commands)) return;
  for (const [index, command] of commands.entries()) {
    if (typeof command !== "object" || command === null || Array.isArray(command)) continue;
    const commandPath = `${path}[${index}]`;
    scanCommand(command as Command, add, owner, commandPath);
  }
}

function scanCommand(
  command: Command,
  add: (access: StoryFlagAccess, kind: StoryFlagKind, targetId: string | undefined, location: UsageLocation) => void,
  owner: UsageOwner,
  commandPath: string
): void {
  switch (command.kind) {
    case "setSwitch":
      add("write", "switch", command.switchId, { ...owner, commandPath, detail: "setSwitch" });
      if (typeof command.value === "object" && command.value !== null && command.value.kind === "var") {
        add("read", "variable", command.value.id, { ...owner, commandPath: `${commandPath}.value`, detail: "setSwitch operand" });
      }
      break;
    case "setVariable":
      add("write", "variable", command.variableId, { ...owner, commandPath, detail: "setVariable" });
      if (typeof command.value === "object" && command.value !== null && command.value.kind === "var") {
        add("read", "variable", command.value.id, { ...owner, commandPath: `${commandPath}.value`, detail: "setVariable operand" });
      }
      break;
    case "changeGold":
      if (typeof command.amount === "object" && command.amount !== null && command.amount.kind === "var") {
        add("read", "variable", command.amount.id, { ...owner, commandPath: `${commandPath}.amount`, detail: "changeGold amount" });
      }
      break;
    case "changeExp":
      if (typeof command.amount === "object" && command.amount !== null && command.amount.kind === "var") {
        add("read", "variable", command.amount.id, { ...owner, commandPath: `${commandPath}.amount`, detail: "changeExp amount" });
      }
      break;
    case "changeItem":
      if (typeof command.amount === "object" && command.amount !== null && command.amount.kind === "var") {
        add("read", "variable", command.amount.id, { ...owner, commandPath: `${commandPath}.amount`, detail: "changeItem amount" });
      }
      break;
    case "inputWait":
      add("write", "variable", command.variableId, { ...owner, commandPath, detail: "inputWait variable" });
      break;
    case "inputNumber":
      add("write", "variable", command.variableId, { ...owner, commandPath, detail: "inputNumber variable" });
      break;
    case "getFriendship":
      add("write", "variable", command.variableId, { ...owner, commandPath, detail: "getFriendship result" });
      break;
    case "fork":
      addConditionReads(command.condition, add, { ...owner, commandPath: `${commandPath}.condition`, detail: "conditional branch" });
      scanCommands(command.then, add, owner, `${commandPath}.then`);
      if (command.else) scanCommands(command.else, add, owner, `${commandPath}.else`);
      break;
    case "choices":
      if (!Array.isArray(command.options)) break;
      for (const [optionIndex, option] of command.options.entries()) {
        scanCommands(option.branch, add, owner, `${commandPath}.options[${optionIndex}].branch`);
      }
      if (command.cancelBranch) scanCommands(command.cancelBranch, add, owner, `${commandPath}.cancelBranch`);
      break;
    case "loop":
      scanCommands(command.body, add, owner, `${commandPath}.body`);
      break;
    case "moveEvent":
      scanMoveRoute(command.route, add, { ...owner, commandPath: `${commandPath}.route`, detail: "moveEvent route" });
      break;
    case "shop":
      if (command.transactionBranch) scanCommands(command.transactionBranch, add, owner, `${commandPath}.transactionBranch`);
      break;
    case "promoteActor":
      if (command.successBranch) scanCommands(command.successBranch, add, owner, `${commandPath}.successBranch`);
      if (command.failureBranch) scanCommands(command.failureBranch, add, owner, `${commandPath}.failureBranch`);
      break;
    case "evolveMonster":
      if (command.successBranch) scanCommands(command.successBranch, add, owner, `${commandPath}.successBranch`);
      if (command.failureBranch) scanCommands(command.failureBranch, add, owner, `${commandPath}.failureBranch`);
      break;
    case "m2Command":
      scanM2Command(command.fields, add, owner, commandPath);
      break;
  }
}

function scanMoveRoute(
  route: MoveRoute | undefined,
  add: (access: StoryFlagAccess, kind: StoryFlagKind, targetId: string | undefined, location: UsageLocation) => void,
  location: UsageLocation
): void {
  if (!route) return;
  for (const [index, move] of route.moves.entries()) {
    if (move.kind !== "setSwitch") continue;
    add("write", "switch", move.switchId, {
      ...location,
      commandPath: `${location.commandPath}.moves[${index}]`,
      detail: "move route setSwitch",
    });
  }
}

function addConditionReads(
  condition: Condition | undefined,
  add: (access: StoryFlagAccess, kind: StoryFlagKind, targetId: string | undefined, location: UsageLocation) => void,
  location: UsageLocation
): void {
  if (!condition) return;
  if (condition.kind === "switch") add("read", "switch", condition.switchId, location);
  if (condition.kind === "variable") add("read", "variable", condition.variableId, location);
  if (condition.kind === "all" || condition.kind === "any") {
    for (const child of condition.conditions) addConditionReads(child, add, location);
  }
  if (condition.kind === "not") addConditionReads(condition.condition, add, location);
}

function addBattleConditionReads(
  condition: BattleEventCondition | undefined,
  add: (access: StoryFlagAccess, kind: StoryFlagKind, targetId: string | undefined, location: UsageLocation) => void,
  location: UsageLocation
): void {
  if (!condition) return;
  if (condition.kind === "switch") add("read", "switch", condition.switchId, location);
  if (condition.kind === "variable") add("read", "variable", condition.variableId, location);
}

function scanM2Command(
  fields: Record<string, string | number | boolean>,
  add: (access: StoryFlagAccess, kind: StoryFlagKind, targetId: string | undefined, location: UsageLocation) => void,
  owner: UsageOwner,
  commandPath: string
): void {
  const condition = typeof fields.condition === "string" ? fields.condition : "";
  const target = typeof fields.target === "string" ? fields.target : undefined;
  if (condition === "switchOn" || condition === "switchOff") {
    add("read", "switch", target, { ...owner, commandPath: `${commandPath}.fields.target`, detail: "m2 Wait Until switch" });
  } else if (condition === "variable") {
    add("read", "variable", target, { ...owner, commandPath: `${commandPath}.fields.target`, detail: "m2 Wait Until variable" });
  }

  const query = typeof fields.query === "string" ? fields.query : "";
  if (query === "switch") add("read", "switch", target, { ...owner, commandPath: `${commandPath}.fields.target`, detail: "m2 Data Query switch" });
  if (query === "variable") add("read", "variable", target, { ...owner, commandPath: `${commandPath}.fields.target`, detail: "m2 Data Query variable" });

  add("write", "switch", typeof fields.switchId === "string" ? fields.switchId : undefined, {
    ...owner,
    commandPath: `${commandPath}.fields.switchId`,
    detail: "m2 switch output",
  });
  add("write", "variable", typeof fields.variableId === "string" ? fields.variableId : undefined, {
    ...owner,
    commandPath: `${commandPath}.fields.variableId`,
    detail: "m2 variable output",
  });
  add("write", "variable", typeof fields.resultVariableId === "string" ? fields.resultVariableId : undefined, {
    ...owner,
    commandPath: `${commandPath}.fields.resultVariableId`,
    detail: "m2 result variable",
  });
}

function usageLabel(location: UsageLocation): string {
  if (location.source === "map-event") {
    const page = location.pageNumber ? `/page${location.pageNumber}` : "";
    return `map:${location.mapId} event:${location.eventId}${page} ${location.conditionPath ?? location.commandPath ?? ""}`.trim();
  }
  if (location.source === "common-event") {
    return `common:${location.commonEventId} ${location.conditionPath ?? location.commandPath ?? ""}`.trim();
  }
  const page = location.pageNumber ? `/page${location.pageNumber}` : "";
  return `troop:${location.troopId}${page} ${location.conditionPath ?? location.commandPath ?? ""}`.trim();
}
