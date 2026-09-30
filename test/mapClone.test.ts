import { describe, expect, it } from "vitest";
import { cloneGameMap } from "@/project/mapClone";
import { createBlankMap } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";

describe("cloneGameMap", () => {
  it("copies authored map fields, not only tiles and events", () => {
    const source = createBlankMap("던전", 12, 10, COMBINED_TOWN_TILESET_ID);
    source.encounterRate = 8;
    source.troopIds = ["troop_slime"];
    source.bgm = { mode: "custom", resourceId: "bgm_cave" };
    source.disableSave = true;
    source.battleBackground = "bg_cave";
    source.events.push({
      id: "ev_old",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [{ kind: "transfer", mapId: source.id, x: 1, y: 1 }],
    });

    let n = 0;
    const copy = cloneGameMap(source, {
      newId: "map_copy",
      newName: "던전 복사",
      nextEventId: () => `ev_new_${n++}`,
    });

    expect(copy.id).toBe("map_copy");
    expect(copy.name).toBe("던전 복사");
    expect(copy.encounterRate).toBe(8);
    expect(copy.troopIds).toEqual(["troop_slime"]);
    expect(copy.bgm).toEqual({ mode: "custom", resourceId: "bgm_cave" });
    expect(copy.disableSave).toBe(true);
    expect(copy.battleBackground).toBe("bg_cave");
    expect(copy.events[0]?.id).toBe("ev_new_0");
    expect(copy.events[0]?.id).not.toBe("ev_old");
    expect(copy.events[0]?.commands[0]).toMatchObject({ kind: "transfer", mapId: "map_copy" });
    expect(source.events[0]?.id).toBe("ev_old");
  });
});
