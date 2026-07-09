// test/audioEngine.test.ts
// 오디오 엔진의 순수 로직 검증: 페이드 상태머신 / 자동재생 언락 큐 / 리소스 해석.
// (실제 HTMLAudioElement 재생은 브라우저 QA 로 검증 — node 환경에서는 순수 로직만)

import { describe, it, expect } from "vitest";
import { clampVolume, computeFadeVolume, isFadeComplete } from "@/player/audio/fade";
import {
  createAudioQueueState,
  requestAudio,
  unlockQueue,
  clearPending,
  type AudioRequest,
} from "@/player/audio/audioQueue";
import {
  audioChannelForCommand,
  isLoopingChannel,
  resolveAudioSource,
  volumeGroupForChannel,
} from "@/player/audio/audioResources";
import type { Project } from "@/project/types";

function req(overrides: Partial<AudioRequest> = {}): AudioRequest {
  return { channel: "bgm", resourceId: "track", url: "/x.mp3", loop: true, ...overrides };
}

function projectWithUploaded(uploaded: Project["assets"]["uploaded"]): Pick<Project, "assets"> {
  return { assets: { sprites: {}, uploaded } };
}

describe("fade 상태머신", () => {
  it("선형 보간: 시작/중간/끝", () => {
    expect(computeFadeVolume(0, 1, 0, 1000)).toBe(0);
    expect(computeFadeVolume(0, 1, 500, 1000)).toBeCloseTo(0.5);
    expect(computeFadeVolume(0, 1, 1000, 1000)).toBe(1);
  });

  it("페이드아웃 방향", () => {
    expect(computeFadeVolume(0.8, 0, 250, 1000)).toBeCloseTo(0.6);
  });

  it("경과가 범위를 벗어나면 클램프", () => {
    expect(computeFadeVolume(0, 1, -100, 1000)).toBe(0);
    expect(computeFadeVolume(0, 1, 5000, 1000)).toBe(1);
  });

  it("durationMs<=0 이면 즉시 목표값", () => {
    expect(computeFadeVolume(0, 1, 0, 0)).toBe(1);
    expect(computeFadeVolume(0.3, 0.9, 10, -5)).toBe(0.9);
  });

  it("isFadeComplete", () => {
    expect(isFadeComplete(0, 1000)).toBe(false);
    expect(isFadeComplete(999, 1000)).toBe(false);
    expect(isFadeComplete(1000, 1000)).toBe(true);
    expect(isFadeComplete(0, 0)).toBe(true);
  });

  it("clampVolume: 범위/비유한값", () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(Number.NaN)).toBe(0);
  });
});

describe("자동재생 언락 큐", () => {
  it("언락 전에는 큐잉되고 즉시 재생하지 않는다", () => {
    const state = createAudioQueueState();
    const { state: next, immediate } = requestAudio(state, req());
    expect(immediate).toBeNull();
    expect(next.unlocked).toBe(false);
    expect(next.loopPending.bgm?.resourceId).toBe("track");
  });

  it("언락 후에는 즉시 재생(immediate 반환)", () => {
    const state = { ...createAudioQueueState(), unlocked: true };
    const { immediate } = requestAudio(state, req({ resourceId: "boss" }));
    expect(immediate?.resourceId).toBe("boss");
  });

  it("루프 채널은 최신 요청만 유지(교체)", () => {
    let state = createAudioQueueState();
    state = requestAudio(state, req({ resourceId: "field" })).state;
    state = requestAudio(state, req({ resourceId: "town" })).state;
    expect(state.loopPending.bgm?.resourceId).toBe("town");
  });

  it("원샷 채널은 순서대로 누적", () => {
    let state = createAudioQueueState();
    state = requestAudio(state, req({ channel: "se", resourceId: "hit", loop: false })).state;
    state = requestAudio(state, req({ channel: "se", resourceId: "coin", loop: false })).state;
    expect(state.oneShotPending.map((r) => r.resourceId)).toEqual(["hit", "coin"]);
  });

  it("unlock 시 루프(bgm→bgs)→원샷 순으로 방출하고 큐를 비운다", () => {
    let state = createAudioQueueState();
    state = requestAudio(state, req({ channel: "se", resourceId: "se1", loop: false })).state;
    state = requestAudio(state, req({ channel: "bgs", resourceId: "wind", loop: true })).state;
    state = requestAudio(state, req({ channel: "bgm", resourceId: "main", loop: true })).state;
    const { state: unlocked, flushed } = unlockQueue(state);
    expect(flushed.map((r) => r.resourceId)).toEqual(["main", "wind", "se1"]);
    expect(unlocked.unlocked).toBe(true);
    expect(unlocked.loopPending).toEqual({});
    expect(unlocked.oneShotPending).toEqual([]);
  });

  it("clearPending 은 언락 상태를 유지하며 대기 큐만 비운다", () => {
    let state = { ...createAudioQueueState(), unlocked: true };
    state = requestAudio(state, req()).state; // unlocked 라 immediate — 큐 미변경
    state = { ...state, oneShotPending: [req({ channel: "se", loop: false })] };
    const cleared = clearPending(state);
    expect(cleared.unlocked).toBe(true);
    expect(cleared.oneShotPending).toEqual([]);
  });
});

describe("리소스 해석/분류", () => {
  it("loop 플래그로 채널 유도", () => {
    expect(audioChannelForCommand(true)).toBe("bgm");
    expect(audioChannelForCommand(false)).toBe("se");
  });

  it("루프 채널 판별", () => {
    expect(isLoopingChannel("bgm")).toBe(true);
    expect(isLoopingChannel("bgs")).toBe(true);
    expect(isLoopingChannel("me")).toBe(false);
    expect(isLoopingChannel("se")).toBe(false);
  });

  it("볼륨 그룹: se 만 SE, 나머지는 BGM", () => {
    expect(volumeGroupForChannel("se")).toBe("se");
    expect(volumeGroupForChannel("bgm")).toBe("bgm");
    expect(volumeGroupForChannel("bgs")).toBe("bgm");
    expect(volumeGroupForChannel("me")).toBe("bgm");
  });

  it("빈 resourceId 는 null", () => {
    expect(resolveAudioSource(undefined, projectWithUploaded({}))).toBeNull();
    expect(resolveAudioSource("  ", projectWithUploaded({}))).toBeNull();
  });

  it("업로드 오디오 리소스는 dataUrl 로 해석", () => {
    const project = projectWithUploaded({
      myBgm: { id: "myBgm", name: "내 BGM", kind: "music", dataUrl: "data:audio/mpeg;base64,QQ==", meta: {} },
    });
    expect(resolveAudioSource("myBgm", project)).toBe("data:audio/mpeg;base64,QQ==");
  });

  it("업로드된 비오디오(이미지) 리소스는 재생하지 않는다(null)", () => {
    const project = projectWithUploaded({
      pic: { id: "pic", name: "그림", kind: "picture", dataUrl: "data:image/png;base64,QQ==", meta: {} },
    });
    expect(resolveAudioSource("pic", project)).toBeNull();
  });

  it("번들 EasyRPG 음악 리소스는 경로로 해석", () => {
    const url = resolveAudioSource("easyrpg-music-church", projectWithUploaded({}));
    expect(url).toBe("/assets/easyrpg/music/Church.mid");
  });

  it("존재하지 않는 리소스는 null", () => {
    expect(resolveAudioSource("does-not-exist", projectWithUploaded({}))).toBeNull();
  });
});
