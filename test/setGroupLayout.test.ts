import { describe, expect, it } from "vitest";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { TOOL_CATEGORIES } from "@/editor/panels/toolBrowserModal";
import { runTool } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import type { TileGroupMetadata } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
type SetGroupLayoutData = {
  readonly axis: "horizontal" | "vertical";
  readonly groupId: string;
  readonly tilesetId: string;
};

function contextWithGroup(): ToolContext {
  const project = createBlankProject();
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [layoutGroup()];
  return { project };
}

function layoutGroup(): TileGroupMetadata {
  return {
    defaultLayer: "upper",
    description: "2칸 나무",
    id: "tree-pair",
    name: "나무 2칸",
    placementRules: "위/아래 한 덩어리",
    role: "prop",
    tileIds: [100],
  };
}

function groupOf(ctx: ToolContext): TileGroupMetadata {
  const group = ctx.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((candidate) => candidate.id === "tree-pair");
  if (!group) throw new Error("test group missing");
  return group;
}

function grammarOf(ctx: ToolContext): PatternGrammar {
  const grammar = groupOf(ctx).patternGrammar;
  if (!grammar) throw new Error("patternGrammar missing");
  return grammar;
}

function dataOf(value: unknown): SetGroupLayoutData {
  if (!isSetGroupLayoutData(value)) throw new Error("set_group_layout data shape mismatch");
  return value;
}

function isSetGroupLayoutData(value: unknown): value is SetGroupLayoutData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Reflect.get(value, "tilesetId") === DEFAULT_TILESET_ID
    && typeof Reflect.get(value, "groupId") === "string"
    && (Reflect.get(value, "axis") === "vertical" || Reflect.get(value, "axis") === "horizontal");
}

describe("set_group_layout", () => {
  it("세로 위/아래 구성을 저장하고 샘플에서 위 칸 260, 아래 칸 290으로 배치한다", () => {
    // Given: a project with one editable tile group.
    const ctx = contextWithGroup();

    // When: the group layout is persisted as top/bottom.
    const result = runTool(ctx, "set_group_layout", { axis: "vertical", bottom: [290], groupId: "tree-pair", top: [260] });

    // Then: the grammar, tile union, registry data, and sample placement match the saved layout.
    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toBe("구성 저장: 나무 2칸 — 위 [260] / 아래 [290] (세로)");
    expect(dataOf(result.data)).toEqual({ axis: "vertical", groupId: "tree-pair", tilesetId: DEFAULT_TILESET_ID });
    expect(grammarOf(ctx)).toEqual({
      axis: "vertical",
      kind: "vertical_expandable",
      minHeight: 2,
      minWidth: 1,
      parts: [
        { role: "top", tileIds: [260] },
        { role: "bottom", tileIds: [290] },
      ],
      preserveCaps: true,
      repeat: "body",
    });
    expect(groupOf(ctx).tileIds).toEqual([100, 260, 290]);

    const sample = buildGroupSample(ctx.project.tilesets[DEFAULT_TILESET_ID], groupOf(ctx));
    expect(sample.w).toBe(5);
    expect(sample.h).toBe(2);
    expect(sample.upper[0]).toBe(260);
    expect(sample.upper[sample.w]).toBe(290);
    expect(sample.lower[0]).toBe(TILE.GRASS);
  });

  it("가로 좌/우 구성을 leftCap/rightCap 문법으로 저장한다", () => {
    // Given: a project with one editable tile group.
    const ctx = contextWithGroup();

    // When: the group layout is persisted as left/right.
    const result = runTool(ctx, "set_group_layout", {
      axis: "horizontal",
      groupId: "tree-pair",
      left: [210],
      right: [211],
      tilesetId: DEFAULT_TILESET_ID,
    });

    // Then: the horizontal expandable grammar uses the supported cap roles.
    expect(result.ok, result.summary).toBe(true);
    expect(grammarOf(ctx)).toEqual({
      axis: "horizontal",
      kind: "horizontal_expandable",
      minHeight: 1,
      minWidth: 2,
      parts: [
        { role: "leftCap", tileIds: [210] },
        { role: "rightCap", tileIds: [211] },
      ],
      preserveCaps: true,
      repeat: "body",
    });
    expect(groupOf(ctx).tileIds).toEqual([100, 210, 211]);
  });

  it("없는 그룹/타일셋, 축별 필수 파트 누락, 잘못된 타일 id를 거부한다", () => {
    // Given: a project with one editable tile group.
    const ctx = contextWithGroup();

    // When: invalid layout requests are made.
    const missingGroup = runTool(ctx, "set_group_layout", { axis: "vertical", groupId: "missing", top: [260] });
    const missingTileset = runTool(ctx, "set_group_layout", { axis: "vertical", groupId: "tree-pair", tilesetId: "missing", top: [260] });
    const missingVerticalParts = runTool(ctx, "set_group_layout", { axis: "vertical", groupId: "tree-pair" });
    const invalidTile = runTool(ctx, "set_group_layout", { axis: "horizontal", groupId: "tree-pair", right: [9999] });

    // Then: all invalid calls fail without replacing the existing group layout.
    expect(missingGroup.ok).toBe(false);
    expect(missingGroup.issues?.[0]?.code).toBe("group-not-found");
    expect(missingTileset.ok).toBe(false);
    expect(missingTileset.issues?.[0]?.code).toBe("tileset-not-found");
    expect(missingVerticalParts.ok).toBe(false);
    expect(missingVerticalParts.issues?.[0]?.code).toBe("invalid-args");
    expect(invalidTile.ok).toBe(false);
    expect(invalidTile.issues?.[0]?.code).toBe("tile-out-of-range");
    expect(groupOf(ctx).patternGrammar).toBeUndefined();
  });

  it("레지스트리와 툴 브라우저 카테고리에 등록된다", () => {
    // Given: the tool registry and browser category metadata.
    const toolNames = allTools().map((tool) => tool.name);
    const categoryNames = TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name));

    // Then: set_group_layout is exposed in both surfaces.
    expect(toolNames).toContain("set_group_layout");
    expect(categoryNames).toContain("set_group_layout");
  });
});
