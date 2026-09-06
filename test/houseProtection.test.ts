import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import type { GameMap } from "@/project/types";
import { completedHouseProject, houseMap, HOUSE_RECT, mutateProject } from "./fixtures/completedHouse";

function expectProtected(mutate: (map: GameMap) => void, prepare?: (map: GameMap) => void): void {
  const ctx = { project: completedHouseProject() };
  prepare?.(houseMap(ctx.project));
  const before = serialize(ctx.project);
  const result = mutateProject(ctx, (draft) => mutate(houseMap(draft)));
  expect(result.issues?.map((issue) => issue.code)).toContain("protected-house-write");
  expect(result.ok).toBe(false);
  expect(serialize(ctx.project)).toBe(before);
}

describe("completed house geometry and exact cell ownership", () => {
  it.each([
    [3, 2], [6, 2], [3, 3], [6, 6], [4, 4],
  ])("protects bbox, full-width north ridge and empty cells at (%i,%i)", (x, y) => {
    expectProtected((map) => { map.lowerTiles[y * map.width + x] = 72; });
    expectProtected((map) => { map.upperTiles[y * map.width + x] = 200; });
  });

  it.each(["lowerTileStacks", "upperTileStacks"] as const)("protects %s contents, order and absence", (layer) => {
    const index = (map: GameMap): number => 4 * map.width + 4;
    for (const replacement of [[199], [200, 199], [], undefined]) {
      expectProtected((map) => {
        if (replacement === undefined) delete map[layer];
        else map[layer] = { [index(map)]: replacement };
      }, (map) => { map[layer] = { [index(map)]: [199, 200] }; });
    }
    expectProtected((map) => { map[layer] = { [index(map)]: [199] }; });
  });

  it.each([[0, 0], [18, 13]])("clips ridge and bbox at map edges (%i,%i)", (x, y) => {
    expectProtected((map) => { map.upperTiles[y * map.width + x] = 199; }, (map) => {
      const region = map.layoutPlan?.regions[0];
      if (!region) throw new Error("Missing region");
      Object.assign(region, { x, y, w: 4, h: 4 });
    });
  });

  it("protects a human placement rectangle without adding a north ridge", () => {
    const ctx = { project: completedHouseProject() };
    const map = houseMap(ctx.project);
    delete map.layoutPlan;
    map.structurePlacements = [{
      id: "human_1", kitId: "deleted-kit", ...HOUSE_RECT,
      before: { lower: Array(16).fill(240), upper: Array(16).fill(-1) }, afterHash: "human-edited",
    }];
    const loaded = deserialize(serialize(ctx.project));
    ctx.project = loaded;
    const result = mutateProject(ctx, (draft) => {
      const target = houseMap(draft);
      target.upperTiles[3 * target.width + 3] = 200;
    });
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(ctx.project).toBe(loaded);
    expect(mutateProject(ctx, (draft) => {
      const target = houseMap(draft);
      target.upperTiles[2 * target.width + 3] = 199;
    }).ok).toBe(true);
  });

  it("protects the existing roof-deck ladder attachment, not the entire yard", () => {
    const prepare = (map: GameMap): void => {
      const region = map.layoutPlan?.regions[0];
      if (!region) throw new Error("Missing region");
      region.tags = ["roof-deck"];
      map.upperTiles[7 * map.width + 5] = 322;
    };
    expectProtected((map) => { map.upperTiles[7 * map.width + 5] = -1; }, prepare);
    expectProtected((map) => { map.lowerTiles[7 * map.width + 5] = 72; }, prepare);
    const ctx = { project: completedHouseProject() };
    prepare(houseMap(ctx.project));
    expect(mutateProject(ctx, (draft) => {
      const map = houseMap(draft);
      map.upperTiles[7 * map.width + 6] = 199;
    }).ok).toBe(true);
  });

  it.each(["remove", "shrink", "move", "reclassify", "rename-id", "remove-door"])("rejects structural metadata change: %s", (kind) => {
    expectProtected((map) => {
      const region = map.layoutPlan?.regions[0];
      if (!region) throw new Error("Missing region");
      if (kind === "remove") delete map.layoutPlan;
      if (kind === "shrink") region.w -= 1;
      if (kind === "move") region.x += 1;
      if (kind === "reclassify") region.role = "custom";
      if (kind === "rename-id") region.id = "replacement";
      if (kind === "remove-door") delete region.doorAt;
    }, (map) => {
      const region = map.layoutPlan?.regions[0];
      if (!region) throw new Error("Missing region");
      region.shape = "rooftop-deck";
      map.upperTiles[7 * map.width + 5] = 322;
    });
  });

  it("does not claim a raw adjacent ladder without roof-deck metadata", () => {
    const ctx = { project: completedHouseProject() };
    const map = houseMap(ctx.project);
    map.upperTiles[7 * map.width + 5] = 322;
    const result = mutateProject(ctx, (draft) => {
      const target = houseMap(draft);
      target.upperTiles[7 * target.width + 5] = -1;
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });

  it("allows descriptive metadata and unrelated stack changes", () => {
    const ctx = { project: completedHouseProject() };
    const result = mutateProject(ctx, (draft) => {
      const map = houseMap(draft);
      const region = map.layoutPlan?.regions[0];
      if (!region || !map.layoutPlan) throw new Error("Missing region");
      region.label = "Renamed by AI";
      region.tags = ["residential"];
      region.yardTheme = "garden";
      map.layoutPlan.notes = "Description only";
      map.upperTileStacks = { 1: [199, 200] };
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(houseMap(ctx.project).layoutPlan?.regions[0]?.label).toBe("Renamed by AI");
  });

  it.each(["delete", "crop", "tileset"])("rejects protected map %s", (kind) => {
    const ctx = { project: completedHouseProject() };
    const before = serialize(ctx.project);
    const result = mutateProject(ctx, (draft) => {
      const map = houseMap(draft);
      if (kind === "delete") delete draft.maps[map.id];
      if (kind === "crop") { map.width -= 1; map.lowerTiles.length = map.width * map.height; map.upperTiles.length = map.width * map.height; }
      if (kind === "tileset") map.tilesetId = "other";
    });
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("takes the current accepted human-edited tiles as truth, not original kit tiles", () => {
    const ctx = { project: completedHouseProject() };
    houseMap(ctx.project).lowerTiles[3 * houseMap(ctx.project).width + 3] = 72;
    expect(mutateProject(ctx, (draft) => { houseMap(draft).name = "New name"; }).ok).toBe(true);
    expect(houseMap(ctx.project).lowerTiles[3 * houseMap(ctx.project).width + 3]).toBe(72);
  });
});
