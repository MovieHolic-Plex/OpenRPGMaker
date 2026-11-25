import { describe, expect, it } from "vitest";
import { getTool, runTool } from "@/editor/tools";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { cellsInFillShape } from "@/editor/tools/v3/constructionTools";
import { DEFAULT_SAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import { deserialize, serialize } from "@/project/io";
import type { GameMap, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { completedHouseProject, houseMap, HOUSE_RECT } from "./fixtures/completedHouse";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { atomFromGroup, fillRun, hardAdjacencyViolation, mirrorTile, planRows, rowThickness } from "@/editor/tools/v3/rowArrangement";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3";
import { byName } from "@/editor/tools/toolArgCoerce";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";
import { isolateTimers } from "./mergedTeardown";

describe("houseProtectionFill", () => {
  isolateTimers();
  function fillTool() {
    const tool = getTool("fill_region");
    if (!tool) throw new Error("Missing fill tool");
    return tool;
  }
  function fixture() {
    // The fill materials (물·모래·잔디), sand/lake autotiles and TILE.GRASS are combined-town ones. That sheet is retired from new
    // projects (the start map is beodeul_city, where 240 is a wall), so restore it and put the house map back on it.
    const project = withRetiredEasyRpgTilesets(completedHouseProject());
    const map = houseMap(project);
    map.tilesetId = COMBINED_TOWN_TILESET_ID;
    // Passable roof/deck, empty wing gap, ordered stacks and empty stacks are all owned.
    map.lowerTiles.fill(TILE.GRASS);
    map.lowerTiles[4 * map.width + 4] = TILE.EMPTY;
    map.lowerTileStacks = { [4 * map.width + 4]: [], [5 * map.width + 4]: [72, TILE.GRASS] };
    map.upperTiles[5 * map.width + 4] = 200;
    map.upperTileStacks = { [4 * map.width + 4]: [], [5 * map.width + 4]: [199, 200] };
    return { project };
  }
  function changedCells(before: GameMap, after: GameMap): number {
    return before.lowerTiles.reduce((count, lower, index) => count + Number(
      lower !== after.lowerTiles[index] || before.upperTiles[index] !== after.upperTiles[index],
    ), 0);
  }
  describe("fill_region completed-house protection", () => {
    it.each([
      { material: "물", layer: "lower" },
      { material: "물", layer: "lower", clearUpper: false },
      { material: "모래", layer: "lower" },
      { material: "모래", layer: "lower", clearUpper: true },
      { material: "물", layer: "upper" },
      { material: "모래", layer: "upper", clearUpper: true },
    ])("accepts permitted ground while preserving both house layers and stacks: %j", (options) => {
      // Given a fill crossing the full house bbox and north ridge.
      const ctx = fixture();
      const map = houseMap(ctx.project);
      const before = structuredClone(map);
      const houses = captureHouseProtection(ctx.project);
      map.upperTiles[2 * map.width + 2] = 199;
      before.upperTiles[2 * map.width + 2] = 199;

      // When executed through the real transaction and unchanged final invariant.
      const result = runTool(ctx, "fill_region", {
        mapId: map.id, rect: { x: 2, y: 2, w: 6, h: 5 }, ...options,
        force: true, selection: HOUSE_RECT,
      });

      // Then only the ten unowned cells can change, and the receipt matches reality.
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(captureHouseProtection(ctx.project)).toEqual(houses);
      expect(changedCells(before, houseMap(ctx.project))).toBe(10);
      expect(result.data).toMatchObject({ filled: 10, mutatedCells: 10, skipped: { structure: 20 } });
      const clears = options.layer === "lower" && (options.clearUpper ?? options.material === "물");
      expect(result.data).toMatchObject({ upperCleared: clears ? 1 : 0 });
      expect(houseMap(ctx.project).upperTiles[2 * map.width + 2]).toBe(
        options.layer === "upper" ? options.material === "물" ? LAKE_AUTOTILE_TILE.BODY : SAND_TILE.BODY : clears ? TILE.EMPTY : 199,
      );
    });

    it.each(["rect", "ellipse", "circle"] as const)("skips protected cells inside the %s mask before direct writes", (shape) => {
      // Given a known shape and metadata-only house cells, including the empty gap.
      const ctx = fixture();
      const map = houseMap(ctx.project);
      const rect = { x: 2, y: 1, w: 7, h: 7 };
      const mask = cellsInFillShape(map, rect, shape);
      const houses = captureHouseProtection(ctx.project);
      const protectedKeys = new Set(houses.flatMap((house) => house.cells.map(({ x, y }) => `${x},${y}`)));
      const skipped = mask.filter(({ x, y }) => protectedKeys.has(`${x},${y}`)).length;
      const before = structuredClone(map);

      // When the real tool definition runs without a transaction rollback safety net.
      const result = fillTool().run(ctx.project, { mapId: map.id, rect, shape, material: "모래", clearUpper: true });

      // Then every permitted shape cell changes, not the protected cells or box corners.
      expect(captureHouseProtection(ctx.project)).toEqual(houses);
      expect(changedCells(before, map)).toBe(mask.length - skipped);
      expect(result.data).toMatchObject({ filled: mask.length - skipped, mutatedCells: mask.length - skipped,
        skipped: { structure: skipped }, maskCells: mask.length, gapCells: 0 });
      for (let y = rect.y; y < rect.y + rect.h; y += 1) {
        for (let x = rect.x; x < rect.x + rect.w; x += 1) {
          if (!mask.some((cell) => cell.x === x && cell.y === y)) expect(map.lowerTiles[y * map.width + x]).toBe(TILE.GRASS);
        }
      }
    });

    it("reports zero placement when every requested cell is protected", () => {
      // Given an entirely protected selection with no impassable wall expansion.
      const ctx = fixture();
      const before = structuredClone(ctx.project);
      // When force-like arguments accompany an all-house fill.
      const result = fillTool().run(ctx.project, {
        mapId: ctx.project.startMapId, rect: HOUSE_RECT, material: "물", clearUpper: true, force: true,
      });
      // Then the operation is a truthful no-op, not claimed terrain placement.
      expect(ctx.project).toEqual(before);
      expect(result.data).toMatchObject({ filled: 0, mutatedCells: 0, reshaped: 0, upperCleared: 0,
        skipped: { structure: 16 } });
      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    it.each(["lower", "upper"] as const)("retains fill-only structure fallback in the %s layer without house metadata", (layer) => {
      // Given an unfinished structure with a role only in the selected layer.
      const ctx = fixture();
      const map = houseMap(ctx.project);
      delete map.layoutPlan;
      const tileset = ctx.project.tilesets[map.tilesetId];
      tileset.tileGroups?.push({ id: "fill-roof", name: "Fill roof", role: "roof", defaultLayer: "upper", tileIds: [199],
        description: "Fixture roof", placementRules: "" });
      map[layer === "lower" ? "lowerTiles" : "upperTiles"][2 * map.width + 2] = 199;
      const before = structuredClone(map);
      // When lower terrain fill explicitly requests upper clearing.
      const result = fillTool().run(ctx.project, { mapId: map.id, rect: { x: 1, y: 2, w: 2, h: 1 }, material: "모래", clearUpper: true });
      // Then both layers at the structure stay intact, while adjacent ground changes.
      expect(map.lowerTiles[2 * map.width + 2]).toBe(before.lowerTiles[2 * map.width + 2]);
      expect(map.upperTiles[2 * map.width + 2]).toBe(before.upperTiles[2 * map.width + 2]);
      expect(map.lowerTiles[2 * map.width + 1]).not.toBe(before.lowerTiles[2 * map.width + 1]);
      expect(result.data).toMatchObject({ filled: 1, mutatedCells: 1, skipped: { structure: 1 } });
      expect(map.layoutPlan).toBeUndefined();
    });

    it.each(["house", "upper-roof"] as const)("preserves a %s neighbor while retaining it as an autotile connectivity input", (owner) => {
      // Given sand outside the requested mask that would normally be reshaped.
      const ctx = fixture();
      const map = houseMap(ctx.project);
      map.lowerTiles[4 * map.width + 6] = SAND_TILE.BODY;
      if (owner === "upper-roof") {
        delete map.layoutPlan;
        map.upperTiles[4 * map.width + 6] = 199;
        ctx.project.tilesets[map.tilesetId].tileGroups?.push({ id: "neighbor-roof", name: "Neighbor roof", role: "roof", defaultLayer: "upper",
          tileIds: [199], description: "Fixture roof", placementRules: "" });
      }
      const before = structuredClone(map);
      // When only its east neighbor is filled.
      const result = fillTool().run(ctx.project, { mapId: map.id, rect: { x: 7, y: 4, w: 1, h: 1 }, material: "모래" });
      // Then the protected neighbor stays exact; the new tile connects west (mask 8).
      expect(map.lowerTiles[4 * map.width + 6]).toBe(SAND_TILE.BODY);
      expect(map.upperTiles[4 * map.width + 6]).toBe(before.upperTiles[4 * map.width + 6]);
      expect(map.lowerTiles[4 * map.width + 7]).toBe(DEFAULT_SAND_AUTOTILE_GROUP.variantMap["8"]);
      expect(map.lowerTiles[4 * map.width + 7]).not.toBe(DEFAULT_SAND_AUTOTILE_GROUP.variantMap["0"]);
      expect(result.data).toMatchObject({ filled: 1, mutatedCells: changedCells(before, map), skipped: { structure: 0 } });
    });

    it("preserves reloaded human placement bounds without claiming a north ridge", () => {
      // Given a persisted placement (not a layout house).
      const ctx = fixture();
      const map = houseMap(ctx.project);
      delete map.layoutPlan;
      map.structurePlacements = [{ id: "human", kitId: "removed-kit", ...HOUSE_RECT,
        before: { lower: Array(16).fill(TILE.GRASS), upper: Array(16).fill(TILE.EMPTY) }, afterHash: "human-edited" }];
      ctx.project = deserialize(serialize(ctx.project));
      const houses = captureHouseProtection(ctx.project);
      // When a fill straddles the reloaded placement and its unowned north row.
      const result = runTool(ctx, "fill_region", { mapId: map.id, rect: { x: 3, y: 2, w: 4, h: 2 }, material: "모래" });
      // Then the north row changes and the human placement remains exact.
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(captureHouseProtection(ctx.project)).toEqual(houses);
      expect(result.data).toMatchObject({ filled: 4, mutatedCells: 4, skipped: { structure: 4 } });
    });

    it("filters protected wall-gap expansion cells as well as requested cells", () => {
      // Given an unowned cell separated from a wall by a passable, owned gap.
      const ctx = fixture();
      const map = houseMap(ctx.project);
      map.lowerTiles[4 * map.width + 4] = 15;
      // A wall is a run: a lone obstacle no longer pulls the fill past the rectangle (wallFlush.expandCellsAgainstWalls,
      // e0be8616a2). Extend the wall one cell north so the gap in front of it still counts.
      map.lowerTiles[3 * map.width + 4] = 15;
      const houses = captureHouseProtection(ctx.project);
      // When wall-flush expansion adds the protected gap to the fill candidates.
      const result = fillTool().run(ctx.project, { mapId: map.id, rect: { x: 2, y: 4, w: 1, h: 1 }, material: "모래" });
      // Then the gap is reported as skipped, never painted.
      expect(captureHouseProtection(ctx.project)).toEqual(houses);
      expect(result.data).toMatchObject({ filled: 1, mutatedCells: 1, gapCells: 1, skipped: { structure: 1 } });
    });

    it.each([false, true])("reports final mutations rather than paint and reshape attempts (neighbor=%s)", (neighbor) => {
      // Given either unchanged grass or an unprotected sand neighbor needing reshaping.
      const ctx = fixture();
      const map = houseMap(ctx.project);
      if (neighbor) map.lowerTiles[10 * map.width + 11] = SAND_TILE.BODY;
      const before = structuredClone(map);
      // When one unowned cell is filled.
      const result = fillTool().run(ctx.project, { mapId: map.id, rect: { x: 10, y: 10, w: 1, h: 1 }, material: neighbor ? "모래" : "잔디" });
      // Then the receipt counts final unique changes, including the neighbor but not unchanged grass.
      expect(changedCells(before, map)).toBe(neighbor ? 2 : 0);
      expect(result.data).toMatchObject({ filled: 1, mutatedCells: neighbor ? 2 : 0 });
    });

    // Removed it "accepts %s around a real authored": author_house was removed from the tool registry on purpose.
  });
});

// test/rowArrangementV3.test.ts
// 축 기반 줄 배치 계약 테스트 (타일 툴 v3 — arrange_rows).
// 고정하는 계약: (1) repeatBody 없는 그룹은 고정 크기 원자다 — 벤치를 임의 길이로 늘려
// hard adjacency 를 깨뜨리는 회귀를 막는다 (2) repeatBody 있는 그룹만 줄 전체로 신축
// (3) 통로/줄 간격 기하 (4) symmetric 은 방향 타일만 거울 교체하고 셀 순서는 유지
// (5) 지형·9분할 문법은 거부하고 다른 프리미티브로 안내 — 전부 순수/결정론.
describe("rowArrangementV3", () => {
  isolateTimers();
  const EXAMPLE = { mapId: "map_1", rect: { x: 0, y: 0, w: 8, h: 6 }, material: "벤치" };
  const SYMMETRIC = { axis: "vertical", symmetric: true } as const;
  const PLAIN = { axis: "vertical", symmetric: false } as const;
  function project(): Project {
    return withRetiredCombinedTownMaps(createBlankProject());
  }
  function tileset(proj = project()): TilesetDef {
    return proj.tilesets[COMBINED_TOWN_TILESET_ID];
  }
  function harnessGroup(def: TilesetDef, suffix: string): TileGroupMetadata {
    const group = def.tileGroups?.find((entry) => entry.id === `${COMBINED_TOWN_HARNESS_PREFIX}${suffix}`);
    if (!group) throw new Error(`하네스 그룹이 없습니다: ${suffix}`);
    return group;
  }
  describe("atomFromGroup (어휘 → 줄 배치 원자)", () => {
    it("벤치(327|328)는 repeatBody가 없으니 2×1 고정 원자다 — 임의 길이로 늘리지 않는다", () => {
      const def = tileset();
      const atom = atomFromGroup(def, harnessGroup(def, "bench-horizontal"), PLAIN, EXAMPLE);
      expect(atom.kind).toBe("fixed");
      if (atom.kind !== "fixed") throw new Error("고정 원자여야 합니다");
      expect({ w: atom.w, h: atom.h }).toEqual({ w: 2, h: 1 });
      expect(atom.cells).toEqual([
        { dx: 0, dy: 0, tile: 327 },
        { dx: 1, dy: 0, tile: 328 },
      ]);
    });

    it("세로 의자(358|388)는 1×2 고정 원자다", () => {
      const def = tileset();
      const atom = atomFromGroup(def, harnessGroup(def, "bench-vertical"), PLAIN, EXAMPLE);
      if (atom.kind !== "fixed") throw new Error("고정 원자여야 합니다");
      expect({ w: atom.w, h: atom.h }).toEqual({ w: 1, h: 2 });
      expect(atom.cells.map((cell) => cell.tile)).toEqual([358, 388]);
    });

    it("탁자(234/235/236)는 repeatBody가 있으니 가로 신축 원자다", () => {
      const def = tileset();
      const atom = atomFromGroup(def, harnessGroup(def, "table-horizontal"), PLAIN, EXAMPLE);
      expect(atom.kind).toBe("stretch");
      if (atom.kind !== "stretch") throw new Error("신축 원자여야 합니다");
      expect(atom).toMatchObject({ axis: "horizontal", head: 234, body: 235, tail: 236, minLength: 3 });
    });

    it("문법이 없는 단독 의자는 1칸 원자이고, 후보가 여럿이어도 타일을 섞지 않는다", () => {
      const def = tileset();
      const atom = atomFromGroup(def, harnessGroup(def, "free-chairs"), PLAIN, EXAMPLE);
      if (atom.kind !== "fixed") throw new Error("고정 원자여야 합니다");
      expect({ w: atom.w, h: atom.h }).toEqual({ w: 1, h: 1 });
      expect(atom.cells).toEqual([{ dx: 0, dy: 0, tile: 147 }]);
    });

    it("symmetric이면 방향 대립쌍이 있는 타일을 기본으로 골라 마주보게 만든다", () => {
      const def = tileset();
      const group = harnessGroup(def, "table-chairs");
      const plain = atomFromGroup(def, group, PLAIN, EXAMPLE);
      const mirroredAtom = atomFromGroup(def, group, SYMMETRIC, EXAMPLE);
      if (plain.kind !== "fixed" || mirroredAtom.kind !== "fixed") throw new Error("고정 원자여야 합니다");
      // 좌우 대립쌍이 없는 175(앞모습)가 기본, symmetric이면 205(우향)로 바뀐다.
      expect(plain.cells[0].tile).toBe(175);
      expect(mirroredAtom.cells[0].tile).toBe(205);
      expect(mirrorTile(def, group, 205, "vertical")).toBe(206);
    });

    it("오토타일 지형은 줄로 배치할 수 없고 fill_region/lay_path로 안내한다", () => {
      const def = tileset();
      const dirt = def.tileGroups?.find((group) => group.patternGrammar?.kind === "autotile_3x3");
      if (!dirt) throw new Error("오토타일 하네스 그룹이 없습니다");
      expect(() => atomFromGroup(def, dirt, PLAIN, EXAMPLE)).toThrow(/fill_region|lay_path/);
    });
  });
  describe("planRows / fillRun (통로 기하와 줄 채우기)", () => {
    it("통로를 가운데 두고 좌우 블록에 줄을 쌓는다 — 줄은 통로와 수직", () => {
      const atom = { kind: "fixed" as const, w: 2, h: 1, cells: [{ dx: 0, dy: 0, tile: 1 }], shape: "테스트" };
      const plan = planRows({ x: 0, y: 0, w: 14, h: 5 }, "vertical", 2, 1, atom);
      expect(plan.runAxis).toBe("horizontal");
      expect(plan.thickness).toBe(1);
      expect(plan.aisle).toEqual({ x: 6, y: 0, w: 2, h: 5 });
      // 두께 1 + 간격 1 → y = 0,2,4 세 줄 × 좌우 2블록.
      expect(plan.lines).toHaveLength(6);
      expect(plan.lines.filter((line) => line.side === "a").map((line) => line.rect)).toEqual([
        { x: 0, y: 0, w: 6, h: 1 },
        { x: 0, y: 2, w: 6, h: 1 },
        { x: 0, y: 4, w: 6, h: 1 },
      ]);
      expect(plan.lines.filter((line) => line.side === "b").map((line) => line.rect.x)).toEqual([8, 8, 8]);
    });

    it("aisleWidth 0이면 통로 없이 한 블록", () => {
      const atom = { kind: "fixed" as const, w: 1, h: 1, cells: [{ dx: 0, dy: 0, tile: 1 }], shape: "테스트" };
      const plan = planRows({ x: 2, y: 3, w: 4, h: 2 }, "vertical", 0, 0, atom);
      expect(plan.aisle).toBeNull();
      expect(plan.lines.every((line) => line.side === "a")).toBe(true);
      expect(plan.lines.map((line) => line.rect)).toEqual([
        { x: 2, y: 3, w: 4, h: 1 },
        { x: 2, y: 4, w: 4, h: 1 },
      ]);
    });

    it("axis=horizontal이면 통로가 가로로 뻗고 줄은 세로로 놓인다", () => {
      const atom = { kind: "fixed" as const, w: 1, h: 2, cells: [{ dx: 0, dy: 0, tile: 1 }, { dx: 0, dy: 1, tile: 2 }], shape: "테스트" };
      const plan = planRows({ x: 0, y: 0, w: 5, h: 10 }, "horizontal", 2, 0, atom);
      expect(plan.runAxis).toBe("vertical");
      expect(rowThickness(atom, "vertical")).toBe(1);
      expect(plan.aisle).toEqual({ x: 0, y: 4, w: 5, h: 2 });
      expect(plan.lines[0].rect).toEqual({ x: 0, y: 0, w: 1, h: 4 });
    });

    it("벤치 원자는 2칸 단위로 타일링되고 나눠떨어지지 않는 꼬리 칸은 비운다", () => {
      const def = tileset();
      const group = harnessGroup(def, "bench-horizontal");
      const atom = atomFromGroup(def, group, PLAIN, EXAMPLE);
      const fill = fillRun(atom, { x: 0, y: 0, w: 5, h: 1 }, "horizontal");
      expect(fill.atoms).toBe(2);
      expect(fill.leftover).toBe(1);
      expect(fill.cells.map((cell) => cell.tile)).toEqual([327, 328, 327, 328]);
      expect(fill.units).toHaveLength(2);
      // 규칙(327은 328 바로 왼쪽)을 지킨다 — 이 검사가 임의 길이 확장 회귀를 잡는다.
      expect(hardAdjacencyViolation(group, fill.cells)).toBeNull();
    });

    it("벤치를 캡 폴백으로 임의 길이 확장하면 hard 규칙 위반으로 걸린다", () => {
      const def = tileset();
      const group = harnessGroup(def, "bench-horizontal");
      // expandWall 식 폴백이 만들던 배치: 중간이 leftCap(327)으로 채워진다.
      const broken = [327, 327, 327, 328].map((tile, index) => ({ x: index, y: 0, tile }));
      expect(hardAdjacencyViolation(group, broken)).toMatch(/327/);
    });

    it("신축 원자는 줄 전체를 캡+본체로 한 번에 채운다", () => {
      const def = tileset();
      const atom = atomFromGroup(def, harnessGroup(def, "table-horizontal"), PLAIN, EXAMPLE);
      const fill = fillRun(atom, { x: 3, y: 2, w: 5, h: 1 }, "horizontal");
      expect(fill.leftover).toBe(0);
      expect(fill.units).toHaveLength(1);
      expect(fill.cells.map((cell) => cell.tile)).toEqual([234, 235, 235, 235, 236]);
      expect(fill.cells[0]).toEqual({ x: 3, y: 2, tile: 234 });
    });

    it("신축 최소 길이보다 짧은 줄은 아무것도 놓지 않는다", () => {
      const def = tileset();
      const atom = atomFromGroup(def, harnessGroup(def, "table-horizontal"), PLAIN, EXAMPLE);
      const fill = fillRun(atom, { x: 0, y: 0, w: 2, h: 1 }, "horizontal");
      expect(fill.cells).toEqual([]);
      expect(fill.leftover).toBe(2);
    });
  });
  describe("arrange_rows 툴", () => {
    const tool = byName(CONSTRUCTION_TOOLS_V3, "arrange_rows");

    function firstMapId(proj: Project): string {
      const id = Object.keys(proj.maps)[0];
      if (!id) throw new Error("맵이 없습니다");
      return id;
    }

    it("교회 신도석: 통로 양쪽에 벤치 줄을 깔고 통로는 비운 채로 남긴다", () => {
      const proj = project();
      const mapId = firstMapId(proj);
      const map = proj.maps[mapId];
      const result = tool.run(proj, {
        mapId,
        rect: { x: 2, y: 2, w: 14, h: 7 },
        material: "벤치(가로)",
        axis: "vertical",
        aisleWidth: 2,
        rowGap: 1,
        symmetric: true,
      });
      expect(result.summary).toContain("줄 배치");
      const data = result.data as Record<string, unknown>;
      expect(data.lines).toBe(8);
      expect(data.aisle).toEqual({ x: 8, y: 2, w: 2, h: 7 });
      // 좌측 줄 첫 두 칸은 벤치 좌·우 조각.
      const at = (x: number, y: number): number => map.upperTiles[y * map.width + x] || map.lowerTiles[y * map.width + x];
      expect([at(2, 2), at(3, 2)]).toEqual([327, 328]);
      // 통로는 손대지 않는다.
      expect(at(8, 2)).not.toBe(327);
      expect(at(9, 2)).not.toBe(328);
      // 줄 간격 1 — y=3은 비어 있다.
      expect(at(2, 3)).not.toBe(327);
    });

    it("방향 의자는 symmetric에서 통로를 두고 서로 마주본다", () => {
      const proj = project();
      const mapId = firstMapId(proj);
      const map = proj.maps[mapId];
      const result = tool.run(proj, {
        mapId,
        rect: { x: 0, y: 0, w: 9, h: 3 },
        material: "탁자 옆 의자",
        axis: "vertical",
        aisleWidth: 1,
        rowGap: 0,
        symmetric: true,
      });
      const at = (x: number, y: number): number => map.upperTiles[y * map.width + x] || map.lowerTiles[y * map.width + x];
      expect(at(0, 0)).toBe(205);
      expect(at(3, 0)).toBe(205);
      expect(at(5, 0)).toBe(206);
      expect(at(8, 0)).toBe(206);
      expect((result.data as Record<string, unknown>).mirrored).toBe(12);
    });

    it("방향 구분이 없는 재료로 symmetric을 켜면 경고로 알린다", () => {
      const proj = project();
      const result = tool.run(proj, {
        mapId: firstMapId(proj),
        rect: { x: 0, y: 0, w: 8, h: 2 },
        material: "벤치(가로)",
        aisleWidth: 2,
        rowGap: 0,
        symmetric: true,
      });
      expect(result.warnings?.join(" ")).toMatch(/방향 구분 타일이 없어/);
    });

    it("원자 크기로 나눠떨어지지 않으면 남긴 칸을 경고한다", () => {
      const proj = project();
      const result = tool.run(proj, {
        mapId: firstMapId(proj),
        rect: { x: 0, y: 0, w: 7, h: 1 },
        material: "벤치(가로)",
        aisleWidth: 0,
        rowGap: 0,
      });
      expect(result.warnings?.join(" ")).toMatch(/나눠떨어지지 않아/);
      expect((result.data as Record<string, unknown>).leftover).toBe(1);
    });

    it("줄이 들어갈 자리가 없으면 영역을 넓히라고 거부한다", () => {
      const proj = project();
      expect(() => tool.run(proj, {
        mapId: firstMapId(proj),
        rect: { x: 0, y: 0, w: 2, h: 1 },
        material: "의자(세로)",
        aisleWidth: 0,
      })).toThrow(/놓을 자리가 없습니다/);
    });

    it("axis 오타는 형식 예시와 함께 거부한다", () => {
      const proj = project();
      expect(() => tool.run(proj, {
        mapId: firstMapId(proj),
        rect: { x: 0, y: 0, w: 8, h: 4 },
        material: "벤치(가로)",
        axis: "diagonal",
      })).toThrow(/axis는 vertical/);
    });

    // 툴이 노출돼도 프롬프트가 줄 배치를 place_props 로 보내면 원래 실패가 되살아난다.
    // 라우팅 문장은 기본 예산(12,000자)에서 살아남는 앞머리 섹션에 있어야 한다 — 뒤쪽 섹션으로
    // 밀리면 잘려서 사라진다(합본 하네스 프로젝트는 이미 예산을 800자 넘게 초과하는 상태다).
    it("타일 어휘 다이제스트가 자리 줄 배치를 arrange_rows로 라우팅한다", () => {
      const prompt = buildSystemPrompt(project(), {});

      expect(prompt).toContain("## 타일 어휘 다이제스트");
      expect(prompt).toContain("arrange_rows");
      expect(prompt).toContain("자리 줄");
    });
  });
});
