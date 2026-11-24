import { describe, expect, it, beforeEach } from "vitest";
import { cutPieceFor, LONG_RAMP_RUNOUT } from "@/project/relief/cutPieces";
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { reliefAllowsStep } from "@/project/relief/walk";
import rampArt from "@/project/relief/rampArt.json";
import tileset from "@/assets/beodeulCityTileset.json";
import type { ReliefArtPatch } from "@/project/relief/render";
import type { GameMap } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { landRectCells, paintLandCells } from "@/editor/terrainLandBrush";
import { reliefRenderOptions } from "@/project/relief/screen";
import { layerTileAt } from "@/project/mapLayers";
import { isolateTimers } from "./mergedTeardown";

describe("longRampLakeshore", () => {
  isolateTimers();
  const pieces = (rampArt as Record<string, { pieces?: Record<string, ReliefArtPatch> }>)["grass-steps"]!.pieces!;
  function cliff(rise: number): GameMap {
    const w = 12, h = 16, n = w * h, levels = new Array<number>(n).fill(0);
    for (let y = 1; y <= 5; y++) for (let x = 2; x < 10; x++) levels[y * w + x] = rise;
    return { id: "m", name: "m", width: w, height: h, tileSize: 16, tilesetId: "t", lowerTiles: new Array(n).fill(0), upperTiles: new Array(n).fill(-1), events: [], relief: { width: w, height: h, levels } } as GameMap;
  }
  describe("긴 비탈", () => {
    for (const rise of [2, 4, 6, 8, 10]) it(`${rise}단: 절벽 면을 따라 내려와 낮은 땅 위 ${LONG_RAMP_RUNOUT}칸, 한 장 그림, 걸어서 오른다`, () => {
      const map = cliff(rise);
      const plan = planReliefRamp(map, { x: 5, y: 6, face: "top" }, 2, false);
      expect(plan.ok).toBe(true);
      plan.apply!(map);
      const rows = new Set(map.relief!.ramps!.flatMap((v, i) => (v ? [Math.floor(i / map.width)] : [])));
      expect(rows.size).toBe(LONG_RAMP_RUNOUT);
      const art = cutPieceFor(pieces, "ramp", "n", 2, LONG_RAMP_RUNOUT, rise);
      expect(art?.h).toBe((rise + LONG_RAMP_RUNOUT) * 16);
      let y = map.height - 1;
      while (y > 1 && reliefAllowsStep(map.relief, 5, y, 5, y - 1)) { y--; if (map.relief!.levels[y * map.width + 5] === rise && !map.relief!.ramps?.[y * map.width + 5]) break; }
      expect(map.relief!.levels[y * map.width + 5]).toBe(rise);
    });

    it("1단과 돌계단은 기존 낱조각 그대로", () => {
      const map = cliff(1);
      planReliefRamp(map, { x: 5, y: 6, face: "top" }, 2, false).apply!(map);
      expect(map.relief!.ramps!.filter(Boolean).length).toBe(2);
      expect(cutPieceFor(pieces, "stairs", "n", 2, 1, 3)).toBe(pieces["stairs:n:2x1:3"]);
    });
  });
  describe("자연 호숫가 오토타일", () => {
    const groups = (tileset as { autotileGroups: { id: string; memberTileIds: number[]; variantMap: Record<string, number> }[] }).autotileGroups;
    for (const id of ["beodeul_lakeshore_grass", "beodeul_lakeshore_sand"]) it(`${id}: 47장, 256 마스크 모두 구성원으로`, () => {
      const g = groups.find((x) => x.id === id)!;
      expect(g.memberTileIds.length).toBe(47);
      const members = new Set(g.memberTileIds);
      for (let m = 0; m < 256; m++) expect(members.has(g.variantMap[String(m)]!)).toBe(true);
    });
  });
});

describe("rampCutPieces", () => {
  isolateTimers();
  const pieces = (rampArt as Record<string, { pieces?: Record<string, ReliefArtPatch> }>)["grass-steps"]!.pieces!;
  function hill(): GameMap {
    const w = 20, h = 15, n = w * h, levels = new Array<number>(n).fill(0);
    for (let y = 3; y < 8; y++) for (let x = 1; x < 19; x++) levels[y * w + x] = 2;
    return { id: "m", name: "m", width: w, height: h, tileSize: 16, tilesetId: "t", lowerTiles: new Array(n).fill(0), upperTiles: new Array(n).fill(-1), events: [], relief: { width: w, height: h, levels } };
  }
  describe("경사로 한 장짜리 비탈", () => {
    it("넓은 경사로는 3칸 조각의 왼쪽·가운데·오른쪽 칸으로 늘린다(옆벽은 양끝에 한 번씩)", () => {
      const three = cutPieceFor(pieces, "ramp", "n", 3, 1, 2)!, five = cutPieceFor(pieces, "ramp", "n", 5, 1, 2)!;
      const cell = three.w / 3, at = (p: ReliefArtPatch, x: number, y: number) => Array.from({ length: 4 }, (_, k) => p.rgba[(y * p.w + x) * 4 + k]);
      for (let y = 0; y < five.h; y++) for (let x = 0; x < cell; x++) {
        expect(at(five, x, y)).toEqual(at(three, x, y));
        expect(at(five, 4 * cell + x, y)).toEqual(at(three, 2 * cell + x, y));
        for (const col of [1, 2, 3]) expect(at(five, col * cell + x, y)).toEqual(at(three, cell + x, y));
      }
    });

    // 2단 이상 북쪽 경사로는 긴 비탈이다 — 낮은 땅 위 LONG_RAMP_RUNOUT 줄(133d84ccb9). 1단만 발치 한 줄.
    for (const width of [2, 3, 5]) it(`북쪽 경사로 폭 ${width}: 절벽 발치 ${LONG_RAMP_RUNOUT}줄 긴 비탈, 걸어서 올라간다`, () => {
      const map = hill();
      const plan = planReliefRamp(map, { x: 9, y: 8, face: "top" }, width, false);
      expect(plan.ok).toBe(true);
      plan.apply!(map);
      const rows = new Set(map.relief!.ramps!.flatMap((v, i) => (v ? [Math.floor(i / map.width)] : [])));
      expect([...rows].sort((x, y) => x - y)).toEqual([8, 9]);
      expect(reliefAllowsStep(map.relief, 9, 9, 9, 8) && reliefAllowsStep(map.relief, 9, 8, 9, 7)).toBe(true);
    });
  });
});

describe("terrainShoreRamp", () => {
  isolateTimers();
  const current = () => { const p = store.getCurrent(); return p.maps[p.startMapId]!; };
  describe("물가·경사로", () => {
    beforeEach(() => { store.replaceProject(createBlankProject()); });

    it("호수 가장자리는 물 오토타일 가장자리 조각, 둘레 풀밭은 그대로", () => {
      const map = current();
      const grass = layerTileAt(map, 1, 0);
      paintLandCells(map.id, landRectCells(map, { x: 5, y: 5 }, { x: 9, y: 8 }), "water", true);
      const after = current();
      const ring = [4 * map.width + 6, 9 * map.width + 6, 6 * map.width + 4, 6 * map.width + 10];
      expect(ring.every((i) => layerTileAt(after, 1, i) === grass)).toBe(true);
      const middle = layerTileAt(after, 1, 6 * map.width + 7), edge = layerTileAt(after, 1, 5 * map.width + 7);
      expect(edge).not.toBe(middle);
    });

    it("양식 없는 맵의 경사로도 조각 그림을 고르고, 폭 4~8 은 2·3 조각을 이어 붙인다", () => {
      const pieces = (rampArt as Record<string, { pieces?: Record<string, ReliefArtPatch> }>)["grass-steps"]!.pieces!;
      for (const w of [4, 5, 6, 8]) expect(cutPieceFor(pieces, "ramp", "n", w, 1, 2)?.w).toBe(w * 16);
      const w = 20, h = 15, levels = new Array<number>(w * h).fill(0), ramps = new Array<number>(w * h).fill(0);
      for (let y = 3; y < 9; y++) for (let x = 5; x < 15; x++) levels[y * w + x] = 2;
      for (let x = 8; x < 12; x++) for (let y = 9; y < 11; y++) ramps[y * w + x] = 1;
      const options = reliefRenderOptions({ width: w, height: h, levels, ramps });
      expect(options.rampArt).toBeDefined();
    });
  });
});
