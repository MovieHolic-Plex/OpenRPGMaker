import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults/defaultProject";
import type { ClusterRule, TileGroupMetadata } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

function clusterGroup(): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "클러스터 규칙 대상",
    id: "cluster-main",
    name: "클러스터",
    placementRules: "규칙 테스트",
    role: "building",
    tileIds: [260, 290],
  };
}

function contextWithGroup(): ToolContext {
  const project = createBlankProject();
  for (const map of Object.values(project.maps)) {
    map.lowerTiles.fill(TILE.GRASS);
    map.upperTiles.fill(TILE.EMPTY);
  }
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [clusterGroup()];
  return { project };
}

function rulesOf(ctx: ToolContext): readonly ClusterRule[] {
  return ctx.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.[0]?.rules ?? [];
}

describe("set_cluster_rule", () => {
  it("규칙을 추가하고 같은 id면 갱신한다", () => {
    // Given: a project with one tile group.
    const ctx = contextWithGroup();

    // When: the same cluster rule id is written twice.
    const first = runTool(ctx, "set_cluster_rule", {
      groupId: "cluster-main",
      rule: { id: "roof-wall", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" },
      tilesetId: DEFAULT_TILESET_ID,
    });
    const second = runTool(ctx, "set_cluster_rule", {
      groupId: "cluster-main",
      rule: { id: "roof-wall", kind: "adjacency", message: "260 아래 290 필요", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "medium" },
      tilesetId: DEFAULT_TILESET_ID,
    });

    // Then: the rule is updated in place.
    expect(first.ok, first.summary).toBe(true);
    expect(second.ok, second.summary).toBe(true);
    expect(rulesOf(ctx)).toEqual([
      { id: "roof-wall", kind: "adjacency", message: "260 아래 290 필요", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "medium" },
    ]);
  });

  it("없는 그룹과 잘못된 kind는 거부한다", () => {
    // Given: a project with one known group.
    const ctx = contextWithGroup();

    // When: invalid set_cluster_rule calls are made.
    const missing = runTool(ctx, "set_cluster_rule", {
      groupId: "missing",
      rule: { id: "ok", kind: "count", params: { max: 1 }, strength: "soft" },
      tilesetId: DEFAULT_TILESET_ID,
    });
    const invalidKind = runTool(ctx, "set_cluster_rule", {
      groupId: "cluster-main",
      rule: { id: "bad", kind: "diagonal", params: {}, strength: "hard" },
      tilesetId: DEFAULT_TILESET_ID,
    });

    // Then: both calls fail without changing the group rules.
    expect(missing.ok).toBe(false);
    expect(missing.issues?.[0]?.code).toBe("group-not-found");
    expect(invalidKind.ok).toBe(false);
    expect(invalidKind.issues?.[0]?.code).toBe("invalid-args");
    expect(rulesOf(ctx)).toEqual([]);
  });

  it("upsert_tile_group stores rules and the registry exposes set_cluster_rule", () => {
    // Given: a blank project.
    const ctx: ToolContext = { project: createBlankProject() };

    // When: a group is upserted with cluster rules.
    const result = runTool(ctx, "upsert_tile_group", {
      name: "규칙 그룹",
      role: "building",
      rules: [{ id: "max-two", kind: "count", params: { max: 2, perMap: true }, strength: "soft" }],
      tileIds: [260, 290],
      tilesetId: DEFAULT_TILESET_ID,
    });

    // Then: rules are persisted and the new tool is catalog-visible.
    expect(result.ok, result.summary).toBe(true);
    const groupId = (result.data as { readonly groupId: string }).groupId;
    const group = ctx.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((candidate) => candidate.id === groupId);
    expect(group?.rules).toEqual([{ id: "max-two", kind: "count", params: { max: 2, perMap: true }, strength: "soft" }]);
    expect(allTools().map((tool) => tool.name)).toContain("set_cluster_rule");
  });
});
