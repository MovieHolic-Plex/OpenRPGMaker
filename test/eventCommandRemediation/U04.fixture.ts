import { readFileSync } from "node:fs";
import { createBlankProject, createBlankMap, singleNodeTree, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Command, Project } from "@/project/types";

export type PictureCommand = Extract<Command, { kind: "showPicture" }>;
export type MovieCommand = Extract<Command, { kind: "playMovie" }>;
export type MediaCommand = PictureCommand | MovieCommand;

export const MOVIE_ID = "u04-movie";
export const OTHER_MOVIE_ID = "u04-other-movie";
export const EVENT_ID = "u04-media";
export const SENTINEL = { kind: "text", body: "u04-after-media" } satisfies Command;
// Real shipped WebM bytes, not the truncated data URL used by the adjacent form test.
export const MOVIE_URL = `data:video/webm;base64,${readFileSync(
  new URL("../../public/assets/movies/sample-movie.webm", import.meta.url),
).toString("base64")}`;

export function picture(waitForPicture: boolean | undefined = true, durationMs = 500): PictureCommand {
  return {
    kind: "showPicture", pictureId: "picA", resourceId: "u04-picture",
    x: 10, y: 20, scale: 50, opacity: 128, rotation: 15, durationMs,
    ...(waitForPicture === undefined ? {} : { waitForPicture }),
  };
}

export function movie(flags: Pick<MovieCommand, "wait" | "skippable"> = {}): MovieCommand {
  return { kind: "playMovie", resourceId: MOVIE_ID, ...flags };
}

export function mediaProject(): Project {
  const project = createBlankProject();
  project.assets.uploaded["u04-picture"] = {
    id: "u04-picture", name: "U04 picture", kind: "picture", meta: {},
    // Generated 32x24 RGBA PNG with verified chunk CRCs; the old copied 1px URL was corrupt.
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAYAAACbU/80AAAAK0lEQVR4nO3OIQEAAAgDMNKRjoh0gRg3E/Ornr2kEhAQEBAQEBAQEBBIBx5/nwd59Y64GgAAAABJRU5ErkJggg==",
  };
  for (const id of [MOVIE_ID, OTHER_MOVIE_ID]) {
    project.assets.uploaded[id] = { id, name: id, kind: "picture", dataUrl: MOVIE_URL, meta: {} };
  }
  return project;
}

export function persisted(command: MediaCommand): { project: Project; command: MediaCommand } {
  const project = mediaProject();
  project.commonEvents.push({
    id: EVENT_ID, name: "U04", trigger: "none", commands: [structuredClone(command), SENTINEL],
  });
  const loaded = deserialize(serialize(project));
  const result = loaded.commonEvents.find((event) => event.id === EVENT_ID)?.commands[0];
  if (!result || (result.kind !== "showPicture" && result.kind !== "playMovie")) {
    throw new Error("U04 media command missing after project deserialize");
  }
  return { project: loaded, command: result };
}

export function buildFixture(): Project {
  const project = mediaProject();
  const map = createBlankMap("U04 media", 8, 8);
  map.id = "map_intro";
  project.meta.title = "U04 native media preservation";
  project.maps = { [map.id]: map };
  project.mapTree = singleNodeTree(map.id);
  project.startMapId = map.id;
  project.startPos = { x: 2, y: 3 };
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
  const commands: Command[] = [
    picture(), { kind: "text", body: "g3-f10-after-picture" },
    movie(), { kind: "text", body: "g5-f2-after-movie" },
  ];
  map.events = [{ id: "host", x: 2, y: 2, trigger: { kind: "action" }, commands, pages: [{
    id: "host-page", name: "U04", conditions: [],
    graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }] }, { id: "selectedOther", x: 4, y: 2, trigger: { kind: "action" }, commands: [
    { ...picture(false, 0), pictureId: "wrong-target", x: 99 },
  ] }];
  return deserialize(serialize(project));
}
