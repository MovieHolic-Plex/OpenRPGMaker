import { createBlankMap, createBlankProject, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import type { Command, Project } from "@/project/types";

export const TEXT_MAP = "map_text_tools";
export const TEXT_EVENT = "text-tools";
export const OTHER_ACTOR = "text_other";
export const FIRST_VARIABLE = "var_0001";
export const REWARD_VARIABLE = "var_0002";

export function textFixture(): Extract<Command, { kind: "text" }> {
  return { kind: "text", body: "Hello world", speaker: "Narrator", emotion: "happy" };
}

export function buildFixture(command: Command = textFixture()): Project {
  const project = createBlankProject();
  const firstActor = project.database.actors[0];
  if (!firstActor) throw new TypeError("Blank fixture requires its initial actor");
  firstActor.name = "First Hero";
  project.database.actors.splice(1, 0, { ...structuredClone(firstActor), id: OTHER_ACTOR, name: "Other" });
  for (const record of project.variables) {
    if (record.id === FIRST_VARIABLE) record.name = "First value";
    if (record.id === REWARD_VARIABLE) record.name = "Reward";
  }
  project.session.variables[FIRST_VARIABLE] = 11;
  project.session.variables[REWARD_VARIABLE] = 29;
  const map = createBlankMap("Text tools", 8, 8);
  map.id = TEXT_MAP;
  map.events = [{
    id: TEXT_EVENT, x: 2, y: 2, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: "text-page", name: "Text tools", conditions: [],
      graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
      trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [structuredClone(command)],
    }],
  }];
  project.maps = { [TEXT_MAP]: map };
  project.mapTree = { mapId: TEXT_MAP, children: [] };
  project.startMapId = TEXT_MAP;
  project.startPos = { x: 2, y: 3 };
  project.meta.title = "G1-F18 text insertion";
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
  return project;
}

export function textCommand(project: Project): Command {
  const command = project.maps[TEXT_MAP]?.events[0]?.pages?.[0]?.commands[0];
  if (!command) throw new TypeError("Text fixture command is missing");
  return command;
}

export function saveTextCommand(project: Project, command: Command): void {
  const page = project.maps[TEXT_MAP]?.events[0]?.pages?.[0];
  if (!page) throw new TypeError("Text fixture page is missing");
  page.commands[0] = command;
}
