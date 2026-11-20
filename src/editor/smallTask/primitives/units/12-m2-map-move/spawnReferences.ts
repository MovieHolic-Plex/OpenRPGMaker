import { LOOP_BODY_BRANCH_INDEX, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import type { Command, EventPage, M2CommandFields, Project } from "@/project/types";

export function spawnedEventId(fields: Readonly<Partial<M2CommandFields>>): string {
  const template = String(fields.templateEventId ?? fields.prefabId ?? "");
  return String(fields.eventId ?? (template ? `${template}_spawn` : "spawned-event"));
}

export function hasEarlierSpawn(project: Project, page: EventPage, path: readonly number[], id: string): boolean {
  function spawnsEvent(command: Command): boolean {
    if (command.kind !== "m2Command" || command.commandId !== "m2-203-spawn-event" || spawnedEventId(command.fields) !== id) return false;
    const templateId = String(command.fields.templateEventId ?? command.fields.prefabId ?? "");
    return Boolean(templateId) && Object.values(project.maps).some(map => map.events.some(event => event.id === templateId));
  }

  function executionLists(command: Command): readonly (readonly Command[])[] {
    if (command.kind === "callCommonEvent") {
      const common = project.commonEvents.find(event => event.id === command.commonEventId);
      return common ? [common.commands] : [];
    }
    if (command.kind === "callMapEvent") {
      // A transfer can change the active map before the call.
      return Object.values(project.maps).flatMap(map => map.events
        .filter(event => event.id === command.eventId)
        .flatMap(event => [event.commands, ...(event.pages ?? []).map(page => page.commands)]));
    }
    return nestedCommandLists(command);
  }

  const jumpTargets = new Set<string>();
  const scannedJumps = new Set<readonly Command[]>();
  function collectJumps(commands: readonly Command[]) {
    if (scannedJumps.has(commands)) return;
    scannedJumps.add(commands);
    for (const command of commands) {
      if (command.kind === "gotoLabel") jumpTargets.add(command.name);
      for (const branch of executionLists(command)) collectJumps(branch);
    }
  }
  function mayRemove(command: Command, seen: Set<Command>): boolean {
    if (seen.has(command)) return false;
    seen.add(command);
    // A script can run an arbitrary event command through game.cmd.
    if (command.kind === "script" && command.compiled?.trim()) return true;
    if (command.kind === "m2Command" && command.commandId === "m2-204-remove-event" && String(command.fields.eventId ?? "") === id) return true;
    return executionLists(command).some(branch => branch.some(child => mayRemove(child, seen)));
  }
  collectJumps(page.commands);
  let live = false;
  for (let depth = 0; depth < path.length; depth += 2) {
    const list = resolveCommandListAtPath(page.commands, path.slice(0, depth + 1))!;
    for (const command of list.slice(0, path[depth])) {
      if (spawnsEvent(command)) live = true;
      if (command.kind === "label" && jumpTargets.has(command.name)) live = false;
      if (live && mayRemove(command, new Set())) live = false;
    }
    if (path[depth + 1] === LOOP_BODY_BRANCH_INDEX) live = false;
  }
  return live;
}

const EVENT_REFERENCE_FIELDS = new Set([
  "eventId", "eventIds", "eventA", "eventB", "event", "target", "targetEventId",
  "sourceEventId", "templateEventId", "prefabId", "hostEventId", "anchorEventId", "npcKey",
  "mapEventId", "returnEventId", "routeTarget", "removedEventIds",
]);

export function findSpawnUsage(
  project: Project, id: string, ownCommand: Command | undefined, kind: "declaration" | "reference" | "removalFlag",
): boolean {
  const removalFlag = `event-removed:${id}`;
  const eventTarget = `event:${id}`;
  const matches = (value: unknown) => value === id || value === eventTarget || value === removalFlag;
  const visited = new WeakSet<object>();
  const scriptLiterals = kind === "reference" ? [id, eventTarget, removalFlag] : [removalFlag];

  function mentionsReference(source: string): boolean {
    return scriptLiterals.some(literal => source.includes(JSON.stringify(literal))
      || source.includes(`'${literal}'`) || source.includes(`\`${literal}\``));
  }

  function visit(value: unknown, key = ""): boolean {
    if (kind !== "declaration" && value === removalFlag) return true;
    if (kind === "reference" && EVENT_REFERENCE_FIELDS.has(key) && matches(value)) return true;
    if (!value || typeof value !== "object" || value === ownCommand) return false;
    if (visited.has(value)) return false;
    visited.add(value);
    if (Array.isArray(value)) return value.some(child => visit(child, key));
    const record = value as Record<string, unknown>;
    if (kind === "reference" && record.kind === "event" && record.id === id) return true;
    if (kind === "reference" && key === "selfSwitches" && Object.hasOwn(record, id)) return true;
    if (kind !== "declaration" && typeof record.source === "string" && typeof record.compiled === "string"
      && (mentionsReference(record.source) || mentionsReference(record.compiled))) return true;
    if (record.kind === "m2Command" && record.commandId === "m2-203-spawn-event") {
      const fields = (value as Extract<Command, { kind: "m2Command" }>).fields;
      if (kind === "declaration") return spawnedEventId(fields) === id;
      return Object.entries(fields).some(([field, entry]) => field !== "eventId" && visit(entry, field));
    }
    if (kind === "reference" && record.kind === "m2Command" && record.commandId === "m2-041-swap-event-location") {
      const fields = (value as Extract<Command, { kind: "m2Command" }>).fields;
      if (matches(fields.eventB ?? fields.value ?? fields.mapId)) return true;
    }
    return Object.entries(record).some(([field, child]) => {
      // An original draft is the same declaration, but its references can reappear on cancel.
      if (field === "draft" && kind === "declaration") return false;
      return (kind !== "declaration" && field === removalFlag) || visit(child, field);
    });
  }

  // Tile sheets and resource payloads cannot carry authored event references.
  const { maps, tilesets, assets, ...authored } = project;
  return Object.values(maps).some(map => visit(map.events) || visit(map.locations) || visit(map.encounterTable))
    || visit(authored);
}
