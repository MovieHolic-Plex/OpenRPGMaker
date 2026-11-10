import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { OPEN_GROUND, openGroundProps } from "@/project/openGround";
import type { GameMap, Project } from "@/project/types";

// 2026-11-11 구조 재점검 3-1: 설원·사막·스팀펑크 칩셋으로 지은 야외 맵 13장이 전부 «맨땅 0% · 빈 터 없음» 이었다
// (빈 터 찾기가 몬스터 수집 시트의 바닥 이름표 다섯 가지만 땅으로 셌다).
function tileByLabel(project: Project, tilesetId: string, label: string): number {
  const hit = Object.entries(project.tilesets[tilesetId]?.tileMeta ?? {}).find(([, meta]) => meta?.label === label);
  assert(hit, `${tilesetId} 에 «${label}» 칸이 없다`);
  return Number(hit[0]);
}
function snowField(lower: (project: Project) => number, width = 24, height = 18) {
  const project = createBlankProject();
  const base = project.maps[project.startMapId];
  assert(base && project.tilesets.snow_north, "snow_north 번들 칩셋이 있어야 한다");
  const tile = lower(project);
  const map: GameMap = { ...base, id: "map_snow", name: "눈밭", width, height, tilesetId: "snow_north", events: [],
    lowerTiles: new Array<number>(width * height).fill(tile), upperTiles: new Array<number>(width * height).fill(-1) };
  delete (map as { mapRole?: unknown }).mapRole;
  project.maps[map.id] = map;
  return { ctx: { project }, map };
}
const SNOW = (project: Project) => tileByLabel(project, "snow_north", "눈밭(바람 물결)");

describe("빈 야외 땅 — 바닥 이름표를 모르는 칩셋", () => {
  it("find_empty_ground 는 걸을 수 있는 야외 지형 칸을 땅으로 세고 그 칩셋의 소품을 일러 준다", () => {
    const { ctx, map } = snowField(SNOW);
    const result = runTool(ctx, "find_empty_ground", { mapId: map.id });
    assert(result.ok, result.summary);
    const data = result.data as { bare: { bareShare: number; ground: number }; areas: { ground: string; w: number; h: number }[]; props?: { trees: string[] } };
    expect(data.bare.ground).toBe(map.width * map.height);
    expect(data.bare.bareShare).toBeGreaterThan(0.9);
    expect(data.areas[0]).toMatchObject({ ground: OPEN_GROUND });
    expect(data.props?.trees.length).toBeGreaterThan(0);
  });

  it("길 칸은 땅이 아니다", () => {
    const { ctx, map } = snowField(SNOW);
    const road = Object.entries(ctx.project.tilesets.snow_north!.tileMeta ?? {}).find(([, meta]) => (meta?.label ?? "").startsWith("다진 눈길"));
    assert(road);
    for (let x = 0; x < map.width; x++) map.lowerTiles[8 * map.width + x] = Number(road[0]);
    const data = runTool(ctx, "find_empty_ground", { mapId: map.id }).data as { bare: { ground: number }; areas: { y: number; h: number }[] };
    expect(data.bare.ground).toBe(map.width * (map.height - 1));
    for (const area of data.areas) expect(area.y > 8 || area.y + area.h <= 8).toBe(true);
  });

  it("실내 바닥은 땅이 아니다", () => {
    const { ctx, map } = snowField((project) => tileByLabel(project, "snow_north", "통나무 판자 바닥(따뜻한 갈색)"), 14, 10);
    const result = runTool(ctx, "find_empty_ground", { mapId: map.id });
    assert(result.ok, result.summary);
    expect((result.data as { areas: unknown[] }).areas).toHaveLength(0);
  });

  it("furnish_outdoor_area 는 그 칩셋의 나무·덤불·바위로 채우고 맨땅 비율을 낮춘다", () => {
    const { ctx, map } = snowField(SNOW);
    const result = runTool(ctx, "furnish_outdoor_area", { mapId: map.id });
    assert(result.ok, result.summary);
    const data = result.data as { ground: string; lots: unknown[]; bareBefore: { bareShare: number }; bareAfter: { bareShare: number } };
    expect(data.ground).toBe(OPEN_GROUND);
    expect(data.lots.length).toBeGreaterThan(0);
    expect(data.bareAfter.bareShare).toBeLessThan(data.bareBefore.bareShare);
    expect(ctx.project.maps[map.id]!.upperTiles.some((tile) => tile !== -1)).toBe(true);
  });

  it("props 로 고른 소품만 쓰고, 없는 이름은 있는 이름을 일러 주며 거절한다", () => {
    const { ctx, map } = snowField(SNOW);
    const names = openGroundProps(ctx.project.tilesets.snow_north!);
    const tree = names.trees[0]!;
    const ok = runTool(ctx, "furnish_outdoor_area", { mapId: map.id, region: "top-left", props: [tree] });
    assert(ok.ok, ok.summary);
    expect((ok.data as { palette: { trees: string[]; smalls: string[] } }).palette).toMatchObject({ trees: [tree], smalls: [] });
    const bad = runTool(ctx, "furnish_outdoor_area", { mapId: map.id, region: "bottom-right", props: ["용의 알"] });
    expect(bad.ok).toBe(false);
    expect(bad.summary).toContain("Available:");
  });
});
