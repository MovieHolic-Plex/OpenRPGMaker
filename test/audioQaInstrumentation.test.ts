/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "@/player/audio/audioEngine";

const qaWindow: Window & {
  __oprnAudioState?: () => ReturnType<AudioEngine["audioStateSnapshot"]>;
  __oprnAudioObserved?: string[];
} = window;
const engines: AudioEngine[] = [];

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => {
  for (const engine of engines.splice(0)) {
    engine.stopAll();
    engine.setQaInstrumentation(false);
  }
  delete qaWindow.__oprnAudioState;
  delete qaWindow.__oprnAudioObserved;
  vi.restoreAllMocks();
});

describe("real AudioEngine QA capability", () => {
  for (const qaInstrumentation of [undefined, false, true]) {
    it(`keeps playback and public state with qaInstrumentation=${qaInstrumentation}`, () => {
      const engine = qaInstrumentation === undefined
        ? new AudioEngine()
        : new AudioEngine({ qaInstrumentation });
      engines.push(engine);
      if (qaInstrumentation !== true) {
        expect.soft(Object.hasOwn(window, "__oprnAudioState")).toBe(false);
        expect.soft(Object.hasOwn(window, "__oprnAudioObserved")).toBe(false);
      }
      engine.setVolume("bgm", 0.4);
      engine.play("bgm", "queued", "/queued.wav", true, { fadeInMs: 0, playbackRate: 1.25 });
      expect(document.querySelectorAll("audio")).toHaveLength(0);
      engine.unlock();
      const audio = document.querySelector("audio");
      expect(audio).not.toBeNull();
      expect(audio?.getAttribute("src")).toBe("/queued.wav");
      expect(audio?.loop).toBe(true);
      expect(audio?.volume).toBe(0.4);
      expect(audio?.playbackRate).toBe(1.25);
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
      engine.setVolume("bgm", 0.3);
      engine.setPlaybackRate(0.75);
      expect(audio?.volume).toBe(0.3);
      expect(audio?.playbackRate).toBe(0.75);
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
      expect(engine.audioStateSnapshot()).toEqual({
        volume: { bgm: 0.3, se: 0.8 }, playbackRate: 0.75, pan: 0, fadeInMs: 0,
      });
      if (qaInstrumentation === true) {
        expect(qaWindow.__oprnAudioState?.()).toEqual(engine.audioStateSnapshot());
        expect(qaWindow.__oprnAudioObserved).toEqual(["queued"]);
        const snapshot = qaWindow.__oprnAudioState?.();
        if (!snapshot) throw new Error("missing enabled audio snapshot");
        snapshot.volume.bgm = 1;
        expect(engine.getVolume("bgm")).toBe(0.3);
      } else {
        expect.soft(Object.hasOwn(window, "__oprnAudioState")).toBe(false);
        expect.soft(Object.hasOwn(window, "__oprnAudioObserved")).toBe(false);
      }
      engine.stopAll();
      expect(audio?.isConnected).toBe(false);
      expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    });
  }

  it("revokes only observation, keeps playback, and starts a fresh observation lifetime", () => {
    const engine = new AudioEngine({ qaInstrumentation: true });
    engines.push(engine);
    engine.unlock();
    engine.play("bgm", "first", "/first.wav", true, { fadeInMs: 0 });
    const audio = document.querySelector("audio");
    const observed = qaWindow.__oprnAudioObserved;
    engine.setQaInstrumentation(true);
    expect(qaWindow.__oprnAudioObserved).toBe(observed);
    engine.setQaInstrumentation(false);
    expect(Object.hasOwn(window, "__oprnAudioState")).toBe(false);
    expect(Object.hasOwn(window, "__oprnAudioObserved")).toBe(false);
    expect(audio?.isConnected).toBe(true);
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    engine.play("se", "off-shot", "/shot.wav", false);
    expect(observed).toEqual(["first"]);
    expect(Object.hasOwn(window, "__oprnAudioObserved")).toBe(false);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    engine.setQaInstrumentation(true);
    expect(qaWindow.__oprnAudioObserved).toEqual([]);
    expect(qaWindow.__oprnAudioState?.()).toEqual(engine.audioStateSnapshot());
    engine.play("se", "new-shot", "/new.wav", false);
    expect(qaWindow.__oprnAudioObserved).toEqual(["new-shot"]);
    engine.stopAll();
    expect(qaWindow.__oprnAudioObserved).toEqual(["new-shot"]);
    engine.setQaInstrumentation(false);
    engine.setQaInstrumentation(false);
    expect(Object.hasOwn(window, "__oprnAudioState")).toBe(false);
    expect(Object.hasOwn(window, "__oprnAudioObserved")).toBe(false);
  });

  it("does not delete a hook or observation array it no longer owns", () => {
    const engine = new AudioEngine({ qaInstrumentation: true });
    engines.push(engine);
    const replacementState = () => engine.audioStateSnapshot();
    const replacementObserved = ["external-owner"];
    qaWindow.__oprnAudioState = replacementState;
    qaWindow.__oprnAudioObserved = replacementObserved;
    engine.setQaInstrumentation(false);
    expect(qaWindow.__oprnAudioState).toBe(replacementState);
    expect(qaWindow.__oprnAudioObserved).toBe(replacementObserved);
  });
});
