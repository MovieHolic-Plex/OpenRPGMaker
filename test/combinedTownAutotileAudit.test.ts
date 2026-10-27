import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_AUTOTILE_GROUPS } from "@/project/defaults/autotileGroups";
import { auditCombinedTownAutotiles, repairCombinedTownAutotiles } from "@/project/combinedTownAutotileAudit";
import type { AutotileGroup, Project } from "@/project/types";
// 합본 마을(EasyRPG) 칩셋의 타일 번호·그룹을 겨냥한 시험 — 2026-10-07 정리 뒤 새 프로젝트에 없어 옛 저장본처럼 다시 심는다.
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";

function fixture(group: AutotileGroup, tiles: readonly number[]): Project {
  const project = startOnRetiredCombinedTown(createBlankProject());
  project.meta = { ...project.meta, title: "audit fixture" };
  const map = project.maps[project.startMapId]!;
  map.width = tiles.length;
  map.height = 1;
  map.lowerTiles = [...tiles];
  map.upperTiles = tiles.map(() => 0);
  project.tilesets[map.tilesetId] = { ...project.tilesets[map.tilesetId]!, autotileGroups: [group] };
  return project;
}

describe("combined-town autotile audit", () => {
  const group = DEFAULT_AUTOTILE_GROUPS[0]!;
  const isolated = group.variantMap["0"]!;
  const connectedEast = group.variantMap["2"]!;
  const connectedWest = group.variantMap["8"]!;

  it("accepts canonical variants", () => {
    const report = auditCombinedTownAutotiles(fixture(group, [connectedEast, connectedWest]), "fixture");
    expect(report.findings).toEqual([]);
    expect(report.memberCells).toBe(2);
  });

  it("reports an incorrect boundary variant with coordinates", () => {
    const wrong = group.memberTileIds.find((tile) => tile !== isolated)!;
    const report = auditCombinedTownAutotiles(fixture(group, [wrong]), "fixture");
    expect(report.findings).toEqual([
      expect.objectContaining({ x: 0, y: 0, actual: wrong, expected: isolated, reason: "stale-variant" }),
    ]);
  });

  it("does not mutate the audited project", () => {
    const project = fixture(group, [isolated]);
    const before = structuredClone(project);
    auditCombinedTownAutotiles(project, "fixture");
    expect(project).toEqual(before);
  });

  it("excludes lake and base grass outside effective groups", () => {
    const report = auditCombinedTownAutotiles(fixture(group, [0, 240]), "fixture");
    expect(report.memberCells).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it("merges a custom group with non-overlapping built-ins", () => {
    const project = startOnRetiredCombinedTown(createBlankProject());
    const map = project.maps[project.startMapId]!;
    project.tilesets[map.tilesetId] = { ...project.tilesets[map.tilesetId]!, autotileGroups: [group] };
    const report = auditCombinedTownAutotiles(project, "fixture");
    expect(report.effectiveGroupIds.length).toBe(DEFAULT_AUTOTILE_GROUPS.length);
  });

  it("repairs every stale member variant deterministically", () => {
    const wrong = group.memberTileIds.find((tile) => tile !== isolated)!;
    const project = fixture(group, [wrong]);
    const original = structuredClone(project);
    const repaired = repairCombinedTownAutotiles(project);
    expect(auditCombinedTownAutotiles(repaired, "fixture").findings).toEqual([]);
    expect(project).toEqual(original);
    expect(repairCombinedTownAutotiles(repaired)).toEqual(repaired);
  });
});
