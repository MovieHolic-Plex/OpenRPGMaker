/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "@/player/audio/audioEngine";
import { listAudioFailures, playAudioCommand, resetAudioFailuresForTest } from "@/player/audio";
import { AudioPreviewSession, type AudioPreviewState } from "@/editor/panels/audioPreviewSession";
import { installPreviewMedia, previewMedia } from "./support/previewMedia";

type DiagnosticWindow = Window & {
  __oprnAudioState?: () => ReturnType<AudioEngine["audioStateSnapshot"]>;
  __oprnAudioFailures?: () => ReturnType<typeof listAudioFailures>;
};
const diagnostic: DiagnosticWindow = window;

beforeEach(() => {
  resetAudioFailuresForTest();
  installPreviewMedia();
});
afterEach(() => {
  delete diagnostic.__oprnAudioState;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("audio failure diagnostics", () => {
  it("records an engine load failure once in the structured state", () => {
    const engine = new AudioEngine({ qaInstrumentation: true });
    expect(diagnostic.__oprnAudioState?.().failures).toEqual([]);
    engine.unlock();
    engine.play("bgm", "missing-bgm", "/missing.mp3", true, { fadeInMs: 0 });
    document.querySelector("audio")?.dispatchEvent(new Event("error"));
    const failures = diagnostic.__oprnAudioState?.().failures;
    expect(failures).toHaveLength(1);
    expect(failures?.[0]).toMatchObject({ resourceId: "missing-bgm", reason: "load-error", channel: "bgm" });
    expect(typeof failures?.[0]?.at).toBe("number");
    expect(diagnostic.__oprnAudioFailures?.()).toEqual(failures);
    engine.stopAll();
    engine.setQaInstrumentation(false);
  });

  it("records a resource that cannot be resolved instead of dropping it silently", () => {
    playAudioCommand({ resourceId: "no-such-resource", loop: true }, { assets: { sprites: {}, uploaded: {} } });
    expect(listAudioFailures()).toMatchObject([{ resourceId: "no-such-resource", reason: "unresolved", channel: "bgm" }]);
  });

  it("marks an unreachable preview source and records it under the resource id", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const session = new AudioPreviewSession(host);
    const states: AudioPreviewState[] = [];
    session.subscribe(state => states.push(state));
    session.select("/catalog/missing.mp3", "", true, "cc0-bgm-missing");
    const media = previewMedia(host);
    Object.defineProperty(media, "error", { value: { code: 4, message: "" } });
    media.dispatchEvent(new Event("error"));
    expect(states.at(-1)).toMatchObject({ phase: "error", unreachable: true });
    expect(listAudioFailures()).toMatchObject([{ resourceId: "cc0-bgm-missing", reason: "source", channel: "preview" }]);
    session.dispose();
  });
});
