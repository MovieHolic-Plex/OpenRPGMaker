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
// Explicit channel/options override the legacy loop-derived channel.
export function playAudioCommand(
  step: { readonly resourceId: string; readonly loop: boolean; readonly channel?: AudioChannel; readonly volume?: number; readonly fadeInMs?: number },
  project: Pick<Project, "assets">,
  options?: AudioPlayOptions
): void {
  const url = resolveAudioSource(step.resourceId, project);
  if (url === null) return;
  const channel = step.channel ?? audioChannelForCommand(step.loop);
  const playback = step.volume === undefined && step.fadeInMs === undefined ? options : {
    ...(step.volume === undefined ? {} : { volume: step.volume }),
    ...(step.fadeInMs === undefined ? {} : { fadeInMs: step.fadeInMs }),
    ...options,
  };
  if (playback === undefined) {
    getAudioEngine().play(channel, step.resourceId, url, step.loop);
    return;
  }
  getAudioEngine().play(channel, step.resourceId, url, step.loop, playback);
}

// stopAudio 명령: 모든 채널 정지(페이드아웃).
export function stopAudioCommand(): void {
  getAudioEngine().stopAll(true);
}

/** 저작된 원샷 음악(ME). URL 을 못 풀면 false — 호출부가 폴백을 낸다. */
export function playMusicEffect(
  resourceId: string | undefined,
  project: Pick<Project, "assets">,
): boolean {
  return playChannelResource("me", resourceId, project);
}

/** 저작된 효과음. URL 을 못 풀면 false. */
export function playSoundEffect(
  resourceId: string | undefined,
  project: Pick<Project, "assets">,
): boolean {
  return playChannelResource("se", resourceId, project);
}

function playChannelResource(
  channel: AudioChannel,
  resourceId: string | undefined,
  project: Pick<Project, "assets">,
): boolean {
  const id = resourceId?.trim();
  if (!id) return false;
  const url = resolveAudioSource(id, project);
  if (url === null) return false;
  getAudioEngine().play(channel, id, url, false);
  return true;
}

// 특정 채널만 정지.
export function stopAudioChannel(channel: AudioChannel, fadeMs?: number): void {
  if (fadeMs === undefined) {
    getAudioEngine().stopChannel(channel);
    return;
  }
  getAudioEngine().stopChannel(channel, fadeMs);
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
