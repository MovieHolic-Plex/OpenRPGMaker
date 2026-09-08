/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIO_PREVIEW_DEFAULTS, AudioPreviewSession, type AudioPreviewState } from "@/editor/panels/audioPreviewSession";
import { audioPreviewTime } from "@/editor/panels/audioPreviewPlayer";
import { installPreviewMedia, mediaMetadata, previewMedia } from "./support/previewMedia";

const sessions: AudioPreviewSession[] = [];
function fixture() {
  const host = document.createElement("div");
  document.body.append(host);
  const session = new AudioPreviewSession(host);
  sessions.push(session);
  const states: AudioPreviewState[] = [];
  session.subscribe(state => states.push(state));
  session.select("/fixture.wav");
  return { session, host, media: previewMedia(host), state: () => states.at(-1), states };
}
beforeEach(() => { installPreviewMedia(); });
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("editor preview media lifecycle", () => {
  it("does not infer playing from selection or a fulfilled play promise", async () => {
    const f = fixture();
    expect(f.state()?.phase).toBe("ready");
    await f.session.play();
    expect(f.state()?.phase).toBe("loading");
    f.media.dispatchEvent(new Event("playing"));
    expect(f.state()?.phase).toBe("playing");
  });
  it("keeps metadata loading distinct from a requested play", () => {
    const f = fixture();
    f.media.dispatchEvent(new Event("loadstart"));
    expect(f.state()).toMatchObject({ phase: "loading", requested: false });
  });
  it("reports a rejected play and permits retry", async () => {
    const f = fixture();
    vi.mocked(f.media.play).mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    await f.session.play();
    expect(f.state()).toMatchObject({ phase: "error", error: "blocked" });
    await f.session.play();
    f.media.dispatchEvent(new Event("playing"));
    expect(f.state()?.phase).toBe("playing");
  });
  it("ignores rejected play and events from a replaced source", async () => {
    const f = fixture();
    let reject: (reason: Error) => void = () => { throw new Error("play request not installed"); };
    vi.mocked(f.media.play).mockImplementationOnce(() => new Promise((_resolve, rejectPlay) => { reject = rejectPlay; }));
    const pending = f.session.play();
    f.session.select("/replacement.wav");
    reject(new Error("late rejection"));
    await pending;
    for (const name of ["playing", "ended", "error", "loadedmetadata"]) f.media.dispatchEvent(new Event(name));
    expect(f.state()).toMatchObject({ phase: "ready", current: 0, error: "" });
    expect(f.media.hasAttribute("src")).toBe(false);
  });
  it("pauses without rewinding and resumes from the same position", async () => {
    const f = fixture();
    await f.session.play(); f.media.dispatchEvent(new Event("playing"));
    f.media.currentTime = 8;
    f.session.pause();
    expect(f.state()?.phase).toBe("paused");
    await f.session.play();
    expect(f.media.currentTime).toBe(8);
  });
  it("stops immediately and ignores late canplay or playing", async () => {
    const f = fixture();
    await f.session.play();
    f.media.currentTime = 5;
    f.session.stop();
    f.media.dispatchEvent(new Event("canplay")); f.media.dispatchEvent(new Event("playing"));
    expect(f.state()).toMatchObject({ phase: "stopped", current: 0 });
    expect(f.media.paused).toBe(true);
  });
  it("replays an ended sound immediately", async () => {
    const f = fixture();
    mediaMetadata(f.media, 0.18);
    await f.session.play();
    f.media.currentTime = 0.18; f.media.dispatchEvent(new Event("ended"));
    expect(f.state()?.phase).toBe("ended");
    await f.session.play();
    expect(f.media.currentTime).toBe(0);
    f.media.dispatchEvent(new Event("playing"));
    expect(f.state()?.phase).toBe("playing");
  });
  it("seeks only with a finite known duration and keeps an ended seek position", () => {
    const f = fixture();
    mediaMetadata(f.media, Infinity); f.session.seek(3);
    expect(f.media.currentTime).toBe(0);
    mediaMetadata(f.media, 10); f.session.seek(12);
    expect(f.media.currentTime).toBe(10);
    f.media.dispatchEvent(new Event("ended")); f.session.seek(3);
    expect(f.state()).toMatchObject({ phase: "paused", current: 3, duration: 10 });
  });
  it("makes buffering and decode errors observable", async () => {
    const f = fixture();
    await f.session.play(); f.media.dispatchEvent(new Event("playing"));
    f.media.dispatchEvent(new Event("waiting"));
    expect(f.state()?.phase).toBe("loading");
    f.media.dispatchEvent(new Event("error"));
    expect(f.state()?.phase).toBe("error");
    expect(f.state()?.error.length).toBeGreaterThan(0);
  });
  it("keeps a failed selected source failed during metadata refresh", () => {
    const f = fixture(); f.media.dispatchEvent(new Event("error"));
    f.session.select("/fixture.wav");
    expect(f.state()?.phase).toBe("error");
  });
  it("allows only the latest editor session to play", async () => {
    const a = fixture(); const b = fixture();
    await a.session.play(); a.media.dispatchEvent(new Event("playing"));
    await b.session.play(); b.media.dispatchEvent(new Event("playing"));
    expect(a.media.paused).toBe(true);
    expect(a.state()?.phase).toBe("stopped");
    expect(b.state()?.phase).toBe("playing");
  });
  it("releases source and listeners on disposal", async () => {
    const f = fixture(); await f.session.play();
    f.session.dispose(); const count = f.states.length;
    f.media.dispatchEvent(new Event("error")); f.media.dispatchEvent(new Event("playing"));
    expect(f.states).toHaveLength(count);
    expect(f.host.querySelector("audio")).toBeNull();
    expect(f.media.hasAttribute("src")).toBe(false);
    expect(f.media.paused).toBe(true);
  });
  it("keeps cross-origin playback native until pan is requested", () => {
    const f = fixture(); f.session.select("https://audio.example/no-cors.mp3");
    expect(previewMedia(f.host).hasAttribute("crossorigin")).toBe(false);
    f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: -40 });
    expect(previewMedia(f.host).crossOrigin).toBe("anonymous");
  });
  it("applies volume, tempo and a media-position-driven fade without timers", async () => {
    const f = fixture();
    f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, volume: 40, tempo: 135, fade: 4 });
    await f.session.play();
    expect(f.media.volume).toBe(0); expect(f.media.playbackRate).toBe(1.35);
    f.media.currentTime = 2; f.media.dispatchEvent(new Event("timeupdate"));
    expect(f.media.volume).toBeCloseTo(0.2);
    f.media.currentTime = 4; f.media.dispatchEvent(new Event("timeupdate"));
    expect(f.media.volume).toBeCloseTo(0.4);
  });
  it.each([[0.18, "0:00.18"], [0, "0:00"], [84.636725, "1:24"], [null, "--:--"]] as const)("formats meaningful preview time %s", (seconds, expected) => {
    expect(audioPreviewTime(seconds)).toBe(expected);
  });
  it("preserves fade progress across a music loop, seek and pause", async () => {
    const f = fixture();
    f.session.select("/loop.wav", "", true);
    const media = previewMedia(f.host);
    mediaMetadata(media, 2);
    f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, fade: 4 });
    await f.session.play();
    media.currentTime = 1.5; media.dispatchEvent(new Event("timeupdate"));
    expect(media.volume).toBeCloseTo(0.375);
    media.currentTime = 0.5; media.dispatchEvent(new Event("timeupdate"));
    expect(media.loop).toBe(true); expect(media.volume).toBeCloseTo(0.625);
    f.session.seek(1.5); media.dispatchEvent(new Event("timeupdate"));
    expect(media.volume).toBeCloseTo(0.625);
    f.session.pause(); await f.session.play();
    media.currentTime = 1.75; media.dispatchEvent(new Event("timeupdate"));
    expect(media.volume).toBeCloseTo(0.6875);
  });
  it("connects real pan routing and disposes every WebAudio resource", async () => {
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const panner = { pan: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
    const close = vi.fn().mockResolvedValue(undefined);
    const destination = {};
    const createSource = vi.fn(() => source);
    vi.stubGlobal("AudioContext", class {
      destination = destination;
      createMediaElementSource = createSource;
      createStereoPanner = () => panner;
      resume = () => Promise.resolve();
      close = close;
    });
    const f = fixture();
    f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: -40 });
    await f.session.play();
    expect(createSource).toHaveBeenCalledWith(previewMedia(f.host));
    expect(source.connect).toHaveBeenCalledWith(panner);
    expect(panner.connect).toHaveBeenCalledWith(destination);
    expect(panner.pan.value).toBe(-0.4);
    f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: 80 });
    expect(panner.pan.value).toBe(0.8);
    f.session.dispose();
    expect(source.disconnect).toHaveBeenCalledOnce(); expect(panner.disconnect).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
  });
  it("does not recreate a failed pan session after disposal", async () => {
    const f = fixture();
    f.session.configure({ ...AUDIO_PREVIEW_DEFAULTS, pan: -40 });
    previewMedia(f.host).dispatchEvent(new Event("error"));
    f.session.dispose();
    await f.session.play();
    expect(f.host.querySelector("audio")).toBeNull();
  });
});
