import { EventEmitter } from "node:events";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { installEditRenderGate, type EditRenderGateGame } from "@/editor/editRenderGate";
import type { ProjectChangeDescriptor } from "@/project/store";

let prototype: object;
beforeAll(async () => {
  vi.stubGlobal("window", {
    Phaser: { Scene: class {} }, location: { search: "" },
    addEventListener() {}, removeEventListener() {},
  });
  vi.stubGlobal("document", { querySelector: () => null });
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
