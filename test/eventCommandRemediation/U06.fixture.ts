import { createBlankProject } from "@/project/defaults";
import { createInterpreter } from "@/player/interpreter";
import { startSession } from "@/project/session";
import type { Command, EventPageGraphic, Project } from "@/project/types";

export const HERO_ID = "actor_hero";
export const BOB_ID = "actor_u06_bob";
export const CUSTOM_GRAPHIC: EventPageGraphic = {
  sprite: { type: "uploaded", id: "charsetB" },
  direction: "left",
  pattern: 2,
  transparent: false,
};
export const CUSTOM_FOLLOWER: Extract<Command, { kind: "addFollower" }> = {
  kind: "addFollower", actorId: HERO_ID, name: "Hero", graphic: CUSTOM_GRAPHIC,
};

export function buildFixture(initial: Command = CUSTOM_FOLLOWER): Project {
  const project = createBlankProject();
  const hero = project.database.actors.find((actor) => actor.id === HERO_ID);
  if (!hero) throw new Error("U06 requires the default hero record");
  // Different actor IDs are essential: re-adding one actor replaces that follower.
  project.database.actors.push({ ...structuredClone(hero), id: BOB_ID, name: "Bob" });
  project.system.monsterCollection = true;
  project.assets.uploaded.charsetB = {
    id: "charsetB", name: "charsetB", kind: "sprite",
    // Valid three-pixel RGBA PNG, three 1x1 frames; frame 2 is an actual raw frame.
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAABCAYAAAAb4BS0AAAAEklEQVR4nGP4z8DwHwwZ/v8HACPpBftwlZ1iAAAAAElFTkSuQmCC",
    meta: { width: 3, height: 1, frames: 3, frameWidth: 1, frameHeight: 1 },
  };
  project.maps[project.startMapId]!.events = [{
    id: "u06-host", x: 2, y: 3, trigger: { kind: "action" }, commands: [structuredClone(initial)],
    pages: [{
      id: "u06-page", name: "U06", conditions: [], graphic: {},
      trigger: { kind: "action" }, priority: "below", overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [structuredClone(initial)],
    }],
  }];
  return project;
}

export function commandOf(project: Project): Command {
  const command = project.maps[project.startMapId]?.events[0]?.pages?.[0]?.commands[0];
  if (!command) throw new Error("U06 fixture command missing");
  return command;
}

export function saveCommand(project: Project, command: Command): void {
  const event = project.maps[project.startMapId]!.events[0]!;
  event.commands = [structuredClone(command)];
  event.pages![0]!.commands = [structuredClone(command)];
}

export function followerSession(project: Project) {
  const session = startSession(project, 6);
  const result = createInterpreter([
    { kind: "addFollower", actorId: HERO_ID, name: "Alice" },
    { kind: "addFollower", actorId: BOB_ID, name: "Bob" },
    { kind: "giveMonster", speciesId: "species_wild_slime", level: 3, nickname: "M" },
  ], session, project).start();
  if (result.kind !== "done") throw new Error("U06 follower setup did not complete");
  return session;
}
