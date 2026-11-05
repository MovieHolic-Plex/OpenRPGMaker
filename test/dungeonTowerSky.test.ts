// 2026-11-05 imageplan-honest p4/p10: a two-floor castle built from an image plan (vagueWiden recipe author_dungeon{type:"castle",
// floors:2, direction:"up"}) floated on a cloud-sea background the plan never showed. The cloud sky belongs to towers or an explicit ask.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "@/editor/tools/dungeonTools";
import { AREA_VOID_RATIO, measureMapAreaUse } from "@/editor/tools/mapAreaUse";

function build(args: Record<string, unknown>) {
  const project = createBlankProject();
  const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, seed: 11, populate: false, ...args });
  const ids = (res.data as { floors: string[] }).floors;
  return ids.map((id) => project.maps[id]!);
}

describe("author_dungeon cloud sky around stacked floors", () => {
  it("keeps a named stacked castle's dark ceiling, with or without a type", () => {
    for (const args of [{ type: "castle", name: "성채" }, { name: "성채" }]) {
      const maps = build({ ...args, floors: 2, direction: "up" });
      expect(maps).toHaveLength(2);
      for (const m of maps) expect(m.background).toBeUndefined();
    }
  });

  it("opens the sky for a castle or temple named as a tower", () => {
    expect(build({ type: "castle", name: "마법사의 탑", floors: 3, direction: "up" }).some((m) => m.background !== undefined)).toBe(true);
  });

  it("builds the two-floor castle recipe without sky and without a black void", () => {
    const project = createBlankProject();
    const floorRooms = [[{ kind: "entrance" }, { kind: "hall" }, { kind: "library" }, { kind: "storage" }], [{ kind: "shrine" }, { kind: "boss" }]];
    const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, seed: 11, populate: false, type: "castle", name: "성채", floors: 2, direction: "up", floorRooms });
    const maps = (res.data as { floors: string[] }).floors.map((id) => project.maps[id]!);
    for (const m of maps) expect(m.background).toBeUndefined();
    expect(measureMapAreaUse(project, maps[0]!)!.voidRatio).toBeLessThan(AREA_VOID_RATIO);
  });

  it("still opens the sky around a tower", () => {
    const maps = build({ type: "tower", floors: 3, direction: "up" });
    expect(maps.some((m) => m.background !== undefined)).toBe(true);
  });

  it("opens the sky around a castle when asked", () => {
    const maps = build({ type: "castle", floors: 2, direction: "up", sky: true });
    expect(maps.some((m) => m.background !== undefined)).toBe(true);
  });
});
