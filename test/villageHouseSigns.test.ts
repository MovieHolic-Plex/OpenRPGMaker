import { describe, expect, it } from "vitest";
import { ALL_HOUSE_KIT_IDS, HOUSE_KITS, stampFootprintHouseKit } from "@/editor/houseKit";
import { createAuthorVillageTool } from "@/editor/tools/authorVillageTool";
import { captureHouseProtection, protectedHouseCells } from "@/editor/tools/houseProtection";
import { runTool } from "@/editor/tools/toolRunner";
import { buildVillageDomain, inspectVillageBuild } from "@/editor/tools/village/builder";
import { finishVillageHouseDecor } from "@/editor/tools/village/decor";
import { applyRoofDeck } from "@/editor/tools/village/houses";
import type { BuiltHouse, Plaza } from "@/editor/tools/village/constants";
import { TILE } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import type { GameMap } from "@/project/types";
import { createExistingProject, EXISTING_TARGET, runFacade } from "./authorVillageFacadeFixtures";

const SIGN_TILES = new Set([443, 472, 473]);
const plaza: Plaza = { rect: { x: 30, y: 20, w: 6, h: 6 }, centerX: 33, centerRow: 23 };

function signs(map: GameMap) {
  return map.upperTiles.flatMap((upper, index) => SIGN_TILES.has(upper)
    ? [{ x: index % map.width, y: Math.floor(index / map.width), lower: map.lowerTiles[index], upper }]
    : []);
}

describe("house-owned village signs", () => {
  it.each([7, 11])("owns first-publication signs through roads, fill and IO reload at seed %s", (seed) => {
    // Given a real facade invocation, observed before any environment stage runs.
    const project = createExistingProject();
    let published: ReturnType<typeof signs> = [];
    let ownedAtPublication: boolean[] = [];
    let sealed: ReturnType<typeof captureHouseProtection> = [];
    const tool = createAuthorVillageTool({
      inspect: inspectVillageBuild,
      build(draft, args) {
        const map = draft.maps.map_existing;
        let plan = map.layoutPlan;
        let observed = false;
        Object.defineProperty(map, "layoutPlan", {
          configurable: true, enumerable: true,
          get: () => plan,
          set(value: GameMap["layoutPlan"]) {
            plan = value;
            if (observed) return;
            observed = true;
            published = signs(map);
            const protectedCells = new Set(protectedHouseCells(map).map(({ x, y }) => `${x},${y}`));
            // Independently enumerate the fixed bbox: no new sign-sized ownership extension.
            ownedAtPublication = published.map(({ x, y }) => protectedCells.has(`${x},${y}`)
              && (value?.regions ?? []).some((region) => region.role === "house"
                && x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h));
            sealed = captureHouseProtection(draft);
          },
        });
        return buildVillageDomain(draft, args);
      },
    });

    // When author_village performs finishing, sealing, roads and all postprocessing.
    const result = runFacade(project, {
      target: EXISTING_TARGET, houseCount: 4, countPolicy: "exact", seed, interior: false,
    }, tool);

    // Then all three produced signs are owned from publication and survive unchanged.
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(published.map(({ upper }) => upper).sort()).toEqual([443, 472, 473]);
    expect(ownedAtPublication, JSON.stringify(published)).toEqual([true, true, true]);
    expect(signs(project.maps.map_existing)).toEqual(published);
    expect(captureHouseProtection(project)).toEqual(sealed);
    expect(result.data).toMatchObject({ village: { actualHouseCount: 4,
      structuralQa: { ok: true, doorsConnected: 4, doorsIntact: 4, roadComponents: 1 } } });

    const context = { project };
    for (const material of ["모래", "물"]) {
      context.project = deserialize(serialize(context.project));
      expect(signs(context.project.maps.map_existing)).toEqual(published);
      const beforeFill = context.project.maps.map_existing.lowerTiles.slice();
      const filled = runTool(context, "fill_region", {
        mapId: "map_existing", rect: { x: 0, y: 0, w: 50, h: 50 }, material, clearUpper: true,
      });
      expect(filled.ok, JSON.stringify(filled.issues)).toBe(true);
      expect(context.project.maps.map_existing.lowerTiles.some((tile, index) =>
        tile !== beforeFill[index])).toBe(true);
      expect(signs(context.project.maps.map_existing)).toEqual(published);
      expect(captureHouseProtection(context.project)).toEqual(sealed);
    }
    expect(signs(deserialize(serialize(context.project)).maps.map_existing)).toEqual(published);
  }, 90_000);

  const controls = ALL_HOUSE_KIT_IDS.flatMap((kitId) => [3, 8].flatMap((w) =>
    ([1, 3] as const).map((stories) => ({ kitId, w, stories }))));
  it.each(controls)("mounts a visible sign without replacing doors or windows: $kitId width=$w stories=$stories", ({ kitId, w, stories }) => {
    // Given real kit facades, including minimum-width and tall houses with windows.
    const map = createExistingProject().maps.map_existing;
    const wallRows = 2 * stories + 1;
    const bbox = { x: 5, y: 5, w, h: wallRows + 3 };
    const stamped = stampFootprintHouseKit(map, { kitId, stories, wings: [bbox] });
    expect(stamped.ok).toBe(true);
    if (!stamped.doorAt) throw new Error("Fixture house has no door");
    const house: BuiltHouse = { bbox, kitId, stories, doorAt: stamped.doorAt,
      front: { x: stamped.doorAt.x, y: stamped.doorAt.y + 1 }, templateId: "control", program: "shop" };
    const before = structuredClone(map);

    // When house-owned finishing places banners and the shop sign.
    finishVillageHouseDecor(map, [house], plaza);

    // Then the sign overlays an actual wall, not a roof/gap, and existing art remains.
    const placed = signs(map);
    expect(placed).toHaveLength(1);
    const wall = HOUSE_KITS[kitId].wall;
    for (const sign of placed) {
      expect(sign.x >= bbox.x && sign.x < bbox.x + bbox.w && sign.y >= bbox.y && sign.y < bbox.y + bbox.h).toBe(true);
      expect([...wall.top, ...wall.mid, ...wall.bottom]).toContain(sign.lower);
      expect(sign.x === house.doorAt.x && (sign.y === house.doorAt.y || sign.y === house.doorAt.y - 1)).toBe(false);
    }
    expect(map.lowerTiles).toEqual(before.lowerTiles);
    before.upperTiles.forEach((tile, index) => {
      if (tile !== TILE.EMPTY) expect(map.upperTiles[index]).toBe(tile);
    });
  });

  it.each(["wing-gap", "low-wall", "roof-deck", "occupied-row", "no-free-wall"] as const)(
    "uses only free facade cells when the control is %s", (control) => {
      // Given a real non-rectangular, low, deck, or occupied facade.
      const map = createExistingProject().maps.map_existing;
      const bbox = { x: 5, y: 5, w: 8, h: 9 };
      const wings = control === "wing-gap"
        ? [{ x: 5, y: 5, w: 8, h: 5 }, { x: 5, y: 5, w: 3, h: 9 }]
        : [bbox];
      const stamped = stampFootprintHouseKit(map, { kitId: "blue-stone", wings, lowWall: control === "low-wall" });
      expect(stamped.ok).toBe(true);
      if (!stamped.doorAt) throw new Error("Fixture house has no door");
      const house: BuiltHouse = { bbox, kitId: "blue-stone", stories: 1, doorAt: stamped.doorAt,
        front: { x: stamped.doorAt.x, y: stamped.doorAt.y + 1 }, templateId: control, program: "inn" };
      if (control === "roof-deck") applyRoofDeck(map, bbox, house.doorAt);
      const wall = HOUSE_KITS[house.kitId].wall;
      const wallTiles = new Set([...wall.top, ...wall.mid, ...wall.bottom]);
      if (control === "occupied-row" || control === "no-free-wall") {
        map.lowerTiles.forEach((tile, index) => {
          if (wallTiles.has(tile) && (control === "no-free-wall" || Math.floor(index / map.width) === 11)) {
            map.upperTiles[index] = index % 2 === 0 ? 208 : 87;
          }
        });
      }
      const before = structuredClone(map);

      // When finishing searches for a sign mount without altering existing art.
      finishVillageHouseDecor(map, [house], plaza);

      // Then fallback stays on actual wall rows, or omits the sign if none are free.
      expect(signs(map)).toHaveLength(control === "no-free-wall" ? 0 : 1);
      for (const sign of signs(map)) {
        expect(sign.x >= bbox.x && sign.x < bbox.x + bbox.w && sign.y >= bbox.y && sign.y < bbox.y + bbox.h).toBe(true);
        expect(wallTiles.has(sign.lower)).toBe(true);
        if (control === "occupied-row") expect(sign.y).not.toBe(11);
      }
      expect(map.lowerTiles).toEqual(before.lowerTiles);
      before.upperTiles.forEach((tile, index) => {
        if (tile !== TILE.EMPTY) expect(map.upperTiles[index]).toBe(tile);
      });
    },
  );
});
