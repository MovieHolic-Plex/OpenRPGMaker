import { expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createInterpreter } from "@/player/interpreter";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

function session(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorVitals: {},
    currentMapId: "map",
    x: 0,
    y: 0,
  };
}

it("changeParty initializes actor vitals when interpreter has project context", () => {
  const project = createBlankProject();
  const actorId = project.database.actors[0]?.id;
  if (!actorId) throw new Error("missing default actor");
  const state = session();
  const commands: Command[] = [{ kind: "changeParty", actorId, action: "add" }];

  createInterpreter(commands, state, project).start();

  expect(state.partyActorIds).toEqual([actorId]);
  expect(state.actorVitals[actorId]?.hp).toBeGreaterThan(0);
  expect(state.actorVitals[actorId]?.mp).toBeGreaterThanOrEqual(0);
  expect(state.actorVitals[actorId]?.hp).toBe(state.actorVitals[actorId]?.maxHp);
  expect(state.actorVitals[actorId]?.mp).toBe(state.actorVitals[actorId]?.maxMp);
});
