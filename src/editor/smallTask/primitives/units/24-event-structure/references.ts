import { withOpenEventDrafts, type SmallTaskDraftSource } from "@/ai/smallTaskReferences";
import { gotoLabel } from "@/player/interpreter/stack";
import type { Frame } from "@/player/interpreter/types";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { getCharacterProfile } from "@/project/characterProfiles";
import { MAX_SHOWN_CHOICES } from "@/project/choiceView";
import { compareVariableValue } from "@/project/conditionEvaluation";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { scriptCalls, scriptHasDynamic, scriptReads, scriptWrites } from "@/project/script/effects";
import { clampVariableValue, startStateOf } from "@/project/session";
import { sightWatcherIds } from "@/project/sightWatchers";
import { resolveSpeakerActor } from "@/project/staging/dialogueActors";
import { storyFlagById } from "@/project/storyFlags";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, Condition, EventPage, EventSightWatchers, GameEvent, MoveRoute, Project } from "@/project/types";

type RecordNode = Record<string, unknown>;

function someRecord(value: unknown, test: (node: RecordNode) => boolean, descend?: (node: RecordNode) => boolean): boolean {
  if (Array.isArray(value)) return value.some(child => someRecord(child, test, descend));
  if (value === null || typeof value !== "object") return false;
  const node = value as RecordNode;
  return test(node) || (node.kind !== "m2Command" && (descend?.(node) ?? true)
    && Object.values(node).some(child => someRecord(child, test, descend)));
}

const isId = (value: unknown, id: string) => typeof value === "string" && value.trim() === id;
const pointsTo = (map: unknown, mapId: string) => typeof map !== "string" || !map.trim() || map.trim() === mapId;
const m2Index = (node: RecordNode) => typeof node.commandId === "string" ? m2CommandById(node.commandId)?.index : undefined;
// These commands search across maps for their event ID.
const globalM2Targets = new Set([40, 41, 203]);
const moveStageTargets = new Set(["approach", "turnToward", "exitVia", "enterVia", "doorCue"]);

function m2EventReference(node: RecordNode, mapId: string, id: string): boolean {
  const fields = node.fields as RecordNode | undefined;
  if (!fields) return false;
  switch (m2Index(node)) {
    case 203:
      // The runtime can fall back to a template on another map.
      return isId(fields.templateEventId ?? fields.prefabId, id);
    case 214:
      return pointsTo(fields.targetMapId, mapId) && isId(fields.targetEventId, id);
    case 41:
      return isId(fields.eventA ?? fields.target, id) || isId(fields.eventB ?? fields.value ?? fields.mapId, id);
    case 40:
      return isId(fields.target, id);
    case 201:
      return [fields.target, fields.targetEventId, fields.eventId].some(value => isId(value, id))
        || isId(fields.target, `event:${id}`);
    case 54: case 55: case 56: case 57:
    case 204: case 205: case 206: case 224: case 225:
      return [fields.target, fields.eventId, fields.event].some(value => isId(value, id));
    default: return false;
  }
}

function authoredRoots(project: Project) {
  return [project.commonEvents, project.database, project.quests, project.endings, project.gameBlueprint, project.system,
    project.session.farmAnimals, project.spatialAuthoring, project.worldAtlases, project.worldGraph,
    project.testPresets, project.meta.oprnCinematicTimelines];
}

export function hasEventReference(project: Project, mapId: string, id: string, includeDynamicScripts = true): boolean {
  const references = (node: RecordNode) => {
    if (node.kind === "m2Command") return m2EventReference(node, mapId, id);
    if (node.kind === "script") {
      return scriptReads(node, "event", project).includes(id) || scriptWrites(node, "event", project).includes(id)
        || scriptCalls(node, "event", project).includes(id)
        || (includeDynamicScripts && scriptHasDynamic(node, "event", { library: project.scriptLibrary }));
    }
    if (node.kind === "text" && (isId(node.speakerActor, id) || isId(node.addressee, id))) return true;
    if (typeof node.kind === "string" && moveStageTargets.has(node.kind)
      && (isId(node.target, id) || isId(node.actor, id) || isId(node.door, id))) return true;
    if (node.kind === "say" && (isId(node.actor, id) || isId(node.to, id))) return true;
    if (node.kind === "faceEachOther" && (isId(node.a, id) || isId(node.b, id))) return true;
    if ((node.kind === "moveActor" || node.kind === "faceToward" || node.kind === "camera")
      && (isId(node.actor, id) || isId(node.target, id))) return true;
    return pointsTo(node.mapId, mapId) && (isId(node.eventId, id) || isId(node.returnEventId, id)
      || (Array.isArray(node.eventIds) && node.eventIds.includes(id)))
      || pointsTo(node.templateMapId, mapId) && isId(node.templateEventId, id);
  };
  if (Object.hasOwn(project.meta.oprnCharacterRoles ?? {}, `${mapId}/${id}`)) return true;
  if (someRecord(authoredRoots(project), references)) return true;
  return Object.values(project.maps).some(map => {
    // Local targets in another map with the same ID resolve to that map's own event.
    // An explicitly paired map ID can still point across maps from the same command tree.
    const localIdExists = map.id !== mapId && map.events.some(event => event.id === id);
    return someRecord([map.events, map.defaultLighting, map.encounterTable, map.fieldSpawns], node => {
      if (localIdExists && node.mapId === undefined && node.targetMapId === undefined && node.templateMapId === undefined) {
        if (node.kind === "m2Command" && globalM2Targets.has(m2Index(node) ?? -1)) return references(node);
        const fields = node.kind === "m2Command" ? node.fields as RecordNode | undefined : undefined;
        if (!fields || ![fields.targetMapId, fields.templateMapId, fields.sourceMapId].some(value => value === mapId)) return false;
      }
      return references(node);
    });
  });
}

const objectiveName = (name: string) => name.replace(/[\s「」『』"'·.,!?]/gu, "");

export function hasNamedObjective(project: Project, event: GameEvent, newName = ""): boolean {
  const oldName = objectiveName(event.name ?? "");
  const nextName = objectiveName(newName);
  if (!oldName || oldName === nextName) return false;
  const namesEvent = (node: RecordNode) => {
    if (node.kind !== "m2Command" || m2Index(node) !== 214) return false;
    const fields = node.fields as RecordNode | undefined;
    if (!isId(fields?.surface, "objectiveChip") || typeof fields?.message !== "string") return false;
    if (typeof fields.targetMapId === "string") {
      const target = project.maps[fields.targetMapId.trim()]?.events.find(candidate => isId(fields.targetEventId, candidate.id));
      const page = target?.pages?.at(-1);
      // The runtime falls back to the text when the ID's active page cannot be interacted with.
      if (page && !page.conditions.length && page.commands.length
        && ["action", "playerTouch", "eventTouch"].includes(page.trigger.kind)) return false;
    }
    const message = objectiveName(fields.message);
    const tail = /\(([^():]+):([^()]*)\)\s*$/u.exec(fields.message);
    const tailNames = [tail?.[1], ...(tail?.[2]?.split("→").slice(1).join("·").split("·") ?? [])];
    const matches = (name: string) => (name.length >= 2 && message.includes(name))
      || tailNames.some(part => part !== undefined && objectiveName(part) === name);
    return matches(oldName) && !(nextName && matches(nextName));
  };
  return someRecord(authoredRoots(project), namesEvent)
    || Object.values(project.maps).some(map => someRecord(map.events, namesEvent));
}

export function hasNamedEventReference(project: Project, mapId: string, event: GameEvent, name?: string): boolean {
  const map = project.maps[mapId];
  const remaining = name === undefined ? map.events.filter(entry => entry.id !== event.id)
    : map.events.map(entry => entry.id === event.id ? { ...entry, name } : entry);
  const candidates = (events: readonly GameEvent[]) => events.filter(entry => entry.pages?.length
    ? entry.pages.some(page => !page.graphic?.transparent && (page.graphic?.sprite || page.graphic?.appearanceId || entry.sprite))
    : entry.sprite).map(entry => ({
    id: entry.id, x: entry.x, y: entry.y,
    names: [entry.name ?? "", getCharacterProfile(project, entry.characterId)?.displayName ?? ""],
  }));
  const beforeActors = candidates(map.events);
  const afterActors = candidates(remaining);
  const leader = project.database.actors.find(actor => actor.id === project.session.partyActorIds?.[0]) ?? project.database.actors[0];
  const refers = (root: unknown, ownerId?: string) => someRecord(root, node => {
    if (node.kind === "eventSeesPlayer" && !node.eventId && node.watchers) {
      const watchers = node.watchers as EventSightWatchers;
      return sightWatcherIds([event], watchers, map.locations).length > 0
        && sightWatcherIds(remaining, watchers, map.locations).length === 0;
    }
    const fields = node.kind === "m2Command" && m2Index(node) === 209 ? node.fields as RecordNode : node;
    if ((node.kind !== "text" && fields === node) || typeof fields?.speaker !== "string" || !fields.speaker.trim()) return false;
    if (typeof fields.speakerActor === "string" && fields.speakerActor.trim()) return false;
    const input = { speaker: fields.speaker, currentEventId: ownerId, playerNames: leader ? [leader.name] : [], player: null };
    const before = resolveSpeakerActor({ ...input, visible: beforeActors });
    const after = resolveSpeakerActor({ ...input, visible: afterActors });
    return (before === event.id) !== (after === event.id);
  });
  return refers(authoredRoots(project)) || (name === undefined ? remaining : map.events).some(owner => refers(owner, owner.id));
}

export function anOpenDraftReferencesDeletedEvent(
  before: Project, after: Project, mapId: string, event: GameEvent, live?: SmallTaskDraftSource,
): boolean {
  const target = { mapId, eventId: event.id };
  const workingAfter = withOpenEventDrafts(after, live, target);
  if (workingAfter === after) return false;
  const workingBefore = withOpenEventDrafts(before, live, target);
  return hasEventReference(workingAfter, mapId, event.id) || hasNamedObjective(workingAfter, event)
    || switchesStrandedByDeletion(workingAfter, event).global
    || hasNamedEventReference(workingBefore, mapId, event);
}

export function pageIsShadowed(event: GameEvent, page: EventPage): boolean {
  const pages = event.pages ?? [];
  return pages.slice(pages.indexOf(page) + 1).some(later => !later.conditions?.length);
}

const globalKey = (id: string) => `switch:${id}`;
const selfKey = (eventId: string, key: string) => `self:${eventId}:${key}`;
const variableKey = (id: string) => `variable:${id}`;

function readGlobalSwitch(project: Project, node: RecordNode): string | undefined {
  if (node.kind !== "switch" && node.kind !== "storyFlag") return undefined;
  const flagId = node.kind === "switch" ? node.storyFlagId : node.flagId;
  if (typeof flagId === "string" && flagId.trim()) {
    const flag = storyFlagById(project, flagId);
    return flag?.kind === "switch" ? flag.targetId : undefined;
  }
  return typeof node.switchId === "string" ? node.switchId : undefined;
}

export function switchesStrandedByDeletion(after: Project, removed: EventPage | GameEvent, owner?: GameEvent) {
  const global = new Set<string>();
  const local = new Map<string, string>();
  const removedCommands = "x" in removed
    ? (removed.pages?.length ? removed.pages.filter(page => !pageIsShadowed(removed, page)) : [removed.commands, removed.moveRoute])
    : removed;
  someRecord(removedCommands, node => {
    if (node.kind === "setSwitch" && node.value !== false && typeof node.switchId === "string") global.add(node.switchId);
    if (node.kind === "script") for (const id of scriptWrites(node, "switch", after)) global.add(id);
    if (owner && node.kind === "setSelfSwitch" && node.value === true && typeof node.key === "string") {
      local.set(node.key, selfKey(owner.id, node.key));
    }
    return false;
  });
  if (!global.size && !local.size) return { global: false, self: false };

  const events = Object.values(after.maps).flatMap(map => map.events);
  const targets = new Set([...Array.from(global, globalKey), ...local.values()]);
  const stranded = unreplacedSwitches(after, events, targets);
  if (!stranded.size) return { global: false, self: false };
  const readsGlobal = (node: RecordNode) => {
    const id = readGlobalSwitch(after, node);
    return id !== undefined && stranded.has(globalKey(id));
  };
  const readsSelf = (node: RecordNode) => node.kind === "selfSwitch"
    && typeof node.key === "string" && stranded.has(local.get(node.key) ?? "");

  return {
    self: local.size > 0 && someRecord(owner?.pages, node => requiresSwitchOn(node, readsSelf), outsideCompoundCondition),
    global: global.size > 0 && someRecord([events, ...authoredRoots(after)], node => {
      if (node.kind === "m2Command") {
        const fields = node.fields as RecordNode | undefined;
        return typeof fields?.target === "string" && stranded.has(globalKey(fields.target))
          && ((m2Index(node) === 206 && (fields.condition === "switchOn" || fields.condition === undefined))
            || (m2Index(node) === 217 && fields.query === "switch"));
      }
      return requiresSwitchOn(node, readsGlobal)
        || (typeof node.conditionSwitchId === "string" && stranded.has(globalKey(node.conditionSwitchId)))
        || (node.kind === "script" && scriptReads(node, "switch", after).some(id => stranded.has(globalKey(id))));
    }, outsideCompoundCondition),
  };
}

function outsideCompoundCondition(node: RecordNode): boolean {
  return node.kind !== "not" && node.kind !== "all" && node.kind !== "any";
}

function requiresSwitchOn(node: RecordNode, matches: (node: RecordNode) => boolean): boolean {
  return evaluateCondition(node, leaf => matches(leaf) ? leaf.value === false : undefined) !== true
    && readsSwitchOn(node, matches);
}

function readsSwitchOn(value: unknown, matches: (node: RecordNode) => boolean, negated = false): boolean {
  if (!value || typeof value !== "object") return false;
  const node = value as RecordNode;
  if (node.kind === "not") return readsSwitchOn(node.condition, matches, !negated);
  if (node.kind === "all" || node.kind === "any") {
    return Array.isArray(node.conditions) && node.conditions.some(child => readsSwitchOn(child, matches, negated));
  }
  return (node.value === false) === negated && matches(node);
}

function evaluateCondition(value: unknown, leaf: (node: RecordNode) => boolean | undefined): boolean | undefined {
  if (!value || typeof value !== "object") return undefined;
  const node = value as RecordNode;
  if (node.kind === "not") {
    const result = evaluateCondition(node.condition, leaf);
    return result === undefined ? undefined : !result;
  }
  if ((node.kind === "all" || node.kind === "any") && Array.isArray(node.conditions)) {
    const results = node.conditions.map(child => evaluateCondition(child, leaf));
    const decisive = node.kind === "any";
    if (results.includes(decisive)) return decisive;
    if (results.every(result => result === !decisive)) return !decisive;
  }
  return leaf(node);
}

type State = ReadonlyMap<string, boolean | number>;
type ConditionEvaluator = (condition: unknown, state: State, eventId?: string) => boolean | undefined;

function routeSwitches(route: MoveRoute | undefined): Command[] {
  return route?.moves.filter(move => move.kind === "setSwitch") ?? [];
}

function* activeCommandLists(event: GameEvent, state: State, evaluate: ConditionEvaluator): Generator<Command[]> {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index--) {
    const page = pages[index];
    const results = (page.conditions ?? []).map(condition => evaluate(condition, state, event.id));
    if (results.includes(false)) continue;
    yield page.commands;
    yield routeSwitches(page.movement?.route);
    if (results.every(result => result === true)) return;
  }
  if (!pages.length && evaluate(event.condition, state, event.id) !== false) {
    yield event.commands;
    yield routeSwitches(event.moveRoute);
  }
}

const MAX_REACHABLE_STATES = 256;
const MAX_COMMAND_STEPS = 2048;

function unreplacedSwitches(project: Project, events: GameEvent[], targets: ReadonlySet<string>): Set<string> {
  const commonEvents = project.commonEvents ?? [];
  const commonCommands = new Map(commonEvents.map(event => [event.id, event.commands]));
  const otherLists = project.database.troops.flatMap(troop => [
    ...troop.battleEventPages.map(page => page.commands), ...troopAfterBattleLists(troop).map(entry => entry.commands),
  ]);
  const start = startStateOf(project);
  const initial = new Map<string, boolean | number>();
  for (const [id, value] of Object.entries(project.flags)) initial.set(globalKey(id), value);
  for (const { id } of project.switches) initial.set(globalKey(id), start.switches?.[id] ?? false);
  for (const { id } of project.variables) initial.set(variableKey(id), start.variables?.[id] ?? 0);

  // Keep state for candidate switches and values that can affect subsequent execution.
  const tracked = new Set(targets);
  const selfReads = new Set<string>();
  const possibleOff = new Set<string>();
  someRecord([events, commonEvents, otherLists], node => {
    const switchId = readGlobalSwitch(project, node);
    if (switchId !== undefined) tracked.add(globalKey(switchId));
    if (typeof node.conditionSwitchId === "string") tracked.add(globalKey(node.conditionSwitchId));
    if (node.kind === "selfSwitch" && typeof node.key === "string") selfReads.add(node.key);
    if (node.kind === "variable" && typeof node.variableId === "string") tracked.add(variableKey(node.variableId));
    if (node.kind === "var" && typeof node.id === "string") tracked.add(variableKey(node.id));
    if (node.kind === "setSwitch" && node.value !== true && typeof node.switchId === "string") {
      possibleOff.add(globalKey(node.switchId));
    }
    return false;
  });

  const switchOn = (state: State, key: string) => (state.get(key) ?? initial.get(key)) === true;
  const readVariable = (state: State, id: string) => Number(state.get(variableKey(id)) ?? initial.get(variableKey(id)) ?? 0);
  const evaluate: ConditionEvaluator = (condition, state, eventId) => evaluateCondition(condition, node => {
    const id = readGlobalSwitch(project, node);
    if (id !== undefined) return switchOn(state, globalKey(id)) === (node.value !== false);
    if (node.kind === "selfSwitch" && typeof node.key === "string") {
      return Boolean(eventId && switchOn(state, selfKey(eventId, node.key))) === (node.value !== false);
    }
    if (node.kind === "variable" && typeof node.variableId === "string" && typeof node.value === "number") {
      const { op } = node as Extract<Condition, { kind: "variable" }>;
      return compareVariableValue(readVariable(state, node.variableId), op, node.value);
    }
    return undefined;
  });

  const replaced = new Set<string>();
  const empty: State = new Map();
  const seenOff = new Set([...targets].filter(key => !switchOn(empty, key)));
  const states: State[] = [empty];
  const seenStates = new Set<string>(["[]"]);
  const stateKeys = new WeakMap<State, string>();
  const relevantLists = new WeakMap<Command[], boolean>();
  let truncated = false;
  const stateKey = (state: State) => {
    let key = stateKeys.get(state);
    if (key === undefined) {
      key = JSON.stringify([...state].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
      stateKeys.set(state, key);
    }
    return key;
  };
  const enqueue = (state: State) => {
    const key = stateKey(state);
    if (seenStates.has(key)) return;
    if (states.length >= MAX_REACHABLE_STATES) { truncated = true; return; }
    seenStates.add(key);
    states.push(state);
  };

  const run = (commands: Command[], state: State, eventId?: string) => {
    if (!commands.length || replaced.size === targets.size) return;
    if (!relevantLists.has(commands)) {
      relevantLists.set(commands, someRecord(commands, node => node.kind === "setSwitch" || node.kind === "setSelfSwitch"
        || node.kind === "setVariable" || node.kind === "callCommonEvent" || node.kind === "script"));
    }
    if (!relevantLists.get(commands)) return;
    const write = (prior: State, key: string, value: boolean | number, fallback: boolean | number) => {
      const current = prior.get(key) ?? initial.get(key) ?? fallback;
      if (targets.has(key) && value === true && current === false) replaced.add(key);
      if (targets.has(key) && value === false) seenOff.add(key);
      if (current === value) return prior;
      const next = new Map(prior);
      if ((initial.get(key) ?? fallback) === value) next.delete(key);
      else next.set(key, value);
      return next;
    };
    walkCommands(commands, state, commonCommands, eventId, evaluate, (command, prior) => {
      if (command.kind === "setSwitch") {
        const key = globalKey(command.switchId);
        if (!tracked.has(key)) return prior;
        const value = command.value;
        const on = typeof value === "boolean" ? value : value === "toggle"
          ? !switchOn(prior, key) : readVariable(prior, value.id) !== 0;
        return write(prior, key, on, false);
      }
      if (command.kind === "setSelfSwitch" && eventId) {
        const key = selfKey(eventId, command.key);
        if (targets.has(key) || selfReads.has(command.key)) return write(prior, key, command.value, false);
      }
      if (command.kind === "setVariable" && tracked.has(variableKey(command.variableId))) {
        const current = readVariable(prior, command.variableId);
        const value = typeof command.value === "number" ? command.value : readVariable(prior, command.value.id);
        const result = { "=": value, "+=": current + value, "-=": current - value,
          "*=": current * value, "/=": value === 0 ? current : current / value }[command.op];
        return write(prior, variableKey(command.variableId), clampVariableValue(result), 0);
      }
      if (command.kind === "script") {
        for (const id of scriptWrites(command, "switch", project)) {
          const key = globalKey(id);
          if (tracked.has(key)) prior = write(prior, key, true, false);
        }
      }
      return prior;
    }, stateKey, enqueue, () => { truncated = true; });
  };

  // Re-evaluate page priority only between command lists, using one state for all of an event's pages.
  for (const state of states) {
    if (replaced.size === targets.size) return new Set();
    for (const event of events) for (const list of activeCommandLists(event, state, evaluate)) run(list, state, event.id);
    for (const event of commonEvents) {
      if ((event.trigger === "auto" || event.trigger === "parallel")
        && (!event.conditionSwitchId || switchOn(state, globalKey(event.conditionSwitchId)))) run(event.commands, state);
    }
    for (const list of otherLists) run(list, state);
  }
  // If exploration runs out of room, a switch with an unproven path from off still needs its original writer.
  return new Set([...targets].filter(key => !replaced.has(key) && (seenOff.has(key) || (truncated && possibleOff.has(key)))));
}

function nextBranches(command: Command, evaluate: (condition: unknown) => boolean | undefined): readonly (readonly Command[])[] {
  if (command.kind === "fork") {
    const result = evaluate(command.condition);
    if (result === true) return [command.then];
    if (result === false) return [command.else ?? []];
    return [command.then, command.else ?? []];
  }
  if (command.kind === "choices") {
    const available = command.options.slice(0, MAX_SHOWN_CHOICES).map(option => ({
      branch: option.branch,
      show: option.showWhen ? evaluate(option.showWhen) : true,
      enable: option.enableWhen ? evaluate(option.enableWhen) : true,
    }));
    const branches = available.filter(option => option.show !== false && option.enable !== false).map(option => option.branch);
    if (command.cancelBehavior === "branch") branches.push(command.cancelBranch ?? []);
    if (!available.some(option => option.show === true && option.enable === true)) branches.push([]);
    return branches;
  }
  if (command.kind === "moveEvent") return [routeSwitches(command.route), []];
  const branches = nestedCommandLists(command);
  return branches.length ? [...branches, []] : branches;
}

function walkCommands(
  commands: Command[], initial: State, common: ReadonlyMap<string, Command[]>, eventId: string | undefined,
  evaluate: ConditionEvaluator, apply: (command: Command, state: State) => State,
  stateKey: (state: State) => string, complete: (state: State) => void, truncate: () => void,
): void {
  if (!commands.length) return;
  const pending = [{ stack: [{ commands, pc: 0 }] as Frame[], state: initial }];
  const seen = new Set<string>();
  const listIds = new Map<Command[], number>();
  while (pending.length > 0) {
    const { stack, state: start } = pending.pop()!;
    let state = start;
    while (stack.length > 0) {
      const key = JSON.stringify([stateKey(state), stack.map(frame => {
        if (!listIds.has(frame.commands)) listIds.set(frame.commands, listIds.size);
        return [listIds.get(frame.commands), frame.pc, Boolean(frame.loopOwner)];
      })]);
      if (seen.has(key)) break;
      if (seen.size >= MAX_COMMAND_STEPS) { truncate(); return; }
      seen.add(key);

      const frame = stack.at(-1)!;
      const command = frame.commands[frame.pc];
      if (!command) {
        if (frame.loopOwner) frame.pc = 0;
        else stack.pop();
        continue;
      }
      frame.pc += 1;
      if (command.kind === "gotoLabel") {
        gotoLabel(stack, command.name);
        continue;
      }
      if (command.kind === "breakLoop") {
        for (let index = stack.length - 1; index >= 0; index--) {
          if (!stack[index].loopOwner) continue;
          stack.length = index;
          break;
        }
        continue;
      }
      if (command.kind === "loop") {
        if (command.body.length) stack.push({ commands: command.body, pc: 0,
          loopOwner: { commands: frame.commands, pc: frame.pc - 1, iterations: 0 } });
        continue;
      }
      if (command.kind === "callCommonEvent") {
        const called = common.get(command.commonEventId);
        if (called?.length) stack.push({ commands: called, pc: 0 });
        continue;
      }

      state = apply(command, state);
      const [branch, ...alternates] = nextBranches(command, condition => evaluate(condition, state, eventId));
      for (const alternate of alternates) {
        const frames = stack.map(entry => ({ ...entry }));
        if (alternate.length) frames.push({ commands: alternate as Command[], pc: 0 });
        pending.push({ stack: frames, state });
      }
      if (branch?.length) stack.push({ commands: branch as Command[], pc: 0 });
    }
    if (stack.length === 0) complete(state);
  }
}
