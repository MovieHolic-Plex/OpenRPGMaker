/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The title does not need Phaser; audio and the player shell remain real.
vi.mock("@/app/mode", () => ({ startPlayGame: vi.fn(), destroyGame: vi.fn() }));
vi.mock("@/project/store", () => import("@/player/exportProjectStoreShim"));
vi.mock("@/assets/bundledAssetWarmup", () => ({ warmBundledPlayAssets: vi.fn() }));
import { renderPlayer, teardownPlayer } from "@/player/player";
import { getAudioEngine, audioStateSnapshot } from "@/player/audio";
import { setExportedProject } from "@/player/exportProjectStoreShim";
import { createBlankProject } from "@/project/defaults";

let main: HTMLElement;
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  setExportedProject(createBlankProject());
  main = document.createElement("main");
  document.body.append(main);
});
afterEach(() => {
  teardownPlayer();
  getAudioEngine().stopAll();
  main.remove();
  Reflect.deleteProperty(window, "__oprnAudioState");
  Reflect.deleteProperty(window, "__oprnAudioObserved");
  vi.restoreAllMocks();
});

function qaGlobals(): string[] {
  return ["__oprnAudioState", "__oprnAudioObserved"].filter(key => Object.hasOwn(window, key));
}

describe("player shell audio observation ownership", () => {
  for (const nextCapability of [undefined, false]) {
    it(`cleans an enabled shell before replacement with ${nextCapability}`, () => {
      renderPlayer(main, { qaInstrumentation: true });
      expect(qaGlobals()).toEqual(["__oprnAudioState", "__oprnAudioObserved"]);
      const engine = getAudioEngine();
      const state = audioStateSnapshot();
      renderPlayer(main, nextCapability === undefined ? {} : { qaInstrumentation: nextCapability });
      expect(qaGlobals()).toEqual([]);
      expect(getAudioEngine()).toBe(engine);
      expect(audioStateSnapshot()).toEqual(state);
      engine.unlock();
      engine.play("se", "off", "/off.wav", false);
      expect(qaGlobals()).toEqual([]);
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
      expect(main.querySelector('[data-testid="title-screen"]')).not.toBeNull();
    });
  }
  it("releases observation on teardown and can opt in on the next shell", () => {
    renderPlayer(main, { qaInstrumentation: true });
    expect(qaGlobals()).toEqual(["__oprnAudioState", "__oprnAudioObserved"]);
    teardownPlayer();
    expect(qaGlobals()).toEqual([]);
    renderPlayer(main, { qaInstrumentation: true });
    expect(qaGlobals()).toEqual(["__oprnAudioState", "__oprnAudioObserved"]);
  });
});
