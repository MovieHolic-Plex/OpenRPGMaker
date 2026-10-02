/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StartedSource = { readonly buffer: unknown };

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
    connect(node: unknown): unknown;
    start(): void;
  } {
    const context = this;
    return {
      buffer: null,
      connect(node: unknown) {
        return node;
      },
      start() {
        context.started.push({ buffer: this.buffer });
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

  it("merges the same sample restarted within 80ms into one start (heal cue + heal animation)", async () => {
    const samples = await importFreshModule(context);
    await Promise.all([samples.loadBattleSample("easyrpg-sound-recovery5"), samples.loadBattleSample("easyrpg-sound-damage2")]);
    context.currentTime = 1;
    expect(samples.playBattleSample("easyrpg-sound-recovery5", 0.4)).toBe(true);
    context.currentTime = 1.005;
    // 이미 울리고 있으므로 true(호출부가 요소 폴백으로 또 내지 않게) — 시작은 한 번.
    expect(samples.playBattleSample("easyrpg-sound-recovery5", 0.4)).toBe(true);
    expect(samples.playBattleSample("easyrpg-sound-damage2", 0.4)).toBe(true); // 다른 샘플은 그대로
    expect(context.started).toHaveLength(2);
    context.currentTime = 1.2;
    expect(samples.playBattleSample("easyrpg-sound-recovery5", 0.4)).toBe(true);
    expect(context.started).toHaveLength(3);
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
