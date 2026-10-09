// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { captureFormSurface } from "./eventEditorFormSurface";
import { captureInteractionSurface } from "./eventEditorInteractionSurface";
import { probeCommandControls } from "./eventEditorCommitProbe";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  vi.stubGlobal("Image", class {
    addEventListener(): void {}
    set src(_value: string) {}
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("stops the animation interval after harvesting a detached command form", () => {
  const scheduled = vi.spyOn(window, "setInterval");
  const cleared = vi.spyOn(window, "clearInterval");
  const before = vi.getTimerCount();

  const surface = captureFormSurface("showAnimation");

  expect(surface.error).toBeUndefined();
  expect(surface.controls["show-animation-play"]).toBe("button{}");
  expect(scheduled).toHaveBeenCalledTimes(1);
  const timer = scheduled.mock.results[0];
  if (timer?.type !== "return") throw new Error("Animation timer was not scheduled");
  expect(cleared).toHaveBeenCalledWith(timer.value);
  expect(vi.getTimerCount()).toBe(before);
});

it("releases intervals started by interaction-driven preview changes", () => {
  const before = vi.getTimerCount();
  const surface = captureInteractionSurface(MINIMAL_COMMANDS.showAnimation, "showAnimation");
  expect(surface.error).toBeUndefined();
  expect(surface.reactions).toHaveProperty("show-animation-animationId-select");
  expect(vi.getTimerCount()).toBe(before);
});

it("keeps commit probes static even when a browser window already exists", () => {
  const before = vi.getTimerCount();
  const schedule = window.setInterval;
  const run = probeCommandControls(MINIMAL_COMMANDS.showAnimation);
  expect(run.error).toBeUndefined();
  expect(run.results.some(result => result.key === "show-animation-animationId-select")).toBe(true);
  expect(window.setInterval).toBe(schedule);
  expect(vi.getTimerCount()).toBe(before);
});
