import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import type { TileGroupMetadata } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

function contextWithGroup(): ToolContext {
  const project = createBlankProject();
  project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [roofGroup()];
  return { project };
}

function roofGroup(): TileGroupMetadata {
  return {
    defaultLayer: "upper",
    description: "구조 규칙 테스트 지붕",
    id: "roof-main",
    name: "지붕",
    patternGrammar: {
      axis: "both",
      kind: "nine_slice_expandable",
      parts: [
        { role: "bottomLeft", tileIds: [1] },
        { role: "bottom", tileIds: [2] },
        { role: "bottomRight", tileIds: [3] },
      ],
      preserveCaps: true,
      repeat: "center",
    },
    placementRules: "벽 위에 배치",
    role: "roof",
    tileIds: [1, 2, 3],
  };
}

describe("structure rule tools", () => {
  it("set_group_junction adds and updates a rule for the same neighbor side", () => {
    // Given: a tileset group that can define roof-wall boundary behavior.
    const ctx = contextWithGroup();

    // When: the junction rule is written, then written again for the same neighbor side.
    const first = runTool(ctx, "set_group_junction", {
      groupId: "roof-main",
      junction: { action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" },
      tilesetId: COMBINED_TOWN_TILESET_ID,
    });
    const second = runTool(ctx, "set_group_junction", {
      groupId: "roof-main",
      junction: { action: "replace", atRoles: ["bottomLeft"], replaceWith: [4], side: "below", withRole: "wall" },
      tilesetId: COMBINED_TOWN_TILESET_ID,
    });

    // Then: the rule is updated in place instead of duplicated.
    expect(first.ok, first.summary).toBe(true);
    expect(second.ok, second.summary).toBe(true);
    const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0];
    expect(group?.junctions).toEqual([
      { action: "replace", atRoles: ["bottomLeft"], replaceWith: [4], side: "below", withRole: "wall" },
    ]);
  });

  it("set_group_overlay adds and updates a rule for the same condition", () => {
    // Given: a tileset group that can add conditional roof overlays.
    const ctx = contextWithGroup();

    // When: the same overlay condition is written twice.
    const first = runTool(ctx, "set_group_overlay", {
      groupId: "roof-main",
      overlay: { tileIds: [5], when: "diagonalCorner" },
      tilesetId: COMBINED_TOWN_TILESET_ID,
    });
    const second = runTool(ctx, "set_group_overlay", {
      groupId: "roof-main",
      overlay: { tileIds: [6, 7], when: "diagonalCorner" },
      tilesetId: COMBINED_TOWN_TILESET_ID,
    });

    // Then: the condition has the latest tile set.
    expect(first.ok, first.summary).toBe(true);
    expect(second.ok, second.summary).toBe(true);
    const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0];
    expect(group?.overlays).toEqual([{ tileIds: [6, 7], when: "diagonalCorner" }]);
  });

  it("rejects structure rules for an unknown group", () => {
    // Given: a tileset without the requested group id.
    const ctx = contextWithGroup();

    // When: a structure rule targets that id.
    const junction = runTool(ctx, "set_group_junction", {
      groupId: "missing",
      junction: { action: "omit", side: "below", withRole: "wall" },
      tilesetId: COMBINED_TOWN_TILESET_ID,
    });
    const overlay = runTool(ctx, "set_group_overlay", {
      groupId: "missing",
      overlay: { tileIds: [5], when: "ridge" },
      tilesetId: COMBINED_TOWN_TILESET_ID,
    });

    // Then: both tools report a group-not-found failure.
    expect(junction.ok).toBe(false);
    expect(junction.issues?.[0]?.code).toBe("group-not-found");
    expect(overlay.ok).toBe(false);
    expect(overlay.issues?.[0]?.code).toBe("group-not-found");
  });

  it("upsert_tile_group stores junctions and overlays when provided", () => {
    // Given: a blank project with the default tileset.
    const ctx: ToolContext = { project: createBlankProject() };

    // When: a group is upserted with structural rules.
    const result = runTool(ctx, "upsert_tile_group", {
      junctions: [{ action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" }],
      name: "처마 지붕",
      overlays: [{ tileIds: [8], when: "eaveEnd" }],
      role: "roof",
      tileIds: [1, 2, 3],
      tilesetId: COMBINED_TOWN_TILESET_ID,
    });

    // Then: both optional arrays are persisted on the group.
    expect(result.ok, result.summary).toBe(true);
    const groupId = (result.data as { readonly groupId: string }).groupId;
    const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((candidate) => candidate.id === groupId);
    expect(group?.junctions).toEqual([{ action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" }]);
    expect(group?.overlays).toEqual([{ tileIds: [8], when: "eaveEnd" }]);
  });

  it("catalog registry includes the structure rule tools", () => {
    // Given: the tool registry is the catalog source.
    const names = allTools().map((tool) => tool.name);

    // Then: both new tools are registered for catalog generation.
    expect(names).toEqual(expect.arrayContaining(["set_group_junction", "set_group_overlay"]));
  });
});
