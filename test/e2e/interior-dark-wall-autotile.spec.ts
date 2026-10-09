/**
 * E2E: dark-wall 366 brush autotile + interior room pipeline demos.
 * Contract: "오토타일" = paint brush body 366 → edges/corners form from neighbor mask.
 */
import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DARK_WALL_TILE,
  createDarkWallAutotileGroup,
  isDarkWallTile,
  paintDarkWallAndShape,
} from "@/project/defaults/darkWallAutotile";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import {
  INTERIOR_ROOM_DEMO_PLANS,
  INTERIOR_ROOM_TILESET_ID,
  runInteriorRoomPipeline,
  ensureInteriorRoomHarness,
  createEmptyRoomMap,
  applyInteriorRoomLayer,
  VR,
} from "@/editor/interiorRoomPipeline";
import { createBlankProject } from "@/project/defaults";
import { paintTilesBulk } from "@/editor/tileActions";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";

const EVIDENCE = "output/evidence/interior-dark-wall-autotile";
const VOID = 430;
const F = 72;
const B = DARK_WALL_TILE.BODY;

test.setTimeout(90_000);

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function at(lower: number[], w: number, x: number, y: number): number {
  return lower[y * w + x]!;
}

test.describe("interior dark-wall 366 autotile contracts", () => {
  test("contract: 366 ring around floor reshapes to edges and outer corners", async () => {
    await mkdir(EVIDENCE, { recursive: true });
    const map = {
      width: 5,
      height: 5,
      lowerTiles: [
        VOID, VOID, VOID, VOID, VOID,
        VOID, B, B, B, VOID,
        VOID, B, F, B, VOID,
        VOID, B, B, B, VOID,
        VOID, VOID, VOID, VOID, VOID,
      ],
    };
    const group = createDarkWallAutotileGroup();
    const pts: { x: number; y: number }[] = [];
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        if (map.lowerTiles[y * 5 + x] === B) pts.push({ x, y });
      }
    }
    shapeAutotileGroupAround(map, group, pts);
    const t = (x: number, y: number) => map.lowerTiles[y * 5 + x]!;

    expect(B).toBe(366);
    expect(t(2, 1)).toBe(DARK_WALL_TILE.EDGE_NORTH);
    expect(t(1, 2)).toBe(DARK_WALL_TILE.EDGE_WEST);
    expect(t(3, 2)).toBe(DARK_WALL_TILE.EDGE_EAST);
    expect(t(2, 3)).toBe(DARK_WALL_TILE.EDGE_SOUTH);
    expect(t(1, 1)).toBe(DARK_WALL_TILE.CORNER_NORTH_WEST);
    expect(t(3, 1)).toBe(DARK_WALL_TILE.CORNER_NORTH_EAST);
    expect(t(1, 3)).toBe(DARK_WALL_TILE.CORNER_SOUTH_WEST);
    expect(t(3, 3)).toBe(DARK_WALL_TILE.CORNER_SOUTH_EAST);
    expect(t(2, 2)).toBe(F);

    await writeFile(
      path.join(EVIDENCE, "001-366-ring-result.json"),
      JSON.stringify({ grid: chunk(map.lowerTiles, 5), tiles: DARK_WALL_TILE }, null, 2),
      "utf8",
    );
  });

  test("contract: paintDarkWallAndShape is brush-then-reshape", async () => {
    const map = {
      width: 2,
      height: 2,
      lowerTiles: [VOID, VOID, VOID, VOID],
    };
    paintDarkWallAndShape(map as never, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(map.lowerTiles[0]).toBe(DARK_WALL_TILE.CORNER_NORTH_WEST);
    expect(map.lowerTiles[1]).toBe(DARK_WALL_TILE.CORNER_NORTH_EAST);
    expect(map.lowerTiles[2]).toBe(DARK_WALL_TILE.CORNER_SOUTH_WEST);
    expect(map.lowerTiles[3]).toBe(DARK_WALL_TILE.CORNER_SOUTH_EAST);
  });

  test("shapes: L-corridor of 366 produces bend outer corner", async () => {
    const map = {
      width: 5,
      height: 5,
      lowerTiles: Array.from({ length: 25 }, () => VOID),
    };
    // horizontal arm + vertical arm
    const cells = [
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
      { x: 1, y: 2 }, { x: 1, y: 3 },
    ];
    paintDarkWallAndShape(map as never, cells);
    expect(at(map.lowerTiles, 5, 1, 1)).toBe(DARK_WALL_TILE.CORNER_NORTH_WEST);
    expect(isDarkWallTile(at(map.lowerTiles, 5, 3, 1))).toBe(true);
    expect(isDarkWallTile(at(map.lowerTiles, 5, 1, 3))).toBe(true);
    await writeFile(
      path.join(EVIDENCE, "003-L-shape.json"),
      JSON.stringify({ grid: chunk(map.lowerTiles, 5) }, null, 2),
      "utf8",
    );
  });

  test("shapes: thick block center is body 366", async () => {
    const map = {
      width: 3,
      height: 3,
      lowerTiles: Array.from({ length: 9 }, () => VOID),
    };
    const cells = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
      { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
    ];
    paintDarkWallAndShape(map as never, cells);
    expect(map.lowerTiles[1 * 3 + 1]).toBe(366);
    expect(map.lowerTiles[0]).toBe(DARK_WALL_TILE.CORNER_NORTH_WEST);
  });

  test("pipeline: three interior demos enclose floor, entrance, bed hard pair", async () => {
    const project = createBlankProject();
    ensureInteriorRoomHarness(project);
    const reports = [];
    for (const plan of INTERIOR_ROOM_DEMO_PLANS) {
      const result = runInteriorRoomPipeline(plan);
      expect(result.ok, result.warnings.join("; ")).toBe(true);
      const map = result.map;
      let floorCount = 0;
      let wallCount = 0;
      let cornerCount = 0;
      let edgeCount = 0;
      const members = new Set(createDarkWallAutotileGroup().memberTileIds);
      const corners = new Set([
        DARK_WALL_TILE.CORNER_NORTH_WEST,
        DARK_WALL_TILE.CORNER_NORTH_EAST,
        DARK_WALL_TILE.CORNER_SOUTH_WEST,
        DARK_WALL_TILE.CORNER_SOUTH_EAST,
      ]);
      const edges = new Set([
        DARK_WALL_TILE.EDGE_NORTH,
        DARK_WALL_TILE.EDGE_SOUTH,
        DARK_WALL_TILE.EDGE_WEST,
        DARK_WALL_TILE.EDGE_EAST,
      ]);
      for (const t of map.lowerTiles) {
        if (t === 72) floorCount += 1;
        if (members.has(t)) wallCount += 1;
        if (corners.has(t)) cornerCount += 1;
        if (edges.has(t)) edgeCount += 1;
      }
      expect(floorCount).toBeGreaterThan(4);
      expect(wallCount).toBeGreaterThan(4);
      // autotile must diversify: not a solid blob of body 366 only
      expect(cornerCount + edgeCount).toBeGreaterThan(0);

      const ent = map.events?.find((e) => e.pages?.[0]?.name === "입구");
      expect(ent).toBeTruthy();
      expect(ent!.x).toBe(plan.door.x);
      expect(ent!.y).toBe(plan.door.y);
      const body = (ent!.pages?.[0]?.commands?.[0] as { body?: string })?.body;
      expect(typeof body).toBe("string");

      if (plan.theme === "bedroom") {
        let bedOk = false;
        for (let i = 0; i < map.upperTiles.length; i += 1) {
          if (map.upperTiles[i] === 355) {
            expect(map.upperTiles[i + 1]).toBe(356);
            bedOk = true;
          }
        }
        expect(bedOk).toBe(true);
      }

      // door cell is floor, not wall
      expect(map.lowerTiles[plan.door.y * map.width + plan.door.x]).toBe(VR.FLOOR);

      reports.push({
        mapId: plan.mapId,
        theme: plan.theme,
        floorCount,
        wallCount,
        cornerCount,
        edgeCount,
        entrance: { x: ent!.x, y: ent!.y },
        log: result.log,
      });
    }
    await writeFile(path.join(EVIDENCE, "002-demo-pipeline-report.json"), JSON.stringify(reports, null, 2), "utf8");
  });

  test("pipeline: multi-layer advance floor then walls yields shaped shell", async () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS[0]!;
    let map = createEmptyRoomMap(plan);
    map = applyInteriorRoomLayer(map, plan, "floor").map;
    expect(map.lowerTiles.filter((t) => t === VR.FLOOR).length).toBeGreaterThan(0);
    expect(map.lowerTiles.some((t) => isDarkWallTile(t))).toBe(false);

    map = applyInteriorRoomLayer(map, plan, "walls").map;
    expect(map.lowerTiles.some((t) => isDarkWallTile(t))).toBe(true);
    const tiles = new Set(map.lowerTiles);
    const hasCorner = [
      DARK_WALL_TILE.CORNER_NORTH_WEST,
      DARK_WALL_TILE.CORNER_NORTH_EAST,
      DARK_WALL_TILE.CORNER_SOUTH_WEST,
      DARK_WALL_TILE.CORNER_SOUTH_EAST,
    ].some((c) => tiles.has(c));
    expect(hasCorner).toBe(true);

    map = applyInteriorRoomLayer(map, plan, "entrance").map;
    expect(map.events?.some((e) => e.pages?.[0]?.name === "입구")).toBe(true);
  });

  test("pipeline: dining floor cells not eaten by south edge wall", async () => {
    const plan = INTERIOR_ROOM_DEMO_PLANS.find((p) => p.theme === "dining")!;
    const { map, ok } = runInteriorRoomPipeline(plan);
    expect(ok).toBe(true);
    expect(map.lowerTiles[9 * map.width + 6]).toBe(VR.FLOOR);
    expect(map.lowerTiles[9 * map.width + 9]).toBe(VR.FLOOR);
  });

  test("editor paint path: Manual autoConnect=false still shapes 366 ring (RM brush)", async () => {
    // Repro: UI default Manual — previously left raw 366 body with no edges/corners.
    const project = createBlankProject();
    const mapId = "map_e2e_dark_wall_manual";
    const w = 5;
    const h = 5;
    const map: GameMap = {
      id: mapId,
      name: "manual paint 366",
      width: w,
      height: h,
      tilesetId: INTERIOR_ROOM_TILESET_ID,
      tileSize: 16,
      lowerTiles: Array.from({ length: w * h }, () => VOID),
      upperTiles: Array.from({ length: w * h }, () => 0),
      events: [],
    };
    map.lowerTiles[2 * w + 2] = F;
    project.maps[mapId] = map;
    store.replace(project);

    const shell = [
      { layer: "lower" as const, x: 1, y: 1, tile: B },
      { layer: "lower" as const, x: 2, y: 1, tile: B },
      { layer: "lower" as const, x: 3, y: 1, tile: B },
      { layer: "lower" as const, x: 1, y: 2, tile: B },
      { layer: "lower" as const, x: 3, y: 2, tile: B },
      { layer: "lower" as const, x: 1, y: 3, tile: B },
      { layer: "lower" as const, x: 2, y: 3, tile: B },
      { layer: "lower" as const, x: 3, y: 3, tile: B },
    ];
    paintTilesBulk(mapId, shell, { autoConnect: false });
    const m = store.getCurrent().maps[mapId]!;
    const t = (x: number, y: number) => m.lowerTiles[y * w + x]!;
    expect(t(1, 1)).toBe(DARK_WALL_TILE.CORNER_NORTH_WEST);
    expect(t(3, 1)).toBe(DARK_WALL_TILE.CORNER_NORTH_EAST);
    expect(t(1, 3)).toBe(DARK_WALL_TILE.CORNER_SOUTH_WEST);
    expect(t(3, 3)).toBe(DARK_WALL_TILE.CORNER_SOUTH_EAST);
    expect(t(2, 1)).toBe(DARK_WALL_TILE.EDGE_NORTH);
    expect(t(2, 2)).toBe(F);
    await writeFile(
      path.join(EVIDENCE, "006-manual-paint-366-ring.json"),
      JSON.stringify({ grid: chunk(m.lowerTiles, w), note: "autoConnect:false still shapes" }, null, 2),
      "utf8",
    );
  });

  test("editor paint path: bulk 366 with autoConnect on interior tileset", async () => {
    const project = createBlankProject();
    ensureInteriorRoomHarness(project);
    const mapId = "map_e2e_dark_wall_paint";
    const w = 6;
    const h = 6;
    const map: GameMap = {
      id: mapId,
      name: "e2e paint",
      width: w,
      height: h,
      tilesetId: INTERIOR_ROOM_TILESET_ID,
      lowerTiles: Array.from({ length: w * h }, () => VOID),
      upperTiles: Array.from({ length: w * h }, () => 0),
      events: [],
    };
    // center floor
    map.lowerTiles[2 * w + 2] = F;
    map.lowerTiles[2 * w + 3] = F;
    map.lowerTiles[3 * w + 2] = F;
    map.lowerTiles[3 * w + 3] = F;
    project.maps[mapId] = map;
    store.replace(project);

    const groups = autotileGroupsForTileset(project.tilesets[INTERIOR_ROOM_TILESET_ID]);
    expect(groups.some((g) => g.id.includes("dark-wall"))).toBe(true);

    // ring shell around the 2×2 floor
    const shell = [
      { layer: "lower" as const, x: 1, y: 1, tile: B },
      { layer: "lower" as const, x: 2, y: 1, tile: B },
      { layer: "lower" as const, x: 3, y: 1, tile: B },
      { layer: "lower" as const, x: 4, y: 1, tile: B },
      { layer: "lower" as const, x: 1, y: 2, tile: B },
      { layer: "lower" as const, x: 4, y: 2, tile: B },
      { layer: "lower" as const, x: 1, y: 3, tile: B },
      { layer: "lower" as const, x: 4, y: 3, tile: B },
      { layer: "lower" as const, x: 1, y: 4, tile: B },
      { layer: "lower" as const, x: 2, y: 4, tile: B },
      { layer: "lower" as const, x: 3, y: 4, tile: B },
      { layer: "lower" as const, x: 4, y: 4, tile: B },
    ];
    paintTilesBulk(mapId, shell, { autoConnect: true });
    const m = store.getCurrent().maps[mapId]!;
    const t = (x: number, y: number) => m.lowerTiles[y * w + x]!;

    expect(t(1, 1)).toBe(DARK_WALL_TILE.CORNER_NORTH_WEST);
    expect(t(4, 1)).toBe(DARK_WALL_TILE.CORNER_NORTH_EAST);
    expect(t(1, 4)).toBe(DARK_WALL_TILE.CORNER_SOUTH_WEST);
    expect(t(4, 4)).toBe(DARK_WALL_TILE.CORNER_SOUTH_EAST);
    expect(t(2, 1)).toBe(DARK_WALL_TILE.EDGE_NORTH);
    expect(t(3, 1)).toBe(DARK_WALL_TILE.EDGE_NORTH);
    expect(t(2, 2)).toBe(F);

    await writeFile(
      path.join(EVIDENCE, "004-editor-paint-ring.json"),
      JSON.stringify({ grid: chunk(m.lowerTiles, w), tiles: DARK_WALL_TILE }, null, 2),
      "utf8",
    );
  });

  test("blank project interior tileset already has dark-wall group after harness seed", async () => {
    const project = createBlankProject();
    // ensure via theme pack path + explicit harness
    const seeded = ensureInteriorRoomHarness(project);
    const ts = project.tilesets[INTERIOR_ROOM_TILESET_ID];
    expect(ts).toBeTruthy();
    const dark = (ts!.autotileGroups ?? []).find((g) => g.id.includes("dark-wall"));
    expect(dark, "dark-wall autotile group missing on interior tileset").toBeTruthy();
    expect(dark!.memberTileIds).toContain(366);
    expect(dark!.connectTileIds).toContain(72);
    await writeFile(
      path.join(EVIDENCE, "005-harness-seed.json"),
      JSON.stringify({
        seeded,
        groupId: dark!.id,
        body: 366,
        memberCount: dark!.memberTileIds.length,
        variantKeys: Object.keys(dark!.variantMap).length,
      }, null, 2),
      "utf8",
    );
  });
});
