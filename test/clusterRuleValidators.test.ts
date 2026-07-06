import { describe, expect, it } from "vitest";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import type { ClusterRule, GameMap, Project, TileGroupMetadata } from "@/project/types";

const MAP_ID = "map_cluster_rules";

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

function groupWithRules(rules: readonly ClusterRule[]): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "검증 대상 클러스터",
    id: "cluster-main",
    name: "검증 클러스터",
    placementRules: "테스트 규칙",
    role: "building",
    rules: [...rules],
    tileIds: [10, 11, 260, 290],
  };
}

function projectWithRules(rules: readonly ClusterRule[]): { readonly map: GameMap; readonly project: Project } {
  const project = createBlankProject();
  const map = blankMap();
  project.maps = { [MAP_ID]: map };
  project.mapTree = { mapId: MAP_ID, children: [] };
  project.startMapId = MAP_ID;
  project.startPos = { x: 0, y: 0 };
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [groupWithRules(rules)];
  return { map, project };
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
});
