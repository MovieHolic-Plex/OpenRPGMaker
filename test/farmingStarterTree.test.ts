import { describe, expect, it } from "vitest";
import { createBlankProject, createFarmingDemoProject } from "@/project/defaults";
import { canMove, isPassable } from "@/project/collision";
import { deserialize, serialize } from "@/project/io";
import { collectProjectItemReferenceIds, validateProjectReferences } from "@/project/io/references";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { placeableKey } from "@/project/placeables";
import { startSession } from "@/project/session";
import { canOccupySpatialFootprint } from "@/project/spatialOccupancy";
import { resolveToolUseOnTile, setEquippedTool } from "@/project/toolActions";
import type { Project } from "@/project/types";
import { farmIntentForHand, interactWithFarmPlot, isTileFarmable } from "@/player/farming";
import { handSlotEntries, selectHandSlot } from "@/player/handSlot";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";

function starterTree(project: Project) {
  const trees = Object.values(project.session.placeables ?? {}).filter((object) => object.kind === "tree");
  expect(trees.length).toBeGreaterThan(0);
  const tree = trees[0]!;
  expect(tree.itemId).toBe("item_wood");
  expect(project.maps[tree.mapId]).toBeDefined();
  expect(project.database.items.filter((item) => item.id === tree.itemId)).toHaveLength(1);
  expect(project.session.placeables?.[placeableKey(tree.mapId, tree.x, tree.y)]).toEqual(tree);
  return tree;
}

function runtime() {
  const project = createFarmingDemoProject();
  const tree = starterTree(project);
  const session = startSession(project, 81);
  const map = project.maps[tree.mapId]!;
  const axeSlot = handSlotEntries(project, session).findIndex((entry) => entry.itemId === "item_axe") + 1;
  expect(axeSlot).toBeGreaterThan(0);
  selectHandSlot(project, session, axeSlot);
  const chop = () => interactWithFarmPlot(project, session, map, tree.x, tree.y, farmIntentForHand(project, session));
  return { project, tree, session, map, chop };
}

describe("ordinary farming starter tree", () => {
  it("authors a raw wood tree and an owned selectable axe without earned assets", () => {
    const { project, session, map, tree } = runtime();
    expect(project.database.items.filter((item) => item.id === "item_axe")).toHaveLength(1);
    expect(project.database.items.find((item) => item.id === "item_axe")).toMatchObject({ farmTool: "axe", consumable: false });
    expect(session.inventory.item_axe).toBe(1);
    expect(session.inventory.item_wood).toBeUndefined();
    expect(session.lifeSkills).toEqual({});
    expect(session.energy).toBe(100);
    expect(resolveToolUseOnTile(project, session, map, tree.x, tree.y, "chop")).toMatchObject({
      itemId: "item_axe", farmTool: "axe", action: "chop", ruleId: "legacy-axe-chop",
    });
    expect(session.farmBuildingPlacements?.farm_building_workshop_1?.paymentReceipt).toBeUndefined();
  });

  it("has a collision-checked approach outside crops, events, buildings and exits", () => {
    const { project, session, map, tree } = runtime();
    expect({ x: tree.x, y: tree.y }).toEqual({ x: 6, y: 11 });
    expect(tree.mapId).toBe(project.startMapId);
    const withoutTree = structuredClone(session);
    delete withoutTree.placeables![placeableKey(tree.mapId, tree.x, tree.y)];
    expect(canOccupySpatialFootprint(project, withoutTree, { ...tree, orientation: "down" }, { width: 1, height: 1 })).toBe(true);
    // Conservative authored route: avoid even walkable crop cells and nonblocking decor.
    const route = [project.startPos, ...[5, 6, 7, 8, 9, 10].map((x) => ({ x, y: 4 })),
      ...[5, 6, 7, 8, 9, 10, 11].map((y) => ({ x: 10, y })),
      { x: 9, y: 11 }, { x: 8, y: 11 }, { x: 7, y: 11 }];
    for (const [index, cell] of [...route, tree].entries()) {
      expect(isPassable(project, map, cell.x, cell.y)).toBe(true);
      expect(isTileFarmable(map, cell.x, cell.y)).toBe(false);
      expect(map.events.some((event) => event.x === cell.x && event.y === cell.y)).toBe(false);
      expect(map.events.some((event) => event.schedule?.some((entry) =>
        entry.at.mapId === map.id && entry.at.x === cell.x && entry.at.y === cell.y))).toBe(false);
      expect(canOccupySpatialFootprint(project, withoutTree, { mapId: map.id, ...cell, orientation: "down" }, { width: 1, height: 1 })).toBe(true);
      if (index > 0) {
        const previous = route[index - 1]!;
        expect(Math.abs(previous.x - cell.x) + Math.abs(previous.y - cell.y)).toBe(1);
        expect(canMove(project, map, previous.x, previous.y, cell.x, cell.y)).toBe(true);
      }
    }
    expect(Math.abs(tree.x - project.startPos.x) + Math.abs(tree.y - project.startPos.y)).toBeGreaterThan(1);
    for (const event of map.events) expect(Math.abs(tree.x - event.x) + Math.abs(tree.y - event.y)).toBeGreaterThan(1);
    for (const building of project.system.farmAnimalBuildings ?? []) {
      if (building.mapId === map.id) expect(Math.abs(tree.x - building.x) + Math.abs(tree.y - building.y)).toBeGreaterThan(1);
    }
  });

  it("validates raw references before Project4 roundtrip and keeps tree/tool semantics", () => {
    const project = createFarmingDemoProject();
    const tree = starterTree(project);
    const before = serialize(project);
    validateProjectReferences(project);
    expect(serialize(project)).toBe(before);
    expect(collectProjectItemReferenceIds(project).has(tree.itemId!)).toBe(true);
    const loaded = deserialize(before);
    expect(loaded.version).toBe(4);
    validateProjectReferences(loaded);
    expect(loaded.session).toEqual(project.session);
    expect(starterTree(loaded)).toEqual(tree);
    expect(loaded.database.items.find((item) => item.id === "item_axe")).toEqual(project.database.items.find((item) => item.id === "item_axe"));
    expect(serialize(deserialize(serialize(loaded)))).toBe(serialize(loaded));
  });

  it("detects missing raw tree map/drop records rather than accepting normalized deletion", () => {
    const project = createFarmingDemoProject();
    const tree = starterTree(project);
    const missingMap = structuredClone(project);
    delete missingMap.maps[tree.mapId];
    expect(() => starterTree(missingMap)).toThrow();
    const missingWood = structuredClone(project);
    missingWood.database.items = missingWood.database.items.filter((item) => item.id !== tree.itemId);
    expect(() => starterTree(missingWood)).toThrow();
    expect(() => validateProjectReferences(missingWood)).toThrow();
  });

  it("chops exactly once for one wood, one energy and ten foraging XP, never mutating the start", () => {
    const { project, session, tree, chop } = runtime();
    const start = serialize(project);
    const before = structuredClone(session);
    expect(chop()).toMatchObject({ kind: "harvested", source: "tree", itemId: "item_wood", count: 1,
      energySpent: 1, xpAwarded: { foraging: 10 }, affectedTiles: [{ x: tree.x, y: tree.y, kind: "harvested" }] });
    const expected = structuredClone(before);
    expected.inventory.item_wood = 1;
    expected.collections!.item_wood = { discovered: true, caughtCount: 0, donated: false, shippedCount: 0 };
    expected.energy = 99;
    expected.lifeSkills = { life_foraging: { xp: 10, level: 1 } };
    delete expected.placeables![placeableKey(tree.mapId, tree.x, tree.y)];
    expect(session).toEqual(expected);
    expect(chop()).toMatchObject({ kind: "ignored", reason: "not-farmable" });
    expect(session).toEqual(expected);
    expect(serialize(project)).toBe(start);
    const fresh = startSession(project, 81);
    expect(fresh.placeables).toEqual(before.placeables);
    expect(fresh.placeables).not.toBe(project.session.placeables);
    expect(fresh.placeables?.[placeableKey(tree.mapId, tree.x, tree.y)]).not.toBe(tree);
    expect(fresh.inventory.item_wood).toBeUndefined();
  });

  it.each(["insufficient-energy", "missing-axe", "inventory-full"] as const)("conserves the complete session on %s and permits a corrected retry", (reason) => {
    const { session, chop } = runtime();
    if (reason === "insufficient-energy") session.energy = 0;
    if (reason === "missing-axe") setEquippedTool(session, "item_pickaxe");
    if (reason === "inventory-full") session.inventory.item_wood = ITEM_QUANTITY_MAX;
    const before = structuredClone(session);
    expect(chop()).toMatchObject({ kind: "ignored", reason });
    expect(session).toEqual(before);
    if (reason === "insufficient-energy") session.energy = 1;
    if (reason === "missing-axe") setEquippedTool(session, "item_axe");
    if (reason === "inventory-full") session.inventory.item_wood = ITEM_QUANTITY_MAX - 1;
    expect(chop()).toMatchObject({ kind: "harvested", count: 1 });
    const after = structuredClone(session);
    expect(chop().kind).toBe("ignored");
    expect(session).toEqual(after);
  });

  it("preserves standing and actually chopped trees through Save5 without backfill", () => {
    const { project, session, tree, chop } = runtime();
    const standing = createSaveSnapshot(project, session);
    expect(standing.schemaVersion).toBe(5);
    expect(applySaveSnapshot(project, JSON.parse(JSON.stringify(standing))).placeables).toEqual(session.placeables);
    expect(chop().kind).toBe("harvested");
    expect(standing.session.placeables?.[placeableKey(tree.mapId, tree.x, tree.y)]).toEqual(tree);
    const chopped = createSaveSnapshot(project, session);
    const restored = applySaveSnapshot(project, JSON.parse(JSON.stringify(chopped)));
    expect(restored.placeables).toEqual(session.placeables);
    expect(restored.inventory).toEqual(session.inventory);
    expect(restored.energy).toBe(99);
    expect(restored.lifeSkills).toEqual(session.lifeSkills);
    expect(createSaveSnapshot(project, restored).session.placeables).toEqual(chopped.session.placeables);
    expect(interactWithFarmPlot(project, restored, project.maps[tree.mapId]!, tree.x, tree.y).kind).toBe("ignored");
    expect(restored.inventory.item_wood).toBe(1);
  });

  it("does not add trees or axes to blank or existing tree-free farming projects/saves", () => {
    for (const project of [createBlankProject(), createFarmingDemoProject()]) {
      project.session.placeables = Object.fromEntries(Object.entries(project.session.placeables ?? {}).filter(([, object]) => object.kind !== "tree"));
      delete project.session.inventory.item_axe;
      project.database.items = project.database.items.filter((item) => item.id !== "item_axe");
      const loaded = deserialize(serialize(project));
      expect(loaded.session.placeables ?? {}).toEqual(project.session.placeables);
      expect(loaded.database.items.some((item) => item.id === "item_axe")).toBe(false);
      const session = startSession(loaded, 81);
      const restored = applySaveSnapshot(loaded, createSaveSnapshot(loaded, session));
      expect(restored.placeables).toEqual(project.session.placeables);
      expect(restored.inventory.item_axe).toBeUndefined();
    }
  });
});
