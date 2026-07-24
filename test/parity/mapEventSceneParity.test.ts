// test/parity/mapEventSceneParity.test.ts
// Invariant: maps/events authored into the project (editor data layer) execute correctly in
// headless play (runSceneTest): transfer moves the player, switch/variable/item commands apply.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent } from "@/project/types";
import { editorProject, firstMapId, scene } from "./parityRig";

function actionEvent(id: string, x: number, y: number, commands: Command[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "parity",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      },
    ],
  } as GameEvent;
}

function projectWithEvent(build: (map: { events: GameEvent[] }, project: ReturnType<typeof createBlankProject>) => void) {
  return editorProject(() => {
    store.update((project) => {
      const map = project.maps[project.startMapId];
      build(map as { events: GameEvent[] }, project);
    });
  });
}

const START = { x: 2, y: 2 };
const EVENT_TILE = { x: 2, y: 3 };

describe("editor->player map/event/scene parity", () => {
  it("an authored setSwitch event flips the switch in play", () => {
    const project = projectWithEvent((map, p) => {
      p.switches.push({ id: "sw_parity", name: "parity" });
      map.events.push(actionEvent("ev_switch", EVENT_TILE.x, EVENT_TILE.y, [{ kind: "setSwitch", switchId: "sw_parity", value: true }]));
    });
    const result = scene(project, { mapId: firstMapId(project), start: START, steps: [{ kind: "interact" }, { kind: "expect", switchOn: "sw_parity" }] });
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("an authored setVariable event writes the variable in play", () => {
    const project = projectWithEvent((map, p) => {
      p.variables.push({ id: "var_parity", name: "parity" });
      map.events.push(actionEvent("ev_var", EVENT_TILE.x, EVENT_TILE.y, [{ kind: "setVariable", variableId: "var_parity", op: "=", value: 42 }]));
    });
    const result = scene(project, { mapId: firstMapId(project), start: START, steps: [{ kind: "interact" }, { kind: "expect", variableEquals: { variableId: "var_parity", value: 42 } }] });
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("an authored changeItem event grants the item in play", () => {
    const project = projectWithEvent((map) => {
      map.events.push(actionEvent("ev_item", EVENT_TILE.x, EVENT_TILE.y, [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 3 }]));
    });
    const result = scene(project, { mapId: firstMapId(project), start: START, steps: [{ kind: "interact" }, { kind: "expect", inventoryCount: { itemId: "item_potion", count: 3 } }] });
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("an authored transfer event moves the player to the destination tile", () => {
    const project = projectWithEvent((map) => {
      map.events.push(actionEvent("ev_transfer", EVENT_TILE.x, EVENT_TILE.y, [{ kind: "transfer", mapId: firstMapId(store.getCurrent()), x: 15, y: 12 }]));
    });
    const result = scene(project, { mapId: firstMapId(project), start: START, steps: [{ kind: "interact" }, { kind: "expect", playerAt: { x: 15, y: 12 } }] });
    expect(result.ok, result.failureReason).toBe(true);
  });
});
