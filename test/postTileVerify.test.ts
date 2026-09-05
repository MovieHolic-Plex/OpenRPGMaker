// postTileVerify: AI 타일 시공 후검증 계약 (지붕 완결성·나무-풀 오배치).

import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { verifyPostTilePlacement } from "@/project/lint/postTileVerify";
import type { LintIssue } from "@/project/lint/projectLint";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

const MAP_ID = "map_blank_start";
const WALL_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`;

function context(): { ctx: ToolContext; tileset: () => TilesetDef } {
  const ctx: ToolContext = { project: createBlankProject() };
  return { ctx, tileset: () => ctx.project.tilesets[DEFAULT_TILESET_ID] };
}

function approve(tileset: TilesetDef, groupId: string): TileGroupMetadata {
  const group = tileset.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) throw new Error(`그룹 없음: ${groupId}`);
  group.origin = "user";
  return group;
}

function addApprovedRoof(tileset: TilesetDef): TileGroupMetadata {
  const roof: TileGroupMetadata = {
    id: "test-roof", name: "빨간 지붕", role: "roof", defaultLayer: "upper", layerHome: "upper",
    tileIds: [60, 61, 62], description: "빨간 지붕 재료", placementRules: "", origin: "user",
    patternGrammar: {
      kind: "horizontal_expandable", minWidth: 2, preserveCaps: true, repeat: "body",
      parts: [{ role: "leftCap", tileIds: [60] }, { role: "repeatBody", tileIds: [61] }, { role: "rightCap", tileIds: [62] }],
    },
  };
  tileset.tileGroups!.push(roof);
  tileset.tileMeta ??= [];
  for (const tile of [60, 61, 62]) {
    tileset.tileMeta[tile] = {
      ...(tileset.tileMeta[tile] ?? {}),
      label: "빨간 지붕",
      description: "빨간 지붕 재료",
      role: "roof",
      origin: "user",
      source: "user",
    };
  }
  return roof;
}

function lintIssues(data: unknown): LintIssue[] {
  if (typeof data !== "object" || data === null) return [];
  const issues = (data as { issues?: unknown }).issues;
  return Array.isArray(issues) ? issues as LintIssue[] : [];
}

describe("post-roof-incomplete (지붕 완결성 후검증)", () => {
  it("wallRect가 벽 일부만 덮으면 경고를 내되 적용은 막지 않는다", () => {
    const { ctx, tileset } = context();
    addApprovedRoof(tileset());
    approve(tileset(), WALL_GROUP_ID);
    expect(runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 4, y: 6, w: 6, h: 3 }, material: "흰 집 벽" }).ok).toBe(true);
    const roofed = runTool(ctx, "build_roof", {
      mapId: MAP_ID, material: "빨간 지붕", wallRect: { x: 4, y: 6, w: 3, h: 3 },
    });
    expect(roofed.ok, roofed.summary).toBe(true);
    const issue = (roofed.issues ?? []).find((entry) => entry.code === "post-roof-incomplete");
    expect(issue).toBeTruthy();
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("3칸");
    expect((roofed.diff?.warnings ?? []).some((warning) => warning.includes("지붕 미완성"))).toBe(true);
  });

  it("지붕이 그 집 벽 전체를 덮으면 조용하다", () => {
    const { ctx, tileset } = context();
    addApprovedRoof(tileset());
    approve(tileset(), WALL_GROUP_ID);
    expect(runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 4, y: 6, w: 5, h: 3 }, material: "흰 집 벽" }).ok).toBe(true);
    const roofed = runTool(ctx, "build_roof", { mapId: MAP_ID, material: "빨간 지붕" });
    expect(roofed.ok, roofed.summary).toBe(true);
    expect((roofed.issues ?? []).some((entry) => entry.code === "post-roof-incomplete")).toBe(false);
  });

  it("다른 집 벽이 있어도 이번에 지붕을 얹은 집만 본다", () => {
    const { ctx, tileset } = context();
    addApprovedRoof(tileset());
    approve(tileset(), WALL_GROUP_ID);
    expect(runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 1, y: 8, w: 5, h: 3 }, material: "흰 집 벽" }).ok).toBe(true);
    expect(runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 12, y: 8, w: 5, h: 3 }, material: "흰 집 벽" }).ok).toBe(true);
    const roofed = runTool(ctx, "build_roof", {
      mapId: MAP_ID, material: "빨간 지붕", wallRect: { x: 1, y: 8, w: 5, h: 3 },
    });
    expect(roofed.ok, roofed.summary).toBe(true);
    expect((roofed.issues ?? []).some((entry) => entry.code === "post-roof-incomplete")).toBe(false);
  });

  it("run_lint는 일부만 덮인 지붕을 경고한다", () => {
    const { ctx, tileset } = context();
    addApprovedRoof(tileset());
    approve(tileset(), WALL_GROUP_ID);
    expect(runTool(ctx, "build_wall", { mapId: MAP_ID, rect: { x: 4, y: 6, w: 6, h: 3 }, material: "흰 집 벽" }).ok).toBe(true);
    expect(runTool(ctx, "build_roof", {
      mapId: MAP_ID, material: "빨간 지붕", wallRect: { x: 4, y: 6, w: 3, h: 3 },
    }).ok).toBe(true);
    const linted = runTool(ctx, "run_lint", {});
    expect(linted.ok, linted.summary).toBe(true);
    expect(lintIssues(linted.data).some((entry) => entry.code === "post-roof-incomplete")).toBe(true);
  });
});

describe("post-tree-only-undergrowth (나무가 풀로 깔림 후검증)", () => {
  it("숲 합성이 나무 없이 덤불만 깔면 경고를 낸다", () => {
    const project = createBlankProject();
    const map = project.maps[MAP_ID];
    map.upperTiles[3 * map.width + 3] = 289;
    map.upperTiles[3 * map.width + 4] = 289;
    const issues = verifyPostTilePlacement(project, {
      name: "place_props",
      args: { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "침엽수", density: "dense" },
      data: { placed: 5, requested: 8, materials: ["덤불"] },
    });
    const issue = issues.find((entry) => entry.code === "post-tree-only-undergrowth");
    expect(issue).toBeTruthy();
    expect(issue?.severity).toBe("warning");
  });

  it("숲 합성에 나무가 포함되면 조용하다", () => {
    const project = createBlankProject();
    const map = project.maps[MAP_ID];
    map.lowerTiles[3 * map.width + 3] = 290;
    map.upperTiles[2 * map.width + 3] = 260;
    const issues = verifyPostTilePlacement(project, {
      name: "place_props",
      args: { mapId: MAP_ID, area: { x: 2, y: 2, w: 6, h: 6 }, material: "침엽수", density: "dense" },
      data: { placed: 5, requested: 8, materials: ["침엽수", "덤불"] },
    });
    expect(issues.some((entry) => entry.code === "post-tree-only-undergrowth")).toBe(false);
  });

  it("나무를 요청했는데 영역에 나무 타일이 하나도 없으면 경고를 낸다", () => {
    const project = createBlankProject();
    const issues = verifyPostTilePlacement(project, {
      name: "place_props",
      args: { mapId: MAP_ID, area: { x: 2, y: 2, w: 4, h: 4 }, material: "침엽수", count: 4 },
      data: { placed: 4, requested: 4 },
    });
    expect(issues.some((entry) => entry.code === "post-tree-missing")).toBe(true);
  });

  it("덤불만 있으면 나무 타일로 세지 않는다", () => {
    const project = createBlankProject();
    const map = project.maps[MAP_ID];
    map.upperTiles[3 * map.width + 3] = 289;
    const issues = verifyPostTilePlacement(project, {
      name: "place_props",
      args: { mapId: MAP_ID, area: { x: 2, y: 2, w: 4, h: 4 }, material: "침엽수", count: 4 },
      data: { placed: 4, requested: 4 },
    });
    expect(issues.some((entry) => entry.code === "post-tree-missing")).toBe(true);
  });

  it("나무 상자 같은 가구는 나무 기대치 검사에서 제외한다", () => {
    const project = createBlankProject();
    const issues = verifyPostTilePlacement(project, {
      name: "place_props",
      args: { mapId: MAP_ID, area: { x: 2, y: 2, w: 4, h: 4 }, material: "나무 상자", count: 2 },
      data: { placed: 2, requested: 2 },
    });
    expect(issues.some((entry) => entry.code === "post-tree-missing")).toBe(false);
  });

  it("영역에 실제 나무가 있으면 조용하다", () => {
    const project = createBlankProject();
    const map = project.maps[MAP_ID];
    map.lowerTiles[3 * map.width + 3] = 290;
    map.upperTiles[2 * map.width + 3] = 260;
    expect(map.upperTiles[2 * map.width + 3]).toBe(260);
    const issues = verifyPostTilePlacement(project, {
      name: "place_props",
      args: { mapId: MAP_ID, area: { x: 2, y: 2, w: 4, h: 4 }, material: "침엽수", count: 1 },
      data: { placed: 1, requested: 1 },
    });
    expect(issues.some((entry) => entry.code === "post-tree-missing")).toBe(false);
  });

  it("타일 쓰기 외의 툴에는 아무것도 말하지 않는다", () => {
    const project = createBlankProject();
    expect(verifyPostTilePlacement(project, { name: "place_npc", args: {}, data: undefined })).toEqual([]);
    expect(project.maps[MAP_ID].upperTiles.length).toBeGreaterThan(0);
    void TILE.EMPTY;
  });
});
