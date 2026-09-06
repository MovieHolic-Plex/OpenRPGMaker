// player/audio/audioEngine.ts
// 실제 재생 엔진(브라우저 전용). HTMLAudioElement 기반.
// - BGM/BGS: 루프 재생, 트랙 교체 시 크로스페이드, 정지 시 페이드아웃.
// - ME/SE: 원샷 재생(동시 다중 허용).
// - 볼륨: BGM 그룹 / SE 그룹 분리.
// - 자동재생 정책: unlock(첫 사용자 입력) 전 요청은 큐잉 후 방출.
// 순수 로직(큐/페이드/리소스 해석)은 audioQueue/fade/audioResources 에 분리돼 단위 테스트된다.

import type { AudioChannel, AudioCommandState } from "@/project/session";
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
// HTMLMediaElement.playbackRate 는 이론상 제한이 없지만 브라우저가 실제로 소리를 내는 범위는
// 대략 0.25~4 다. 그 밖의 값은 무음이 되어 "고장"으로 보이므로 여기서 클램프한다.
const MIN_PLAYBACK_RATE = 0.25;
const MAX_PLAYBACK_RATE = 4;
const UNLOCK_EVENTS: readonly string[] = ["pointerdown", "keydown", "touchstart"];

// 요청 단위 재생 옵션. 전부 선택적이므로 기존 호출부(playAudioCommand 등)는 그대로 동작한다.
export interface AudioPlayOptions {
  /** Per-track multiplier, 0..1; never changes the user mixer. */
  readonly gain?: number;
  // 이 요청의 페이드인 길이(ms). 생략 시 DEFAULT_FADE_MS.
  readonly fadeInMs?: number;
  // 재생 속도(템포). 지정하면 이 요청이 실제 재생될 때 적용된다.
  readonly playbackRate?: number;
  // 스테레오 밸런스(-1 왼쪽 … 1 오른쪽). 지정하면 이 요청이 실제 재생될 때 적용된다.
  readonly pan?: number;
}

// 브라우저 QA 가 읽는 현재 적용값 스냅숏.
export interface AudioStateSnapshot {
  readonly volume: Record<AudioVolumeGroup, number>;
  readonly playbackRate: number;
  readonly pan: number;
  readonly fadeInMs: number;
}

interface ManagedTrack {
  channel: AudioChannel;
  resourceId: string;
  readonly audio: HTMLAudioElement;
  fadeTimer: number | null;
  gain: number;
  // Fade envelope is independent of mixer/gain, including when either is zero.
  fadeLevel: number;
}

// 값 클램프(NaN 은 기본값으로).
function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
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
  private readonly oneShots: Set<ManagedTrack> = new Set();
  private readonly fadingTracks: Set<ManagedTrack> = new Set();
  private volumes: Record<AudioVolumeGroup, number> = { bgm: 0.7, se: 0.8 };
  private playbackRate = 1;
  private pan = 0;
  private fadeInMs = DEFAULT_FADE_MS;
  private unlockInstalled = false;
  private readonly warnedMissing: Set<string> = new Set();
  // WebAudio 팬 그래프는 **지연 생성**한다: pan 이 0 이 아닌 요청이 처음 올 때만 만든다.
  // AudioContext 가 없거나 createMediaElementSource 가 던지는 환경(jsdom/happy-dom)에서는
  // 조용히 건너뛰고 값만 보관한다.
  private audioContext: AudioContext | null = null;
  private webAudioUnavailable = false;
  private readonly panners: WeakMap<HTMLAudioElement, StereoPannerNode> = new WeakMap();

  private qaObservation: { readonly readState: () => AudioStateSnapshot; readonly resources: string[] } | null = null;

  constructor(options: { readonly qaInstrumentation?: boolean } = {}) {
    this.setQaInstrumentation(options.qaInstrumentation === true);
  }

  // The player shell owns this capability, including title audio and shell teardown.
  // Revocation removes only our QA publications; it never stops or resets playback.
  setQaInstrumentation(enabled: boolean): void {
    if (typeof window === "undefined") return;
    const holder: Window & {
      __oprnAudioState?: () => AudioStateSnapshot;
      __oprnAudioObserved?: string[];
    } = window;
    if (enabled === true) {
      if (this.qaObservation) return;
      this.qaObservation = { readState: () => this.audioStateSnapshot(), resources: [] };
      holder.__oprnAudioState = this.qaObservation.readState;
      holder.__oprnAudioObserved = this.qaObservation.resources;
    } else if (this.qaObservation) {
      if (holder.__oprnAudioState === this.qaObservation.readState) delete holder.__oprnAudioState;
      if (holder.__oprnAudioObserved === this.qaObservation.resources) delete holder.__oprnAudioObserved;
      this.qaObservation = null;
    }
  }

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
    // 재생 중인 트랙에 즉시 반영 — 정지 후 재생을 요구하지 않는다.
    for (const track of [...this.loopTracks.values(), ...this.oneShots, ...this.fadingTracks]) {
      if (volumeGroupForChannel(track.channel) === group) this.updateTrackVolume(track);
    }
  }

  getVolume(group: AudioVolumeGroup): number {
    return this.volumes[group];
  }

  // 재생 속도(템포). 재생 중인 모든 요소에 즉시 반영된다.
  setPlaybackRate(rate: number): void {
    this.playbackRate = clampNumber(rate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE, 1);
    for (const audio of this.liveElements()) {
      audio.playbackRate = this.playbackRate;
    }
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  // 스테레오 밸런스(-1 왼쪽 … 1 오른쪽). WebAudio 가 없으면 값만 보관한다.
  setPan(pan: number): void {
    this.pan = clampNumber(pan, -1, 1, 0);
    for (const audio of this.liveElements()) {
      this.applyPan(audio);
    }
  }

  getPan(): number {
    return this.pan;
  }

  // 다음 재생에 쓸 페이드인 길이(ms). 요청 옵션이 없을 때의 기본값이 된다.
  setFadeInMs(fadeInMs: number): void {
    this.fadeInMs = clampNumber(fadeInMs, 0, 60_000, DEFAULT_FADE_MS);
  }

  // 마지막으로 적용한(또는 다음 재생에 쓸) 페이드인 길이(ms).
  getFadeInMs(): number {
    return this.fadeInMs;
  }

  // 브라우저 QA 훅이 읽는 현재 적용값.
  audioStateSnapshot(): AudioStateSnapshot {
    return {
      volume: { ...this.volumes },
      playbackRate: this.playbackRate,
      pan: this.pan,
      fadeInMs: this.fadeInMs,
    };
  }

  // playAudio 명령 처리. url 이 이미 해석된 상태로 전달된다.
  play(channel: AudioChannel, resourceId: string, url: string, loop: boolean, options?: AudioPlayOptions): void {
    if (typeof window === "undefined" || typeof Audio === "undefined") return;
    // QA-only request observation, not proof of audible output or successful decoding.
    this.qaObservation?.resources.push(resourceId);
    const gain = options?.gain;
    const fadeInMs = options?.fadeInMs;
    const playbackRate = options?.playbackRate;
    const pan = options?.pan;
    const request: AudioRequest = {
      channel,
      resourceId,
      url,
      loop,
      ...(gain === undefined ? {} : { gain: clampVolume(gain) }),
      ...(fadeInMs === undefined ? {} : { fadeInMs: Math.max(0, fadeInMs) }),
      ...(playbackRate === undefined ? {} : { playbackRate }),
      ...(pan === undefined ? {} : { pan }),
    };
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
    for (const track of this.oneShots) {
      this.disposeTrack(track);
    }
    this.oneShots.clear();
    if (!fade) {
      for (const track of this.fadingTracks) this.disposeTrack(track);
    }
  }

  // 세이브 상태의 루프 채널(BGM/BGS) 재개. 원샷은 복원하지 않는다.
  resumeFromState(
    audio: AudioCommandState,
    resolve: (resourceId: string) => string | null,
    options?: AudioPlayOptions
  ): void {
    for (const channel of ["bgm", "bgs", "ambient"] as const) {
      const track = audio[channel];
      if (!track || !isLoopingChannel(channel)) continue;
      const url = resolve(track.resourceId);
      if (url === null) {
        this.warnMissing(track.resourceId);
        continue;
      }
      this.play(channel, track.resourceId, url, track.loop, {
        ...options,
        ...(track.volume === undefined ? {} : { gain: track.volume / 100 }),
        ...(track.fadeInMs === undefined ? {} : { fadeInMs: track.fadeInMs }),
      });
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

  // 이 요청에 적용할 페이드인 길이. 요청에 없으면 현재 기본값(setFadeInMs 로 바뀔 수 있다).
  // 적용값은 QA 훅에서 조회 가능하게 보관한다.
  private resolveFadeInMs(request: AudioRequest): number {
    const fadeInMs = request.fadeInMs === undefined ? this.fadeInMs : Math.max(0, request.fadeInMs);
    this.fadeInMs = fadeInMs;
    return fadeInMs;
  }

  private resolvePlaybackRate(request: AudioRequest): number {
    if (request.playbackRate !== undefined) {
      this.playbackRate = clampNumber(request.playbackRate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE, 1);
    }
    return this.playbackRate;
  }

  private resolvePan(request: AudioRequest): number {
    if (request.pan !== undefined) this.pan = clampNumber(request.pan, -1, 1, 0);
    return this.pan;
  }

  private playLoop(request: AudioRequest): void {
    const fadeInMs = this.resolveFadeInMs(request);
    const playbackRate = this.resolvePlaybackRate(request);
    const pan = this.resolvePan(request);
    const existing = this.loopTracks.get(request.channel);
    // 같은 트랙이 이미 루프 중이면 재시작하지 않는다(RM2K3 동작).
    if (existing && existing.resourceId === request.resourceId) {
      existing.audio.playbackRate = playbackRate;
      this.applyPan(existing.audio, pan);
      if (request.gain !== undefined) existing.gain = request.gain;
      this.updateTrackVolume(existing);
      return;
    }
    if (existing) {
      this.loopTracks.delete(request.channel);
      this.fadeOutAndDispose(existing, DEFAULT_FADE_MS);
    }
    const audio = this.createElement(request.url, true, playbackRate, pan);
    audio.volume = 0;
    const track: ManagedTrack = {
      channel: request.channel,
      resourceId: request.resourceId,
      audio,
      fadeTimer: null,
      gain: request.gain ?? 1,
      fadeLevel: 0,
    };
    this.loopTracks.set(request.channel, track);
    this.startPlayback(audio, request.resourceId);
    this.fadeTo(track, 0, 1, fadeInMs);
  }

  private playOneShot(request: AudioRequest): void {
    const fadeInMs = this.resolveFadeInMs(request);
    const playbackRate = this.resolvePlaybackRate(request);
    const pan = this.resolvePan(request);
    const audio = this.createElement(request.url, false, playbackRate, pan);
    const track: ManagedTrack = {
      channel: request.channel,
      resourceId: request.resourceId,
      audio,
      gain: request.gain ?? 1,
      fadeTimer: null,
      fadeLevel: 0,
    };
    this.oneShots.add(track);
    const cleanup = (): void => {
      this.clearFade(track);
      this.oneShots.delete(track);
      audio.removeEventListener("ended", cleanup);
      audio.removeEventListener("error", cleanup);
      audio.remove();
    };
    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", cleanup);
    // Native one-shots remain immediate unless this request explicitly authors a fade.
    this.fadeTo(track, 0, 1, request.fadeInMs === undefined ? 0 : fadeInMs);
    this.startPlayback(audio, request.resourceId);
  }

  private createElement(url: string, loop: boolean, playbackRate: number, pan: number): HTMLAudioElement {
    const audio = new Audio(url);
    audio.loop = loop;
    audio.preload = "auto";
    audio.playbackRate = playbackRate;
    this.applyPan(audio, pan);
    this.attachToDocument(audio);
    return audio;
  }

  // 생성한 오디오 요소를 문서에 달아도 재생 동작은 변하지 않는다(controls 없는 audio 는
  // 렌더링되지 않는다). 대싼 볼륨·재생속도가 실제 반영됐는지를 브라우저 QA 가
  // `document.querySelector("audio")` 로 교차 검증할 수 있게 된다.
  private attachToDocument(audio: HTMLAudioElement): void {
    if (typeof document === "undefined" || !document.body) return;
    try {
      audio.setAttribute("data-oprn-audio", "1");
      document.body.append(audio);
    } catch {
      // 향상 DOM 구현이 아닌 환경(단위 테스트 mock) — 재생 경로에는 아무 어향도 없다.
    }
  }

  // 재생 중인 모든 요소(루프 트랙 + 원샷).
  private *liveElements(): Generator<HTMLAudioElement> {
    for (const track of this.loopTracks.values()) yield track.audio;
    for (const track of this.oneShots) yield track.audio;
    for (const track of this.fadingTracks) yield track.audio;
  }

  // 팬 적용. 그래프가 아직 없고 중앙(0)이면 아무것도 만들지 않는다(지연 생성).
  private applyPan(audio: HTMLAudioElement, pan: number = this.pan): void {
    const existing = this.panners.get(audio);
    if (existing) {
      existing.pan.value = pan;
      return;
    }
    if (pan === 0) return;
    const panner = this.createPanner(audio);
    if (panner) panner.pan.value = pan;
  }

  private createPanner(audio: HTMLAudioElement): StereoPannerNode | null {
    const context = this.ensureAudioContext();
    if (context === null) return null;
    try {
      const source = context.createMediaElementSource(audio);
      const panner = context.createStereoPanner();
      source.connect(panner);
      panner.connect(context.destination);
      this.panners.set(audio, panner);
      return panner;
    } catch {
      // WebAudio 가 없거나 요소 라우팅이 거부된 환경 — 값만 보관하고 조용히 건너뛴다.
      this.webAudioUnavailable = true;
      return null;
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.webAudioUnavailable) return null;
    if (this.audioContext) return this.audioContext;
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (typeof Ctor !== "function") {
      this.webAudioUnavailable = true;
      return null;
    }
    try {
      const context = new Ctor();
      if (context.state === "suspended" && typeof context.resume === "function") void context.resume();
      this.audioContext = context;
      return context;
    } catch {
      this.webAudioUnavailable = true;
      return null;
    }
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

  private updateTrackVolume(track: ManagedTrack): void {
    track.audio.volume = this.volumes[volumeGroupForChannel(track.channel)] * track.gain * track.fadeLevel;
  }

  private fadeOutAndDispose(track: ManagedTrack, fadeMs: number): void {
    if (fadeMs <= 0) {
      this.disposeTrack(track);
      return;
    }
    this.fadingTracks.add(track);
    this.fadeTo(track, track.fadeLevel, 0, fadeMs, () => this.disposeTrack(track));
  }

  private fadeTo(
    track: ManagedTrack,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void
  ): void {
    this.clearFade(track);
    const target = clampVolume(to);
    if (typeof window === "undefined" || durationMs <= 0) {
      track.fadeLevel = target;
      this.updateTrackVolume(track);
      onComplete?.();
      return;
    }
    const startedAt = nowMs();
    track.fadeLevel = clampVolume(from);
    this.updateTrackVolume(track);
    track.fadeTimer = window.setInterval(() => {
      const elapsed = nowMs() - startedAt;
      track.fadeLevel = computeFadeVolume(from, target, elapsed, durationMs);
      this.updateTrackVolume(track);
      if (isFadeComplete(elapsed, durationMs)) {
        this.clearFade(track);
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
    this.fadingTracks.delete(track);
    this.clearFade(track);
    this.hardStop(track.audio);
  }

  private hardStop(audio: HTMLAudioElement): void {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      if (typeof audio.remove === "function") audio.remove();
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
