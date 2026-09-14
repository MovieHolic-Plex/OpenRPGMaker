/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playCinematicSequence, type CinematicPlayback } from "@/player/cinematicSequence";
import { createBlankProject } from "@/project/defaults";
import type { CinematicScene, Project } from "@/project/types";

const scenes: CinematicScene[] = [
  { id: "one", kind: "text", narration: "첫 장면", durationMs: 0 },
  { id: "two", kind: "text", narration: "둘째 장면", durationMs: 0 },
];
let host: HTMLElement;
let project: Project;
let controller: AbortController;
let playback: CinematicPlayback | undefined;
const play = vi.fn<() => Promise<void>>();
const pause = vi.fn();

function start(musicResourceId?: string, skippable = true): CinematicPlayback {
  playback = playCinematicSequence({
    host,
    project,
    sequence: { enabled: true, skippable, scenes, ...(musicResourceId ? { musicResourceId } : {}) },
    signal: controller.signal,
  });
  return playback;
}
function root(): HTMLElement {
  const node = host.querySelector<HTMLElement>('[data-testid="cinematic-sequence"]');
  if (!node) throw new Error("Missing cinematic root");
  return node;
}
function music(): HTMLAudioElement | null {
  return host.querySelector<HTMLAudioElement>('[data-testid="cinematic-music"]');
}
function press(key: string): void {
  (document.activeElement ?? document).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  project = createBlankProject();
  project.assets.uploaded = {
    bgm: { id: "bgm", name: "오프닝 곡", kind: "music", dataUrl: "data:audio/ogg;base64,AQID", meta: {} },
  };
  host = document.createElement("div");
  document.body.append(host);
  controller = new AbortController();
  play.mockReset().mockResolvedValue();
  pause.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
});

afterEach(() => {
  playback?.teardown();
  playback = undefined;
  controller.abort();
  host.remove();
  vi.restoreAllMocks();
});

describe("오프닝 배경음악 재생", () => {
  it("음악이 없으면 오디오 요소를 만들지 않는다", () => {
    start();
    expect(music()).toBeNull();
    expect(root().dataset.music).toBeUndefined();
  });

  it("시퀀스 시작에 반복 재생하고 장면이 넘어가도 끊지 않는다", () => {
    start("bgm");
    const audio = music();
    expect(audio).not.toBeNull();
    expect(audio?.loop).toBe(true);
    expect(root().dataset.music).toBe("bgm");
    expect(play).toHaveBeenCalled();
    press("Enter");
    expect(root().dataset.sceneId).toBe("two");
    expect(music()).toBe(audio);
    expect(pause).not.toHaveBeenCalled();
  });

  it("끝나면 멈추고 정리한다", async () => {
    const run = start("bgm");
    press("Enter");
    press("Enter");
    await expect(run.done).resolves.toBe("completed");
    expect(pause).toHaveBeenCalled();
    expect(music()).toBeNull();
  });

  it("건너뛰어도 멈춘다", async () => {
    const run = start("bgm");
    press("Escape");
    await expect(run.done).resolves.toBe("skipped");
    expect(pause).toHaveBeenCalled();
  });

  it("재생할 수 없는 음악은 장면 진행을 막지 않는다", () => {
    start("없는-곡");
    expect(root().dataset.mediaState).toBe("ready");
    press("Enter");
    expect(root().dataset.sceneId).toBe("two");
  });
});
