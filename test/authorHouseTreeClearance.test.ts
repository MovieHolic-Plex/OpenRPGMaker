import { describe, expect, it } from "vitest";

import { runAuthorHouse } from "@/editor/tools/authorHouseFacade";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { runTool } from "@/editor/tools/toolRunner";
import { TILE } from "@/project/defaults/constants";
import { validateLayoutPlacement } from "@/project/lint/layoutPlacementValidate";
import { exteriorSingle, preparedProject, projectHash } from "./support/authorHouseFacadeFixture";

const canopy = { x: 5, y: 4 };

function treeSite(validPair: boolean, at = canopy) {
  const project = preparedProject();
  const map = project.maps.m1!;
  map.upperTiles[at.y * map.width + at.x] = 260;
  if (validPair) map.lowerTiles[(at.y + 1) * map.width + at.x] = 290;
  return project;
}

const runners = [
  { name: "facade", run: runAuthorHouse },
  { name: "runTool", run: (ctx: Parameters<typeof runAuthorHouse>[0], args: Record<string, unknown>) => runTool(ctx, "author_house", args) },
];

describe.each(runners)("author_house tree clearance via $name", ({ run }) => {
  it.each([true, false])("rejects a pre-existing tree atomically (valid pair=%s)", (validPair) => {
    const ctx = { project: treeSite(validPair) };
    const original = ctx.project;
    const before = projectHash(original);
    const tiles = structuredClone({ lower: original.maps.m1!.lowerTiles, upper: original.maps.m1!.upperTiles });
    const baselineIssues = validateLayoutPlacement(original, { mapId: "m1" });
    expect(baselineIssues.map(issue => issue.code)).toEqual(validPair ? [] : ["layout-tree-incomplete"]);

    const result = run(ctx, { ...exteriorSingle, interior: "linked-interior" });

    expect(result.ok, JSON.stringify({ summary: result.summary, issues: validateLayoutPlacement(ctx.project) })).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "house-tree-clearance-required", mapId: "m1", ...canopy }),
    ]));
    expect(ctx.project).toBe(original);
    expect(projectHash(ctx.project)).toBe(before);
    expect(ctx.project.maps.m1!.lowerTiles).toEqual(tiles.lower);
    expect(ctx.project.maps.m1!.upperTiles).toEqual(tiles.upper);
    expect(captureHouseProtection(ctx.project)).toEqual([]);
  });
});

describe("author_house tree clearance scope", () => {
  it.each([
    { label: "north ridge", at: { x: 5, y: 2 }, wings: exteriorSingle.wings },
    { label: "gap between wings", at: { x: 9, y: 6 }, wings: [{ x: 3, y: 3, w: 5, h: 6 }, { x: 11, y: 3, w: 5, h: 6 }] },
  ])("does not seal an unchanged orphan in the $label", ({ at, wings }) => {
    const ctx = { project: treeSite(false, at) };
    const before = projectHash(ctx.project);

    const result = runAuthorHouse(ctx, { ...exteriorSingle, wings });

    expect(result.ok, result.summary).toBe(false);
    expect(result.issues?.[0]).toMatchObject({ code: "house-tree-clearance-required", mapId: "m1", ...at });
    expect(result.data.construction).toMatchObject({ applied: false, outcome: "blocked", counts: { actual: 0 } });
    expect(result.data.houses).toEqual([]);
    expect(projectHash(ctx.project)).toBe(before);
  });

  it("rejects the entire linked-lot batch when a later lot needs tree clearance", () => {
    const ctx = { project: treeSite(true, { x: 24, y: 16 }) };
    const before = projectHash(ctx.project);

    const result = runAuthorHouse(ctx, {
      kind: "lots", mapId: "m1", houses: [
        { kitId: "blue-stone", wings: exteriorSingle.wings, interior: "linked-interior", door: true, yard: [] },
        { kitId: "blue-stone", wings: [{ x: 22, y: 15, w: 8, h: 6 }], interior: "exterior-only", yard: [] },
      ],
    });

    expect(result.ok, result.summary).toBe(false);
    expect(result.issues?.[0]).toMatchObject({ code: "house-tree-clearance-required", mapId: "m1", x: 24, y: 16 });
    expect(result.data.construction).toMatchObject({ applied: false, outcome: "blocked", counts: { requested: 2, actual: 0 } });
    expect(projectHash(ctx.project)).toBe(before);
    expect(captureHouseProtection(ctx.project)).toEqual([]);
  });

  it("accepts a clean site without blocking or changing unrelated trees and errors", () => {
    const ctx = { project: treeSite(false, { x: 30, y: 24 }) };
    const map = ctx.project.maps.m1!;
    map.upperTiles[12 * map.width + 2] = 260;
    map.lowerTiles[13 * map.width + 2] = 290;
    const outside = [{ x: 30, y: 24 }, { x: 2, y: 12 }, { x: 2, y: 13 }].map(at => ({
      ...at, lower: map.lowerTiles[at.y * map.width + at.x], upper: map.upperTiles[at.y * map.width + at.x],
    }));
    const baselineIssues = validateLayoutPlacement(ctx.project);
    expect(baselineIssues.map(issue => issue.code)).toEqual(["layout-tree-incomplete"]);

    const result = runAuthorHouse(ctx, exteriorSingle);

    expect(result.ok, result.summary).toBe(true);
    expect(result.data.construction.counts).toEqual({ requested: 1, actual: 1 });
    expect(captureHouseProtection(ctx.project)).toHaveLength(1);
    expect(validateLayoutPlacement(ctx.project)).toEqual(baselineIssues);
    for (const cell of outside) {
      const index = cell.y * map.width + cell.x;
      expect(ctx.project.maps.m1!.lowerTiles[index]).toBe(cell.lower);
      expect(ctx.project.maps.m1!.upperTiles[index]).toBe(cell.upper);
    }
  });

  it("allows explicit clearance then construction, and keeps completed-house erase protection", () => {
    const ctx = { project: treeSite(true) };
    const cleared = runTool(ctx, "tile_erase", { mapId: "m1", layer: "both", rect: { x: 5, y: 4, w: 1, h: 2 } });
    expect(cleared.ok, cleared.summary).toBe(true);
    expect(ctx.project.maps.m1!.upperTiles[4 * 48 + 5]).toBe(TILE.EMPTY);
    expect(ctx.project.maps.m1!.lowerTiles[5 * 48 + 5]).not.toBe(290);

    const result = runAuthorHouse(ctx, exteriorSingle);
    expect(result.ok, result.summary).toBe(true);
    expect(validateLayoutPlacement(ctx.project)).toEqual([]);
    const completed = projectHash(ctx.project);
    const erase = runTool(ctx, "tile_erase", { mapId: "m1", layer: "both", rect: { x: 5, y: 4, w: 1, h: 2 } });
    expect(erase.ok).toBe(false);
    expect(erase.issues?.[0]?.code).toBe("protected-house-write");
    expect(projectHash(ctx.project)).toBe(completed);
  });
});
