/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession, setAudioState } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import { AudioEngine } from "@/player/audio/audioEngine";
import { getAudioEngine, playAudioCommand } from "@/player/audio";
import { parseAudioState } from "@/player/saveSlotValidation";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";

const elements: HTMLAudioElement[] = [];
const engines: AudioEngine[] = [];
const resourceId = "cc0-music-field-loop";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });
  vi.stubGlobal("Audio", function TestAudio(src: string) {
    const element = document.createElement("audio");
    element.src = src;
    vi.spyOn(element, "play").mockResolvedValue();
    vi.spyOn(element, "pause").mockImplementation(() => {});
    elements.push(element);
    return element;
  });
});

afterEach(() => {
  for (const engine of engines) engine.stopAll(false);
  engines.length = 0;
  elements.length = 0;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function engine() {
  const value = new AudioEngine();
  engines.push(value);
  value.setVolume("bgm", 0.5);
  value.setVolume("se", 0.4);
  value.unlock();
  return value;
}

function lastElement() {
  const value = elements.at(-1);
  if (!value) throw new Error("Expected a real media element created by AudioEngine");
  return value;
}

describe("Sound Layer preserves the authored channel and track controls", () => {
  it.each([
    ["bgm", true], ["bgs", true], ["ambient", true], ["me", false], ["se", false],
  ] as const)("routes %s without replacing a different channel", (channel, loop) => {
    // Given: an existing BGM and a non-default Sound Layer request.
    const project = createBlankProject();
    const session = startSession(project);
    session.audio.bgm = { resourceId: "existing-bgm", loop: true };
    const interpreter = createInterpreter([{
      kind: "m2Command", commandId: "m2-210-sound-layer",
      fields: { channel, resourceId, volume: 63, fadeMs: 750 },
    }], session, project);
    // When: the real interpreter produces the real player handoff.
    const step = interpreter.start();
    expect(step).toMatchObject({ kind: "playAudio", channel, resourceId, loop, volume: 63, fadeInMs: 750 });
    if (step.kind !== "playAudio") throw new Error("Missing audio handoff");
    setAudioState(session, step);
    // Then: the selected channel retains controls and unrelated music remains.
    expect(Reflect.get(session.audio, channel)).toEqual({ resourceId, loop, volume: 63, fadeInMs: 750 });
    if (channel !== "bgm") expect(session.audio.bgm?.resourceId).toBe("existing-bgm");
  });

  it("the player adapter keeps BGS separate and multiplies track volume by the mixer", () => {
    // Given: only the platform media element is substituted; adapter and engine are real.
    const project = createBlankProject();
    const value = getAudioEngine();
    engines.push(value);
    value.unlock();
    value.setVolume("bgm", 0.5);
    value.play("bgm", "existing-bgm", "/existing.wav", true, { fadeInMs: 0 });
    const first = lastElement();
    const command = { channel: "bgs" as const, resourceId, loop: true, volume: 63, fadeInMs: 0 };
    // When: the real player adapter consumes an authored BGS request.
    playAudioCommand(command, project);
    // Then: no crossfade/stop of BGM and independent track gain.
    expect(elements).toHaveLength(2);
    expect(first.volume).toBe(0.5);
    expect(lastElement().volume).toBeCloseTo(0.315);
    expect(value.getVolume("bgm")).toBe(0.5);
  });

  it("track gain survives fade completion and subsequent mixer changes", () => {
    const value = engine();
    const options = { gain: 0.63, fadeInMs: 400 };
    value.play("bgs", "wind", "/wind.wav", true, options);
    vi.advanceTimersByTime(400);
    expect(lastElement().volume).toBeCloseTo(0.315);
    value.setVolume("bgm", 0.8);
    expect(lastElement().volume).toBeCloseTo(0.504);
    expect(value.getVolume("bgm")).toBe(0.8);
  });

  it("explicit silence is preserved instead of falling back to full track gain", () => {
    const value = engine();
    const options = { gain: 0, fadeInMs: 0 };
    value.play("se", "quiet", "/quiet.wav", false, options);
    expect(lastElement().volume).toBe(0);
    value.setVolume("se", 0.9);
    expect(lastElement().volume).toBe(0);
  });

  it("same-resource requests update gain without recreating the track", () => {
    const value = engine();
    const initial = { gain: 0.2, fadeInMs: 0 };
    const replacement = { gain: 0.8, fadeInMs: 0 };
    value.play("bgs", "wind", "/wind.wav", true, initial);
    const first = lastElement();
    value.play("bgs", "wind", "/wind.wav", true, replacement);
    expect(elements).toHaveLength(1);
    expect(lastElement()).toBe(first);
    expect(first.volume).toBeCloseTo(0.4);
  });

  it("restores ambient as a looping channel with its saved controls", () => {
    const value = engine();
    const saved = {
      bgm: { resourceId: "main", loop: true },
      ambient: { resourceId: "wind", loop: true, volume: 63, fadeInMs: 0 },
    };
    value.resumeFromState(saved, id => `/${id}.wav`, { fadeInMs: 0 });
    expect(elements).toHaveLength(2);
    expect(lastElement().loop).toBe(true);
    expect(lastElement().src).toContain("/wind.wav");
    expect(lastElement().volume).toBeCloseTo(0.315);
  });

  it("save validation preserves ambient and explicit zero volume", () => {
    const ambient = { resourceId, loop: true, volume: 0, fadeInMs: 321 };
    const parsed = parseAudioState({ ambient });
    expect(parsed).toEqual({
      ok: true,
      value: { bgm: undefined, bgs: undefined, me: undefined, se: undefined, ambient },
    });
  });

  it("an ambient request queued before unlock remains a loop after unlock", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const interpreter = createInterpreter([{
      kind: "m2Command", commandId: "m2-210-sound-layer",
      fields: { channel: "ambient", resourceId, volume: 63, fadeMs: 0 },
    }], session, project);
    const step = interpreter.start();
    expect(step).toMatchObject({ kind: "playAudio", channel: "ambient", loop: true });
    if (step.kind !== "playAudio") throw new Error("Missing audio handoff");
    setAudioState(session, step);
    const value = new AudioEngine();
    engines.push(value);
    value.setVolume("bgm", 0.5);
    value.resumeFromState(session.audio, id => `/${id}.wav`, { fadeInMs: 0 });
    expect(elements).toHaveLength(0);
    value.unlock();
    expect(elements).toHaveLength(1);
    expect(lastElement().loop).toBe(true);
    expect(lastElement().volume).toBeCloseTo(0.315);
  });
});


describe("Sound Layer mixer and save-path regressions", () => {
  it.each(["me", "se"] as const)("keeps %s one-shot gain and mixer-group isolation", channel => {
    const value = engine();
    const options = { gain: 0.63, fadeInMs: 0 };
    value.play(channel, "cue", "/cue.wav", false, options);
    const audio = lastElement();
    const initialVolume = channel === "me" ? 0.315 : 0.252;

    value.setVolume(channel === "me" ? "se" : "bgm", 0.9);
    expect.soft(audio.volume).toBeCloseTo(initialVolume);
    value.setVolume(channel === "me" ? "bgm" : "se", 0.8);

    expect(audio.volume).toBeCloseTo(0.504);
  });

  it("muting during fade-out immediately silences the retiring track", () => {
    const value = engine();
    const options = { gain: 0.63, fadeInMs: 0 };
    value.play("bgs", "wind", "/wind.wav", true, options);
    const audio = lastElement();
    value.stopChannel("bgs", 400);
    vi.advanceTimersByTime(200);
    expect(audio.volume).toBeCloseTo(0.1575);

    value.setVolume("bgm", 0);

    expect.soft(audio.volume).toBe(0);
    value.setVolume("bgm", 0.8);
    expect.soft(audio.volume).toBeCloseTo(0.252);
    vi.advanceTimersByTime(200);
    expect(audio.isConnected).toBe(false);
  });

  it("raising a zero mixer during fade-in restores the current envelope", () => {
    const value = engine();
    value.setVolume("bgm", 0);
    const options = { gain: 0.63, fadeInMs: 400 };
    value.play("bgs", "wind", "/wind.wav", true, options);
    vi.advanceTimersByTime(200);

    value.setVolume("bgm", 0.8);

    expect.soft(lastElement().volume).toBeCloseTo(0.252);
    vi.advanceTimersByTime(200);
    expect(lastElement().volume).toBeCloseTo(0.504);
  });

  it("muting during a fade is immediately silent and does not erase track gain", () => {
    const value = engine();
    const options = { gain: 0.63, fadeInMs: 400 };
    value.play("bgs", "wind", "/wind.wav", true, options);
    vi.advanceTimersByTime(200);

    value.setVolume("bgm", 0);
    expect.soft(lastElement().volume).toBe(0);
    vi.advanceTimersByTime(200);
    value.setVolume("bgm", 0.8);

    expect(lastElement().volume).toBeCloseTo(0.504);
  });

  it("a one-shot honors an explicit fade and cancels its fade timer on ended", () => {
    const value = engine();
    const options = { gain: 0.63, fadeInMs: 400 };
    value.play("me", "cue", "/cue.wav", false, options);
    const audio = lastElement();
    expect.soft(audio.volume).toBe(0);
    vi.advanceTimersByTime(200);
    expect.soft(audio.volume).toBeCloseTo(0.1575);

    audio.dispatchEvent(new Event("ended"));
    const endedVolume = audio.volume;
    vi.advanceTimersByTime(200);
    value.setVolume("bgm", 0.9);

    expect(audio.isConnected).toBe(false);
    expect(audio.volume).toBe(endedVolume);
  });

  it.each([0, 63])("saveToSlot/readSaveSlot/applySaveSnapshot retain ambient volume %s and fade", volume => {
    const project = createBlankProject();
    const session = startSession(project, 12345);
    const audio = {
      bgm: { resourceId, loop: true, volume: 25, fadeInMs: 0 },
      ambient: { resourceId: "cc0-sound-ui-confirm", loop: true, volume, fadeInMs: 400 },
      me: { resourceId: "cc0-sound-ui-confirm", loop: false, volume: 63, fadeInMs: 0 },
    };
    session.audio = audio;
    const storage = window.sessionStorage;
    storage.clear();
    try {
      expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });

      const saved = readSaveSlot(storage, 1);
      expect(saved.kind).toBe("present");
      if (saved.kind !== "present") throw new Error("Save-slot roundtrip failed");
      const restored = applySaveSnapshot(project, saved.snapshot);

      expect.soft(restored.audio).toMatchObject(audio);
      const value = engine();
      value.resumeFromState(restored.audio, id => `/${id}.wav`);
      expect.soft(elements).toHaveLength(2); // Saved one-shots must not replay.
      expect.soft(elements[0]?.volume).toBeCloseTo(0.125);
      vi.advanceTimersByTime(200);
      expect.soft(lastElement().volume).toBeCloseTo(volume / 100 * 0.5 * 0.5);
      vi.advanceTimersByTime(200);
      expect(lastElement().volume).toBeCloseTo(volume / 100 * 0.5);
    } finally {
      storage.clear();
    }
  });

  it.each([
    { volume: -1 }, { volume: 101 }, { volume: Number.NaN }, { volume: "63" },
    { fadeInMs: -1 }, { fadeInMs: Number.POSITIVE_INFINITY }, { fadeInMs: "400" },
  ])("rejects malformed persisted audio controls %j", controls => {
    const parsed = parseAudioState({ ambient: { resourceId, loop: true, ...controls } });
    expect(parsed.ok).toBe(false);
  });
});
