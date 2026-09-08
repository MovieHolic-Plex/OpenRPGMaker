import { describe, expect, it } from "vitest";
import { placePropsOnDraft } from "@/editor/tools/placePropsDomain";
import { runScatterObject } from "@/editor/tools/placementTools";
import { runTool } from "@/editor/tools/toolRunner";
import { ToolError } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { isPassable } from "@/project/collision";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import type { GameMap, Project } from "@/project/types";

type Diagnostics = {
  unit: "candidate-origin";
  scope: "area-candidate-origins" | "explicit-candidate-origins";
  footprint: { w: number; h: number };
  candidateOrigins: number;
  rejectedOrigins: number;
  eligibleOrigins: number;
  rejectedBy: Record<string, number>;
  upperErase: { recommended: boolean; upperOnlyOrigins: number };
};

const AREA = { x: 7, y: 5, w: 3, h: 3 };
const SMALL = { x: 3, y: 3, w: 1, h: 1 };

function fixture(floor = 240, interior = false) {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.width = 12;
  map.height = 10;
  map.lowerTiles = Array(120).fill(floor);
  map.upperTiles = Array(120).fill(TILE.EMPTY);
  map.events = [];
  project.startPos = { x: 1, y: 1 };
  if (interior) map.tilesetId = "easyrpg_chipset_interior";
  return { project, map };
}

function fill(map: GameMap, layer: "lowerTiles" | "upperTiles", tile: number, area = AREA) {
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) map[layer][y * map.width + x] = tile;
  }
}

function failure(run: () => unknown): Diagnostics {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(ToolError);
  expect((caught as ToolError).code).toBe("placement-zero");
  const diagnostics = (caught as ToolError & { diagnostics?: Diagnostics }).diagnostics;
  expect(diagnostics).toBeDefined();
  return diagnostics!;
}

function crates(project: Project, area = AREA, count = 3, packing?: "dense") {
  return placePropsOnDraft(project, { mapId: project.startMapId, material: "나무 상자", area, count, seed: 7, packing });
}

function tree(project: Project, area = AREA, extra: Record<string, unknown> = {}) {
  const map = project.maps[project.startMapId]!;
  const group = project.tilesets[map.tilesetId]!.tileGroups!.find((entry) => entry.id.includes("conifer-tree"))!;
  return runScatterObject(project, { mapId: map.id, groupId: group.id, area, count: 3, seed: 7, ...extra });
}

describe("measured prop rejection diagnostics", () => {
  it.each([2, 3])("diagnoses all nine regenerated-cellar sand/road cells even when count=%i samples fewer", (count) => {
    const { project, map } = fixture(423);
    for (let y = AREA.y; y < AREA.y + AREA.h; y += 1) map.lowerTiles[y * map.width + 9] = 360;
    for (let y = 5; y < 8; y += 1) for (let x = 7; x < 10; x += 1) expect(isPassable(project, map, x, y)).toBe(true);
    expect(map.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
    const before = structuredClone(project);
    expect(failure(() => crates(project, AREA, count))).toEqual({
      unit: "candidate-origin", scope: "area-candidate-origins", footprint: { w: 1, h: 1 },
      candidateOrigins: 9, rejectedOrigins: 9, eligibleOrigins: 0,
      rejectedBy: { protectedSurface: 9 }, upperErase: { recommended: false, upperOnlyOrigins: 0 },
    });
    expect(project).toEqual(before);
  });

  it.each(["upper", "lower", "path", "mixed"])("counts single-tile %s causes without inferring water or upper recovery", (cause) => {
    const { project, map } = fixture();
    if (cause === "upper" || cause === "mixed") fill(map, "upperTiles", 289);
    if (cause === "lower") fill(map, "lowerTiles", 43);
    if (cause === "path") fill(map, "lowerTiles", 360);
    if (cause === "mixed") {
      map.lowerTiles[5 * map.width + 7] = 43;
      map.lowerTiles[5 * map.width + 8] = 423;
    }
    const result = failure(() => crates(project));
    expect(result.rejectedBy).toEqual(cause === "upper" ? { upperOccupied: 9 }
      : cause === "lower" ? { lowerImpassable: 9 }
        : cause === "path" ? { protectedSurface: 9 }
          : { upperOccupied: 9, lowerImpassable: 1, protectedSurface: 1 });
    expect(result.upperErase).toEqual({ recommended: cause === "upper", upperOnlyOrigins: cause === "upper" ? 9 : cause === "mixed" ? 7 : 0 });
    expect(result.rejectedOrigins).toBe(9);
  });

  it("does not call an upper bridge over blocked lower ground an upper-only recovery", () => {
    const { project, map } = fixture();
    const tileset = project.tilesets[map.tilesetId]!;
    // Genuine authored runtime override: the existing bridge is passable, but
    // removing it reveals blocked lower. Placement must not change these rules.
    tileset.priority[237] = "lower";
    tileset.passability[237] = { up: true, down: true, left: true, right: true };
    fill(map, "lowerTiles", 43, SMALL);
    fill(map, "upperTiles", 237, SMALL);
    expect(isPassable(project, map, 3, 3)).toBe(true);
    const before = structuredClone(project);
    const result = failure(() => crates(project, SMALL));
    expect(result.rejectedBy).toEqual({ upperOccupied: 1, lowerImpassable: 1 });
    expect(result.upperErase).toEqual({ recommended: false, upperOnlyOrigins: 0 });
    expect(project).toEqual(before);
  });

  it.each(["start", "event", "transfer", "house", "stamp"])("measures %s protection, not terrain occupation", (kind) => {
    const { project, map } = fixture();
    if (kind === "start") project.startPos = { x: 3, y: 3 };
    if (kind === "event" || kind === "transfer") {
      // Use the real event schema via the tool, avoiding a partial GameEvent mock.
      const ctx = { project };
      const placed = runTool(ctx, "upsert_event", { mapId: map.id, event: {
        id: "diagnostic_event", name: "Diagnostic", x: kind === "event" ? 3 : 2, y: 3,
        graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below",
        commands: kind === "transfer" ? [{ kind: "transfer", mapId: map.id, x: 3, y: 3 }] : [],
      } });
      expect(placed.ok, JSON.stringify(placed.issues)).toBe(true);
      Object.assign(project, ctx.project);
    }
    if (kind === "house") map.layoutPlan = { version: 1, kind: "fixture", regions: [{ id: "house", role: "house", label: "House", ...SMALL }] };
    if (kind === "stamp") map.structurePlacements = [{ id: "stamp", kitId: "human", ...SMALL, before: { lower: [240], upper: [-1] }, afterHash: "accepted" }];
    const before = structuredClone(project);
    const result = failure(() => crates(project, SMALL));
    expect(result.rejectedBy).toEqual({ [kind === "house" || kind === "stamp" ? "protectedOwnership" : "protectedEvent"]: 1 });
    expect(result.upperErase.recommended).toBe(false);
    expect(project).toEqual(before);
  });

  it.each(["natural", "dense"])("counts tree footprint origins, not footprint cells, in %s packing", (packing) => {
    const { project, map } = fixture();
    fill(map, "upperTiles", 289);
    const result = failure(() => tree(project, AREA, { packing }));
    expect(result).toEqual({
      unit: "candidate-origin", scope: "area-candidate-origins", footprint: { w: 1, h: 2 },
      candidateOrigins: 6, rejectedOrigins: 6, eligibleOrigins: 0,
      rejectedBy: { upperOccupied: 6 }, upperErase: { recommended: true, upperOnlyOrigins: 6 },
    });
  });

  it("aggregates mixed reasons across a whole footprint; clearing its upper half cannot fix its lower half", () => {
    const { project, map } = fixture();
    const area = { x: 3, y: 3, w: 1, h: 2 };
    map.upperTiles[3 * map.width + 3] = 289;
    map.lowerTiles[4 * map.width + 3] = 43;
    const before = structuredClone(project);
    const result = failure(() => tree(project, area));
    expect(result.candidateOrigins).toBe(1);
    expect(result.rejectedOrigins).toBe(1);
    expect(result.rejectedBy).toEqual({ upperOccupied: 1, lowerImpassable: 1, lowerIncompatible: 1 });
    expect(result.upperErase).toEqual({ recommended: false, upperOnlyOrigins: 0 });
    expect(project).toEqual(before);
  });

  it("measures path rejection for upper furniture footprints without admitting road or sand", () => {
    const { project, map } = fixture(423);
    const before = structuredClone(project);
    const result = failure(() => placePropsOnDraft(project, { mapId: map.id, material: "과일박스", area: AREA, count: 2, seed: 7 }));
    expect(result.footprint).toEqual({ w: 2, h: 1 });
    expect(result.candidateOrigins).toBe(6);
    expect(result.rejectedBy).toEqual({ protectedSurface: 6 });
    expect(result.upperErase.recommended).toBe(false);
    expect(project).toEqual(before);
  });

  it("does not recommend upper erase for a tree canopy hitting ownership even with avoidProtected=false", () => {
    const { project, map } = fixture();
    map.layoutPlan = { version: 1, kind: "fixture", regions: [{ id: "house", role: "house", label: "House", ...SMALL }] };
    const result = failure(() => tree(project, { ...SMALL, h: 2 }, { avoidProtected: false }));
    expect(result.rejectedBy).toEqual({ protectedOwnership: 1 });
    expect(result.upperErase.recommended).toBe(false);
  });

  it("reports no geometric origins for an area shorter than the footprint, not imaginary occupied cells", () => {
    const { project } = fixture();
    const result = failure(() => tree(project, SMALL));
    expect(result.candidateOrigins).toBe(0);
    expect(result.rejectedOrigins).toBe(0);
    expect(result.rejectedBy).toEqual({});
    expect(result.upperErase.recommended).toBe(false);
  });

  it("does not recommend upper erase over blocked lower furniture backing", () => {
    const { project, map } = fixture(43);
    fill(map, "upperTiles", 289);
    const result = failure(() => placePropsOnDraft(project, { mapId: map.id, material: "과일박스", area: AREA, count: 2, seed: 7 }));
    expect(result.rejectedBy).toEqual({ upperOccupied: 6, lowerImpassable: 6 });
    expect(result.upperErase).toEqual({ recommended: false, upperOnlyOrigins: 0 });
  });

  it("distinguishes a missed sample from an entirely excluded area", () => {
    const { project } = fixture();
    expect(crates(project, AREA, 1).data).toMatchObject({ placed: 1, requested: 1 });
    const result = failure(() => crates(project, AREA, 1));
    expect(result).toEqual({
      unit: "candidate-origin", scope: "area-candidate-origins", footprint: { w: 1, h: 1 },
      candidateOrigins: 9, rejectedOrigins: 1, eligibleOrigins: 8,
      rejectedBy: { upperOccupied: 1 }, upperErase: { recommended: false, upperOnlyOrigins: 1 },
    });
  });

  it("counts explicit origins once and does not mislabel their subset as an area census", () => {
    const { project, map } = fixture();
    map.upperTiles[5 * map.width + 7] = 289;
    const result = failure(() => tree(project, AREA, { packing: "dense", origins: [
      { x: 7, y: 5 }, { x: 7, y: 5 }, { x: 6, y: 5 },
    ] }));
    expect(result).toEqual({
      unit: "candidate-origin", scope: "explicit-candidate-origins", footprint: { w: 1, h: 2 },
      candidateOrigins: 2, rejectedOrigins: 2, eligibleOrigins: 0,
      rejectedBy: { upperOccupied: 1, outOfBounds: 1 }, upperErase: { recommended: false, upperOnlyOrigins: 1 },
    });
  });

  it("preserves the explicit event opt-out without opting out of ownership", () => {
    const { project } = fixture();
    project.startPos = { x: 3, y: 3 };
    expect(failure(() => tree(project, { ...SMALL, h: 2 })).rejectedBy).toEqual({ protectedEvent: 1 });
    expect(tree(project, { ...SMALL, h: 2 }, { avoidProtected: false, count: 1 }).data).toMatchObject({ placed: 1, requested: 1 });
  });

  it("recommends upper-only recovery only when the real upper erase and unchanged request succeed", () => {
    const { project, map } = fixture();
    fill(map, "upperTiles", 289);
    expect(failure(() => crates(project, AREA, 2)).upperErase.recommended).toBe(true);
    const ctx = { project };
    const erased = runTool(ctx, "tile_erase", { mapId: map.id, rect: AREA, layer: "upper" });
    expect(erased.ok, JSON.stringify(erased.issues)).toBe(true);
    expect(ctx.project.maps[map.id]!.lowerTiles).toEqual(Array(120).fill(240));
    const result = runTool(ctx, "place_props", { mapId: map.id, area: AREA, material: "나무 상자", count: 2, seed: 7 });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ placed: 2, requested: 2, tileId: 237 });
  });

  it("retains the machine record through the real tool runner without mutating the rejected project", () => {
    const { project, map } = fixture(423);
    const before = structuredClone(project);
    const expected = failure(() => crates(project));
    const ctx = { project };
    const result = runTool(ctx, "place_props", { mapId: map.id, material: "나무 상자", area: AREA, count: 3, seed: 7 });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("placement-zero");
    // A machine sentinel, never parsing human cause/recovery prose.
    const record = result.issues![0]!.message.split("\n").find((line) => line.startsWith("placement_diagnostics: "));
    expect(record).toBeDefined();
    expect(JSON.parse(record!.slice("placement_diagnostics: ".length))).toEqual(expected);
    expect(ctx.project).toEqual(before);
  });

  it.each([[222, false, 237], [240, false, 237], [72, true, 295]] as const)("keeps exact 2/2 crates on floor %i, interior=%s, tile=%i", (floor, interior, crate) => {
    const { project, map } = fixture(floor, interior);
    const tileset = project.tilesets[map.tilesetId]!;
    expect(resolveMaterialByLabel(tileset, "나무 상자", { preferGroup: true, preferRoles: ["prop", "terrain"] })).toMatchObject({ tileId: crate });
    const beforeRules = structuredClone(tileset);
    const ctx = { project };
    const result = runTool(ctx, "place_props", { mapId: map.id, material: "나무 상자", area: AREA, count: 2, seed: 7 });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ placed: 2, requested: 2, tileId: crate });
    expect(ctx.project.maps[map.id]!.upperTiles.filter((tile) => tile !== TILE.EMPTY)).toEqual([crate, crate]);
    expect(ctx.project.maps[map.id]!.lowerTiles).toEqual(Array(120).fill(floor));
    expect(ctx.project.tilesets[map.tilesetId]).toEqual(beforeRules);
  });
});
