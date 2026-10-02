/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StartedSource = { readonly buffer: unknown; stopped: boolean };

class FakeAudioContext {
  readonly decoded: ArrayBuffer[] = [];
  readonly started: StartedSource[] = [];
  readonly destination = { destination: true };
  currentTime = 0;
  decodeAudioState: "ok" | "fail" = "ok";

  decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer> {
    this.decoded.push(bytes);
    if (this.decodeAudioState === "fail") return Promise.reject(new Error("not decodable"));
    return Promise.resolve({ fake: true } as unknown as AudioBuffer);
  }

  createBufferSource(): {
    buffer: unknown;
    playbackRate: { value: number };
    connect(node: unknown): unknown;
    start(): void;
    stop(): void;
  } {
    const context = this;
    let entry: StartedSource | undefined;
    return {
      buffer: null,
      playbackRate: { value: 1 },
      connect(node: unknown) {
        return node;
      },
      start() {
        entry = { buffer: this.buffer, stopped: false };
        context.started.push(entry);
      },
      stop() {
        if (entry) entry.stopped = true;
      },
    };
  }

  createGain(): { gain: { value: number }; connect(node: unknown): unknown } {
    return {
      gain: { value: 1 },
      connect(node: unknown) {
        return node;
      },
    };
  }
}

async function importFreshModule(context: FakeAudioContext | undefined) {
  vi.resetModules();
  if (context) {
    // vi.fn 화살표 래퍼는 new 로 호출할 수 없어 battleSfx 의 `new AudioContext()` 가 실패한다.
    vi.stubGlobal("AudioContext", function () { return context; });
  } else {
    vi.stubGlobal("AudioContext", undefined);
  }
  return import("@/player/battleSeSamples");
}

describe("battleSeSamples", () => {
  let context: FakeAudioContext;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    context = new FakeAudioContext();
    fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back (false) before the sample is loaded, then plays instantly from the cache", async () => {
    const samples = await importFreshModule(context);

    expect(samples.playBattleSample("easyrpg-sound-attack1", 0.4)).toBe(false);

    await samples.loadBattleSample("easyrpg-sound-attack1");
    expect(samples.playBattleSample("easyrpg-sound-attack1", 0.4)).toBe(true);
    context.currentTime = 0.5;
    expect(samples.playBattleSample("easyrpg-sound-attack1", 0.4)).toBe(true);
    expect(context.started).toHaveLength(2);
    expect((context.started[0]?.buffer as { fake?: boolean }).fake).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps only the cue when cue + animation play the same sample within 80ms (heal, bite)", async () => {
    const samples = await importFreshModule(context);
    await Promise.all([samples.loadBattleSample("easyrpg-sound-recovery5"), samples.loadBattleSample("easyrpg-sound-damage2")]);
    // 신호가 먼저: 이펙트 쪽은 내지 않는다(이미 울리므로 true — 요소 폴백도 막는다).
    context.currentTime = 1;
    expect(samples.playBattleSample("easyrpg-sound-recovery5", 0.4, 1, "cue")).toBe(true);
    context.currentTime = 1.005;
    expect(samples.playBattleSample("easyrpg-sound-recovery5", 0.4, 1, "animation")).toBe(true);
    expect(context.started).toHaveLength(1);
    // 이펙트가 먼저(물기: 이펙트 damage2 가 타격 신호 damage2 보다 25ms 앞): 이펙트를 멈추고 세기 모양을 실은 신호를 낸다.
    context.currentTime = 2;
    samples.playBattleSample("easyrpg-sound-damage2", 0.4, 1, "animation");
    context.currentTime = 2.025;
    expect(samples.playBattleSample("easyrpg-sound-damage2", 0.9, 0.9, "cue")).toBe(true);
    expect(context.started).toHaveLength(3);
    expect(context.started[1]?.stopped).toBe(true);
    expect(context.started[2]?.stopped).toBe(false);
    // 창 밖이면 둘 다 난다.
    context.currentTime = 2.3;
    samples.playBattleSample("easyrpg-sound-damage2", 0.4, 1, "animation");
    expect(context.started).toHaveLength(4);
  });

  it("never merges repeats from the same source (an effect repeating its sound every 40ms frame)", async () => {
    const samples = await importFreshModule(context);
    await samples.loadBattleSample("easyrpg-sound-attack1");
    for (let i = 0; i < 3; i += 1) {
      context.currentTime = 2 + i * 0.04;
      expect(samples.playBattleSample("easyrpg-sound-attack1", 0.4, 1, "animation")).toBe(true);
    }
    context.currentTime = 2.2;
    samples.playBattleSample("easyrpg-sound-attack1", 0.4);
    samples.playBattleSample("easyrpg-sound-attack1", 0.4); // 출처 미지정(other)은 합치지 않는다
    expect(context.started).toHaveLength(5);
  });

  it("preloads the listed ids once each", async () => {
    const samples = await importFreshModule(context);
    samples.preloadBattleSamples(["easyrpg-sound-attack1", "easyrpg-sound-damage2", "easyrpg-sound-attack1"]);
    await Promise.all([samples.loadBattleSample("easyrpg-sound-attack1"), samples.loadBattleSample("easyrpg-sound-damage2")]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries after a network failure but never re-fetches a decode failure", async () => {
    const samples = await importFreshModule(context);

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(samples.loadBattleSample("easyrpg-sound-attack1")).resolves.toBeNull();
    await expect(samples.loadBattleSample("easyrpg-sound-attack1")).resolves.not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2); // 네트워크 실패는 재시도된다

    context.decodeAudioState = "fail";
    await expect(samples.loadBattleSample("easyrpg-sound-damage2")).resolves.toBeNull();
    await expect(samples.loadBattleSample("easyrpg-sound-damage2")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3); // 디코딩 실패는 캐시돼 재시도하지 않는다
    expect(samples.playBattleSample("easyrpg-sound-damage2", 0.4)).toBe(false);
  });

  it("does not fetch or throw without a WebAudio context", async () => {
    const samples = await importFreshModule(undefined);
    expect(samples.playBattleSample("easyrpg-sound-damage2", 0.4)).toBe(false);
    await expect(samples.loadBattleSample("easyrpg-sound-damage2")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
