/** @vitest-environment happy-dom */
// AudioEngine 재생 컨트롤(요청 단위 페이드인 · 재생 속도 · 스테레오 밸런스) 계약.
//
// 실측으로 깨져 있던 것: 편집기 음악·효과음 모달의 "페이드인 시간"/"템포"/"밸런스" 슬라이더는
// 핸들러가 없었고, 엔진에는 playbackRate·pan API 자체가 없었으며 페이드는 DEFAULT_FADE_MS=600
// 상수로 하드코딩돼 요청 단위로 길이를 정할 수 없었다.
//
// mock 은 HTMLAudioElement 수준까지만 한다 — 큐/페이드/트랙 관리 등 엔진 로직은 실제로 돈다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AudioEngine } from "@/player/audio/audioEngine";

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
