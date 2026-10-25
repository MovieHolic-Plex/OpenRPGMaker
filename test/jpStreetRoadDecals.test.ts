// jp_city 거리 노면(2026-10-25 판정 J44·J71): 차 밑 노면 표시, 동서 길 횡단보도 방향, 차도 가장자리 칸은 사람 자리가 아니다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { planJpRegionScene } from "@/editor/jpCity/regionComposer";
import { jpRegionById } from "@/editor/jpCity/japaneseRegionsCatalog";
import { regionWithLayout } from "@/editor/jpCity/regionVariants";
import { planJpCityStreet } from "@/project/jpCityStreetComposer";
import { laneCells } from "@/ai/v2/placementRules";
import type { GameMap } from "@/project/types";

function kitSizes() {
  const ts = createBlankProject().tilesets.jp_city!;
  return new Map((ts.structureKits ?? []).map((k) => [k.id, { w: k.width, h: k.height }]));
}

describe("J44 역전 큰길 노면", () => {
  const kits = kitSizes();
  const plan = (seed: number, crosswalkTile?: number) => {
    const region = regionWithLayout(jpRegionById("station_plaza")!, seed).region;
    return planJpRegionScene({ region, mapId: "m", width: 40, height: 28, seed, kitSize: (id) => kits.get(id), crosswalkTile });
  };

  it("차 밑에도 외측선 키트를 깐다", () => {
    const steps = plan(3).steps;
    const cars = steps.filter((s) => /jp-prop-(car-|bus)/.test(s.note)).map((s) => ({ x: Number(s.args.x), y: Number(s.args.y), ...kits.get(s.note)! }));
    const lines = steps.filter((s) => /jp-gnd-asph-line-[ns]$/.test(s.note)).map((s) => ({ x: Number(s.args.x), y: Number(s.args.y) }));
    expect(cars.length).toBeGreaterThan(0);
    const under = lines.filter((l) => cars.some((c) => l.x >= c.x && l.x < c.x + c.w && l.y >= c.y && l.y < c.y + c.h));
    expect(under.length).toBeGreaterThan(0);
  });

  it("횡단보도 칸을 주면 옛 세로 줄 키트 대신 2층 칠하기로 놓는다", () => {
    const steps = plan(3, 3631).steps;
    expect(steps.some((s) => s.note === "jp-gnd-zebra")).toBe(false);
    const cw = steps.find((s) => s.tool === "paint_tiles");
    expect(cw?.args).toMatchObject({ layer: "2", mode: "cells", tile: 3631 });
  });

  it("시타마치 골목 횡단보도도 같은 칸으로 칠한다", () => {
    const p = planJpCityStreet({ mapId: "m", width: 40, height: 28, seed: 0, style: "shitamachi", crosswalkTile: 3631 });
    expect(p.steps.some((s) => s.tool === "paint_tiles" && s.args.tile === 3631)).toBe(true);
  });
});

describe("J71 차도 가장자리 칸은 보도가 아니다", () => {
  it("「…보도 쪽」 흰 선 아스팔트와 횡단보도를 차도로 센다", () => {
    const project = createBlankProject();
    const map = structuredClone(project.maps[project.startMapId]!) as GameMap;
    map.tilesetId = "jp_city";
    const meta = project.tilesets.jp_city!.tileMeta as unknown as { label?: string }[];
    const find = (re: RegExp) => meta.findIndex((m) => re.test(m?.label ?? ""));
    const edge = find(/路側帯 흰 선, 위 보도 쪽/u), walk = find(/^시타마치 바닥 · 콘크리트 판석 보도/u);
    expect(edge).toBeGreaterThan(0);
    map.lowerTiles[0] = edge; map.lowerTiles[1] = walk;
    const lanes = laneCells(project, map);
    expect(lanes.has(0)).toBe(true);
    expect(lanes.has(1)).toBe(false);
  });
});
