import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildClusterEditKickoff, type ClusterGroupSnapshot } from "@/ai/clusterAssistPrompt";
import { commitChangeset } from "@/editor/tools/changeset";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { isAutotileGroup, validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { store } from "@/project/store";
import type { ClusterRule, GameMap, Project, TileGroupMetadata } from "@/project/types";

const MAP_ID = "map_autotile_rules";

let previousProject: Project;

beforeEach(() => {
  previousProject = structuredClone(store.getCurrent());
});

afterEach(() => {
  store.replace(previousProject);
});

describe("오토타일 클러스터 규칙", () => {
  it("isAutotileGroup은 오토타일 문법만 true로 판정한다", () => {
    // Given: groups with each relevant pattern grammar.
    const autotile = group("autotile", [], "autotile_3x3");
    const animated = group("animated", [], "animated_terrain");
    const single = group("single", [], "single");
    const unknown = group("unknown", []);

    // When/Then: only autotile grammars are treated as edge-driven groups.
    expect(isAutotileGroup(autotile)).toBe(true);
    expect(isAutotileGroup(animated)).toBe(true);
    expect(isAutotileGroup(single)).toBe(false);
    expect(isAutotileGroup(unknown)).toBe(false);
  });

  it("오토타일 그룹의 adjacency hard 규칙은 검증과 커밋 게이트에서 건너뛴다", () => {
    // Given: an autotile group has a hard tile-pair rule that would fail for fixed tiles.
    const { map, project } = projectWithGroup(group("lake-water-autotile", [hardAdjacencyRule()], "autotile_3x3"));
    map.lowerTiles[at(map, 1, 1)] = 260;

    // When: cluster rules and the commit gate validate the project.
    const violations = validateClusterRules(project);
    const commit = commitChangeset(project);

    // Then: the autotile tile-pair rule is skipped and does not block commit.
    expect(violations).toHaveLength(0);
    expect(commit.ok).toBe(true);
    expect(commit.issues.filter((issue) => issue.code.startsWith("cluster-rule"))).toHaveLength(0);
  });

  it("비오토타일 그룹의 동일 adjacency hard 규칙은 기존처럼 위반된다", () => {
    // Given: a non-autotile group uses the same hard adjacency rule.
    const { map, project } = projectWithGroup(group("roof-wall", [hardAdjacencyRule()], "single"));
    map.lowerTiles[at(map, 1, 1)] = 260;

    // When: cluster rules are validated.
    const violations = validateClusterRules(project);

    // Then: the fixed tile-pair rule still produces a hard violation.
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      code: "cluster-rule:adjacency:roof-wall",
      severity: "error",
    });
  });

  it("오토타일 그룹의 spacing 규칙은 건너뛰고 count 규칙은 유지한다", () => {
    // Given: an autotile group has spacing and count rules.
    const { map, project } = projectWithGroup(group("dirt-road-autotile", [
      { id: "gap", kind: "spacing", params: { minGap: 3 }, strength: "hard" },
      { id: "cap", kind: "count", params: { max: 1 }, strength: "hard" },
    ], "animated_terrain"));
    map.lowerTiles[at(map, 0, 0)] = 260;
    map.lowerTiles[at(map, 1, 0)] = 290;

    // When: cluster rules are validated.
    const violations = validateClusterRules(project);

    // Then: spacing is skipped, while the count rule still reports the over-limit group.
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      code: "cluster-rule:count:dirt-road-autotile",
      severity: "error",
    });
  });
});

describe("오토타일 규칙 저작 스킬", () => {
  it("오토타일 그룹은 타일쌍 kind 선택지를 숨기고 개수/취소만 제시한다", () => {
    // Given: the cluster-edit skill is opened for an autotile group.
    const project = projectWithGroup(group("lake-water-autotile", [], "autotile_3x3")).project;
    store.replace(project);

    // When: the system skill builds its kickoff prompt.
    const prompt = clusterEditPrompt("lake-water-autotile");

    // Then: the prompt explains the autotile branch and offers only count/cancel for rule kind.
    expect(prompt).toContain("이 그룹은 오토타일이라 가장자리를 자동 계산합니다");
    expect(prompt).toContain("타일쌍(인접성/간격) 규칙은 적용되지 않습니다");
    expect(prompt).toContain("[선택지] 개수 | 취소");
    expect(prompt).not.toContain("[선택지] 인접성 | 간격 | 개수");
  });

  it("비오토타일 그룹은 기존 인접성/간격/개수 선택지를 유지한다", () => {
    // Given: the cluster-edit skill is opened for a regular group.
    const project = projectWithGroup(group("roof-wall", [], "single")).project;
    store.replace(project);

    // When: the system skill builds its kickoff prompt.
    const prompt = clusterEditPrompt("roof-wall");

    // Then: the original tile-pair choices remain available.
    expect(prompt).toContain("[선택지] 인접성 | 간격 | 개수");
    expect(prompt).not.toContain("[선택지] 개수 | 취소");
  });
});

function blankMap(): GameMap {
  const width = 5;
  const height = 5;
  return {
    events: [],
    height,
    id: MAP_ID,
    lowerTiles: new Array<number>(width * height).fill(TILE.GRASS),
    name: "오토타일 규칙 테스트",
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

function group(
  id: string,
  rules: readonly ClusterRule[],
  patternKind?: NonNullable<TileGroupMetadata["patternGrammar"]>["kind"]
): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "오토타일 규칙 테스트 그룹",
    id,
    name: id,
    placementRules: "테스트 규칙",
    role: "building",
    rules: [...rules],
    tileIds: [260, 290],
    ...(patternKind ? { patternGrammar: patternGrammar(patternKind) } : {}),
  };
}

function patternGrammar(kind: NonNullable<TileGroupMetadata["patternGrammar"]>["kind"]): NonNullable<TileGroupMetadata["patternGrammar"]> {
  return {
    kind,
    parts: [{ role: "center", tileIds: [260, 290] }],
    preserveCaps: false,
    repeat: "source_order",
  };
}

function projectWithGroup(tileGroup: TileGroupMetadata): { readonly map: GameMap; readonly project: Project } {
  const project = createBlankProject();
  const map = blankMap();
  project.maps = { [MAP_ID]: map };
  project.mapTree = { mapId: MAP_ID, children: [] };
  project.mapConnections = [];
  project.startMapId = MAP_ID;
  project.startPos = { x: 0, y: 0 };
  project.testPresets = [];
  project.villageInfoDocuments = [];
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [tileGroup];
  return { map, project };
}

/** 킥오프 프롬프트에 실릴 그룹 스냅샷(구 skills.ts 의 clusterGroupSnapshot 로컬 픽스처). */
function groupSnapshot(tilesetId: string, groupId: string): ClusterGroupSnapshot | null {
  const group = store.getCurrent().tilesets[tilesetId]?.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) return null;
  return {
    id: group.id,
    name: group.name,
    role: group.role,
    defaultLayer: group.defaultLayer,
    tileIds: [...group.tileIds],
    description: group.description,
    placementRules: group.placementRules,
    patternGrammar: group.patternGrammar ? { kind: group.patternGrammar.kind } : null,
  };
}

function clusterEditPrompt(groupId: string): string {
  return buildClusterEditKickoff({
    tilesetId: DEFAULT_TILESET_ID,
    groupId,
    group: groupSnapshot(DEFAULT_TILESET_ID, groupId),
  });
}
