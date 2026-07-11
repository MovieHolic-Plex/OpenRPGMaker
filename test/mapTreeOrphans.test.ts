import { describe, expect, it } from "vitest";
import { collectMapIdsInTree, repairMapTreeOrphans } from "@/editor/mapTreeActions";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import type { Project } from "@/project/types";

function miniProject(maps: string[], tree: Project["mapTree"], startMapId?: string): Pick<Project, "maps" | "mapTree" | "startMapId"> {
  const projectMaps: Project["maps"] = {};
  for (const id of maps) {
    const m = createBlankMap(id, 4, 4);
    m.id = id;
    m.name = id;
    projectMaps[id] = m;
  }
  return { maps: projectMaps, mapTree: tree, startMapId: startMapId ?? maps[0]! };
}

describe("repairMapTreeOrphans", () => {
  it("attaches maps that exist in project.maps but not in mapTree", () => {
    const project = miniProject(
      ["map_a", "map_b", "map_c"],
      { mapId: "map_a", children: [] },
    );
    expect(collectMapIdsInTree(project.mapTree).size).toBe(1);
    expect(repairMapTreeOrphans(project)).toBe(true);
    expect([...collectMapIdsInTree(project.mapTree)].sort()).toEqual(["map_a", "map_b", "map_c"]);
    expect(project.mapTree.mapId).toBe("map_a");
    expect(project.mapTree.children.map((c) => c.mapId).sort()).toEqual(["map_b", "map_c"]);
  });

  it("repairs invalid root using startMapId", () => {
    const project = miniProject(
      ["map_a", "map_b"],
      { mapId: "map_missing", children: [{ mapId: "map_b", children: [] }] },
      "map_a",
    );
    expect(repairMapTreeOrphans(project)).toBe(true);
    expect(project.mapTree.mapId).toBe("map_a");
    expect(collectMapIdsInTree(project.mapTree).has("map_b")).toBe(true);
  });

  it("is a no-op when tree already covers all maps", () => {
    const project = miniProject(
      ["map_a", "map_b"],
      { mapId: "map_a", children: [{ mapId: "map_b", children: [] }] },
    );
    expect(repairMapTreeOrphans(project)).toBe(false);
  });
});
