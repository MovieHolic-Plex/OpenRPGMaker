// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { installDesktopShellBridge } from "@/player/desktopShellBridge";

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
    const restorePads = stubGamepads(() => southPressed);
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

function stubGamepads(southPressed: () => boolean): () => void {
  const nav = navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] };
  const previous = nav.getGamepads;
  const getGamepads = (): (Gamepad | null)[] => [gamepad(southPressed())];
  Object.defineProperty(navigator, "getGamepads", { configurable: true, value: getGamepads });
  return () => {
    if (previous) Object.defineProperty(navigator, "getGamepads", { configurable: true, value: previous });
    else delete (navigator as { getGamepads?: unknown }).getGamepads;
  };
}

function gamepad(southPressed: boolean): Gamepad {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 }));
  buttons[0] = { pressed: southPressed, touched: southPressed, value: southPressed ? 1 : 0 };
  return {
    id: "Test Pad",
    index: 0,
    connected: true,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons,
    timestamp: 0,
  } as unknown as Gamepad;
}

function flushFrame(frames: FrameRequestCallback[]): void {
  const callback = frames.shift();
  if (!callback) throw new Error("gamepad poll was not scheduled");
  callback(0);
}
