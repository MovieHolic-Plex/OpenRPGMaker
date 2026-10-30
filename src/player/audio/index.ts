import { getPlayerPreferences } from '@/player/playerPreferences';
// player/audio/index.ts
// 오디오 엔진 싱글턴 + playAudio/stopAudio 명령 연결 헬퍼.
// 플레이어 런타임(playSceneInterpreter/playSceneSchedulers/PlayScene)에서 사용한다.

import type { AudioChannel, AudioCommandState, AudioTrackState } from "@/project/session";
import type { Project } from "@/project/types";
import { AudioEngine, type AudioPlayOptions } from "./audioEngine";
import { authoredTrackGain } from "./fade";
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
export { authoredTrackGain, authoredVolumePercent, computeFadeVolume, duckGainAt, isFadeComplete, clampVolume } from "./fade";

let engine: AudioEngine | null = null;

// 엔진 싱글턴. 최초 접근 시 자동재생 언락 리스너 설치.
export function getAudioEngine(options?: { readonly qaInstrumentation: boolean }): AudioEngine {
  if (engine === null) {
    engine = new AudioEngine(options);
    const prefs = getPlayerPreferences();
    engine.setVolume("bgm", prefs.bgm);
    engine.setVolume("se", prefs.se);
    engine.installUnlockListeners();
  } else if (options !== undefined) {
    engine.setQaInstrumentation(options.qaInstrumentation);
  }
  return engine;
}

/** 엔진 기본 SE 음량(audioEngine volumes.se) — Web Audio 전투 샘플은 이 값에서의 크기로 맞춰져 있다. */
const DEFAULT_SE_MIX = 0.8;

/**
 * Web Audio 로 곧장 나가는 효과음(전투 샘플)이 곱할 사용자 SE 음량 배율. 기본 설정이면 1.
 * 엔진을 새로 만들지 않는다(편집기 미리보기에서도 부른다).
 */
export function seMixScale(): number {
  const se = engine ? engine.getVolume("se") : getPlayerPreferences().se;
  return Number.isFinite(se) ? Math.max(0, se) / DEFAULT_SE_MIX : 1;
}

/** 효과음이 울리는 동안 BGM 을 잠깐 낮춘다. 엔진이 없으면(BGM 이 없으면) 아무것도 안 한다. */
export function duckBgmForEffect(level: number, holdMs: number): void {
  engine?.duckBgm(level, holdMs);
}

// playAudio 명령: 리소스 해석 후 재생. 해석 실패 시 조용히 no-op.
// Explicit channel/options override the legacy loop-derived channel.
export function playAudioCommand(
  step: AudioTrackState & { readonly channel?: AudioChannel },
  project: Pick<Project, "assets">,
  options?: AudioPlayOptions
): void {
  const url = resolveAudioSource(step.resourceId, project);
  if (url === null) return;
  const channel = step.channel ?? audioChannelForCommand(step.loop);
  // options 가 없으면 5번짜 인자를 **전달하지 않는다** — `undefined` 도 인자로 기록되서
  // 기존 호출 계약을 단정하는 테스트(test/cc0AudioPlayback.test.ts)가 깨진다.
  if (options === undefined && step.volume === undefined && step.fadeInMs === undefined) {
    getAudioEngine().play(channel, step.resourceId, url, step.loop);
    return;
  }
  getAudioEngine().play(channel, step.resourceId, url, step.loop, {
    ...options,
    ...(step.volume === undefined ? {} : { gain: authoredTrackGain(step.volume) }),
    ...(step.fadeInMs === undefined ? {} : { fadeInMs: step.fadeInMs }),
  });
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

/**
 * 위치음 한 번(발소리 등): 음량 배율 gain(0..1)·좌우 pan(-1..1). 엔진 밸런스 값은 바꾸지 않는다.
 * 잠금 해제 전이면 큐에 쌓지 않는다 — 지나간 발소리를 나중에 몰아 들려주면 안 된다.
 */
export function playPositionalSound(
  resourceId: string,
  project: Pick<Project, "assets">,
  mix: { readonly gain: number; readonly pan: number },
): boolean {
  const id = resourceId.trim();
  if (!id) return false;
  const audio = getAudioEngine();
  if (!audio.isUnlocked()) return false;
  const url = resolveAudioSource(id, project);
  if (url === null) return false;
  audio.play("se", id, url, false, { gain: mix.gain, pan: mix.pan, positional: true });
  return true;
}

/** 숨어 있는 동안의 고리음(interaction.heldSe)을 맞춘다 — resourceId 가 없으면 끈다. */
export function syncHeldLoop(resourceId: string | undefined, project: Pick<Project, "assets">): void {
  const id = resourceId?.trim();
  // 고리가 없고 켤 것도 없으면 엔진을 만들지 않는다(편집기 미리보기·헤드리스).
  if (!id && (engine === null || engine.heldLoopResourceId() === null)) return;
  const audio = getAudioEngine();
  if (!id) { audio.holdLoop(null, null); return; }
  if (audio.heldLoopResourceId() === id) return;
  audio.holdLoop(id, resolveAudioSource(id, project));
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

/** 모드 전환이 오디오 소유권을 가져갔다는 표시(Phaser 게임 registry 에 심는다).
 *  게임 파괴는 다음 프레임에 실제로 일어나므로, 이전 씬의 teardown 이 그때 공유 엔진을
 *  통째로 멈추면 이미 켜 둔 새 트랙(타이틀 BGM)까지 사라진다. */
export const AUDIO_HANDOFF_REGISTRY_KEY = "audioHandoffOwned";
