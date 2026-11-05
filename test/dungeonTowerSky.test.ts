// 2026-11-05 imageplan-honest p4/p10: a two-floor castle built from an image plan (vagueWiden recipe author_dungeon{type:"castle",
// floors:2, direction:"up"}) floated on a cloud-sea background the plan never showed. The cloud sky belongs to towers or an explicit ask.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "@/editor/tools/dungeonTools";

function build(args: Record<string, unknown>) {
  const project = createBlankProject();
  const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, seed: 11, populate: false, ...args });
  const ids = (res.data as { floors: string[] }).floors;
  return ids.map((id) => project.maps[id]!);
}

describe("author_dungeon cloud sky around stacked floors", () => {
  it("keeps a stacked castle's dark ceiling", () => {
    const maps = build({ type: "castle", floors: 2, direction: "up" });
    expect(maps).toHaveLength(2);
    for (const m of maps) expect(m.background).toBeUndefined();
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
