// player/audio/fade.ts
// 순수 페이드 상태머신. 볼륨 보간만 계산하며 DOM/타이머에 의존하지 않는다.
// 엔진(audioEngine)이 이 함수들로 실제 HTMLAudioElement 볼륨을 갱신한다.

// from → to 로 durationMs 동안 선형 보간한 볼륨(0~1)을 반환한다.
// durationMs <= 0 이면 즉시 목표값. elapsedMs 는 0..durationMs 범위 밖이어도 클램프한다.
export function computeFadeVolume(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return clampVolume(to);
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return clampVolume(from + (to - from) * t);
}

// 페이드가 끝났는지(경과가 지속시간 이상인지).
export function isFadeComplete(elapsedMs: number, durationMs: number): boolean {
  return durationMs <= 0 || elapsedMs >= durationMs;
}

// 볼륨을 0~1 로 클램프(HTMLMediaElement.volume 유효 범위).
export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  if (volume < 0) return 0;
  if (volume > 1) return 1;
  return volume;
}
