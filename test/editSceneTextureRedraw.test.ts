import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as renderGate from "@/editor/editRenderGate";
import type { ProjectChangeDescriptor } from "@/project/store";

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
  vi.stubGlobal("window", {
    Phaser: { Scene: class {} }, location: { search: "" },
    addEventListener() {}, removeEventListener() {},
  });
  vi.stubGlobal("document", { querySelector: () => null });
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
  // 맵 전환은 업로드 시트와 번들 시트를 같이 싣는다. 완료 콜백은 같은 한 프레임으로 모인다.
  expect(callbacks).toHaveLength(2);
  expect(callbacks.every((callback) => callback === scene.requestTextureRedraw)).toBe(true);
  callbacks[0]!();
  scene.requestTextureRedraw();
  frame();
  expect(scene.redraw).toHaveBeenCalledTimes(1);
});

it("loads bundled chipsets when a map change is not a tile stroke", () => {
  scene.redrawForStoreChange({ scope: "map", mapId: "current" });
  expect(bundled.ensureBundledProjectTextures).toHaveBeenCalledTimes(1);
  expect(tilesets.ensureUploadedTilesetTextures).toHaveBeenCalledTimes(1);
});

it("loads bundled chipsets when an event graphic is added without tile cells", () => {
  scene.redrawForStoreChange({ scope: "map", mapId: "current", eventId: "event-1" });
  expect(bundled.ensureBundledProjectTextures).toHaveBeenCalledTimes(1);
});

it("does not scan textures on a tile stroke or a relief sample", () => {
  scene.redrawForStoreChange({ scope: "map", mapId: "current", cells: [{ x: 1, y: 2, layer: "lower" }] });
  scene.redrawForStoreChange({ scope: "map", mapId: "current", relief: true });
  expect(bundled.ensureBundledProjectTextures).not.toHaveBeenCalled();
  expect(tilesets.ensureUploadedTilesetTextures).not.toHaveBeenCalled();
  expect(bundled.ensureUploadedCharsetTextures).not.toHaveBeenCalled();
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
