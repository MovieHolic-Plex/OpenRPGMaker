/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordMapEditIfChanged, recordProjectSnapshot, redoMapEdit, resetMapEditHistory, undoMapEdit, revertToHistoryIndex, redoToHistoryIndex } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { setTeamRole } from "@/project/teamAccess";

beforeEach(() => {
  setTeamRole(null);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const project = createBlankProject();
  project.assets.uploaded.historyProbe = { id: "historyProbe", name: "shared image", kind: "sprite", dataUrl: "data:image/png;base64,AA==", meta: {} };
  store.replaceProject(project);
  resetMapEditHistory();
});
afterEach(() => {
  resetMapEditHistory();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
});

describe("history restore with shared asset dictionaries", () => {
  it("preserves mixed map/project/tileset order when jumping and redoing once", () => {
    const initial = store.getCurrent(), mapId = initial.startMapId;
    const tilesetId = initial.maps[mapId]!.tilesetId;
    const initialName = initial.tilesets[tilesetId]!.name;
    const initialTile = initial.maps[mapId]!.lowerTiles[0]!;
    const image = initial.assets.uploaded.historyProbe;
    recordProjectSnapshot("tile", mapId, { kind: "map", mapId });
    store.updateMapTiles(mapId, map => { map.lowerTiles[0] = initialTile + 1; });
    recordProjectSnapshot("title");
    store.update(project => { project.meta.title = "jump title"; });
    recordProjectSnapshot("tileset", mapId, { kind: "map", mapId, includeTilesets: true });
    store.update(project => { project.tilesets[tilesetId]!.name = "jump tileset"; });
    expect(revertToHistoryIndex(0)).toBe(true);
    expect(store.getCurrent().meta.title).toBe(initial.meta.title);
    expect(store.getCurrent().maps[mapId]!.lowerTiles[0]).toBe(initialTile);
    expect(store.getCurrent().tilesets[tilesetId]!.name).toBe(initialName);
    expect(redoToHistoryIndex(0)).toBe(true);
    expect(store.getCurrent().meta.title).toBe("jump title");
    expect(store.getCurrent().maps[mapId]!.lowerTiles[0]).toBe(initialTile + 1);
    expect(store.getCurrent().tilesets[tilesetId]!.name).toBe("jump tileset");
    expect(store.getCurrent().assets.uploaded.historyProbe).toBe(image);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId]!.lowerTiles[0]).toBe(initialTile);
  });

  it("restores a map edit without copying unrelated tilesets and uploaded image objects", () => {
    const before = store.getCurrent(), mapId = before.startMapId;
    const tileset = before.tilesets[before.maps[mapId]!.tilesetId];
    const image = before.assets.uploaded.historyProbe;
    const tile = before.maps[mapId]!.lowerTiles[0]!;
    recordMapEditIfChanged(mapId, () => store.updateMapTiles(mapId, map => { map.lowerTiles[0] = tile + 1; }, { label: "history probe" }));
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId]!.lowerTiles[0]).toBe(tile);
    expect(store.getCurrent().tilesets[tileset!.id]).toBe(tileset);
    expect(store.getCurrent().assets.uploaded.historyProbe).toBe(image);
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId]!.lowerTiles[0]).toBe(tile + 1);
    expect(store.getCurrent().tilesets[tileset!.id]).toBe(tileset);
    expect(store.getCurrent().assets.uploaded.historyProbe).toBe(image);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId]!.lowerTiles[0]).toBe(tile);
  });

  it("captures redo for project edits without copying the asset objects", () => {
    const before = store.getCurrent(), tileset = Object.values(before.tilesets)[0]!;
    const image = before.assets.uploaded.historyProbe;
    recordProjectSnapshot("rename project");
    store.update(project => { project.meta.title = "renamed"; }, { label: "rename project" });
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().meta.title).toBe(before.meta.title);
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().meta.title).toBe("renamed");
    expect(store.getCurrent().tilesets[tileset.id]).toBe(tileset);
    expect(store.getCurrent().assets.uploaded.historyProbe).toBe(image);
  });
});
