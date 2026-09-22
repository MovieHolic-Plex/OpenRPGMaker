import { describe, expect, it } from "vitest";
import { commitChangeset, createDraft } from "@/editor/tools/changeset";
import { runTool } from "@/editor/tools/toolRunner";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { ClusterRule, GameMap, Project, TileGroupMetadata } from "@/project/types";

function at(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}

function adjacencyGroup(): TileGroupMetadata {
  const rule: ClusterRule = {
    id: "roof-wall-hard",
    kind: "adjacency",
    params: { a: 260, b: 290, relation: "aAboveB" },
    strength: "hard",
  };
  return {
    defaultLayer: "lower",
    description: "260은 290 바로 위에 있어야 한다",
    id: "roof-wall",
    name: "지붕-벽",
    placementRules: "260 아래에는 290",
    role: "building",
    rules: [rule],
    tileIds: [260, 290],
  };
}

function twoMapProject(): { readonly project: Project; readonly left: GameMap; readonly right: GameMap } {
  const project = createBlankProject();
  const left = createBlankMap("map-left", 6, 6);
  const right = createBlankMap("map-right", 6, 6);
  project.maps = { [left.id]: left, [right.id]: right };
  project.mapTree = { mapId: left.id, children: [{ mapId: right.id, children: [] }] };
  project.startMapId = left.id;
  project.startPos = { x: 0, y: 0 };
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [adjacencyGroup()];
  return { project, left, right };
}

describe("AI 타일 커밋 핫패스", () => {
  it("createDraft는 타일 버퍼를 원본과 분리해 복사한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("시작 맵이 없습니다");
    map.lowerTiles[0] = 3;
    map.lowerTileStacks = { 0: [4, 5] };
    const draft = createDraft(project);
    const cloned = draft.maps[map.id];
    if (!cloned) throw new Error("복제 맵이 없습니다");
    cloned.lowerTiles[0] = 9;
    cloned.lowerTileStacks?.[0]?.push(8);
    expect(map.lowerTiles[0]).toBe(3);
    expect(map.lowerTileStacks[0]).toEqual([4, 5]);
    expect(cloned.lowerTiles).not.toBe(map.lowerTiles);
  });

  it("skipRoundtrip 커밋은 직렬화 실패를 차단 사유로 쓰지 않는다", () => {
    const project = createBlankProject();
    Object.defineProperty(project, "boom", {
      enumerable: true,
      get() {
        throw new Error("roundtrip");
      },
    });
    const blocked = commitChangeset(project);
    expect(blocked.ok).toBe(false);
    expect(blocked.issues.some((issue) => issue.code === "serialize-roundtrip")).toBe(true);

    const passed = commitChangeset(project, undefined, { skipRoundtrip: true });
    expect(passed.ok).toBe(true);
    expect(passed.issues.some((issue) => issue.code === "serialize-roundtrip")).toBe(false);
  });

  it("paint_tiles는 방금 칠한 맵의 클러스터 위반만 보고한다", () => {
    const { project, left, right } = twoMapProject();
    left.lowerTiles[at(left, 1, 1)] = 260;
    right.lowerTiles[at(right, 1, 1)] = 260;
    const painted = runTool({ project }, "paint_tiles", {
      mapId: left.id,
      layer: "lower",
      mode: "cells",
      tile: TILE.PATH,
      cells: [{ x: 3, y: 3 }],
    });
    expect(painted.ok).toBe(true);
    const cluster = painted.issues?.filter((issue) => issue.code.startsWith("cluster-rule")) ?? [];
    expect(cluster.some((issue) => issue.mapId === left.id)).toBe(true);
    expect(cluster.some((issue) => issue.mapId === right.id)).toBe(false);
  });

  it("손대지 않은 맵의 기존 클러스터 위반은 타일 도구 결과에 다시 싣지 않는다", () => {
    const { project, left, right } = twoMapProject();
    right.lowerTiles[at(right, 1, 1)] = 260;
    const painted = runTool({ project }, "paint_tiles", {
      mapId: left.id,
      layer: "lower",
      mode: "cells",
      tile: TILE.PATH,
      cells: [{ x: 2, y: 2 }],
    });
    expect(painted.ok).toBe(true);
    const cluster = painted.issues?.filter((issue) => issue.code.startsWith("cluster-rule")) ?? [];
    expect(cluster.some((issue) => issue.mapId === right.id)).toBe(false);
  });
});
