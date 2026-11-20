import { withOpenEventDrafts, type SmallTaskDraftSource } from "@/ai/smallTaskReferences";
import { getCharacterProfile } from "@/project/characterProfiles";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { scriptCalls, scriptHasDynamic, scriptReads, scriptWrites } from "@/project/script/effects";
import { sightWatcherIds } from "@/project/sightWatchers";
import { resolveSpeakerActor } from "@/project/staging/dialogueActors";
import { storyFlagById } from "@/project/storyFlags";
import type { EventPage, EventSightWatchers, GameEvent, Project } from "@/project/types";

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
  return hasEventReference(workingAfter, mapId, event.id) || hasNamedObjective(workingAfter, event) || strandsSwitch(workingAfter, event)
    || hasNamedEventReference(workingBefore, mapId, event);
}

export function pageIsShadowed(event: GameEvent, page: EventPage): boolean {
  const pages = event.pages ?? [];
  return pages.slice(pages.indexOf(page) + 1).some(later => !later.conditions?.length);
}

export function strandsSwitch(after: Project, removed: EventPage | GameEvent): boolean {
  const enabled = new Set<string>();
  const written = (node: RecordNode) => {
    if (node.kind === "script") return scriptWrites(node, "switch", after);
    return node.kind === "setSwitch" && node.value !== false && typeof node.switchId === "string" ? [node.switchId] : [];
  };
  const removedCommands = "x" in removed
    ? [removed.pages?.filter(page => !pageIsShadowed(removed, page)), legacyExecution(removed)] : removed;
  someRecord(removedCommands, node => {
    for (const id of written(node)) enabled.add(id);
    return false;
  });
  if (!enabled.size) return false;
  const events = Object.values(after.maps).flatMap(map => map.events);
  const otherRoots = authoredRoots(after).filter(root => root !== after.commonEvents);
  const blockedSwitch = (node: RecordNode) => node.kind === "switch" && typeof node.switchId === "string" && enabled.has(node.switchId);
  const evaluate = (value: unknown) => knownCondition(value, blockedSwitch, false);
  removeReplacedSwitches(enabled, id => {
    const writes = (node: RecordNode) => written(node).includes(id);
    return events.some(event => eventCanWrite(event, evaluate, writes))
      || (after.commonEvents?.some(event => !enabled.has(event.conditionSwitchId ?? "") && someExecutableWrite(event.commands, evaluate, writes)) ?? false)
      || someExecutableWrite(otherRoots, evaluate, writes);
  });
  const readsEnabledSwitch = (node: RecordNode): boolean => {
    if (node.kind !== "switch" && node.kind !== "storyFlag") return false;
    const flagId = node.kind === "switch" ? node.storyFlagId : node.flagId;
    if (typeof flagId === "string" && flagId.trim()) {
      const flag = storyFlagById(after, flagId);
      return flag?.kind === "switch" && enabled.has(flag.targetId);
    }
    return typeof node.switchId === "string" && enabled.has(node.switchId);
  };
  return enabled.size > 0 && someRecord([events, ...authoredRoots(after)], node => {
    if (node.kind === "m2Command") {
      const fields = node.fields as RecordNode | undefined;
      return typeof fields?.target === "string" && enabled.has(fields.target)
        && ((m2Index(node) === 206 && (fields.condition === "switchOn" || fields.condition === undefined))
          || (m2Index(node) === 217 && fields.query === "switch"));
    }
    return (knownCondition(node, readsEnabledSwitch, false) !== true && readsSwitchOn(node, readsEnabledSwitch))
      || (typeof node.conditionSwitchId === "string" && enabled.has(node.conditionSwitchId))
      || (node.kind === "script" && scriptReads(node, "switch", after).some(id => enabled.has(id)));
  }, outsideCompoundCondition);
}

function outsideCompoundCondition(node: RecordNode): boolean {
  return node.kind !== "not" && node.kind !== "all" && node.kind !== "any";
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

function knownCondition(value: unknown, matches: (node: RecordNode) => boolean, on: boolean): boolean | undefined {
  if (!value || typeof value !== "object") return undefined;
  const node = value as RecordNode;
  if (node.kind === "not") {
    const result = knownCondition(node.condition, matches, on);
    return result === undefined ? undefined : !result;
  }
  if ((node.kind === "all" || node.kind === "any") && Array.isArray(node.conditions)) {
    const results = node.conditions.map(child => knownCondition(child, matches, on));
    const decisive = node.kind === "any";
    if (results.includes(decisive)) return decisive;
    if (results.every(result => result === !decisive)) return !decisive;
  }
  return matches(node) ? (node.value !== false) === on : undefined;
}

type EvaluateCondition = (value: unknown) => boolean | undefined;

function someExecutableWrite(value: unknown, evaluate: EvaluateCondition, writes: (node: RecordNode) => boolean): boolean {
  return someRecord(value, node => {
    if (node.kind !== "fork") return writes(node);
    const condition = evaluate(node.condition);
    return (condition !== false && someExecutableWrite(node.then, evaluate, writes))
      || (condition !== true && someExecutableWrite(node.else, evaluate, writes));
  }, node => node.kind !== "fork");
}

function eventCanWrite(event: GameEvent, evaluate: EvaluateCondition, writes: (node: RecordNode) => boolean): boolean {
  // Higher pages take priority. Unrelated conditions remain unknown.
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index--) {
    const page = pages[index];
    const results = (page.conditions ?? []).map(evaluate);
    if (results.includes(false)) continue;
    if (someExecutableWrite([page.commands, page.movement?.route], evaluate, writes)) return true;
    if (results.every(result => result === true)) return false;
  }
  return !pages.length && evaluate(event.condition) !== false
    && someExecutableWrite([event.commands, event.moveRoute], evaluate, writes);
}

function legacyExecution(event: GameEvent) {
  return event.pages?.length ? undefined : [event.commands, event.moveRoute];
}

function removeReplacedSwitches(keys: Set<string>, hasSurvivingSetter: (id: string) => boolean): void {
  // A surviving starter can unlock another setter. A cycle with no starter leaves all its switches off.
  let previousSize: number;
  do {
    previousSize = keys.size;
    for (const id of keys) if (hasSurvivingSetter(id)) keys.delete(id);
  } while (keys.size > 0 && keys.size < previousSize);
}

export function strandsSelfSwitch(event: GameEvent, removed: EventPage): boolean {
  const written = (node: RecordNode) => node.kind === "setSelfSwitch" && node.value === true && typeof node.key === "string"
    ? node.key : undefined;
  const remaining = [legacyExecution(event), event.pages];
  const keys = new Set<string>();
  someRecord(removed.commands, node => {
    const key = written(node);
    if (key) keys.add(key);
    return false;
  });
  if (!keys.size) return false;
  const readsSelfSwitch = (node: RecordNode) => node.kind === "selfSwitch" && typeof node.key === "string" && keys.has(node.key);
  const evaluate = (value: unknown) => knownCondition(value, readsSelfSwitch, false);
  removeReplacedSwitches(keys, key => eventCanWrite(event, evaluate, node => written(node) === key));
  return keys.size > 0 && someRecord(remaining, node => knownCondition(node, readsSelfSwitch, false) !== true
    && readsSwitchOn(node, readsSelfSwitch), outsideCompoundCondition);
}
