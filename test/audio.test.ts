// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "@/player/audio/audioEngine";
import { createBlankProject } from "@/project/defaults";
import { startSession, setAudioState } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import { getAudioEngine, playAudioCommand } from "@/player/audio";
import { parseAudioState } from "@/player/saveSlotValidation";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { isolateTimers } from "./mergedTeardown";

describe("audioEnginePlaybackControls", () => {
  isolateTimers();
  // AudioEngine 재생 컨트롤(요청 단위 페이드인 · 재생 속도 · 스테레오 밸런스) 계약.
  //
  // 실측으로 깨져 있던 것: 편집기 음악·효과음 모달의 "페이드인 시간"/"템포"/"밸런스" 슬라이더는
  // 핸들러가 없었고, 엔진에는 playbackRate·pan API 자체가 없었으며 페이드는 DEFAULT_FADE_MS=600
  // 상수로 하드코딩돼 요청 단위로 길이를 정할 수 없었다.
  //
  // mock 은 HTMLAudioElement 수준까지만 한다 — 큐/페이드/트랙 관리 등 엔진 로직은 실제로 돈다.
  describe("audioEnginePlaybackControls", () => {
    isolateTimers();
    class FakeAudio {
      static instances: FakeAudio[] = [];
      volume = 1;
      playbackRate = 1;
      loop = false;
      preload = "";
      currentTime = 0;
      src: string;
      paused = true;
      playCalls = 0;
      isConnected = false;
      private readonly listeners = new Map<string, Set<() => void>>();

      constructor(src?: string) {
        this.src = src ?? "";
        FakeAudio.instances.push(this);
      }

      play(): Promise<void> {
        this.playCalls += 1;
        this.paused = false;
        return Promise.resolve();
      }

      pause(): void {
        this.paused = true;
      }

      setAttribute(): void {}

      remove(): void {
        this.isConnected = false;
      }

      addEventListener(type: string, listener: () => void): void {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: () => void): void {
        this.listeners.get(type)?.delete(listener);
      }

      dispatch(type: string): void {
        for (const listener of this.listeners.get(type) ?? []) listener();
      }
    }
    let originalAudio: unknown;
    function newEngine(): AudioEngine {
      const engine = new AudioEngine();
      engine.unlock();
      return engine;
    }
    function lastAudio(): FakeAudio {
      const audio = FakeAudio.instances[FakeAudio.instances.length - 1];
      if (!audio) throw new Error("no HTMLAudioElement was created");
      return audio;
    }
    beforeEach(() => {
      FakeAudio.instances = [];
      originalAudio = (globalThis as { Audio?: unknown }).Audio;
      (globalThis as { Audio?: unknown }).Audio = FakeAudio;
    });
    afterEach(() => {
      (globalThis as { Audio?: unknown }).Audio = originalAudio;
    });
    describe("AudioEngine 재생 컨트롤", () => {
      it("요청 단위 fadeInMs=0 은 즉시 목표 볼륨, 양수 fadeInMs 는 0 에서 시작한다", () => {
        const engine = newEngine();
        engine.setVolume("bgm", 0.6);

        engine.play("bgm", "track-a", "/a.wav", true, { fadeInMs: 0 });
        expect(lastAudio().volume).toBeCloseTo(0.6, 5);
        expect(engine.getFadeInMs()).toBe(0);

        engine.stopAll(false);
        engine.play("bgm", "track-b", "/b.wav", true, { fadeInMs: 900 });
        expect(engine.getFadeInMs()).toBe(900);
        expect(lastAudio().volume).toBe(0);
      });

      it("페이드인을 생략하면 기존 기본 길이를 그대로 쓴다", () => {
        const engine = newEngine();
        engine.play("bgm", "track-a", "/a.wav", true);
        expect(engine.getFadeInMs()).toBe(600);
      });

      it("playbackRate 를 설정·조회하고 새 트랙에 반영한다", () => {
        const engine = newEngine();
        engine.setPlaybackRate(1.25);
        expect(engine.getPlaybackRate()).toBeCloseTo(1.25, 5);

        engine.play("bgm", "track-a", "/a.wav", true, { fadeInMs: 0 });
        expect(lastAudio().playbackRate).toBeCloseTo(1.25, 5);
      });

      it("재생 중 playbackRate 변경이 정지 없이 즉시 반영된다", () => {
        const engine = newEngine();
        engine.play("bgm", "track-a", "/a.wav", true, { fadeInMs: 0 });
        const audio = lastAudio();
        const playCallsBefore = audio.playCalls;

        engine.setPlaybackRate(0.75);

        expect(audio.playbackRate).toBeCloseTo(0.75, 5);
        expect(audio.playCalls).toBe(playCallsBefore);
        expect(audio.paused).toBe(false);
        // 새 요소를 만들지 않았다 = 정지 후 재생이 아니다.
        expect(FakeAudio.instances.length).toBe(1);
      });

      it("재생 중 볼륨 변경이 즉시 반영된다", () => {
        const engine = newEngine();
        engine.play("se", "shot", "/s.wav", false, { fadeInMs: 0 });
        engine.setVolume("se", 0.25);
        expect(lastAudio().volume).toBeCloseTo(0.25, 5);
      });

      it("자연 종료된 원샷 요소를 DOM 에서 제거한다", () => {
        const body = document.body as HTMLBodyElement & { append: (...nodes: unknown[]) => void };
        const originalAppend = body.append;
        body.append = (...nodes: unknown[]) => {
          for (const node of nodes) {
            if (node instanceof FakeAudio) node.isConnected = true;
            else originalAppend.call(body, node);
          }
        };

        try {
          const engine = newEngine();
          engine.play("se", "shot", "/shot.wav", false, { fadeInMs: 0 });
          const audio = lastAudio();
          expect(audio.isConnected).toBe(true);

          audio.dispatch("ended");

          expect(audio.isConnected).toBe(false);
        } finally {
          body.append = originalAppend;
        }
      });

      it("playbackRate 를 브라우저 유효 범위로 클램프한다", () => {
        const engine = newEngine();
        engine.setPlaybackRate(99);
        expect(engine.getPlaybackRate()).toBe(4);
        engine.setPlaybackRate(0);
        expect(engine.getPlaybackRate()).toBe(0.25);
        engine.setPlaybackRate(Number.NaN);
        expect(engine.getPlaybackRate()).toBe(1);
      });

      it("WebAudio 가 없는 환경에서도 pan 값을 보관·조회하고 -1..1 로 클램프한다", () => {
        // happy-dom 에는 AudioContext.createMediaElementSource 가 없다 — 조용히 건너뛰고
        // 설정값만 보관하는 계약을 여기서 지킨다.
        const engine = newEngine();
        engine.play("bgm", "track-a", "/a.wav", true, { fadeInMs: 0 });

        engine.setPan(-0.5);
        expect(engine.getPan()).toBeCloseTo(-0.5, 5);
        engine.setPan(9);
        expect(engine.getPan()).toBe(1);
        engine.setPan(-9);
        expect(engine.getPan()).toBe(-1);
        engine.setPan(Number.NaN);
        expect(engine.getPan()).toBe(0);
        // 재생은 계속된다(예외로 트랙이 죽지 않는다).
        expect(lastAudio().paused).toBe(false);
      });

      it("요청 옵션으로 준 playbackRate/pan 도 엔진 상태가 된다", () => {
        const engine = newEngine();
        engine.play("bgm", "track-a", "/a.wav", true, { fadeInMs: 0, playbackRate: 1.5, pan: 0.4 });
        expect(engine.getPlaybackRate()).toBeCloseTo(1.5, 5);
        expect(engine.getPan()).toBeCloseTo(0.4, 5);
        expect(lastAudio().playbackRate).toBeCloseTo(1.5, 5);
      });

      it("언락 전에 큐잉된 요청마다 playbackRate/pan 을 따로 보존한다", () => {
        const panners = new Map<FakeAudio, { pan: { value: number } }>();
        const previousAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext;
        class FakeAudioContext {
          state = "running";
          destination = {};
          private source: FakeAudio | null = null;

          createMediaElementSource(audio: FakeAudio): { connect: (target: object) => void } {
            this.source = audio;
            return {
              connect: (target: object) => {
                const panner = target as { pan?: { value: number } };
                if (panner.pan && this.source) panners.set(this.source, panner as { pan: { value: number } });
              },
            };
          }

          createStereoPanner(): { pan: { value: number }; connect: () => void } {
            return { pan: { value: 0 }, connect: () => undefined };
          }
        }
        (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;

        try {
          const engine = new AudioEngine();
          engine.play("bgm", "first", "/first.ogg", true, { fadeInMs: 0, playbackRate: 0.5, pan: -0.5 });
          engine.play("bgs", "second", "/second.ogg", true, { fadeInMs: 0, playbackRate: 1.5, pan: 0.5 });
          expect(FakeAudio.instances).toHaveLength(0);

          engine.unlock();

          expect(FakeAudio.instances.map((audio) => ({ src: audio.src, playbackRate: audio.playbackRate }))).toEqual([
            { src: "/first.ogg", playbackRate: 0.5 },
            { src: "/second.ogg", playbackRate: 1.5 },
          ]);
          expect(FakeAudio.instances.map((audio) => panners.get(audio)?.pan.value)).toEqual([-0.5, 0.5]);
        } finally {
          if (previousAudioContext === undefined) Reflect.deleteProperty(globalThis, "AudioContext");
          else (globalThis as { AudioContext?: unknown }).AudioContext = previousAudioContext;
        }
      });

      it("QA 관찰 훅으로 현재 적용값을 브라우저에서 읽을 수 있다", () => {
        const engine = new AudioEngine({ qaInstrumentation: true });
        engine.unlock();
        engine.setVolume("bgm", 0.5);
        engine.setPlaybackRate(1.1);
        engine.setPan(-0.25);
        engine.play("bgm", "track-a", "/a.wav", true, { fadeInMs: 250 });

        const snapshot = engine.audioStateSnapshot();
        expect(snapshot.volume.bgm).toBeCloseTo(0.5, 5);
        expect(snapshot.playbackRate).toBeCloseTo(1.1, 5);
        expect(snapshot.pan).toBeCloseTo(-0.25, 5);
        expect(snapshot.fadeInMs).toBe(250);

        const hook = (window as unknown as { __oprnAudioState?: () => typeof snapshot }).__oprnAudioState;
        expect(typeof hook).toBe("function");
        expect(hook?.().playbackRate).toBeCloseTo(1.1, 5);
        engine.stopAll();
        engine.setQaInstrumentation(false);
      });
    });
  });
  describe("eventCommandAudioRepairs", () => {
    isolateTimers();
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

      it("plays a fractional volume as a gain so 0.6 is 60%, not 0.6%", () => {
        const project = createBlankProject();
        const value = getAudioEngine();
        engines.push(value);
        value.unlock();
        value.setVolume("bgm", 0.7);
        value.setVolume("se", 0.8);
        playAudioCommand({ channel: "se", resourceId, loop: false, volume: 0.6, fadeInMs: 0 }, project);
        expect(lastElement().volume).toBeCloseTo(0.48);
        value.resumeFromState({ bgs: { resourceId, loop: true, volume: 0.5, fadeInMs: 0 } }, (id) => `/${id}.wav`);
        expect(lastElement().volume).toBeCloseTo(0.35);
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
  });
});

describe("audioQaInstrumentation", () => {
  isolateTimers();
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
          volume: { bgm: 0.3, se: 0.8 }, playbackRate: 0.75, pan: 0, fadeInMs: 0, failures: [],
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
});
