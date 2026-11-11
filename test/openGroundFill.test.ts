import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { OPEN_GROUND, openGroundProps } from "@/project/openGround";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
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

// 2026-11-11 작은 일 재측정(dress-trees-starter): 버들항 시트는 칸 역할(role)을 안 적는다 — 풀밭 432칸 마을이 «맨땅 0%» 로 읽혔고,
// furnish_outdoor_area 는 버들항 맵을 거절하며 없는 키트 이름(bd-tree-…)을 댔다. 조수는 나무를 맵 모서리 (0,0) 에 찍었다.
describe("빈 야외 땅 — 칸 역할을 안 적는 시트(버들항)", () => {
  const village = () => {
    const ctx = { project: buildFixture("starter") };
    return { ctx, mapId: "map_ember_village" };
  };
  const stampedNames = (project: Project, mapId: string): string[] => {
    const map = project.maps[mapId]!, tileset = project.tilesets[map.tilesetId]!;
    const kitOf = new Map<number, string>();
    for (const kit of tileset.structureKits ?? []) for (const row of kit.rows) for (const tile of row.upperTiles ?? []) if (tile >= 0 && !kitOf.has(tile)) kitOf.set(tile, kit.name ?? kit.id);
    return [...new Set(map.upperTiles.filter((tile) => tile >= 0).map((tile) => kitOf.get(tile) ?? `tile ${tile}`))];
  };

  it("find_empty_ground 는 풀밭을 땅으로 읽는다", () => {
    const { ctx, mapId } = village();
    const result = runTool(ctx, "find_empty_ground", { mapId });
    assert(result.ok, result.summary);
    const data = result.data as { bare: { bareShare: number; ground: number }; areas: { ground: string }[]; props?: { trees: string[]; smalls: string[] } };
    expect(data.bare.ground).toBeGreaterThan(300);
    expect(data.bare.bareShare).toBeGreaterThan(0.8);
    expect(data.areas[0]).toMatchObject({ ground: OPEN_GROUND });
    // 기본 소품은 어디에나 어울리는 자연물뿐이다 — 가로등(prop-street)·사막 대추야자·던전 조각이 끼지 않는다.
    const offered = [...(data.props?.trees ?? []), ...(data.props?.smalls ?? [])].join(" | ");
    expect(offered).toContain("버들항 나무");
    expect(offered).not.toMatch(/가로등|대추야자|던전|벤치/u);
  });

  it("furnish_outdoor_area 는 버들항 맵을 거절하지 않고, amount:few · props:[나무] 면 나무 몇 그루만 심는다", () => {
    const { ctx, mapId } = village();
    const before = ctx.project.maps[mapId]!.upperTiles.filter((tile) => tile >= 0).length;
    const result = runTool(ctx, "furnish_outdoor_area", { mapId, region: "all", props: ["나무"], amount: "few" });
    assert(result.ok, result.summary);
    const data = result.data as { lots: unknown[] };
    expect(data.lots.length).toBeGreaterThan(0);
    expect(data.lots.length).toBeLessThanOrEqual(3);
    const after = ctx.project.maps[mapId]!.upperTiles.filter((tile) => tile >= 0).length;
    expect(after - before).toBeGreaterThan(2);
    expect(after - before).toBeLessThan(80);
    // «나무» 는 낱말로 든 키트만 — 통나무·나무 벤치·올리브 나무(다른 장소 것)는 아니다.
    const names = stampedNames(ctx.project, mapId);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toMatch(/^버들항 나무 /u);
  });

  it("amount 를 안 주면 빈 터를 채운다(맨땅 비율이 크게 내려간다)", () => {
    const { ctx, mapId } = village();
    const result = runTool(ctx, "furnish_outdoor_area", { mapId, region: "all" });
    assert(result.ok, result.summary);
    const data = result.data as { bareBefore: { bareShare: number }; bareAfter: { bareShare: number }; lots: unknown[] };
    expect(data.lots.length).toBeGreaterThan(3);
    expect(data.bareAfter.bareShare).toBeLessThan(data.bareBefore.bareShare - 0.4);
  });
});

describe("야외 소품 기본 고르기", () => {
  it("영어 꼬리표는 낱말로 읽는다 — prop-street 의 tree 가 가로등을 나무로 만들지 않는다", () => {
    const project = buildFixture("built");
    const modern = project.tilesets.modern_city;
    assert(modern, "modern_city 번들 칩셋이 있어야 한다");
    const props = openGroundProps(modern);
    const offered = [...props.trees, ...props.smalls].join(" | ");
    expect(offered).not.toMatch(/가로등|신호등|자판기|정류장/u);
    expect(props.trees.length).toBeGreaterThan(0);
  });
});
