/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playCinematicSequence, type CinematicPlayback } from "@/player/cinematicSequence";
import { createBlankProject } from "@/project/defaults";
import type { CinematicScene, CinematicSequence, Project } from "@/project/types";

const text: CinematicScene = { id: "text", kind: "text", narration: "<b>literal</b>\nline", durationMs: 0 };
const image: CinematicScene = { id: "image", kind: "image", resourceId: "image", narration: "caption", durationMs: 0, motion: "pan" };
const video: CinematicScene = { id: "video", kind: "video", resourceId: "video", narration: "", durationMs: 0 };
let host: HTMLElement;
let project: Project;
let controller: AbortController;
let playback: CinematicPlayback;
const play = vi.fn<() => Promise<void>>();
const pause = vi.fn();
const load = vi.fn();
function start(scenes: CinematicScene[], skippable = false): CinematicPlayback {
  playback = playCinematicSequence({ host, project, sequence: { enabled: true, skippable, scenes }, signal: controller.signal });
  return playback;
}
function key(key: string, repeat = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, repeat, bubbles: true, cancelable: true });
  (document.activeElement ?? document).dispatchEvent(event);
  return event;
}
function root(): HTMLElement {
  const node = host.querySelector<HTMLElement>('[data-testid="cinematic-sequence"]');
  if (!node) throw new Error("Missing cinematic root");
  return node;
}
function media<T extends HTMLMediaElement>(selector: string): T {
  const node = host.querySelector<T>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}
beforeEach(() => {
  vi.useFakeTimers();
  project = createBlankProject();
  project.assets.uploaded = {
    image: { id: "image", name: "image", kind: "picture", dataUrl: "data:image/gif;base64,AQID", meta: { width: 1, height: 1 } },
    video: { id: "video", name: "video", kind: "movie", dataUrl: "data:video/webm;base64,AQID", meta: { width: 1, height: 1 } },
    voice: { id: "voice", name: "voice", kind: "sound", dataUrl: "data:audio/ogg;base64,AQID", meta: { width: 0, height: 0 } },
  };
  host = document.createElement("div"); document.body.append(host);
  controller = new AbortController();
  play.mockReset().mockResolvedValue(); pause.mockClear(); load.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(load);
});
afterEach(() => { playback?.teardown(); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("shared sequence playback", () => {
  it.each([undefined, { enabled: false, skippable: true, scenes: [text] }, { enabled: true, skippable: false, scenes: [] }] satisfies (CinematicSequence | undefined)[])("leaves the host unchanged for absent, disabled or empty settings", async sequence => {
    const sentinel = document.createElement("span"); host.append(sentinel);
    playback = playCinematicSequence({ host, project, sequence, signal: controller.signal });
    expect(await playback.done).toBe("completed");
    expect(host.children).toHaveLength(1);
    expect(host.firstChild).toBe(sentinel);
  });
  it("renders safe text and advances ordered image/text scenes by distinct presses", async () => {
    start([text, image, { ...text, id: "last" }]);
    expect(root().querySelector("b")).toBeNull();
    expect(root().querySelector(".cinematic-narration")?.textContent).toBe(text.narration);
    expect(key("Enter", true).defaultPrevented).toBe(true);
    expect(root().dataset.sceneId).toBe("text");
    key("e"); expect(root().dataset.sceneId).toBe("text");
    key("z"); expect(root().dataset.sceneId).toBe("image");
    expect(root().querySelector("img")?.src).toBe(project.assets.uploaded.image.dataUrl);
    key(" "); expect(root().dataset.sceneId).toBe("last");
    key("Enter"); expect(await playback.done).toBe("completed");
  });
  it("consumes all input and pointer channels without activating playback via pointer", () => {
    start([text, image]);
    const bubble = vi.fn(); document.addEventListener("keydown", bubble);
    try {
      for (const value of ["ArrowDown", "Escape", "1", "Tab", "x"]) expect(key(value).defaultPrevented).toBe(true);
      expect(bubble).not.toHaveBeenCalled();
      for (const type of ["pointerdown", "mousedown", "touchstart", "wheel"]) {
        const event = new Event(type, { bubbles: true, cancelable: true }); root().dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
      root().click(); expect(root().dataset.sceneId).toBe("text");
    } finally { document.removeEventListener("keydown", bubble); }
  });
  it.each([text, image, video])("scrolls overflowing $kind narration synchronously without advancing or leaking keys", async scene => {
    start([{ ...scene, narration: Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n") }, text], true);
    const narration = root().querySelector<HTMLElement>(".cinematic-narration");
    if (!narration) throw new Error("Missing narration");
    // happy-dom has no layout or scroll clamping; model only the browser geometry boundary.
    let top = 0;
    Object.defineProperties(narration, {
      clientHeight: { value: 100 }, scrollHeight: { value: 400 },
      scrollTop: { get: () => top, set: (value: number) => { top = Math.max(0, Math.min(300, value)); } },
    });
    const fallthrough = vi.fn(); document.addEventListener("keydown", fallthrough);
    try {
      for (const [value, repeat, expected] of [
        ["ArrowDown", false, 24], ["ArrowDown", true, 48], ["ArrowUp", true, 24],
        ["PageDown", false, 114], ["PageDown", true, 204], ["PageUp", true, 114],
        ["End", false, 300], ["ArrowDown", true, 300], ["PageDown", false, 300],
        ["Home", false, 0], ["ArrowUp", true, 0], ["PageUp", false, 0],
      ] as const) {
        expect(key(value, repeat).defaultPrevented).toBe(true);
        expect(narration.scrollTop).toBe(expected);
        expect(root().dataset.sceneKind).toBe(scene.kind);
      }
      const composing = new KeyboardEvent("keydown", { key: "PageDown", isComposing: true, bubbles: true, cancelable: true });
      narration.dispatchEvent(composing);
      expect(composing.defaultPrevented).toBe(true);
      expect(narration.scrollTop).toBe(0);
      key("Enter", true); key("Escape", true);
      expect(root().dataset.sceneKind).toBe(scene.kind);
      key("Enter");
      expect(root().dataset.sceneId).toBe(text.id);
      expect(root().querySelector<HTMLElement>(".cinematic-narration")?.scrollTop).toBe(0);
      key("Escape");
      expect(await playback.done).toBe("skipped");
      expect(fallthrough).not.toHaveBeenCalled();
      expect(key("PageDown").defaultPrevented).toBe(false);
    } finally { document.removeEventListener("keydown", fallthrough); }
  });
  it("shows the scrolling hint only for measured overflow and disconnects on scene cleanup", async () => {
    let height = 100;
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(() => height);
    const observers: { notify: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
    vi.spyOn(window, "ResizeObserver").mockImplementation(callback => {
      const observer = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      observers.push({ ...observer, notify: () => callback([], observer) });
      return observer;
    });
    start([text, image]);
    const hint = root().querySelector<HTMLElement>('[data-testid="cinematic-scroll-hint"]');
    expect(hint).not.toBeNull();
    expect(hint?.hidden).toBe(true);
    expect(observers[0].observe).toHaveBeenCalledWith(root().querySelector(".cinematic-narration"));
    height = 400; observers[0].notify();
    expect(hint?.hidden).toBe(false);
    height = 100; observers[0].notify();
    expect(hint?.hidden).toBe(true);
    height = 400; key("Enter");
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(root().querySelector<HTMLElement>('[data-testid="cinematic-scroll-hint"]')?.hidden).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    controller.abort();
    expect(await playback.done).toBe("aborted");
    expect(observers[1].disconnect).toHaveBeenCalled();
  });
  it("skips only when authored and removes its key listener on completion", async () => {
    start([text], true); key("Escape"); expect(await playback.done).toBe("skipped");
    expect(key("Enter").defaultPrevented).toBe(false);
    expect(host.children).toHaveLength(0);
  });
  it("advances timed scenes exactly once and cancels the previous deadline on keyboard advance", async () => {
    start([{ ...text, durationMs: 100 }, { ...image, durationMs: 300 }, { ...text, id: "last" }]);
    key("Enter");
    await vi.advanceTimersByTimeAsync(100);
    expect(root().dataset.sceneId).toBe("image");
    await vi.advanceTimersByTimeAsync(200);
    expect(root().dataset.sceneId).toBe("last");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("advances video on ended once, clears sources and rejects stale ended events", async () => {
    start([{ ...video, narrationAudioResourceId: "voice", durationMs: 200 }, image, text]);
    const movie = media<HTMLVideoElement>("video"); const voice = media<HTMLAudioElement>("audio");
    expect(movie.src).toBe(project.assets.uploaded.video.dataUrl);
    expect(voice.src).toBe(project.assets.uploaded.voice.dataUrl);
    movie.dispatchEvent(new Event("playing")); key("Enter");
    expect(root().dataset.sceneKind).toBe("video");
    movie.dispatchEvent(new Event("ended"));
    movie.dispatchEvent(new Event("ended"));
    await vi.advanceTimersByTimeAsync(200);
    expect(root().dataset.sceneId).toBe("image");
    expect(movie.getAttribute("src")).toBeNull(); expect(voice.getAttribute("src")).toBeNull();
    expect(pause).toHaveBeenCalledTimes(2); expect(load).toHaveBeenCalledTimes(2);
  });
  it("enforces the authored video maximum", async () => {
    start([{ ...video, durationMs: 100 }, text]);
    media("video").dispatchEvent(new Event("playing"));
    await vi.advanceTimersByTimeAsync(100);
    expect(root().dataset.sceneId).toBe("text");
  });
  it("exposes retry after rejected autoplay and continues even an unskippable video", async () => {
    play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    start([video]); await Promise.resolve();
    expect(root().dataset.mediaState).toBe("blocked");
    key("r"); await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(2);
    media("video").dispatchEvent(new Event("playing"));
    expect(root().dataset.mediaState).toBe("playing");
    media("video").dispatchEvent(new Event("error"));
    expect(root().dataset.mediaState).toBe("error");
    key("Enter"); expect(await playback.done).toBe("completed");
  });
  it("clears the blocked state after a successful narration retry", async () => {
    play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    start([{ ...text, narrationAudioResourceId: "voice" }]); await Promise.resolve();
    expect(root().dataset.mediaState).toBe("blocked");
    key("r"); await Promise.resolve();
    expect(root().dataset.mediaState).toBe("ready");
  });
  it("makes narration rejection visible and permits continuation", async () => {
    play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    start([{ ...text, narrationAudioResourceId: "voice" }]); await Promise.resolve();
    expect(root().dataset.mediaState).toBe("blocked");
    key("Enter"); expect(await playback.done).toBe("completed");
    expect(pause).toHaveBeenCalledTimes(1);
  });
  it.each([image, video])("permits continuation with a missing $kind reference", async scene => {
    start([{ ...scene, resourceId: "missing" }]);
    expect(root().dataset.mediaState).toBe("error");
    key("Enter"); expect(await playback.done).toBe("completed");
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["native-error", "missing-reference"] as const)("retains the authored maximum after %s", async failure => {
    start([{ ...video, durationMs: 100, resourceId: failure === "native-error" ? "video" : "missing" }, text]);
    if (failure === "native-error") media("video").dispatchEvent(new Event("error"));
    expect(root().dataset.mediaState).toBe("error");
    await vi.advanceTimersByTimeAsync(100);
    expect(root().dataset.sceneId).toBe("text");
  });
  it("turns a stalled video load into recoverable error", async () => {
    play.mockReturnValueOnce(new Promise<void>(() => undefined));
    start([video]); await vi.advanceTimersByTimeAsync(10_000);
    expect(root().dataset.mediaState).toBe("error");
    key("Enter"); expect(await playback.done).toBe("completed");
  });
  it.each(["abort", "teardown"] as const)("cleans media, timers and listeners on %s", async kind => {
    start([{ ...video, narrationAudioResourceId: "voice", durationMs: 200 }]);
    const movie = media("video");
    if (kind === "abort") controller.abort(); else playback.teardown();
    expect(await playback.done).toBe("aborted");
    expect(movie.getAttribute("src")).toBeNull(); expect(pause).toHaveBeenCalledTimes(2);
    expect(host.children).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
    expect(key("Enter").defaultPrevented).toBe(false);
  });
  it("does not mount when already aborted", async () => {
    controller.abort(); start([video]);
    expect(await playback.done).toBe("aborted"); expect(play).not.toHaveBeenCalled();
  });
  it("aborts when the host is detached", async () => {
    vi.useRealTimers(); start([video]); const done = playback.done;
    host.remove(); expect(await done).toBe("aborted"); expect(pause).toHaveBeenCalledTimes(1);
  });
  it("ignores late play rejection after advance", async () => {
    let rejectPlay: (error: Error) => void = () => undefined;
    play.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectPlay = reject; }));
    start([video, text]); key("Enter"); rejectPlay(new Error("late")); await Promise.resolve();
    expect(root().dataset.sceneId).toBe("text"); expect(root().dataset.mediaState).toBe("ready");
  });
  it("disables image motion when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    start([image]); expect(root().querySelector("img")?.dataset.motion).toBe("none");
  });
});
