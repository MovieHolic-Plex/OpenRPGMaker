/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { AudioEngine } from "@/player/audio/audioEngine";
import { resolveAudioSource } from "@/player/audio/audioResources";

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

it.each(["audio/x-wav", "audio/wave", "audio/vnd.wave", "audio/mp3"])("resolves supported uploaded MIME alias %s without changing bytes", mime => {
  const canonical = mime === "audio/mp3" ? "audio/mpeg" : "audio/wav";
  const project = { assets: { sprites: {}, uploaded: { voice: {
    id: "voice", kind: "sound" as const, name: "voice", dataUrl: `data:${mime};base64,QUJD`, meta: {},
  } } } };
  expect(resolveAudioSource("voice", project)).toBe(`data:${canonical};base64,QUJD`);
});

it("reports a rejected decode and allows a same-resource retry", async () => {
  const rejected = Promise.reject(new DOMException("invalid bytes", "NotSupportedError"));
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValueOnce(rejected).mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const engine = new AudioEngine();
  engine.unlock();
  engine.play("bgm", "broken", "/broken.mp3", true, { fadeInMs: 0 });
  await rejected.catch(() => {});
  expect(warning).toHaveBeenCalled();
  engine.play("bgm", "broken", "/broken.mp3", true, { fadeInMs: 0 });
  expect(play).toHaveBeenCalledTimes(2);
  engine.stopAll();
});

it("retries autoplay denial on the next unlock without replaying a stopped track", async () => {
  const rejected = Promise.reject(new DOMException("gesture needed", "NotAllowedError"));
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValueOnce(rejected).mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const engine = new AudioEngine();
  engine.unlock();
  engine.play("bgm", "blocked", "/valid.mp3", true, { fadeInMs: 0 });
  await rejected.catch(() => {});
  engine.unlock();
  expect(play).toHaveBeenCalledTimes(2);
  expect(warning).not.toHaveBeenCalled();
  engine.stopAll();
  engine.unlock();
  expect(play).toHaveBeenCalledTimes(2);
});

it("reports native media errors after play resolves and removes failed loops", () => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const engine = new AudioEngine();
  engine.unlock();
  engine.play("bgm", "decode", "/decode.mp3", true, { fadeInMs: 0 });
  const audio = document.querySelector("audio");
  expect(audio).not.toBeNull();
  audio?.dispatchEvent(new Event("error"));
  expect(warning).toHaveBeenCalled();
  expect(document.querySelector("audio")).toBeNull();
  engine.stopAll();
});

it("unlocks queued playback even when runtime keyboard input stops bubbling", () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const installed = vi.spyOn(window, "addEventListener");
  const stop = (event: Event): void => event.stopPropagation();
  document.addEventListener("keydown", stop);
  const engine = new AudioEngine();
  try {
    engine.installUnlockListeners();
    engine.play("bgm", "queued", "/valid.mp3", true, { fadeInMs: 0 });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    expect(play).toHaveBeenCalledTimes(1);
  } finally {
    engine.stopAll();
    document.removeEventListener("keydown", stop);
    for (const [type, listener] of installed.mock.calls) window.removeEventListener(type, listener, true);
  }
});

it("does not resurrect an autoplay-blocked track after stopping it", async () => {
  const rejected = Promise.reject(new DOMException("gesture needed", "NotAllowedError"));
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockReturnValueOnce(rejected).mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const engine = new AudioEngine();
  engine.unlock();
  engine.play("bgm", "blocked", "/valid.mp3", true, { fadeInMs: 0 });
  await rejected.catch(() => {});
  engine.stopAll();
  engine.unlock();
  expect(play).toHaveBeenCalledTimes(1);
  expect(document.querySelector("audio")).toBeNull();
});
