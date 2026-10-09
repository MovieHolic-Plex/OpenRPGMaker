import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import type { StructureKitDef } from "@/project/types";

// 특수 건물 킷(Rasak Special_Buildings 선례): 입구 부위가 있는 킷은 찍은 뒤 맵 좌표 입구를 돌려주고, ai.tags 로 검색된다.
function kitProject() {
  const project = createBlankProject();
  const tileset = Object.values(project.tilesets)[0]!;
  const mapId = Object.keys(project.maps)[0]!;
  const kit: StructureKitDef = {
    id: "sb_test_inn", kind: "section", name: "시험 여관", width: 3, height: 2, learnedFrom: "db-authored",
    rows: [{ tiles: [-1, -1, -1], upperTiles: [1, 2, 3] }, { tiles: [-1, -1, -1], upperTiles: [4, -1, 6] }],
    parts: [{ id: "entry1", kind: "entrance", dx: 1, dy: 1, w: 1, h: 1, note: "문" }],
    ai: { description: "시험", placementRules: "", tags: ["특수 건물", "여관"] },
  };
  tileset.structureKits = [...(tileset.structureKits ?? []), kit];
  return { project, tilesetId: tileset.id, mapId };
}

describe("stamp_object 킷 입구", () => {
  it("입구 부위를 맵 좌표로 돌려준다", () => {
    const { project, tilesetId, mapId } = kitProject();
    const ctx = { project };
    const result = runTool(ctx, "stamp_object", { objectId: `kit:${tilesetId}/sb_test_inn`, mapId, x: 4, y: 3 });
    expect(result.ok).toBe(true);
    expect((result.data as { entrances?: unknown }).entrances).toEqual([{ x: 5, y: 4, note: "문" }]);
    expect(result.summary).toContain("입구 (5,4)");
    expect(result.summary).toContain("(5,5)");
  });

  it("킷 ai.tags 로 목록에서 찾는다", () => {
    const { project, tilesetId } = kitProject();
    const list = runTool({ project }, "list_spatial_designs", { kind: "object", query: "특수 건물" });
    expect(list.ok).toBe(true);
    expect(JSON.stringify(list.data)).toContain(`kit:${tilesetId}/sb_test_inn`);
  });
});
