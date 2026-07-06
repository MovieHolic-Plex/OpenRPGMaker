// player/audio/index.ts
// 오디오 엔진 싱글턴 + playAudio/stopAudio 명령 연결 헬퍼.
// 플레이어 런타임(playSceneInterpreter/playSceneSchedulers/PlayScene)에서 사용한다.

import type { AudioChannel, AudioCommandState } from "@/project/session";
import type { Project } from "@/project/types";
import { AudioEngine } from "./audioEngine";
import { audioChannelForCommand, resolveAudioSource } from "./audioResources";

export { AudioEngine } from "./audioEngine";
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
export function playAudioCommand(
  step: { readonly resourceId: string; readonly loop: boolean },
  project: Pick<Project, "assets">
): void {
  const url = resolveAudioSource(step.resourceId, project);
  if (url === null) return;
  const channel = audioChannelForCommand(step.loop);
  getAudioEngine().play(channel, step.resourceId, url, step.loop);
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
export function resumeAudioState(audio: AudioCommandState, project: Pick<Project, "assets">): void {
  getAudioEngine().resumeFromState(audio, (resourceId) => resolveAudioSource(resourceId, project));
}

// 씬 종료/모드 전환: 모든 오디오 즉시 정지.
export function stopAllAudio(): void {
  if (engine === null) return;
  engine.stopAll(false);
}
