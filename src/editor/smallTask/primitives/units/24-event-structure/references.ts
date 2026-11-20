import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { scriptCalls, scriptHasDynamic, scriptReads, scriptWrites } from "@/project/script/effects";
import type { EventPage, GameEvent, Project } from "@/project/types";

type RecordNode = Record<string, unknown>;

function someRecord(value: unknown, test: (node: RecordNode) => boolean): boolean {
  if (Array.isArray(value)) return value.some(child => someRecord(child, test));
  if (value === null || typeof value !== "object") return false;
  const node = value as RecordNode;
  return test(node) || (node.kind !== "m2Command" && Object.values(node).some(child => someRecord(child, test)));
}

const isId = (value: unknown, id: string) => typeof value === "string" && value.trim() === id;
const pointsTo = (map: unknown, mapId: string) => typeof map !== "string" || !map.trim() || map.trim() === mapId;
const m2Index = (node: RecordNode) => typeof node.commandId === "string" ? m2CommandById(node.commandId)?.index : undefined;

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
      return [fields.target, fields.targetEventId, fields.eventId].some(value => isId(value, id));
    case 54: case 55: case 56: case 57:
    case 204: case 205: case 206: case 224: case 225:
      return [fields.target, fields.eventId, fields.event].some(value => isId(value, id));
    default: return false;
  }
}

function authoredRoots(project: Project) {
  return [project.commonEvents, project.database, project.quests, project.gameBlueprint, project.system,
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
    if (fields?.surface !== "objectiveChip" || typeof fields.message !== "string") return false;
    if (typeof fields.targetMapId === "string" && typeof fields.targetEventId === "string"
      && project.maps[fields.targetMapId.trim()]?.events?.some(target => isId(fields.targetEventId, target.id))) return false;
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

export function strandsSwitch(after: Project, removed: unknown): boolean {
  const enabled = new Set<string>();
  const written = (node: RecordNode) => {
    if (node.kind === "script") return scriptWrites(node, "switch", after);
    return node.kind === "setSwitch" && node.value !== false && typeof node.switchId === "string" ? [node.switchId] : [];
  };
  someRecord(removed, node => {
    for (const id of written(node)) enabled.add(id);
    return false;
  });
  if (!enabled.size) return false;
  const roots = [Object.values(after.maps).map(map => map.events), after.commonEvents, after.database.troops];
  if (someRecord(roots, node => node.kind === "script"
    && scriptHasDynamic(node, "switch", { access: "write", library: after.scriptLibrary }))) return false;
  someRecord(roots, node => {
    for (const id of written(node)) enabled.delete(id);
    return enabled.size === 0;
  });
  return enabled.size > 0 && someRecord(roots, node => {
    if (node.kind === "m2Command") {
      const fields = node.fields as RecordNode | undefined;
      return typeof fields?.target === "string" && enabled.has(fields.target)
        && ((m2Index(node) === 206 && fields.condition === "switchOn")
          || (m2Index(node) === 217 && fields.query === "switch"));
    }
    return (node.kind === "switch" && node.value !== false && typeof node.switchId === "string" && enabled.has(node.switchId))
      || (typeof node.conditionSwitchId === "string" && enabled.has(node.conditionSwitchId))
      || (node.kind === "script" && scriptReads(node, "switch", after).some(id => enabled.has(id)));
  });
}

export function strandsSelfSwitch(event: GameEvent, removed: EventPage): boolean {
  const written = (node: RecordNode) => node.kind === "setSelfSwitch" && node.value === true && typeof node.key === "string"
    ? node.key : undefined;
  const remaining = [event.commands, event.pages];
  const keys = new Set<string>();
  someRecord(removed.commands, node => {
    const key = written(node);
    if (key) keys.add(key);
    return false;
  });
  if (!keys.size) return false;
  someRecord(remaining, node => {
    const key = written(node);
    if (key) keys.delete(key);
    return keys.size === 0;
  });
  return keys.size > 0 && someRecord(remaining, node =>
    node.kind === "selfSwitch" && node.value === true && typeof node.key === "string" && keys.has(node.key));
}
