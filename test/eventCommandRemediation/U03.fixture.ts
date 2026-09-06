import { createBlankMap, createBlankProject, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import type { Command, EventPage, Project } from "@/project/types";

export type TransferCommand = Extract<Command, { kind: "transfer" }>;
export const MAP_A = "mapA";
export const MAP_B = "mapB";
export const EVENT_ID = "u03-transfer";
export const PAGE_ID = "u03-page";

/** Deterministic authored target; transfer has no duration field in this schema. */
export function buildFixture(): Project {
  const project = createBlankProject();
  const mapA = { ...createBlankMap("U03 A", 12, 10), id: MAP_A };
  const mapB = { ...createBlankMap("U03 B", 12, 10), id: MAP_B };
  const initial: TransferCommand = {
    kind: "transfer", mapId: MAP_A, x: 2, y: 3,
    direction: "left", fade: "black", transition: "fade",
  };
  const page: EventPage = {
    id: PAGE_ID, name: "U03", conditions: [],
    graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
    trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [structuredClone(initial)],
  };
  mapA.events = [{
    id: EVENT_ID, x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page],
  }];
  project.maps = { [MAP_A]: mapA, [MAP_B]: mapB };
  project.mapTree = { mapId: MAP_A, children: [{ mapId: MAP_B, children: [] }] };
  project.startMapId = MAP_A;
  project.startPos = { x: 1, y: 2 };
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
  return project;
}

export function storedTransfer(project: Project): TransferCommand {
  const command = project.maps[MAP_A]?.events
    .find(event => event.id === EVENT_ID)?.pages
    ?.find(page => page.id === PAGE_ID)?.commands[0];
  if (command?.kind !== "transfer") throw new Error("U03 fixture transfer is missing");
  return command;
}

export function target(command: TransferCommand): Omit<TransferCommand, "transition"> {
  const { transition: _transition, ...selection } = command;
  return selection;
}
