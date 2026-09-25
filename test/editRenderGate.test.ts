import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDIT_RENDER_IDLE_HEARTBEAT_MS,
  EDIT_RENDER_IDLE_MS,
  editRenderGateStats,
  installEditRenderGate,
  markEditRenderActive,
  requestEditRenderFrame,
  type EditRenderGateGame,
} from "@/editor/editRenderGate";

const EVENTS = {
  PRE_STEP: "prestep",
  STEP: "step",
  POST_STEP: "poststep",
  PRE_RENDER: "prerender",
  POST_RENDER: "postrender",
  DESTROY: "destroy",
  VISIBLE: "visible",
  RESUME: "resume",
};

let clock = 0;

function fakeGame() {
  const calls = { update: 0, preRender: 0, render: 0, postRender: 0, preRenderEvents: 0 };
  const events = new EventEmitter();
  events.on(EVENTS.PRE_RENDER, () => { calls.preRenderEvents += 1; });
  const game = {
    pendingDestroy: false,
    isPaused: false,
    runDestroy: () => events.emit(EVENTS.DESTROY),
    events,
    scene: {
      update: () => { calls.update += 1; },
      render: () => { calls.render += 1; },
    },
    renderer: {
      preRender: () => { calls.preRender += 1; },
      postRender: () => { calls.postRender += 1; },
    },
    loop: { started: false, callback: () => undefined },
    step: () => { throw new Error("original step must be replaced"); },
  } satisfies EditRenderGateGame;
  return { game, calls };
}

function frame(game: EditRenderGateGame, ms = 16): void {
  clock += ms;
  game.step(clock, ms);
}

describe("editRenderGate", () => {
  beforeEach(() => {
    clock = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders while active, then only updates once idle", () => {
    const { game, calls } = fakeGame();
    installEditRenderGate(game, EVENTS);
    frame(game);
    expect(calls.render).toBe(1);
    clock += EDIT_RENDER_IDLE_MS;
    frame(game);
    frame(game);
    expect(calls.update).toBe(3);
    expect(calls.render).toBe(1);
    expect(calls.preRender).toBe(1);
    expect(calls.postRender).toBe(1);
    // 입력 폴링은 그리지 않는 프레임에도 돈다.
    expect(calls.preRenderEvents).toBe(3);
    expect(editRenderGateStats(game)).toEqual({ renderedFrames: 1, skippedFrames: 2 });
  });

  it("wakes for an active window, and a frame request renders exactly once", () => {
    const { game, calls } = fakeGame();
    installEditRenderGate(game, EVENTS);
    frame(game);
    clock += EDIT_RENDER_IDLE_MS;
    frame(game);
    expect(calls.render).toBe(1);

    requestEditRenderFrame(game);
    frame(game);
    frame(game);
    expect(calls.render).toBe(2);

    markEditRenderActive(game);
    frame(game);
    frame(game);
    expect(calls.render).toBe(4);
  });

  it("keeps a heartbeat render while idle", () => {
    const { game, calls } = fakeGame();
    installEditRenderGate(game, EVENTS);
    frame(game);
    clock += EDIT_RENDER_IDLE_MS;
    frame(game);
    expect(calls.render).toBe(1);
    clock += EDIT_RENDER_IDLE_HEARTBEAT_MS;
    frame(game);
    expect(calls.render).toBe(2);
  });

  it("replaces an already started loop callback and still honours pause/destroy", () => {
    const { game, calls } = fakeGame();
    game.loop.started = true;
    installEditRenderGate(game, EVENTS);
    game.loop.callback(clock, 16);
    expect(calls.render).toBe(1);

    game.isPaused = true;
    frame(game);
    expect(calls.update).toBe(1);

    game.isPaused = false;
    game.pendingDestroy = true;
    frame(game);
    expect(calls.update).toBe(1);
    expect(editRenderGateStats(game)).toBeNull();
  });

  it("wakes on game visibility events", () => {
    const { game, calls } = fakeGame();
    installEditRenderGate(game, EVENTS);
    frame(game);
    clock += EDIT_RENDER_IDLE_MS;
    frame(game);
    game.events.emit(EVENTS.VISIBLE);
    frame(game);
    expect(calls.render).toBe(2);
  });

  it("is a no-op for games without a gate", () => {
    expect(() => markEditRenderActive({})).not.toThrow();
    expect(() => requestEditRenderFrame(undefined)).not.toThrow();
    expect(editRenderGateStats({})).toBeNull();
  });
});
