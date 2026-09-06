import { asset, buildFixture, command, MAP_A, MAP_B, SWITCH, VARIABLE } from "../U07.fixture";
import type { Project, UploadedAsset } from "../../../src/project/types";
import { deserialize, serialize } from "../../../src/project/io";

export const HOST = "u07-host";
export const EVENT_B = "u07-event-b";
export const HERO = "actor_hero";
export const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }] as const;
export const CASES = [24, 25, 69, 102, 26, 203, 204, 207, 27, 28, 29, 74, 217, 213, 214, 25, 69] as const;

export function media(kind: "music" | "sound" | "system", suffix: "old" | "new"): UploadedAsset {
  const image = asset("backdrop", suffix);
  return { ...image, id: `u07-${kind}-${suffix}`, name: `Authored ${kind} ${suffix}`, kind };
}
export function insertAsset(project: Project, resource: UploadedAsset): void {
  project.assets.uploaded[resource.id] = resource;
  project.resourceProfiles.push({ kind: resource.kind === "sprite" ? "charset" : resource.kind === "tileset" ? "chipset" : resource.kind,
    assetId: resource.id, name: resource.name, imageWidth: resource.meta.width, imageHeight: resource.meta.height });
}
export function editorFixture(): Project {
  const project = buildFixture();
  for (const kind of ["music", "sound", "system"] as const) {
    for (const suffix of ["old", "new"] as const) insertAsset(project, media(kind, suffix));
  }
  const commands = CASES.map(index => {
    switch (index) {
      case 24: return command(index, { target: HERO, value: asset("charset", "old").id });
      case 25: return command(index, { target: HERO, value: asset("faceset", "old").id });
      case 69: return command(index, { value: asset("backdrop", "old").id, resourceId: asset("backdrop", "old").id });
      case 102: return command(index, { resourceId: asset("backdrop", "old").id });
      case 26: return command(index, { value: asset("charset", "old").id });
      case 203: return command(index, { prefabId: EVENT_B, eventId: HOST, mapId: MAP_A, x: 7, y: 9 });
      case 204: return command(index, { eventId: HOST });
      case 207: return command(index, { eventId: HOST, switchId: SWITCH.id });
      case 27: return command(index, { resourceId: media("music", "old").id });
      case 28: return command(index, { resourceId: media("sound", "old").id });
      case 29: return command(index, { value: media("system", "old").id });
      case 74: return command(index, { mapId: MAP_A, x: 7, y: 9 });
      case 217: return command(index, { variableId: VARIABLE.id, query: "playerX" });
      case 213: return command(index, { slotId: "u07-manual-7", restoreOnGameOver: true });
      case 214: return command(index, { message: "U07 authored message", durationMs: 1600 });
    }
  });
  const map = project.maps[MAP_A];
  const second = project.maps[MAP_B];
  if (!map || !second) throw new Error("U07 maps missing");
  map.events = [{ id: HOST, x: 2, y: 2, trigger: { kind: "action" }, commands, pages: [{
    id: "u07-page", name: "U07 selection", conditions: [], trigger: { kind: "action" }, priority: "same",
    graphic: { sprite: { type: "uploaded", id: asset("charset", "old").id }, direction: "down", pattern: 0 },
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }] }];
  map.events.push({ id: EVENT_B, x: 4, y: 4, trigger: { kind: "action" }, commands: [] });
  project.startPos = { x: 2, y: 3 };
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
  return deserialize(serialize(project));
}
