// player/transitions/transitionOverlay.ts
// 맵 전환 연출의 DOM 오버레이. 모자이크(픽셀 블록)/블라인드(가로 막대)를
// requestAnimationFrame 으로 애니메이션한다. 순수 계산은 transitionModel 에 위임.
// out 단계는 화면을 덮고, in 단계는 화면을 드러낸다(사이에 맵 로드).

import {
  blindBars,
  mosaicBlockSize,
  mosaicCoverAlpha,
  transitionProgress,
  type TransferTransitionKind,
} from "@/player/transitions/transitionModel";

const TRANSITION_TESTID = "runtime-transition-overlay";

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : 0;
}

function upsertOverlay(host: HTMLElement, kind: TransferTransitionKind): HTMLElement {
  const existing = host.querySelector(`[data-testid='${TRANSITION_TESTID}']`);
  const overlay = existing instanceof HTMLElement ? existing : document.createElement("div");
  if (!(existing instanceof HTMLElement)) {
    overlay.dataset.testid = TRANSITION_TESTID;
    host.append(overlay);
  }
  overlay.className = `runtime-transition-overlay runtime-transition-${kind}`;
  overlay.dataset.kind = kind;
  return overlay;
}

function removeOverlay(host: HTMLElement): void {
  host.querySelector(`[data-testid='${TRANSITION_TESTID}']`)?.remove();
}

// 한 단계(in/out)를 지정 시간 동안 애니메이션하고 완료 시 resolve.
// rAF 미지원 환경에서는 최종 프레임만 적용하고 즉시 resolve.
export function runTransitionPhase(
  host: HTMLElement,
  kind: TransferTransitionKind,
  phase: "in" | "out",
  durationMs: number
): Promise<void> {
  const overlay = upsertOverlay(host, kind);
  const render = (progress: number): void => {
    if (kind === "mosaic") {
      renderMosaic(overlay, progress, phase);
    } else {
      renderBlinds(overlay, progress, phase);
    }
  };
  render(0);
  if (typeof requestAnimationFrame !== "function") {
    render(1);
    if (phase === "in") removeOverlay(host);
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const startedAt = nowMs();
    const tick = (): void => {
      const progress = transitionProgress(nowMs() - startedAt, durationMs);
      render(progress);
      if (progress >= 1) {
        if (phase === "in") removeOverlay(host);
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function renderMosaic(overlay: HTMLElement, progress: number, phase: "in" | "out"): void {
  const block = mosaicBlockSize(progress, phase);
  const alpha = mosaicCoverAlpha(progress, phase);
  overlay.dataset.blockSize = String(block);
  overlay.style.opacity = String(round(alpha));
  overlay.style.backgroundColor = "#05070c";
  // 블록 크기를 배경 패턴으로 시각화(픽셀화 근사).
  overlay.style.backgroundImage =
    "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)";
  overlay.style.backgroundSize = block > 0 ? `${block}px ${block}px` : "100% 100%";
}

function renderBlinds(overlay: HTMLElement, progress: number, phase: "in" | "out"): void {
  const bars = blindBars(progress, phase);
  overlay.dataset.bars = String(bars.length);
  // 막대 수 변화가 없으면 재생성하지 않고 갱신만.
  if (overlay.childNodes.length !== bars.length) {
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    for (let i = 0; i < bars.length; i++) {
      const bar = document.createElement("div");
      bar.className = "runtime-transition-blind";
      overlay.append(bar);
    }
  }
  const children = overlay.childNodes;
  for (let i = 0; i < bars.length; i++) {
    const bar = children[i];
    if (bar instanceof HTMLElement) {
      bar.style.top = `${round(bars[i]!.top * 100)}%`;
      bar.style.height = `${round(bars[i]!.height * 100)}%`;
    }
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
