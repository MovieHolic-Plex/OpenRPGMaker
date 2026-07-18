import type { AuthorHouseResultData } from "@/editor/tools/authorHouseFacade";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import type { Command, Project } from "@/project/types";

export function preparedProject(): Project {
  const project = createBlankProject();
  const map = createBlankMap("Facade QA", 48, 36);
  map.id = "m1";
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 1, y: 1 };
  return project;
}

export function projectHash(project: Project): string {
  return serialize(project);
}

export function requireHouseData(data: AuthorHouseResultData | undefined): AuthorHouseResultData {
  if (data !== undefined) return data;
  throw new Error("author_house returned no typed data");
}

type TransferExpectation = {
  readonly project: Project;
  readonly mapId: string;
  readonly eventId: string;
  readonly targetMapId: string;
};

export function eventTransfersTo(input: TransferExpectation): boolean {
  const event = input.project.maps[input.mapId]?.events.find((candidate) => candidate.id === input.eventId);
  if (event === undefined) return false;
  return (event.pages ?? []).some((page) =>
    page.commands.some((command: Command) => command.kind === "transfer" && command.mapId === input.targetMapId));
}

export const exteriorSingle = {
  kind: "single",
  mapId: "m1",
  kitId: "blue-stone",
  wings: [{ x: 3, y: 3, w: 8, h: 6 }],
  interior: "exterior-only",
  door: true,
} as const;
