import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import type { ClusterRule, GameMap, Project, TileGroupMetadata } from "@/project/types";

const MAP_ID = "map_cluster_rules";
type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;

function blankMap(): GameMap {
  const width = 5;
  const height = 5;
  return {
    events: [],
    height,
    id: MAP_ID,
    lowerTiles: new Array<number>(width * height).fill(TILE.GRASS),
    name: "클러스터 규칙 테스트",
    tileSize: 16,
    tilesetId: DEFAULT_TILESET_ID,
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    width,
  };
}

function at(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function groupWithRules(rules: readonly ClusterRule[], patternGrammar?: PatternGrammar): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "검증 대상 클러스터",
    id: "cluster-main",
    name: "검증 클러스터",
    placementRules: "테스트 규칙",
    role: "building",
    rules: [...rules],
    tileIds: [10, 11, 260, 290],
    ...(patternGrammar ? { patternGrammar } : {}),
  };
}

function projectWithRules(rules: readonly ClusterRule[], patternGrammar?: PatternGrammar): { readonly map: GameMap; readonly project: Project } {
  const project = createBlankProject();
  const map = blankMap();
  project.maps = { [MAP_ID]: map };
  project.mapTree = { mapId: MAP_ID, children: [] };
  project.startMapId = MAP_ID;
  project.startPos = { x: 0, y: 0 };
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [groupWithRules(rules, patternGrammar)];
  return { map, project };
}

function verticalTreeGrammar(): PatternGrammar {
  return {
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
  };
}

describe("validateClusterRules", () => {
  it("adjacency 규칙은 모든 a 타일 좌표에서 지정 방향의 b 타일을 요구한다", () => {
    // Given: hard adjacency says 260 must be directly above 290.
    const { map, project } = projectWithRules([
      { id: "roof-on-wall", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" },
    ]);
    map.lowerTiles[at(map, 1, 1)] = 260;
    map.lowerTiles[at(map, 3, 1)] = 260;
    map.lowerTiles[at(map, 3, 2)] = 290;

    // When: cluster rules are validated.
    const violations = validateClusterRules(project);

    // Then: only the unsupported 260 coordinate is reported as a hard error.
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      code: "cluster-rule:adjacency:cluster-main",
      groupId: "cluster-main",
      severity: "error",
    });
    expect(violations[0]?.coords).toEqual([{ mapId: MAP_ID, x: 1, y: 1 }]);
  });

  it("adjacency 규칙은 b 타일만 남은 반쪽 페어도 같은 hard 위반으로 보고한다", () => {
    // Given: hard adjacency says 260 must be directly above 290, but only the lower half exists.
    const { map, project } = projectWithRules([
      { id: "conifer-hard", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" },
    ]);
    map.upperTiles[at(map, 2, 3)] = 290;

    // When: cluster rules are validated.
    const violations = validateClusterRules(project);

    // Then: the orphan lower half is reported at its own coordinate.
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      code: "cluster-rule:adjacency:cluster-main",
      severity: "error",
    });
    expect(violations[0]?.coords).toEqual([{ mapId: MAP_ID, x: 2, y: 3 }]);
  });

  it("spacing 규칙은 같은 그룹 인스턴스가 minGap 미만이면 두 좌표를 warning으로 모은다", () => {
    // Given: medium spacing requires a gap of at least 3 grid steps between group tiles.
    const { map, project } = projectWithRules([
      { id: "space-out", kind: "spacing", params: { minGap: 3 }, strength: "medium" },
    ]);
    map.lowerTiles[at(map, 0, 0)] = 10;
    map.upperTiles[at(map, 2, 0)] = 11;

    // When: cluster rules are validated.
    const violations = validateClusterRules(project);

    // Then: both close group instances are returned as a non-blocking warning.
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      code: "cluster-rule:spacing:cluster-main",
      groupId: "cluster-main",
      severity: "warning",
    });
    expect(violations[0]?.coords).toEqual([
      { mapId: MAP_ID, x: 0, y: 0 },
      { mapId: MAP_ID, x: 2, y: 0 },
    ]);
  });

  it("count 규칙은 인스턴스 수 범위를 검사하고 soft 위반을 info로 반환한다", () => {
    // Given: soft count caps the group at 2 instances on each map.
    const { map, project } = projectWithRules([
      { id: "cap", kind: "count", params: { max: 2, perMap: true }, strength: "soft" },
    ]);
    map.lowerTiles[at(map, 1, 0)] = 10;
    map.lowerTiles[at(map, 1, 1)] = 11;
    map.lowerTiles[at(map, 1, 2)] = 260;

    // When: cluster rules are validated for the map.
    const violations = validateClusterRules(project, MAP_ID);

    // Then: the issue is informational and carries every over-limit group coordinate.
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      code: "cluster-rule:count:cluster-main",
      groupId: "cluster-main",
      severity: "info",
    });
    expect(violations[0]?.coords).toEqual([
      { mapId: MAP_ID, x: 1, y: 0 },
      { mapId: MAP_ID, x: 1, y: 1 },
      { mapId: MAP_ID, x: 1, y: 2 },
    ]);
  });

  it("spacing 규칙은 1x2 풋프린트의 자기 인접 셀을 위반으로 세지 않는다", () => {
    // Given: a vertical tree footprint occupies two adjacent cells as one instance.
    const { map, project } = projectWithRules([
      { id: "space-tree", kind: "spacing", params: { minGap: 2 }, strength: "hard" },
    ], verticalTreeGrammar());
    map.upperTiles[at(map, 1, 1)] = 260;
    map.upperTiles[at(map, 1, 2)] = 290;

    // When: cluster rules are validated.
    const violations = validateClusterRules(project);

    // Then: the top and bottom of the same tree do not violate their own minGap.
    expect(violations).toHaveLength(0);
  });

  it("spacing 규칙은 별도 풋프린트 인스턴스 사이 간격을 검사한다", () => {
    // Given: two complete 1x2 trees are touching horizontally.
    const { map, project } = projectWithRules([
      { id: "space-tree", kind: "spacing", params: { minGap: 1 }, strength: "hard" },
    ], verticalTreeGrammar());
    map.upperTiles[at(map, 1, 1)] = 260;
    map.upperTiles[at(map, 1, 2)] = 290;
    map.upperTiles[at(map, 2, 1)] = 260;
    map.upperTiles[at(map, 2, 2)] = 290;

    // When: cluster rules are validated.
    const violations = validateClusterRules(project);

    // Then: the two tree instances violate spacing, and all footprint cells are reported.
    expect(violations).toHaveLength(1);
    expect(violations[0]?.coords).toEqual([
      { mapId: MAP_ID, x: 1, y: 1 },
      { mapId: MAP_ID, x: 1, y: 2 },
      { mapId: MAP_ID, x: 2, y: 1 },
      { mapId: MAP_ID, x: 2, y: 2 },
    ]);
  });

  it("count 규칙은 다중 타일 풋프린트를 셀이 아니라 한 인스턴스로 센다", () => {
    // Given: one complete 1x2 tree and a max count of one.
    const { map, project } = projectWithRules([
      { id: "cap-tree", kind: "count", params: { max: 1, perMap: true }, strength: "hard" },
    ], verticalTreeGrammar());
    map.upperTiles[at(map, 1, 1)] = 260;
    map.upperTiles[at(map, 1, 2)] = 290;

    // When/Then: the two occupied cells count as one instance.
    expect(validateClusterRules(project)).toHaveLength(0);

    // When: a second complete tree is added.
    map.upperTiles[at(map, 3, 1)] = 260;
    map.upperTiles[at(map, 3, 2)] = 290;
    const violations = validateClusterRules(project);

    // Then: count now fails on two instances, not four cells.
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ code: "cluster-rule:count:cluster-main", severity: "error" });
    expect(violations[0]?.coords).toHaveLength(4);
  });

  it("run_lint는 hard/medium/soft 클러스터 위반을 error/warning/info와 좌표로 노출한다", () => {
    // Given: one project carries all three cluster rule strengths.
    const { map, project } = projectWithRules([
      { id: "hard-pair", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" },
      { id: "medium-gap", kind: "spacing", params: { minGap: 3 }, strength: "medium" },
      { id: "soft-cap", kind: "count", params: { max: 2, perMap: true }, strength: "soft" },
    ]);
    project.startPos = { x: 4, y: 4 };
    map.upperTiles[at(map, 2, 3)] = 290;
    map.lowerTiles[at(map, 0, 0)] = 10;
    map.lowerTiles[at(map, 1, 0)] = 11;

    // When: the AI-facing lint tool is executed.
    const lint = runTool({ project }, "run_lint", {});
    const issues = (lint.data as { readonly issues: Array<{ readonly code: string; readonly severity: string; readonly x?: number; readonly y?: number }> }).issues;

    // Then: each strength maps to the expected public severity.
    expect(lint.ok, lint.summary).toBe(true);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "cluster-rule:adjacency:cluster-main", severity: "error", x: 2, y: 3 }),
        expect.objectContaining({ code: "cluster-rule:spacing:cluster-main", severity: "warning", x: 0, y: 0 }),
        expect.objectContaining({ code: "cluster-rule:count:cluster-main", severity: "info" }),
      ])
    );
  });
});
