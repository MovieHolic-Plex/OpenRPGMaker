// player/audio/audioFailureLog.ts
// 재생 실패 기록. 엔진·편집기 미리듣기가 같은 목록에 적고, 조수·도구가 `window.__oprnAudioFailures()` 나
// QA 스냅숏(`__oprnAudioState().failures`)으로 읽는다. 순수 기록소라 성공 경로에서는 아무것도 하지 않는다.

export type AudioFailure = {
  readonly resourceId: string;
  /** 짧은 기계 판독용 사유(예: "unresolved", "network", "source", "decode", "play:NotAllowedError"). */
  readonly reason: string;
  /** 마지막으로 실패한 시각(epoch ms). */
  readonly at: number;
  readonly channel?: string;
};

const MAX_FAILURES = 50;

/** MediaError.code → 사유. 2 네트워크(받지 못함) · 3 디코딩 · 4 원본 없음/미지원(404 포함). */
export function mediaErrorReason(code: number | undefined): string {
  if (code === 2) return "network";
  if (code === 3) return "decode";
  if (code === 4) return "source";
  return "load-error";
}

let failures: AudioFailure[] = [];
const listeners = new Set<(failure: AudioFailure) => void>();

type FailureHolder = Window & { __oprnAudioFailures?: () => AudioFailure[] };

/** 같은 (리소스, 사유)는 한 건으로 합치고 시각만 새로 쓴다. 구독자는 매 기록마다 받는다. */
export function recordAudioFailure(input: { readonly resourceId: string; readonly reason: string; readonly channel?: string }): void {
  const failure: AudioFailure = {
    resourceId: input.resourceId,
    reason: input.reason,
    at: Date.now(),
    ...(input.channel === undefined ? {} : { channel: input.channel }),
  };
  failures = failures.filter(entry => entry.resourceId !== failure.resourceId || entry.reason !== failure.reason);
  failures.push(failure);
  if (failures.length > MAX_FAILURES) failures = failures.slice(-MAX_FAILURES);
  publish();
  for (const listener of [...listeners]) listener(failure);
}

export function listAudioFailures(): AudioFailure[] {
  return failures.map(entry => ({ ...entry }));
}

export function subscribeAudioFailures(listener: (failure: AudioFailure) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** 테스트 헬퍼: 기록과 구독을 비운다. */
export function resetAudioFailuresForTest(): void {
  failures = [];
  listeners.clear();
  if (typeof window !== "undefined") delete (window as FailureHolder).__oprnAudioFailures;
}

// 첫 실패가 생길 때에야 창에 건다 — 실패가 없는 세션은 전역을 하나도 더 얻지 않는다.
function publish(): void {
  if (typeof window === "undefined") return;
  const holder = window as FailureHolder;
  if (holder.__oprnAudioFailures === undefined) holder.__oprnAudioFailures = listAudioFailures;
}
