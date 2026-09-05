import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { buildHouseKit } from "@/editor/tools/houseKitDomain";
import { deserialize, serialize } from "@/project/io";
import { completedHouseProject, houseMap, HOUSE_RECT, mutateProject } from "./fixtures/completedHouse";

function emptyContext() {
  const project = completedHouseProject();
  const map = houseMap(project);
  delete map.layoutPlan;
  map.lowerTiles.fill(240);
  map.upperTiles.fill(-1);
  return { project };
}

const WINGS = [{ x: 2, y: 2, w: 6, h: 6 }];

describe("completed house transaction invariant", () => {
  it.each([false, true])("rolls back maps, events and tree additions atomically (dryRun=%s)", (dryRun) => {
    const ctx = { project: completedHouseProject() };
    const before = serialize(ctx.project);
    const original = ctx.project;
    const result = mutateProject(ctx, (draft) => {
      const map = houseMap(draft);
      map.upperTiles[3 * map.width + 3] = -1;
      map.events.push({ id: "new_event", x: 1, y: 1, trigger: { kind: "action" }, commands: [] });
      draft.maps.new_map = { ...structuredClone(map), id: "new_map", events: [] };
      draft.mapTree.children.push({ mapId: "new_map", children: [] });
    }, dryRun);
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(result.ok).toBe(false);
    expect(ctx.project).toBe(original);
    expect(serialize(ctx.project)).toBe(before);
  });

  it("catches global tree-repair spillover even when the tool edits another map", () => {
    const ctx = { project: completedHouseProject() };
    const map = houseMap(ctx.project);
    map.lowerTiles[7 * map.width + 3] = 290; // repair would overwrite protected upper at (3,6)
    const before = serialize(ctx.project);
    const result = runTool(ctx, "create_map", { id: "elsewhere", name: "Elsewhere", width: 10, height: 10 });
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("seals a newly built standalone house before global tree repair", () => {
    const ctx = emptyContext();
    const map = houseMap(ctx.project);
    map.lowerTiles[8 * map.width + 2] = 290;
    const before = serialize(ctx.project);
    const result = runTool(ctx, "author_house", {
      kind: "single", mapId: map.id, kitId: "blue-stone", wings: WINGS,
      interior: "linked-interior", yard: [],
    });
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("retains registration-time snapshots through later work in the same transaction", () => {
    const ctx = emptyContext();
    const before = serialize(ctx.project);
    const result = mutateProject(ctx, (draft) => {
      buildHouseKit(draft, {
        mapId: draft.startMapId, kitId: "blue-stone", wings: WINGS,
        door: true, doorEvent: false, interior: false,
      });
      const map = houseMap(draft);
      map.upperTiles[3 * map.width + 3] = 199;
    });
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("does not allow removing metadata and then destroying the house", () => {
    const ctx = { project: completedHouseProject() };
    const before = serialize(ctx.project);
    const result = mutateProject(ctx, (draft) => {
      const map = houseMap(draft);
      delete map.layoutPlan;
      map.upperTiles.fill(-1);
      map.lowerTiles.fill(240);
    });
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("rejects new overlapping house geometry even with identical tile IDs", () => {
    const ctx = { project: completedHouseProject() };
    const before = serialize(ctx.project);
    const result = mutateProject(ctx, (draft) => {
      houseMap(draft).layoutPlan?.regions.push({ id: "new_house", role: "house", label: "Overlap", ...HOUSE_RECT });
    });
    expect(result.issues?.[0]?.code).toBe("house-overlap");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("rejects overlap between two newly recorded houses, including only their ridge", () => {
    const ctx = emptyContext();
    const before = serialize(ctx.project);
    const result = mutateProject(ctx, (draft) => {
      houseMap(draft).layoutPlan = { version: 1, kind: "new", regions: [
        { id: "a", role: "house", label: "A", x: 2, y: 2, w: 4, h: 4 },
        { id: "b", role: "house", label: "B", x: 2, y: 6, w: 4, h: 4 },
      ] };
    });
    expect(result.issues?.[0]?.code).toBe("house-overlap");
    expect(serialize(ctx.project)).toBe(before);
  });

  it.each(["author_house", "build_house"])("preflights %s against a completed house without tile changes", (tool) => {
    const ctx = emptyContext();
    const args = tool === "author_house"
      ? { kind: "single", mapId: ctx.project.startMapId, kitId: "blue-stone", wings: WINGS, interior: "exterior-only", yard: [] }
      : { mapId: ctx.project.startMapId, origin: { x: 2, y: 2 }, width: 6, height: 6, material: "stone", naturalness: 0 };
    const built = runTool(ctx, tool, args);
    expect(built.ok, JSON.stringify(built.issues)).toBe(true);
    ctx.project = deserialize(serialize(ctx.project));
    const before = serialize(ctx.project);
    const duplicate = runTool(ctx, tool, args);
    expect(duplicate.issues?.[0]?.code).toBe("house-overlap");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("registers and reloads a standalone roof-deck attachment without claiming its yard", () => {
    const ctx = emptyContext();
    const built = runTool(ctx, "author_house", {
      kind: "single", mapId: ctx.project.startMapId, kitId: "blue-stone",
      wings: [{ x: 2, y: 2, w: 7, h: 8 }], roofDeck: true, interior: "exterior-only", yard: [],
    });
    expect(built.ok, JSON.stringify(built.issues)).toBe(true);
    ctx.project = deserialize(serialize(ctx.project));
    const map = houseMap(ctx.project);
    expect(map.upperTiles[10 * map.width + 6]).toBe(322);
    const before = serialize(ctx.project);
    const erased = runTool(ctx, "tile_erase", { mapId: map.id, rect: { x: 6, y: 10, w: 1, h: 1 } });
    expect(erased.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
    const yard = runTool(ctx, "clear_region", { mapId: map.id, x: 7, y: 10, w: 1, h: 1, fill: "empty" });
    expect(yard.ok, JSON.stringify(yard.issues)).toBe(true);
  });

  it("allows unrelated edits and safe dry-run without changing the original project", () => {
    const ctx = { project: completedHouseProject() };
    const before = serialize(ctx.project);
    const args = { mapId: ctx.project.startMapId, x: 12, y: 10, w: 2, h: 2, fill: "empty" };
    expect(runTool(ctx, "clear_region", args, { dryRun: true }).ok).toBe(true);
    expect(serialize(ctx.project)).toBe(before);
    expect(runTool(ctx, "clear_region", args).ok).toBe(true);
    expect(houseMap(ctx.project).lowerTiles[10 * houseMap(ctx.project).width + 12]).toBe(-1);
  });
});
