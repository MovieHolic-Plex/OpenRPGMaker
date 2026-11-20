import { LOOP_BODY_BRANCH_INDEX, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
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

  const jumpTargets = new Map<readonly Command[], Set<number>>();
  const frames: (readonly Command[])[] = [];
  function collectJumps(commands: readonly Command[]) {
    if (frames.includes(commands)) return;
    frames.push(commands);
    for (const command of commands) {
      if (command.kind === "gotoLabel") {
        // The interpreter jumps to the first match in the nearest active frame.
        for (let i = frames.length - 1; i >= 0; i--) {
          const frame = frames[i]!;
          const row = frame.findIndex(candidate => candidate.kind === "label" && candidate.name === command.name);
          if (row === -1) continue;
          const targets = jumpTargets.get(frame) ?? new Set<number>();
          targets.add(row);
          jumpTargets.set(frame, targets);
          break;
        }
      }
      for (const branch of executionLists(command)) collectJumps(branch);
    }
    frames.pop();
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
    for (let row = 0; row < path[depth]!; row++) {
      const command = list[row]!;
      if (spawnsEvent(command)) live = true;
      if (jumpTargets.get(list)?.has(row)) live = false;
      if (live && mayRemove(command, new Set())) live = false;
    }
    if (path[depth + 1] === LOOP_BODY_BRANCH_INDEX) live = false;
  }
  return live;
}

const EVENT_ID_FIELDS = new Set(["eventId", "targetEventId", "templateEventId", "eventA", "eventB"]);
const MOVE_TARGET_KINDS = new Set(["approach", "turnToward", "exitVia", "enterVia", "doorCue"]);

function referencesM2Event(command: Extract<Command, { kind: "m2Command" }>, id: string): boolean {
  const { fields } = command;
  switch (m2CommandById(command.commandId)?.title) {
    case "Spawn Event": return (fields.templateEventId ?? fields.prefabId) === id;
    case "Swap Event Location":
      return (fields.eventA ?? fields.target) === id || (fields.eventB ?? fields.value ?? fields.mapId) === id;
    case "Set Event Location":
    case "Flash Event":
    case "Pathfind Move": return fields.target === id;
    case "Camera Control": return (fields.targetEventId ?? fields.eventId) === id || fields.target === id || fields.target === `event:${id}`;
    default: return fields.eventId === id;
  }
}

export function findSpawnUsage(
  project: Project, id: string, ownCommand: Command | undefined, kind: "declaration" | "reference" | "removalFlag",
  includeCopies = false,
): boolean {
  const flagPrefix = "event-removed:";
  const removalFlag = flagPrefix + id;
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
    if (!value || typeof value !== "object" || value === ownCommand) return false;
    if (visited.has(value)) return false;
    visited.add(value);
    if (Array.isArray(value)) return value.some(child => visit(child, key));
    const record = value as Record<string, unknown>;
    if (kind === "reference" && key === "selfSwitches" && Object.hasOwn(record, id)) return true;
    if (kind === "reference") {
      if (record.kind === "m2Command") {
        if (referencesM2Event(value as Extract<Command, { kind: "m2Command" }>, id)) return true;
      } else if ((record.kind === "event" && record.id === id)
        || (typeof record.kind === "string" && MOVE_TARGET_KINDS.has(record.kind) && record.target === id)
        || Object.entries(record).some(([field, child]) => EVENT_ID_FIELDS.has(field) && child === id)) return true;
    }
    if (kind !== "declaration" && (record.kind === "script" || key === "scriptLibrary")
      && typeof record.source === "string" && typeof record.compiled === "string") {
      // game.cmd can take a computed command, including IDs or flags built at runtime.
      // The script effects index doesn't cover arbitrary command payloads.
      if (record.compiled.trim() || record.source.trim()) return true;
    }
    if (record.kind === "m2Command") {
      const fields = (value as Extract<Command, { kind: "m2Command" }>).fields;
      if (record.commandId === "m2-203-spawn-event") {
        if (kind === "declaration") return spawnedEventId(fields) === id;
        if (includeCopies && (fields.templateEventId ?? fields.prefabId) === id) copyIds.add(spawnedEventId(fields));
      }
      return kind !== "declaration"
        && Object.entries(fields).some(([field, entry]) => matchesRemovalFlag(field) || matchesRemovalFlag(entry));
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
