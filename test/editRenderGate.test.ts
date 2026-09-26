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

  describe("window input wake", () => {
    type Listener = (event: Event) => void;
    let listeners: Map<string, Listener[]>;
    const originalWindow = (globalThis as { window?: unknown }).window;
    const originalHTMLElement = (globalThis as { HTMLElement?: unknown }).HTMLElement;
    const originalNode = (globalThis as { Node?: unknown }).Node;

    class FakeNode {
      constructor(readonly parent: FakeNode | null = null, readonly tagName = "DIV") {}
      contains(other: FakeNode | null): boolean {
        for (let at = other; at; at = at.parent) if (at === this) return true;
        return false;
      }
    }
    class FakeElement extends FakeNode { isContentEditable = false; }

    beforeEach(() => {
      listeners = new Map();
      (globalThis as { window?: unknown }).window = {
        addEventListener: (type: string, fn: Listener) => { listeners.set(type, [...(listeners.get(type) ?? []), fn]); },
        removeEventListener: () => undefined,
      };
      (globalThis as { Node?: unknown }).Node = FakeNode;
      (globalThis as { HTMLElement?: unknown }).HTMLElement = FakeElement;
    });
    afterEach(() => {
      (globalThis as { window?: unknown }).window = originalWindow;
      (globalThis as { HTMLElement?: unknown }).HTMLElement = originalHTMLElement;
      (globalThis as { Node?: unknown }).Node = originalNode;
    });

    const fire = (type: string, target: FakeNode, buttons = 0): void => {
      for (const fn of listeners.get(type) ?? []) fn({ type, target, buttons } as unknown as Event);
    };

    function idleGameWithCanvas() {
      const { game, calls } = fakeGame();
      const host = new FakeElement();
      const canvas = new FakeElement(host, "CANVAS");
      const withCanvas = Object.assign(game, { canvas: Object.assign(canvas, { parentElement: host, addEventListener: () => undefined, removeEventListener: () => undefined }) });
      installEditRenderGate(withCanvas as unknown as EditRenderGateGame, EVENTS);
      frame(withCanvas);
      clock += EDIT_RENDER_IDLE_MS;
      frame(withCanvas);
      expect(calls.render).toBe(1);
      return { game: withCanvas, calls, host, canvas };
    }

    it("does not wake for a pressed pointer that started in the sidebar", () => {
      const { game, calls } = idleGameWithCanvas();
      const sidebarButton = new FakeElement();
      fire("pointerdown", sidebarButton, 1);
      fire("pointermove", sidebarButton, 1);
      fire("pointerup", sidebarButton, 0);
      frame(game);
      expect(calls.render).toBe(1);
    });

    it("keeps waking while a canvas-started stroke leaves the canvas", () => {
      const { game, calls, canvas } = idleGameWithCanvas();
      const outside = new FakeElement();
      fire("pointerdown", canvas, 1);
      clock += EDIT_RENDER_IDLE_MS;
      fire("pointermove", outside, 1);
      frame(game);
      expect(calls.render).toBe(2);
      clock += EDIT_RENDER_IDLE_MS;
      fire("pointerup", outside, 0);
      frame(game);
      expect(calls.render).toBe(3);
      // 획이 끝난 뒤 바깥에서 누른 포인터는 다시 깨우지 않는다.
      clock += EDIT_RENDER_IDLE_MS;
      fire("pointermove", outside, 1);
      frame(game);
      expect(calls.render).toBe(3);
    });

    it("ignores typing in text fields but wakes for shortcut keys", () => {
      const { game, calls } = idleGameWithCanvas();
      fire("keydown", new FakeElement(null, "INPUT"));
      frame(game);
      expect(calls.render).toBe(1);
      fire("keydown", new FakeElement(null, "BODY"));
      frame(game);
      expect(calls.render).toBe(2);
    });
  });
});
