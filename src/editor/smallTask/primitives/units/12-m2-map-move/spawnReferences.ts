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

const TEXT_FIELDS = new Set(["name", "label", "title", "text", "body", "description", "message", "summary", "source", "compiled"]);

export function findSpawnUsage(
  project: Project, id: string, ownCommand: Command | undefined, kind: "declaration" | "reference" | "removalFlag",
  includeCopies = false,
): boolean {
  const flagPrefix = "event-removed:";
  const removalFlag = flagPrefix + id;
  const eventTarget = `event:${id}`;
  const referencedRemovalIds = new Set<string>();
  const copyIds = new Set<string>();
  function matchesRemovalFlag(value: unknown): boolean {
    if (value === removalFlag) return true;
    if (includeCopies && typeof value === "string" && value.startsWith(flagPrefix)) {
      referencedRemovalIds.add(value.slice(flagPrefix.length));
    }
    return false;
  }
  const visited = new WeakSet<object>();

  function visit(value: unknown, key = ""): boolean {
    if (kind !== "declaration" && matchesRemovalFlag(value)) return true;
    // Commands can carry event targets in old generic fields such as value or mapId.
    if (kind === "reference" && (value === eventTarget || value === id) && !TEXT_FIELDS.has(key)) return true;
    if (!value || typeof value !== "object" || value === ownCommand) return false;
    if (visited.has(value)) return false;
    visited.add(value);
    if (Array.isArray(value)) return value.some(child => visit(child, key));
    const record = value as Record<string, unknown>;
    if (kind === "reference" && key === "selfSwitches" && Object.hasOwn(record, id)) return true;
    if (kind !== "declaration" && (record.kind === "script" || key === "scriptLibrary")
      && typeof record.source === "string" && typeof record.compiled === "string") {
      // game.cmd can take a computed command, including IDs or flags built at runtime.
      // The script effects index doesn't cover arbitrary command payloads.
      if (record.compiled.trim() || record.source.trim()) return true;
    }
    if (record.kind === "m2Command" && record.commandId === "m2-203-spawn-event") {
      const fields = (value as Extract<Command, { kind: "m2Command" }>).fields;
      if (kind === "declaration") return spawnedEventId(fields) === id;
      if (includeCopies && (fields.templateEventId ?? fields.prefabId) === id) copyIds.add(spawnedEventId(fields));
      return Object.entries(fields).some(([field, entry]) => field !== "eventId" && visit(entry, field));
    }
    return Object.entries(record).some(([field, child]) => {
      // An original draft is the same declaration, but its references can reappear on cancel.
      if (field === "draft" && kind === "declaration") return false;
      return (kind !== "declaration" && matchesRemovalFlag(field)) || visit(child, field);
    });
  }

  // Tile sheets and resource payloads cannot carry authored event references.
  const { maps, tilesets, assets, ...authored } = project;
  return Object.values(maps).some(map => visit(map.events) || visit(map.locations) || visit(map.encounterTable))
    || visit(authored)
    || [...copyIds].some(copyId => referencedRemovalIds.has(copyId));
}
