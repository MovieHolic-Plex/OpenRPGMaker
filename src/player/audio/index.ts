// player/audio/index.ts
// 오디오 엔진 싱글턴 + playAudio/stopAudio 명령 연결 헬퍼.
// 플레이어 런타임(playSceneInterpreter/playSceneSchedulers/PlayScene)에서 사용한다.

import type { AudioChannel, AudioCommandState } from "@/project/session";
import type { Project } from "@/project/types";
import { AudioEngine, type AudioPlayOptions } from "./audioEngine";
import { audioChannelForCommand, resolveAudioSource } from "./audioResources";

export { AudioEngine, type AudioPlayOptions, type AudioStateSnapshot } from "./audioEngine";
export {
  resolveAudioSource,
  audioChannelForCommand,
  isLoopingChannel,
  volumeGroupForChannel,
  type AudioVolumeGroup,
} from "./audioResources";
export {
  createAudioQueueState,
  requestAudio,
  unlockQueue,
  clearPending,
  type AudioQueueState,
  type AudioRequest,
} from "./audioQueue";
export { computeFadeVolume, isFadeComplete, clampVolume } from "./fade";

let engine: AudioEngine | null = null;

// 엔진 싱글턴. 최초 접근 시 자동재생 언락 리스너 설치.
export function getAudioEngine(): AudioEngine {
  if (engine === null) {
    engine = new AudioEngine();
    engine.installUnlockListeners();
  }
  return engine;
}

// playAudio 명령: 리소스 해석 후 재생. 해석 실패 시 조용히 no-op.
// options 는 선택적이다 — 기존 호출부(플레이어 런타임 전량)는 그대로 동작한다.
export function playAudioCommand(
  step: { readonly resourceId: string; readonly loop: boolean },
  project: Pick<Project, "assets">,
  options?: AudioPlayOptions
): void {
  const url = resolveAudioSource(step.resourceId, project);
  if (url === null) return;
  const channel = audioChannelForCommand(step.loop);
  // options 가 없으면 5번짜 인자를 **전달하지 않는다** — `undefined` 도 인자로 기록되서
  // 기존 호출 계약을 단정하는 테스트(test/cc0AudioPlayback.test.ts)가 깨진다.
  if (options === undefined) {
    getAudioEngine().play(channel, step.resourceId, url, step.loop);
    return;
  }
  getAudioEngine().play(channel, step.resourceId, url, step.loop, options);
}

// stopAudio 명령: 모든 채널 정지(페이드아웃).
export function stopAudioCommand(): void {
  getAudioEngine().stopAll(true);
}

// 특정 채널만 정지.
export function stopAudioChannel(channel: AudioChannel): void {
  getAudioEngine().stopChannel(channel);
}

// 세이브 로드 후 BGM/BGS 재개.
export function resumeAudioState(
  audio: AudioCommandState,
  project: Pick<Project, "assets">,
  options?: AudioPlayOptions
): void {
  getAudioEngine().resumeFromState(audio, (resourceId) => resolveAudioSource(resourceId, project), options);
}

// 엔진에 적용된 현재 재생 컨트롤 값(볼륨/속도/밸런스/페이드인). 편집기 모달·QA 가 읽는다.
export function audioStateSnapshot(): ReturnType<AudioEngine["audioStateSnapshot"]> {
  return getAudioEngine().audioStateSnapshot();
}

// 씬 종료/모드 전환: 모든 오디오 즉시 정지.
export function stopAllAudio(): void {
  if (engine === null) return;
  engine.stopAll(false);
}
