import { describe, expect, it } from "vitest";
import { commitChangeset } from "@/editor/tools/changeset";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults/defaultProject";
import type { ClusterRule, GameMap, Project, TileGroupMetadata } from "@/project/types";

const MAP_ID = "map_cluster_gate";

function mapForGate(): GameMap {
  const width = 4;
  const height = 4;
  return {
    events: [],
    height,
    id: MAP_ID,
    lowerTiles: new Array<number>(width * height).fill(TILE.GRASS),
    name: "클러스터 게이트",
    tileSize: 16,
    tilesetId: DEFAULT_TILESET_ID,
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    width,
  };
}

function at(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function hardAdjacencyRule(): ClusterRule {
  return { id: "roof-wall-hard", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" };
}

function clusterGroup(): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "260은 290 바로 위에 있어야 한다",
    id: "roof-wall",
    name: "지붕-벽",
    placementRules: "260 아래에는 290",
    role: "building",
    rules: [hardAdjacencyRule()],
    tileIds: [260, 290],
  };
}

function projectForGate(): { readonly map: GameMap; readonly project: Project } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId] ?? mapForGate();
  for (const candidate of Object.values(project.maps)) {
    candidate.lowerTiles.fill(TILE.GRASS);
    candidate.upperTiles.fill(TILE.EMPTY);
  }
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [clusterGroup()];
  return { map, project };
}

describe("cluster rule commit gate", () => {
  it("hard adjacency 위반은 lint error로 보고되지만 commitChangeset을 차단하지 않는다", () => {
    // Given: a hard rule requiring tile 260 directly above tile 290.
    const { map, project } = projectForGate();
    map.lowerTiles[at(map, 1, 1)] = 260;

    // When: the unsupported draft is committed.
    const reported = commitChangeset(project);

    // Then: the cluster-rule hard error is reported but does not block the write.
    expect(reported.ok).toBe(true);
    expect(reported.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "cluster-rule:adjacency:roof-wall",
          severity: "error",
          x: 1,
          y: 1,
        }),
      ])
    );

    // When: the required support tile is placed directly below.
    map.lowerTiles[at(map, 1, 2)] = 290;
    const accepted = commitChangeset(project);

    // Then: the fixed draft still passes, now without cluster-rule issues.
    expect(accepted.ok).toBe(true);
    expect(accepted.issues.filter((issue) => issue.code.startsWith("cluster-rule"))).toHaveLength(0);
  });
});
