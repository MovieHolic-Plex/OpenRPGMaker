import { createBlankMap, createBlankProject } from "@/project/defaults";
import { createDefaultM2Fields, M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { store } from "@/project/store";
import type { Command, Project, UploadedAsset } from "@/project/types";

export type M2 = Extract<Command, { kind: "m2Command" }>;
export const MAP_A = "u07-map-04";
export const MAP_B = "u07-map-12";
export const VARIABLE = { id: "u07-reward-17", name: "Authored reward", initialValue: 0 };
export const SWITCH = { id: "u07-switch-23", name: "Authored gate" };
export const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAQUlEQVR4nO3OQQ0AMBAEofNvupWx8yBBAHf3YvYDISEhoZj9QEhISChmPxASEhKK2Q+EhISEYvYDISEhoZj9oB368AX3eWaj93YAAAAASUVORK5CYII=";
const IMAGE_DATA = {
  "charset-old": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASAAAAEACAIAAACcTTzhAAADW0lEQVR4nO3OAQnAQBAEsfNvulXxLAyBCMh9d8Aj+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2A/pl/DDXHUPTgAAAABJRU5ErkJggg==",
  "charset-new": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASAAAAEACAIAAACcTTzhAAADW0lEQVR4nO3OAQnAQBAEsfNvulXxLAyBCMjdfcAz+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A2H4AYfsBhO0HELYfQNh+AGH7AYTtBxC2H0DYfgBh+wGE7QcQth9A1g8IBPDDS4B2TwAAAABJRU5ErkJggg==",
  "faceset-old": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAQUlEQVR4nO3OQQ0AMBAEofNvupWx8yBBAPfuUvYDISEhoZj9QEhISChmPxASEhKK2Q+EhISEYvYDISEhoZj9oB763xP3eV+LAIgAAAAASUVORK5CYII=",
  "faceset-new": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAQUlEQVR4nO3OQQ0AMBAEofNvupWx8yBBAHf3YvYDISEhoZj9QEhISChmPxASEhKK2Q+EhISEYvYDISEhoZj9oB368AX3eWaj93YAAAAASUVORK5CYII=",
  "backdrop-old": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAQUlEQVR4nO3OQQ0AMBAEofNvupWx8yBBAPfuUvYDISEhoZj9QEhISChmPxASEhKK2Q+EhISEYvYDISEhoZj9oB763xP3eV+LAIgAAAAASUVORK5CYII=",
  "backdrop-new": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAQUlEQVR4nO3OQQ0AMBAEofNvupWx8yBBAHf3YvYDISEhoZj9QEhISChmPxASEhKK2Q+EhISEYvYDISEhoZj9oB368AX3eWaj93YAAAAASUVORK5CYII=",
} as const;

export function command(index: number, fields: M2["fields"] = {}): M2 {
  const entry = M2_COMMAND_CATALOG.find(row => row.index === index);
  if (!entry) throw new Error(`Unknown fixture command ${index}`);
  return { kind: "m2Command", commandId: entry.id, fields: { ...createDefaultM2Fields(entry), ...fields } };
}

export function asset(kind: "charset" | "faceset" | "backdrop", suffix: "old" | "new"): UploadedAsset {
  const width = kind === "charset" ? 288 : 48;
  const height = kind === "charset" ? 256 : 48;
  // Valid RGB PNGs with authored dimensions and distinct old/new pixels.
  return {
    id: `u07-${kind}-${suffix}${kind === "faceset" ? "-bust" : ""}`,
    name: `Authored ${kind} ${suffix}`, kind,
    dataUrl: IMAGE_DATA[`${kind}-${suffix}`],
    meta: { width, height },
  };
}

function addAsset(project: Project, resource: UploadedAsset): void {
  project.assets.uploaded[resource.id] = resource;
  project.resourceProfiles.push({
    kind: resource.kind === "sprite" ? "charset" : resource.kind === "tileset" ? "chipset" : resource.kind,
    assetId: resource.id, name: resource.name,
    imageWidth: resource.meta.width, imageHeight: resource.meta.height,
  });
}

export function registerAsset(resource: UploadedAsset): void {
  store.update(draft => addAsset(draft, resource), { scope: "assets", label: "U07 fixture asset registration" });
}

export function buildFixture(): Project {
  const project = createBlankProject();
  const a = { ...createBlankMap("Authored map A", 12, 10), id: MAP_A };
  const b = { ...createBlankMap("Authored map B", 12, 10), id: MAP_B };
  project.maps = { [MAP_A]: a, [MAP_B]: b };
  project.mapTree = { mapId: MAP_A, children: [{ mapId: MAP_B, children: [] }] };
  project.startMapId = MAP_A;
  project.variables = [VARIABLE];
  project.switches = [SWITCH];
  for (const kind of ["charset", "faceset", "backdrop"] as const) addAsset(project, asset(kind, "old"));
  return project;
}

export const CALLBACK_CASES = [
  { finding: "G2-F9", index: 24, kind: "charset", prefix: "change-actor-graphic", preview: "change-actor-graphic-preview" },
  { finding: "G2-F9", index: 25, kind: "faceset", prefix: "change-actor-faceset", preview: "change-actor-faceset-face-preview" },
  { finding: "G3-F22", index: 69, kind: "backdrop", prefix: "change-parallax-back", preview: "change-parallax-back-preview-image" },
] as const;
