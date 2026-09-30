import { describe, expect, it } from "vitest";
import { createMapFromSpec } from "@/editor/actions";
import { addParentChildTransfers, bestTestStartCell, firstFreeCell } from "@/editor/mapParentLink";
import { INTERIOR_FLOOR_TILE, resolveMapCreateDefaults } from "@/project/mapCreateSpec";
import { collectMapLinkStats } from "@/project/mapLinkStats";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID, DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { tilesetFamily } from "@/project/tilesetFamily";
import { runTool } from "@/editor/tools/toolRunner";
import { FOREST_HARMONY_ID } from "@/project/defaults/forestHarmony";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";

describe("resolveMapCreateDefaults", () => {
  it("starts a new project and a new blank map on the generated default (beodeul_city)", () => {
    const project = createBlankProject();
    expect(project.maps[project.startMapId]?.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(tilesetFamily(project, DEFAULT_TILESET_ID)).toBe("oprn-atlas");
    expect(tilesetFamily(project, DEFAULT_TILESET_ID)).not.toBe(tilesetFamily(project, FOREST_HARMONY_ID));
    const spec = resolveMapCreateDefaults(project, { parentId: project.startMapId });
    expect(spec.preset).toBe("blank");
    expect(spec.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(spec.parentId).toBe(project.startMapId);
  });

  it("create_map fills beodeul_city with its plain grass, not the combined-town number", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "fresh", name: "새 들판", width: 6, height: 5 }).ok).toBe(true);
    const map = ctx.project.maps.fresh!;
    expect(map.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(map.lowerTiles.every((tile) => tile === 737)).toBe(true);
  });

  it("inherits parent size and tileset", () => {
    const project = createBlankProject();
    const parentId = project.startMapId;
    project.maps[parentId]!.width = 40;
    project.maps[parentId]!.height = 30;
    project.maps[parentId]!.tilesetId = COMBINED_TOWN_TILESET_ID;
    const spec = resolveMapCreateDefaults(project, { parentId, preset: "inherit-parent" });
    expect(spec.width).toBe(40);
    expect(spec.height).toBe(30);
    expect(spec.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
    expect(spec.parentId).toBe(parentId);
  });

  it("creates a map from a spec onto the store", () => {
    store.replace(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId, selectedEventId: null, selectedEventPageId: null });
    const parentId = store.getCurrent().startMapId;
    const id = createMapFromSpec({
      name: "다락",
      width: 18,
      height: 12,
      tilesetId: "easyrpg_chipset_interior",
      parentId,
      preset: "interior",
    });
    const project = store.getCurrent();
    expect(project.maps[id]?.width).toBe(18);
    expect(project.maps[id]?.tilesetId).toBe("easyrpg_chipset_interior");
    expect(project.maps[id]?.lowerTiles.every((tile) => tile === INTERIOR_FLOOR_TILE)).toBe(true);
    expect(project.mapTree.children.some((child) => child.mapId === id) || Boolean(project.mapTree.mapId)).toBe(true);
  });

  it("uses the interior tileset and a room size for the interior preset", () => {
    const project = createBlankProject();
    const spec = resolveMapCreateDefaults(project, { parentId: project.startMapId, preset: "interior" });
    expect(spec.tilesetId).toBe("easyrpg_chipset_interior");
    expect(spec.width).toBe(20);
    expect(spec.height).toBe(15);
    expect(spec.parentId).toBe(project.startMapId);
  });
});

describe("parent-child transfer pair", () => {
  it("adds reciprocal transfer events on free cells", () => {
    store.replace(createBlankProject());
    const parentId = store.getCurrent().startMapId;
    const childId = createMapFromSpec({
      name: "방",
      width: 12,
      height: 10,
      tilesetId: COMBINED_TOWN_TILESET_ID,
      parentId,
      preset: "inherit-parent",
    });
    const beforeParentOut = collectMapLinkStats(store.getCurrent(), parentId).outgoingTransfers;
    expect(addParentChildTransfers(parentId, childId)).toBe(true);
    const project = store.getCurrent();
    const parent = project.maps[parentId]!;
    const child = project.maps[childId]!;
    expect(firstFreeCell(parent)).not.toEqual({ x: parent.events[parent.events.length - 1]!.x, y: parent.events[parent.events.length - 1]!.y });
    expect(collectMapLinkStats(project, parentId).outgoingTransfers).toBe(beforeParentOut + 1);
    expect(collectMapLinkStats(project, childId).outgoingTransfers).toBe(1);
    expect(collectMapLinkStats(project, childId).incomingTransfers).toBe(1);
  });
});

describe("map test-play start", () => {
  it("chooses a passable event-free interior cell instead of an empty outer wall", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const tileset = project.tilesets[map.tilesetId]!;
    const passableTile = tileset.passability.findIndex(
      (passage) => passage.up && passage.down && passage.left && passage.right,
    );
    const solidTile = tileset.passability.findIndex(
      (passage) => !passage.up && !passage.down && !passage.left && !passage.right,
    );
    expect(passableTile).toBeGreaterThanOrEqual(0);
    expect(solidTile).toBeGreaterThanOrEqual(0);
    map.width = 7;
    map.height = 7;
    map.lowerTiles = Array.from({ length: 49 }, (_, index) => {
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      return x >= 2 && x <= 4 && y >= 2 && y <= 4 ? passableTile : solidTile;
    });
    map.upperTiles = Array.from({ length: 49 }, () => -1);
    map.events = [{
      id: "ev_center",
      name: "center",
      x: 3,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
    }];

    expect(firstFreeCell(map)).toEqual({ x: 0, y: 0 });
    expect(bestTestStartCell(project, map)).toEqual({ x: 3, y: 2 });
  });
});
