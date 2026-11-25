// @vitest-environment happy-dom

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { editorState } from "@/editor/editorState";
import { paintTile } from "@/editor/actions";
import { getMapEditHistoryDebugEntries, resetMapEditHistory, undoMapEdit, redoMapEdit, getMapEditHistoryState } from "@/editor/mapEditHistory";
import { createBlankProject, TILE } from "@/project/defaults";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import type { MapId } from "@/project/types";
import { EventEmitter } from "node:events";
import { installEditRenderGate, type EditRenderGateGame } from "@/editor/editRenderGate";
import * as renderGate from "@/editor/editRenderGate";
import { isolateTimers } from "./mergedTeardown";

describe("editScenePaintHistory", () => {
  isolateTimers();
  type EditSceneHarness = {
    applyAtPointer(ptr: unknown): void;
    cameras: { main: object };
    isPainting: boolean;
    lastPaintKey: string;
  };
  const TILE_SIZE = 16;
  let EditSceneCtor: { readonly prototype: object };
  beforeAll(async () => {
    // getLoadedPhaser() 는 모듈 로드 시점에 window.Phaser 를 읽고, phaser 자체는 document.documentElement 를
    // 읽는다 — 손으로 만든 window/document 스텁으론 모자라 happy-dom 의 실제 window 를 쓴다.
    (window as unknown as { Phaser: unknown }).Phaser = { Scene: class Scene {} };
    vi.stubGlobal("MouseEvent", class MouseEvent {});
    vi.stubGlobal("PointerEvent", class PointerEvent {});

    const { EditScene } = await import("@/editor/EditScene");
    EditSceneCtor = EditScene;
  }, 90_000);
  afterAll(() => {
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
    editorState.set({
      activePaletteStamp: null,
      autoConnectMode: true,
      brushSize: 1,
      currentMapId: store.getCurrent().startMapId,
      layer: "lower",
      selectedTile: TILE.WATER,
      paintShape: "pen",
      tool: "paint",
    });
  });
  function createEditSceneHarness(): EditSceneHarness {
    return Object.assign(Object.create(EditSceneCtor.prototype), {
      cameras: { main: {} },
      isPainting: false,
      lastPaintKey: "",
    }) as EditSceneHarness;
  }
  function pointerAt(x: number, y: number): unknown {
    return {
      event: {},
      positionToCamera: () => ({
        x: x * TILE_SIZE + 1,
        y: y * TILE_SIZE + 1,
      }),
    };
  }
  function historyKinds(): readonly { readonly kind: string; readonly mapId: string | null }[] {
    return getMapEditHistoryDebugEntries().map((entry) => ({ kind: entry.kind, mapId: entry.mapId }));
  }
  describe("EditScene reliable brush", () => {
    function seedTiles(lower: number): MapId {
      const mapId = store.getCurrent().startMapId;
      store.updateMap(mapId, (map) => {
        map.lowerTiles.fill(lower);
        map.upperTiles.fill(TILE.EMPTY);
      });
      editorState.set({ autoConnectMode: false });
      return mapId;
    }

    it.each([1, 2, 3, 4])("paints and erases exactly a negative-anchored size %i footprint", (size) => {
      const mapId = seedTiles(TILE.EMPTY);
      const scene = createEditSceneHarness();
      editorState.set({ brushSize: size, selectedTile: TILE.GRASS });
      scene.applyAtPointer(pointerAt(6, 6));
      const map = store.getCurrent().maps[mapId];
      const expected = new Set<number>();
      const start = 6 - Math.floor(size / 2);
      for (let y = start; y < start + size; y++) {
        for (let x = start; x < start + size; x++) expected.add(y * map.width + x);
      }
      expect(map.lowerTiles.flatMap((tile, index) => tile === TILE.GRASS ? [index] : [])).toEqual([...expected]);
      store.updateMap(mapId, (draft) => draft.lowerTiles.fill(TILE.GRASS));
      scene.lastPaintKey = "";
      editorState.set({ tool: "erase" });
      scene.applyAtPointer(pointerAt(6, 6));
      expect(store.getCurrent().maps[mapId].lowerTiles.flatMap((tile, index) => tile === TILE.EMPTY ? [index] : [])).toEqual([...expected]);
    });

    it.each([
      { start: [1, 3], end: [13, 3], count: 13 },
      { start: [13, 3], end: [1, 3], count: 13 },
      { start: [1, 1], end: [13, 13], count: 13 },
      { start: [13, 13], end: [1, 1], count: 13 },
      { start: [-3, 3], end: [13, 3], count: 14 },
      { start: [13, 3], end: [-3, 3], count: 14 },
      { start: [13, 13], end: [22, 22], count: 2 },
      { start: [22, 22], end: [13, 13], count: 2 },
    ])("rasterizes sparse paint/erase $start -> $end as one undo", ({ start, end, count }) => {
      const mapId = seedTiles(TILE.EMPTY);
      const scene = createEditSceneHarness();
      editorState.set({ selectedTile: TILE.GRASS });
      const before = [...store.getCurrent().maps[mapId].lowerTiles];
      scene.applyAtPointer(pointerAt(start[0], start[1]));
      scene.applyAtPointer(pointerAt(end[0], end[1]));
      const painted = store.getCurrent().maps[mapId].lowerTiles;
      expect(painted.filter((tile) => tile === TILE.GRASS)).toHaveLength(count);
      const map = store.getCurrent().maps[mapId];
      const expectedIndices = Array.from({ length: count }, (_, index) => {
        const x = Math.max(0, Math.min(start[0], end[0])) + index;
        const y = start[1] === end[1] ? start[1] : x;
        return y * map.width + x;
      });
      expect(painted.flatMap((tile, index) => tile === TILE.GRASS ? [index] : [])).toEqual(expectedIndices);
      expect(historyKinds()).toEqual([{ kind: "map", mapId }]);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(before);
      expect(redoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(painted);
      scene.lastPaintKey = "";
      editorState.set({ tool: "erase" });
      scene.applyAtPointer(pointerAt(start[0], start[1]));
      scene.applyAtPointer(pointerAt(end[0], end[1]));
      expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(before);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(painted);
    });

    it.each(["paint", "fill", "erase"] as const)("preserves redo and undo after no-op %s", (tool) => {
      const mapId = seedTiles(TILE.EMPTY);
      const scene = createEditSceneHarness();
      editorState.set({ selectedTile: TILE.GRASS });
      scene.applyAtPointer(pointerAt(2, 2));
      const edited = [...store.getCurrent().maps[mapId].lowerTiles];
      expect(undoMapEdit()).toBe(true);
      scene.lastPaintKey = "";
      editorState.set({ tool, layer: "upper", selectedTile: TILE.EMPTY });
      scene.applyAtPointer(pointerAt(4, 4));
      expect(getMapEditHistoryState()).toEqual({ canUndo: false, canRedo: true });
      expect(redoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(edited);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
    });

    it.each(["paint", "fill"] as const)("preserves both stacks when %s repeats an existing nonempty lower tile", (tool) => {
      const mapId = seedTiles(TILE.GRASS);
      const scene = createEditSceneHarness();
      editorState.set({ selectedTile: TILE.WATER });
      scene.applyAtPointer(pointerAt(2, 2));
      const firstEdit = structuredClone(store.getCurrent().maps[mapId]);
      scene.lastPaintKey = "";
      scene.applyAtPointer(pointerAt(3, 3));
      const secondEdit = structuredClone(store.getCurrent().maps[mapId]);
      expect(undoMapEdit()).toBe(true);
      scene.lastPaintKey = "";
      editorState.set({ selectedTile: TILE.GRASS, tool });
      scene.applyAtPointer(pointerAt(8, 8));
      expect(getMapEditHistoryState()).toEqual({ canUndo: true, canRedo: true });
      expect(store.getCurrent().maps[mapId]).toEqual(firstEdit);
      expect(redoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId]).toEqual(secondEdit);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId]).toEqual(firstEdit);
    });

    it("records a stroke whose first cell is a no-op at its first real mutation", () => {
      const mapId = seedTiles(TILE.GRASS);
      store.updateMap(mapId, (map) => { map.lowerTiles[3 * map.width + 5] = TILE.EMPTY; });
      const before = [...store.getCurrent().maps[mapId].lowerTiles];
      editorState.set({ selectedTile: TILE.GRASS });
      const scene = createEditSceneHarness();
      scene.applyAtPointer(pointerAt(1, 3));
      expect(historyKinds()).toEqual([]);
      scene.applyAtPointer(pointerAt(8, 3));
      expect(store.getCurrent().maps[mapId].lowerTiles.every((tile) => tile === TILE.GRASS)).toBe(true);
      expect(historyKinds()).toEqual([{ kind: "map", mapId }]);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(before);
    });

    it("does not interpolate collision or stamp gestures", () => {
      const mapId = seedTiles(TILE.GRASS);
      const tilesetId = store.getCurrent().maps[mapId].tilesetId;
      const before = structuredClone(store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS]);
      const scene = createEditSceneHarness();
      editorState.set({ tool: "collision" });
      scene.applyAtPointer(pointerAt(1, 3));
      scene.applyAtPointer(pointerAt(13, 3));
      expect(store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS]).toEqual(before);
      scene.lastPaintKey = "";
      editorState.set({ tool: "paint", activePaletteStamp: {
        width: 1, height: 1, cells: [{ dx: 0, dy: 0, layer: "upper", tile: TILE.FLOWERS }],
        source: { startTile: TILE.FLOWERS, endTile: TILE.FLOWERS },
      } });
      scene.applyAtPointer(pointerAt(1, 3));
      scene.applyAtPointer(pointerAt(13, 3));
      // 타일은 자기 홈 레이어로 놓인다(effectiveLayer). FLOWERS 의 홈이 lower 여도 도장 칸의 "upper" 요청이 거기로 가므로
      // 두 레이어를 합쳐 센다 — 이 단언이 보는 것은 도장이 두 지점에 한 번씩 찍혔다는 점이다.
      const placed = store.getCurrent().maps[mapId];
      expect([...placed.lowerTiles, ...placed.upperTiles].filter((tile) => tile === TILE.FLOWERS)).toHaveLength(2);
    });
  });
  describe("EditScene paint undo history", () => {
    it.each([
      { tool: "paint", setup: (_mapId: MapId) => {} },
      { tool: "fill", setup: (_mapId: MapId) => {} },
      {
        tool: "erase",
        setup: (mapId: MapId) => {
          paintTile(mapId, "lower", 2, 2, TILE.WATER);
          resetMapEditHistory();
        },
      },
      {
        tool: "collision",
        setup: (mapId: MapId) => {
          paintTile(mapId, "lower", 2, 2, TILE.GRASS);
          resetMapEditHistory();
        },
      },
    ] as const)("records $tool canvas edits as map-kind snapshots", async ({ tool, setup }) => {
      const mapId = store.getCurrent().startMapId;
      setup(mapId);
      editorState.set({ currentMapId: mapId, tool });
      const scene = createEditSceneHarness();

      scene.applyAtPointer(pointerAt(2, 2));

      expect(historyKinds()).toEqual([{ kind: "map", mapId }]);
    });

    it("restores a brush stroke through map-kind undo", async () => {
      const mapId = store.getCurrent().startMapId;
      const scene = createEditSceneHarness();
      const before = [...store.getCurrent().maps[mapId].lowerTiles];

      scene.applyAtPointer(pointerAt(2, 2));
      expect(historyKinds()).toEqual([{ kind: "map", mapId }]);

      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(before);
    });

    it("restores collision paint through map-kind undo", async () => {
      const mapId = store.getCurrent().startMapId;
      paintTile(mapId, "lower", 2, 2, TILE.GRASS);
      resetMapEditHistory();
      editorState.set({ currentMapId: mapId, tool: "collision" });
      const scene = createEditSceneHarness();
      const tilesetId = store.getCurrent().maps[mapId].tilesetId;
      const before = { ...store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS] };

      scene.applyAtPointer(pointerAt(2, 2));
      expect(historyKinds()).toEqual([{ kind: "map", mapId }]);
      expect(store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS]).not.toEqual(before);

      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS]).toEqual(before);
    });
  });
});

describe("editSceneStoreRender", () => {
  isolateTimers();
  let prototype: object;
  beforeAll(async () => {
    // getLoadedPhaser() 는 모듈 로드 시점에 window.Phaser 를 읽고, phaser 자체는 document.documentElement 를
    // 읽는다 — 손으로 만든 window/document 스텁으론 모자라 happy-dom 의 실제 window 를 쓴다.
    (window as unknown as { Phaser: unknown }).Phaser = { Scene: class Scene {} };
    prototype = (await import("@/editor/EditScene")).EditScene.prototype;
  }, 90_000);
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => vi.unstubAllGlobals());
  it.each([
    { mapId: "other", renders: 0, cells: 0 },
    { mapId: "current", renders: 1, cells: 1 },
  ])("store change in $mapId renders $renders frame(s)", ({ mapId, renders, cells }) => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const render = vi.fn();
    const game: EditRenderGateGame = {
      pendingDestroy: false, isPaused: false, runDestroy() {}, events: new EventEmitter(),
      scene: { update() {}, render }, renderer: { preRender() {}, postRender() {} },
      loop: { started: false, callback() {} }, step() {},
    };
    installEditRenderGate(game, { PRE_STEP: "pre", STEP: "step", POST_STEP: "post", PRE_RENDER: "preRender", POST_RENDER: "postRender", DESTROY: "destroy", VISIBLE: "visible", RESUME: "resume" });
    game.step(now, 16);
    now = 600;
    const redrawCells = vi.fn();
    const scene = Object.assign(Object.create(prototype), {
      game, mapId: () => "current", eventLayerClickFeedback: null,
      canIncrementallyRenderCells: () => true, redrawCells,
    }) as { redrawForStoreChange(change: ProjectChangeDescriptor): void };
    render.mockClear();
    scene.redrawForStoreChange({ scope: "map", mapId, cells: [{ x: 2, y: 3, layer: "lower" }] });
    game.step(now, 16);
    now += 16;
    game.step(now, 16);
    expect(render).toHaveBeenCalledTimes(renders);
    expect(redrawCells).toHaveBeenCalledTimes(cells);
  });
});

describe("editSceneTextureRedraw", () => {
  isolateTimers();
  type TextureScene = {
    initTextureRedraw(): void;
    requestTextureRedraw(): void;
    cancelTextureRedraw(): void;
    redrawForStoreChange(change: ProjectChangeDescriptor): void;
    redraw: ReturnType<typeof vi.fn>;
  };
  let prototype: TextureScene;
  let Scene: new () => TextureScene;
  let scene: TextureScene;
  let frames: Map<number, FrameRequestCallback>;
  let callbacks: (() => void)[];
  let nextId: number;
  let bundled: typeof import("@/assets/bundled");
  let sprites: typeof import("@/assets/uploadedEventSprites");
  let tilesets: typeof import("@/assets/uploadedTilesets");
  beforeAll(async () => {
    // getLoadedPhaser() 는 모듈 로드 시점에 window.Phaser 를 읽고, phaser 자체는 document.documentElement 를
    // 읽는다 — 손으로 만든 window/document 스텁으론 모자라 happy-dom 의 실제 window 를 쓴다.
    (window as unknown as { Phaser: unknown }).Phaser = { Scene: class Scene {} };
    Scene = (await import("@/editor/EditScene")).EditScene as unknown as new () => TextureScene;
    prototype = Scene.prototype;
    bundled = await import("@/assets/bundled");
    sprites = await import("@/assets/uploadedEventSprites");
    tilesets = await import("@/assets/uploadedTilesets");
  }, 90_000);
  beforeEach(() => {
    frames = new Map(); callbacks = []; nextId = 0;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextId, callback);
      return nextId;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
    vi.spyOn(renderGate, "requestEditRenderFrame").mockImplementation(() => {});
    vi.spyOn(bundled, "ensureUploadedCharsetTextures").mockImplementation((_scene, _project, ready) => { callbacks.push(ready); });
    vi.spyOn(bundled, "ensureBundledProjectTextures").mockImplementation((_scene, _project, ready) => { callbacks.push(ready); });
    vi.spyOn(sprites, "ensureUploadedEventSpriteTextures").mockImplementation((_scene, _project, ready) => { callbacks.push(ready); });
    vi.spyOn(tilesets, "ensureUploadedTilesetTextures").mockImplementation((_scene, _project, ready) => { callbacks.push(ready); });
    scene = Object.assign(new Scene(), {
      game: {}, mapId: () => "current", eventLayerClickFeedback: null,
      canIncrementallyRenderCells: () => false, redraw: vi.fn(),
    });
    scene.initTextureRedraw();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => vi.unstubAllGlobals());
  function frame(): void {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(16));
  }
  it("coalesces 84 asynchronous completions across all four store loaders", async () => {
    scene.redrawForStoreChange({ scope: "project" });
    expect(scene.redraw).toHaveBeenCalledTimes(1); // store redraw remains synchronous
    expect(callbacks).toHaveLength(4);
    scene.redraw.mockClear();
    vi.mocked(renderGate.requestEditRenderFrame).mockClear();
    await Promise.all(Array.from({ length: 84 }, (_, i) => Promise.resolve().then(callbacks[i % 4])));
    expect(frames.size).toBe(1);
    expect(scene.redraw).not.toHaveBeenCalled();
    frame();
    expect(scene.redraw).toHaveBeenCalledTimes(1);
    expect(renderGate.requestEditRenderFrame).toHaveBeenCalledTimes(1);
  });
  it("uses the same scheduler for map-switch tileset completion", () => {
    Object.assign(scene, {
      clearHoverPreview() {}, clearAgentFocusHighlight() {}, clearEventLayerClickFeedback() {},
      cancelCameraFocus() {}, renderStateKey: () => "", viewChromeKey: () => "", cameraViewKey: () => "",
    });
    prototype.redraw.call(scene);
    expect(callbacks).toHaveLength(1);
    expect(callbacks[0]).toBe(scene.requestTextureRedraw);
    callbacks[0]();
    scene.requestTextureRedraw();
    frame();
    expect(scene.redraw).toHaveBeenCalledTimes(1);
  });
  it("cancels queued redraw and ignores late completions after disposal", () => {
    const lateCompletion = scene.requestTextureRedraw;
    lateCompletion();
    const queuedFrame = [...frames.values()][0];
    scene.cancelTextureRedraw();
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    lateCompletion();
    queuedFrame(16); // even a callback already dispatched by the browser is harmless
    expect(frames.size).toBe(0);
    expect(scene.redraw).not.toHaveBeenCalled();
  });
  it("lets reused pending loaders redraw a restarted scene but rejects its old frame", () => {
    const pendingCompletion = scene.requestTextureRedraw;
    pendingCompletion();
    const oldFrame = [...frames.values()][0];
    scene.initTextureRedraw();
    expect(frames.size).toBe(0);
    pendingCompletion(); // scene-keyed pending loaders retain this callback across restart
    expect(frames.size).toBe(1);
    oldFrame(16);
    expect(scene.redraw).not.toHaveBeenCalled();
    scene.requestTextureRedraw();
    expect(frames.size).toBe(1); // stale frame must not clear the new reservation
    frame();
    expect(scene.redraw).toHaveBeenCalledTimes(1);
  });
  it("redraws later completions on the next frame", () => {
    for (let batch = 0; batch < 2; batch++) {
      for (let i = 0; i < 42; i++) scene.requestTextureRedraw();
      expect(frames.size).toBe(1);
      frame();
    }
    expect(scene.redraw).toHaveBeenCalledTimes(2);
  });
  it("keeps a redraw requested during redraw for the following frame", () => {
    scene.redraw.mockImplementationOnce(() => scene.requestTextureRedraw());
    scene.requestTextureRedraw();
    frame();
    expect(frames.size).toBe(1);
    frame();
    expect(scene.redraw).toHaveBeenCalledTimes(2);
  });
});
