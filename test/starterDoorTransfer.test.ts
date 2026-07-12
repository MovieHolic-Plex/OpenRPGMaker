import { describe, expect, it } from "vitest";
import { createStarterMap } from "@/project/defaults";
import {
  addStarterHouseDoor,
  createStarterHouseInteriorMap,
  STARTER_HOUSE_SLIME_EVENT_ID,
  STARTER_HOUSE_SLIME_POS,
} from "@/project/defaults/starterHouseTransfer";
import { DEFAULT_TROOP_ID } from "@/project/defaults/constants";

describe("starter door transfer defaults", () => {
  it("builds a starter house door and matching interior transfer", () => {
    // Given: a starter village and its paired interior map are built from the transfer helpers.
    const starter = createStarterMap();
    addStarterHouseDoor(starter);
    const interior = createStarterHouseInteriorMap(starter.id);

    // When: the generated transfer events are inspected.
    const door = starter.events.find((event) => event.id === "event_starter_house_door");
    const doorPage = door?.pages?.[0];
    const transfer = doorPage?.commands.find((command) => command.kind === "transfer");
    const exit = interior.events.find((event) => event.id === "event_starter_house_exit");
    const exitPage = exit?.pages?.[0];
    const exitTransfer = exitPage?.commands.find((command) => command.kind === "transfer");
    const slime = interior.events.find((event) => event.id === STARTER_HOUSE_SLIME_EVENT_ID);
    const slimePage = slime?.pages?.[0];
    const slimeBattle = slimePage?.commands.find((command) => command.kind === "battleProcessing");

    // Then: player-touch transfers connect the exterior door and interior exit.
    expect(interior.name).toBe("시작 집 내부");
    expect(interior.width).toBeGreaterThanOrEqual(20);
    expect(interior.height).toBeGreaterThanOrEqual(15);
    expect(door).toMatchObject({
      x: 7,
      y: 10,
      trigger: { kind: "playerTouch" },
    });
    expect(doorPage).toMatchObject({
      id: "event_starter_house_door_page",
      priority: "below",
      trigger: { kind: "playerTouch" },
    });
    expect(transfer).toEqual({ kind: "transfer", mapId: "map_starter_house_interior", x: 4, y: 6, fade: "black" });
    expect(exit).toMatchObject({
      x: 4,
      y: 7,
      trigger: { kind: "playerTouch" },
    });
    expect(exitTransfer).toEqual({ kind: "transfer", mapId: starter.id, x: 7, y: 11, fade: "black" });
    // And: an indoor yard slime is ready for quick battle tests.
    expect(slime).toMatchObject({
      x: STARTER_HOUSE_SLIME_POS.x,
      y: STARTER_HOUSE_SLIME_POS.y,
      trigger: { kind: "eventTouch" },
    });
    expect(slimePage?.graphic?.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_monster1" });
    expect(slimeBattle).toEqual({
      kind: "battleProcessing",
      troopId: DEFAULT_TROOP_ID,
      canEscape: true,
      canLose: true,
    });
  });
});
