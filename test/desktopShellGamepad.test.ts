// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { gamepadStickSector, installDesktopShellBridge } from "@/player/desktopShellBridge";
import { stickSectorKeys } from "@/player/touchPad";

/**
 * One physical pad press must be one key event. The shell used to dispatch a
 * second copy straight onto window, so battle/tactics confirmed twice.
 */
describe("desktop shell gamepad", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()?.();
  });

  it("sends one confirm keydown per press, and that event keeps the focused target", () => {
    const frames: FrameRequestCallback[] = [];
    const restoreRaf = stubAnimationFrame(frames);
    cleanups.push(restoreRaf);

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    cleanups.push(() => input.remove());

    let southPressed = false;
    const restorePads = stubGamepads(() => [gamepad(southPressed)]);
    cleanups.push(restorePads);

    const windowEvents: KeyboardEvent[] = [];
    const documentEvents: KeyboardEvent[] = [];
    const onWindow = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "Enter") windowEvents.push(event);
    };
    const onDocument = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "Enter") documentEvents.push(event);
    };
    window.addEventListener("keydown", onWindow);
    document.addEventListener("keydown", onDocument);
    cleanups.push(() => {
      window.removeEventListener("keydown", onWindow);
      document.removeEventListener("keydown", onDocument);
    });

    const cleanup = installDesktopShellBridge(document.body, { gamepadPolling: true });
    cleanups.push(cleanup);

    flushFrame(frames);
    expect(windowEvents).toHaveLength(0);

    southPressed = true;
    flushFrame(frames);
    expect(windowEvents).toHaveLength(1);
    expect(documentEvents).toHaveLength(1);
    expect(windowEvents[0]).toBe(documentEvents[0]);
    expect(windowEvents[0]?.target).toBe(input);

    // Held button must not repeat a confirm.
    flushFrame(frames);
    expect(windowEvents).toHaveLength(1);

    const keyups: KeyboardEvent[] = [];
    const onKeyUp = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "Enter") keyups.push(event);
    };
    window.addEventListener("keyup", onKeyUp);
    cleanups.push(() => window.removeEventListener("keyup", onKeyUp));

    southPressed = false;
    flushFrame(frames);
    expect(keyups).toHaveLength(1);
    expect(keyups[0]?.target).toBe(input);
  });

  it("releases a held button when the pad disconnects, even if that event clears the connected flag first", () => {
    const frames: FrameRequestCallback[] = [];
    const restoreRaf = stubAnimationFrame(frames);
    cleanups.push(restoreRaf);

    let pad: Gamepad | null = gamepad(false);
    const restorePads = stubGamepads(() => [pad]);
    cleanups.push(restorePads);

    const keydowns: KeyboardEvent[] = [];
    const keyups: KeyboardEvent[] = [];
    const onKeyDown = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "ArrowLeft") keydowns.push(event);
    };
    const onKeyUp = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "ArrowLeft") keyups.push(event);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    cleanups.push(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    });

    const cleanup = installDesktopShellBridge(document.body, { gamepadPolling: true });
    cleanups.push(cleanup);

    flushFrame(frames);
    pad = gamepadWithStick(-1, 0);
    flushFrame(frames);
    expect(keydowns).toHaveLength(1);
    expect(window.__oprnDesktopShellState?.gamepadConnected).toBe(true);

    // The disconnect event used to clear gamepadConnected and skip the poll's
    // keyup, so the character kept walking after the controller dropped.
    pad = null;
    window.dispatchEvent(new Event("gamepaddisconnected"));
    expect(keyups).toHaveLength(1);
    expect(window.__oprnDesktopShellState?.gamepadConnected).toBe(false);

    flushFrame(frames);
    expect(keyups).toHaveLength(1);

    // Still holding the stick when the pad comes back starts walking again.
    pad = gamepadWithStick(-1, 0);
    flushFrame(frames);
    expect(keydowns).toHaveLength(2);
    expect(keyups).toHaveLength(1);
  });

  it("releases a held stick on the next poll if the connected flag was cleared without a keyup", () => {
    const frames: FrameRequestCallback[] = [];
    const restoreRaf = stubAnimationFrame(frames);
    cleanups.push(restoreRaf);

    let pad: Gamepad | null = gamepadWithStick(-1, 0);
    const restorePads = stubGamepads(() => [pad]);
    cleanups.push(restorePads);

    const keyups: KeyboardEvent[] = [];
    const onKeyUp = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "ArrowLeft") keyups.push(event);
    };
    window.addEventListener("keyup", onKeyUp);
    cleanups.push(() => window.removeEventListener("keyup", onKeyUp));

    const cleanup = installDesktopShellBridge(document.body, { gamepadPolling: true });
    cleanups.push(cleanup);

    flushFrame(frames);
    expect(window.__oprnDesktopShellState?.gamepadConnected).toBe(true);

    // The disconnect listener used to do only this, then the poll skipped keyup.
    const state = window.__oprnDesktopShellState;
    if (state) state.gamepadConnected = false;
    pad = null;
    flushFrame(frames);
    expect(keyups).toHaveLength(1);
  });

  it("releases a held button when polling stops", () => {
    const frames: FrameRequestCallback[] = [];
    const restoreRaf = stubAnimationFrame(frames);
    cleanups.push(restoreRaf);

    let southPressed = false;
    const restorePads = stubGamepads(() => [gamepad(southPressed)]);
    cleanups.push(restorePads);

    const keyups: KeyboardEvent[] = [];
    const onKeyUp = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "Enter") keyups.push(event);
    };
    window.addEventListener("keyup", onKeyUp);
    cleanups.push(() => window.removeEventListener("keyup", onKeyUp));

    const cleanup = installDesktopShellBridge(document.body, { gamepadPolling: true });
    cleanups.push(cleanup);

    flushFrame(frames);
    southPressed = true;
    flushFrame(frames);

    cleanup();
    expect(keyups).toHaveLength(1);
  });

  it("repeats a held direction like a keyboard key and keeps a held confirm as one edge", () => {
    const frames: FrameRequestCallback[] = [];
    const restoreRaf = stubAnimationFrame(frames);
    cleanups.push(restoreRaf);

    let now = 1_000;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    cleanups.push(() => nowSpy.mockRestore());

    let axisY = 0;
    let southPressed = false;
    const restorePads = stubGamepads(() => [gamepadWithStick(0, axisY, southPressed)]);
    cleanups.push(restorePads);

    const downs: KeyboardEvent[] = [];
    const onKeyDown = (event: Event): void => {
      if (event instanceof KeyboardEvent) downs.push(event);
    };
    window.addEventListener("keydown", onKeyDown);
    cleanups.push(() => window.removeEventListener("keydown", onKeyDown));

    const cleanup = installDesktopShellBridge(document.body, { gamepadPolling: true });
    cleanups.push(cleanup);

    flushFrame(frames);
    axisY = 1;
    southPressed = true;
    flushFrame(frames);
    expect(downs.map((event) => `${event.key}:${event.repeat}`)).toEqual(["Enter:false", "ArrowDown:false"]);

    now = 1_400;
    flushFrame(frames);
    expect(downs).toHaveLength(2);

    now = 1_500;
    flushFrame(frames);
    expect(downs.map((event) => `${event.key}:${event.repeat}`)).toEqual([
      "Enter:false",
      "ArrowDown:false",
      "ArrowDown:true",
    ]);

    now = 1_520;
    flushFrame(frames);
    expect(downs).toHaveLength(3);

    now = 1_533;
    flushFrame(frames);
    expect(downs.filter((event) => event.key === "ArrowDown" && event.repeat)).toHaveLength(2);
    expect(downs.filter((event) => event.key === "Enter")).toHaveLength(1);

    axisY = 0;
    const beforeRelease = downs.length;
    now = 4_000;
    flushFrame(frames);
    // 엣지 1 + 반복 2 = ArrowDown 3. 위 단언들(1520 길이 3 · 1533 반복 2)이 그 둘을 이미 고정하므로
    // 총 keydown 은 Enter 까지 4 다 — 이 자리에서 4 를 기대하던 것은 총 개수와 ArrowDown 개수를 혼동한 것이다.
    expect(downs.filter((event) => event.key === "ArrowDown")).toHaveLength(3);
    expect(downs.filter((event) => event.key === "Enter")).toHaveLength(1);
    // 릴리스 프레임이 새 keydown 을 만들지 않아야 "반복이 멈춘다" 가 증명된다.
    expect(downs).toHaveLength(beforeRelease);

    now = 5_000;
    flushFrame(frames);
    expect(downs).toHaveLength(beforeRelease);
    expect(downs.filter((event) => event.key === "Enter")).toHaveLength(1);
  });

  it("releases a tilted stick when the window blurs and presses it again when focus returns", () => {
  it("reads a 45° stick inside the old per-axis box, and keeps one cardinal when the tilt is slight", () => {
    // 0.42 on both axes is magnitude ~0.59, but each axis is under the old 0.45 gate.
    expect([...stickSectorKeys(gamepadStickSector(0.42, 0.42, null))].sort()).toEqual(["ArrowDown", "ArrowRight"]);
    expect(gamepadStickSector(0.3, 0.3, null)).toBeNull();
    expect([...stickSectorKeys(gamepadStickSector(0.8, 0.15, null))]).toEqual(["ArrowRight"]);
    const held = gamepadStickSector(1, 0, null);
    expect(gamepadStickSector(0.35, 0, held)).toBe(held);
    expect(gamepadStickSector(0.2, 0, held)).toBeNull();
  });

  it("sends the diagonal from a half-tilt stick and does not drop it on the rim", () => {    const frames: FrameRequestCallback[] = [];
    const restoreRaf = stubAnimationFrame(frames);
    cleanups.push(restoreRaf);

    let now = 2_000;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    cleanups.push(() => nowSpy.mockRestore());

    let axisX = 0;
    let southPressed = false;
    const restorePads = stubGamepads(() => [gamepadWithStick(axisX, 0, southPressed)]);
    cleanups.push(restorePads);

    const events: KeyboardEvent[] = [];
    const onKey = (event: Event): void => {
      if (event instanceof KeyboardEvent) events.push(event);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    cleanups.push(() => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    let axisX = 0;
    let axisY = 0;
    const restorePads = stubGamepads(() => [gamepadWithStick(axisX, axisY)]);
    cleanups.push(restorePads);

    const downs: KeyboardEvent[] = [];
    const ups: KeyboardEvent[] = [];
    const onKeyDown = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key.startsWith("Arrow")) downs.push(event);
    };
    const onKeyUp = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key.startsWith("Arrow")) ups.push(event);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    cleanups.push(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);    });

    const cleanup = installDesktopShellBridge(document.body, { gamepadPolling: true });
    cleanups.push(cleanup);

    flushFrame(frames);
    axisX = -1;
    southPressed = true;
    flushFrame(frames);
    expect(events.map((event) => `${event.type}:${event.key}:${event.repeat}`)).toEqual([
      "keydown:Enter:false",
      "keydown:ArrowLeft:false",
    ]);

    // Past the repeat delay, but the window is going away before the next poll.
    now = 2_600;
    window.dispatchEvent(new Event("blur"));
    expect(events.map((event) => `${event.type}:${event.key}`)).toEqual([
      "keydown:Enter",
      "keydown:ArrowLeft",
      "keyup:ArrowLeft",
    ]);

    flushFrame(frames);
    expect(events.filter((event) => event.key === "ArrowLeft" && event.type === "keydown")).toHaveLength(1);
    expect(events.filter((event) => event.key === "Enter" && event.type === "keydown")).toHaveLength(1);

    // Releasing A while blurred still produces keyup, and does not repeat the confirm on focus.
    southPressed = false;
    flushFrame(frames);
    expect(events.filter((event) => event.key === "Enter" && event.type === "keyup")).toHaveLength(1);

    window.dispatchEvent(new Event("focus"));
    now = 3_200;
    flushFrame(frames);
    expect(events.filter((event) => event.key === "ArrowLeft" && event.type === "keydown")).toHaveLength(2);
    expect(events.filter((event) => event.key === "ArrowLeft" && event.repeat)).toHaveLength(0);
    expect(events.filter((event) => event.key === "Enter" && event.type === "keydown")).toHaveLength(1);
  });

  it("releases a tilted stick when the page hides and presses it again when the page is visible", () => {
    axisX = 0.42;
    axisY = 0.42;
    flushFrame(frames);
    expect(downs.map((event) => event.key).sort()).toEqual(["ArrowDown", "ArrowRight"]);
    expect(ups).toHaveLength(0);

    // Still outside the hold radius (~0.31), under the old 0.45 axis gate.
    axisX = 0.22;
    axisY = 0.22;
    flushFrame(frames);
    expect(ups).toHaveLength(0);
    expect(downs).toHaveLength(2);

    axisX = 0.1;
    axisY = 0.1;
    flushFrame(frames);
    expect(ups.map((event) => event.key).sort()).toEqual(["ArrowDown", "ArrowRight"]);

    // From rest, a nudge under the enter radius is still neutral.
    axisX = 0.4;
    axisY = 0;
    flushFrame(frames);
    expect(downs).toHaveLength(2);
  });

  it("forgets the stick hold radius when the pad disconnects", () => {    const frames: FrameRequestCallback[] = [];
    const restoreRaf = stubAnimationFrame(frames);
    cleanups.push(restoreRaf);

    const previousVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    const setVisibility = (value: DocumentVisibilityState): void => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value });
    };
    cleanups.push(() => {
      if (previousVisibility) Object.defineProperty(document, "visibilityState", previousVisibility);
      else delete (document as { visibilityState?: unknown }).visibilityState;
    });

    let axisY = 0;
    const restorePads = stubGamepads(() => [gamepadWithStick(0, axisY)]);
    cleanups.push(restorePads);

    const events: KeyboardEvent[] = [];
    const onKey = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "ArrowDown") events.push(event);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    cleanups.push(() => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    });
    let pad: Gamepad | null = gamepadWithStick(-1, 0);
    const restorePads = stubGamepads(() => [pad]);
    cleanups.push(restorePads);

    const downs: KeyboardEvent[] = [];
    const onKeyDown = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "ArrowLeft") downs.push(event);
    };
    window.addEventListener("keydown", onKeyDown);
    cleanups.push(() => window.removeEventListener("keydown", onKeyDown));
    const cleanup = installDesktopShellBridge(document.body, { gamepadPolling: true });
    cleanups.push(cleanup);

    flushFrame(frames);
    axisY = 1;
    flushFrame(frames);
    expect(events.map((event) => event.type)).toEqual(["keydown"]);

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(events.map((event) => event.type)).toEqual(["keydown", "keyup"]);

    flushFrame(frames);
    expect(events).toHaveLength(2);

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    flushFrame(frames);
    expect(events.map((event) => `${event.type}:${event.repeat}`)).toEqual([
      "keydown:false",
      "keyup:false",
      "keydown:false",
    ]);
    expect(downs).toHaveLength(1);

    pad = null;
    window.dispatchEvent(new Event("gamepaddisconnected"));
    // Between the enter radius (0.45) and the hold radius (0.30). Keeping the
    // hold sector across a disconnect would start walking again.
    pad = gamepadWithStick(-0.35, 0);
    flushFrame(frames);
    expect(downs).toHaveLength(1);  });
});

function stubAnimationFrame(frames: FrameRequestCallback[]): () => void {
  const previousRaf = window.requestAnimationFrame;
  const previousCancel = window.cancelAnimationFrame;
  window.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  window.cancelAnimationFrame = () => {};
  return () => {
    window.requestAnimationFrame = previousRaf;
    window.cancelAnimationFrame = previousCancel;
  };
}

function stubGamepads(read: () => readonly (Gamepad | null)[]): () => void {
  const nav = navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] };
  const previous = nav.getGamepads;
  const getGamepads = (): (Gamepad | null)[] => [...read()];
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: getGamepads });
  return () => {
    if (previous) Object.defineProperty(navigator, "getGamepads", { configurable: true, value: previous });
    else delete (navigator as { getGamepads?: unknown }).getGamepads;
  };
}

function gamepad(southPressed: boolean): Gamepad {
  return gamepadWithStick(0, 0, southPressed);
}

function gamepadWithStick(axisX: number, axisY: number, southPressed = false): Gamepad {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 }));
  buttons[0] = { pressed: southPressed, touched: southPressed, value: southPressed ? 1 : 0 };
  return {
    id: "Test Pad",
    index: 0,
    connected: true,
    mapping: "standard",
    axes: [axisX, axisY, 0, 0],
    buttons,
    timestamp: 0,
  } as unknown as Gamepad;
}

function flushFrame(frames: FrameRequestCallback[]): void {
  const callback = frames.shift();
  if (!callback) throw new Error("gamepad poll was not scheduled");
  callback(0);
}
