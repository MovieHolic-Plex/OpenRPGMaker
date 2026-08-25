// player/audio/audioEngine.ts
// 실제 재생 엔진(브라우저 전용). HTMLAudioElement 기반.
// - BGM/BGS: 루프 재생, 트랙 교체 시 크로스페이드, 정지 시 페이드아웃.
// - ME/SE: 원샷 재생(동시 다중 허용).
// - 볼륨: BGM 그룹 / SE 그룹 분리.
// - 자동재생 정책: unlock(첫 사용자 입력) 전 요청은 큐잉 후 방출.
// 순수 로직(큐/페이드/리소스 해석)은 audioQueue/fade/audioResources 에 분리돼 단위 테스트된다.

import type { AudioChannel } from "@/project/session";
import { clampVolume, computeFadeVolume, isFadeComplete } from "./fade";
import {
  createAudioQueueState,
  requestAudio,
  unlockQueue,
  clearPending,
  type AudioQueueState,
  type AudioRequest,
} from "./audioQueue";
import { isLoopingChannel, volumeGroupForChannel, type AudioVolumeGroup } from "./audioResources";

const DEFAULT_FADE_MS = 600;
const FADE_TICK_MS = 40;
const UNLOCK_EVENTS: readonly string[] = ["pointerdown", "keydown", "touchstart"];

interface ManagedTrack {
  channel: AudioChannel;
  resourceId: string;
  readonly audio: HTMLAudioElement;
  fadeTimer: number | null;
}

// 페이드 진행 상태(경과 계산용). performance.now 미가용 환경 대비 Date.now 폴백.
function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export class AudioEngine {
  private queue: AudioQueueState = createAudioQueueState();
  private readonly loopTracks: Map<AudioChannel, ManagedTrack> = new Map();
  private readonly oneShots: Set<HTMLAudioElement> = new Set();
  private volumes: Record<AudioVolumeGroup, number> = { bgm: 0.7, se: 0.8 };
  private unlockInstalled = false;
  private readonly warnedMissing: Set<string> = new Set();

  // 사용자 입력 언락 리스너 설치(1회). 브라우저 자동재생 정책 대응.
  installUnlockListeners(): void {
    if (this.unlockInstalled) return;
    if (typeof window === "undefined") return;
    this.unlockInstalled = true;
    for (const type of UNLOCK_EVENTS) {
      window.addEventListener(type, this.onUnlockGesture, { once: false, passive: true });
    }
  }

  private readonly onUnlockGesture = (): void => {
    this.unlock();
  };

  // 잠금 해제 + 대기 큐 방출.
  unlock(): void {
    if (this.queue.unlocked) return;
    const { state, flushed } = unlockQueue(this.queue);
    this.queue = state;
    for (const request of flushed) {
      this.playNow(request);
    }
  }

  isUnlocked(): boolean {
    return this.queue.unlocked;
  }

  setVolume(group: AudioVolumeGroup, volume: number): void {
    this.volumes[group] = clampVolume(volume);
    // 재생 중인 루프 트랙에 즉시 반영(원샷은 자연 종료).
    for (const track of this.loopTracks.values()) {
      if (volumeGroupForChannel(track.channel) === group && track.fadeTimer === null) {
        track.audio.volume = this.targetVolumeFor(track.channel);
      }
    }
  }

  getVolume(group: AudioVolumeGroup): number {
    return this.volumes[group];
  }

  // playAudio 명령 처리. url 이 이미 해석된 상태로 전달된다.
  play(channel: AudioChannel, resourceId: string, url: string, loop: boolean): void {
    if (typeof window === "undefined" || typeof Audio === "undefined") return;
    // Browser-QA 관찰 훅: 재생 지시를 받은 리소스를 기록한다(로드/재생 도달 증명).
    if (typeof window !== "undefined") {
      const holder = window as unknown as { __oprnAudioObserved?: string[] };
      if (!Array.isArray(holder.__oprnAudioObserved)) holder.__oprnAudioObserved = [];
      holder.__oprnAudioObserved.push(resourceId);
    }
    const request: AudioRequest = { channel, resourceId, url, loop };
    const { state, immediate } = requestAudio(this.queue, request);
    this.queue = state;
    if (immediate) this.playNow(immediate);
  }

  // 채널 정지(루프: 페이드아웃, 원샷: 즉시 성격상 대상 아님).
  stopChannel(channel: AudioChannel, fadeMs: number = DEFAULT_FADE_MS): void {
    // 아직 재생되지 않은 대기 요청도 제거.
    this.queue = this.dropPending(channel);
    const track = this.loopTracks.get(channel);
    if (!track) return;
    this.loopTracks.delete(channel);
    this.fadeOutAndDispose(track, fadeMs);
  }

  // 세이브 로드/씬 종료: 모든 오디오 정지.
  stopAll(fade = false): void {
    this.queue = clearPending(this.queue);
    for (const track of this.loopTracks.values()) {
      if (fade) {
        this.fadeOutAndDispose(track, DEFAULT_FADE_MS);
      } else {
        this.disposeTrack(track);
      }
    }
    this.loopTracks.clear();
    for (const audio of this.oneShots) {
      this.hardStop(audio);
    }
    this.oneShots.clear();
  }

  // 세이브 상태의 루프 채널(BGM/BGS) 재개. 원샷은 복원하지 않는다.
  resumeFromState(
    audio: Partial<Record<AudioChannel, { readonly resourceId: string; readonly loop: boolean }>>,
    resolve: (resourceId: string) => string | null
  ): void {
    for (const channel of ["bgm", "bgs"] as const) {
      const track = audio[channel];
      if (!track || !isLoopingChannel(channel)) continue;
      const url = resolve(track.resourceId);
      if (url === null) {
        this.warnMissing(track.resourceId);
        continue;
      }
      this.play(channel, track.resourceId, url, track.loop);
    }
  }

  // ── 내부 ──

  private playNow(request: AudioRequest): void {
    if (isLoopingChannel(request.channel)) {
      this.playLoop(request);
    } else {
      this.playOneShot(request);
    }
  }

  private playLoop(request: AudioRequest): void {
    const existing = this.loopTracks.get(request.channel);
    // 같은 트랙이 이미 루프 중이면 재시작하지 않는다(RM2K3 동작).
    if (existing && existing.resourceId === request.resourceId) return;
    if (existing) {
      this.loopTracks.delete(request.channel);
      this.fadeOutAndDispose(existing, DEFAULT_FADE_MS);
    }
    const audio = this.createElement(request.url, true);
    const target = this.targetVolumeFor(request.channel);
    audio.volume = 0;
    const track: ManagedTrack = { channel: request.channel, resourceId: request.resourceId, audio, fadeTimer: null };
    this.loopTracks.set(request.channel, track);
    this.startPlayback(audio, request.resourceId);
    this.fadeTo(track, 0, target, DEFAULT_FADE_MS);
  }

  private playOneShot(request: AudioRequest): void {
    const audio = this.createElement(request.url, false);
    audio.volume = this.targetVolumeFor(request.channel);
    this.oneShots.add(audio);
    const cleanup = (): void => {
      this.oneShots.delete(audio);
      audio.removeEventListener("ended", cleanup);
      audio.removeEventListener("error", cleanup);
    };
    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", cleanup);
    this.startPlayback(audio, request.resourceId);
  }

  private createElement(url: string, loop: boolean): HTMLAudioElement {
    const audio = new Audio(url);
    audio.loop = loop;
    audio.preload = "auto";
    return audio;
  }

  private startPlayback(audio: HTMLAudioElement, resourceId: string): void {
    const result = audio.play();
    if (result && typeof result.catch === "function") {
      void result.catch((error: unknown) => {
        // 자동재생 차단(NotAllowedError)은 조용히 무시 — unlock 후 재요청 흐름으로 커버.
        if (error instanceof DOMException) return;
        this.warnMissing(resourceId);
      });
    }
  }

  private targetVolumeFor(channel: AudioChannel): number {
    return this.volumes[volumeGroupForChannel(channel)];
  }

  private fadeOutAndDispose(track: ManagedTrack, fadeMs: number): void {
    if (fadeMs <= 0) {
      this.disposeTrack(track);
      return;
    }
    this.fadeTo(track, track.audio.volume, 0, fadeMs, () => this.disposeTrack(track));
  }

  private fadeTo(
    track: ManagedTrack,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void
  ): void {
    this.clearFade(track);
    if (typeof window === "undefined" || durationMs <= 0) {
      track.audio.volume = clampVolume(to);
      onComplete?.();
      return;
    }
    const startedAt = nowMs();
    track.audio.volume = clampVolume(from);
    track.fadeTimer = window.setInterval(() => {
      const elapsed = nowMs() - startedAt;
      track.audio.volume = computeFadeVolume(from, to, elapsed, durationMs);
      if (isFadeComplete(elapsed, durationMs)) {
        this.clearFade(track);
        track.audio.volume = clampVolume(to);
        onComplete?.();
      }
    }, FADE_TICK_MS);
  }

  private clearFade(track: ManagedTrack): void {
    if (track.fadeTimer !== null && typeof window !== "undefined") {
      window.clearInterval(track.fadeTimer);
    }
    track.fadeTimer = null;
  }

  private disposeTrack(track: ManagedTrack): void {
    this.clearFade(track);
    this.hardStop(track.audio);
  }

  private hardStop(audio: HTMLAudioElement): void {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
    } catch {
      // 일부 환경에서 src 리셋이 예외를 던질 수 있으나 정지 목적은 달성됨.
    }
  }

  private dropPending(channel: AudioChannel): AudioQueueState {
    if (isLoopingChannel(channel)) {
      const { [channel]: _dropped, ...rest } = this.queue.loopPending;
      return { ...this.queue, loopPending: rest };
    }
    return { ...this.queue, oneShotPending: this.queue.oneShotPending.filter((r) => r.channel !== channel) };
  }

  private warnMissing(resourceId: string): void {
    if (this.warnedMissing.has(resourceId)) return;
    this.warnedMissing.add(resourceId);
    console.warn(`[audio] 오디오 리소스를 재생할 수 없습니다: ${resourceId}`);
  }
}
