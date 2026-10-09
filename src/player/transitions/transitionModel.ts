// player/transitions/transitionModel.ts
// 맵 전환(transfer) 연출의 순수 모델. 기존 페이드(카메라) 외에 모자이크(픽셀화)와
// 블라인드 두 가지를 추가한다. 여기서는 각 연출의 "진행도 → 시각 파라미터" 만
// 계산하고, 실제 DOM 오버레이 적용은 playSceneMapCommands 가 담당한다.

export type TransferTransitionKind = "fade" | "mosaic" | "blinds";

const TRANSITION_KINDS: ReadonlySet<TransferTransitionKind> = new Set(["fade", "mosaic", "blinds"]);

// 문자열/명령 파라미터를 전환 종류로 정규화. 알 수 없으면 기본 "fade".
export function parseTransitionKind(value: string | undefined): TransferTransitionKind {
  if (value !== undefined && TRANSITION_KINDS.has(value as TransferTransitionKind)) {
    return value as TransferTransitionKind;
  }
  return "fade";
}

// DOM 오버레이 연출을 쓰는 종류인지(모자이크/블라인드). fade 는 카메라 페이드로 처리.
export function usesOverlayTransition(kind: TransferTransitionKind): boolean {
  return kind === "mosaic" || kind === "blinds";
}

// 진행도(0~1) 정규화.
export function transitionProgress(elapsedMs: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.max(0, Math.min(1, elapsedMs / durationMs));
}

// 모자이크: 진행도에 따라 픽셀 블록 크기(px)를 키운다(out) 또는 줄인다(in).
// out(0→1): 0 → maxBlock, in(0→1): maxBlock → 0.
export function mosaicBlockSize(progress: number, phase: "in" | "out", maxBlock = 48): number {
  const p = clamp01(progress);
  const eased = phase === "out" ? p : 1 - p;
  return Math.max(0, Math.round(eased * maxBlock));
}

// 모자이크 오버레이의 덮힘 불투명도(픽셀 배경). out 이 끝날수록 화면을 덮는다.
export function mosaicCoverAlpha(progress: number, phase: "in" | "out"): number {
  const p = clamp01(progress);
  return round(phase === "out" ? p : 1 - p);
}

export type BlindBar = {
  // 0~1 세로 위치(막대 상단).
  readonly top: number;
  // 0~1 막대 두께(닫힘 비율).
  readonly height: number;
};

// 블라인드: N 개의 가로 막대가 위→아래로 닫힌다(out) / 열린다(in).
// 각 막대는 자기 슬롯 높이(1/count)만큼 채워질 수 있다.
export function blindBars(progress: number, phase: "in" | "out", count = 8): BlindBar[] {
  const bars: BlindBar[] = [];
  const safeCount = Math.max(1, Math.floor(count));
  const p = clamp01(progress);
  const fill = phase === "out" ? p : 1 - p;
  const slot = 1 / safeCount;
  for (let i = 0; i < safeCount; i++) {
    bars.push({ top: round(i * slot), height: round(slot * fill) });
  }
  return bars;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
