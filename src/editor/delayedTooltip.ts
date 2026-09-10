// 공통 지연 툴팁 — 아이콘만 있는 컨트롤을 누르기 전에 뜻을 알려 준다.
//
// 왜 새로 만드는가 (OPRN-OUT-024): 편집기에는 브라우저 기본 `title`(806곳), 눈에 보이는
// 글자, 기능별 커스텀 팝오버(이벤트 목록·이벤트 마커)가 섞여 있어 지연 시간·위치·문구
// 길이에 계약이 없다. 기본 `title` 은 지연을 못 정하고 키보드 초점에 반응하지 않으며
// Escape 로 닫을 수도 없다. 그래서 **한 가지 동작**을 여기 두고, 대상 목록은
// `delayedTooltipRollout.ts` 에 명시로 적는다(전면 자동 적용 금지).
//
// 접근성 계약: 짧은 한국어 시각 라벨(여섯 자 이하 권장)은 **표시용**이고, 컨트롤의
// 접근 가능한 이름(`aria-label`)은 완전한 문장을 유지한다. 즉 시각 라벨을 줄여도
// 스크린 리더가 듣는 이름은 잘리지 않는다.
import { el } from "@/util/dom";

export const TOOLTIP_DELAY_MS = 1200;
const VIEWPORT_MARGIN = 8;
const TARGET_GAP = 6;
const FALLBACK_TOOLTIP_SIZE = { height: 24, width: 96 } as const;

export type TooltipRect = {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
};

export type TooltipSize = { readonly height: number; readonly width: number };

export type TooltipViewport = { readonly height: number; readonly width: number };

export type TooltipPlacement = {
  readonly left: number;
  readonly side: "above" | "below";
  readonly top: number;
};

/**
 * 대상을 덮지 않고 뷰포트 네 변 안에 머무는 위치. 아래에 공간이 있으면 아래,
 * 없으면 위로 뒤집고, 가로는 대상 중앙 정렬 후 좌우 여백으로 잘라 맞춘다.
 */
export function computeTooltipPlacement(input: {
  readonly size: TooltipSize;
  readonly target: TooltipRect;
  readonly viewport: TooltipViewport;
}): TooltipPlacement {
  const { size, target, viewport } = input;
  const belowTop = target.bottom + TARGET_GAP;
  const fitsBelow = belowTop + size.height <= viewport.height - VIEWPORT_MARGIN;
  const aboveTop = target.top - TARGET_GAP - size.height;
  const fitsAbove = aboveTop >= VIEWPORT_MARGIN;
  const side: "above" | "below" = fitsBelow || !fitsAbove ? "below" : "above";

  const rawTop = side === "below" ? belowTop : aboveTop;
  const maxTop = Math.max(VIEWPORT_MARGIN, viewport.height - VIEWPORT_MARGIN - size.height);
  const top = Math.min(Math.max(rawTop, VIEWPORT_MARGIN), maxTop);

  const centered = target.left + target.width / 2 - size.width / 2;
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - size.width);
  const left = Math.min(Math.max(centered, VIEWPORT_MARGIN), maxLeft);

  return { left: Math.round(left), side, top: Math.round(top) };
}

export type DelayedTooltipSpec = {
  readonly label: string;
  readonly accessibleName?: string;
};

type ActiveTooltip = {
  readonly element: HTMLElement;
  readonly target: HTMLElement;
};

let active: ActiveTooltip | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let pendingTarget: HTMLElement | null = null;
let documentKeyHandlerBound = false;

export function attachDelayedTooltip(target: HTMLElement, spec: DelayedTooltipSpec): () => void {
  if (spec.accessibleName) target.setAttribute("aria-label", spec.accessibleName);
  else if (!target.getAttribute("aria-label") && target.getAttribute("title")) {
    target.setAttribute("aria-label", target.getAttribute("title") ?? "");
  }
  // 기본 title 팝업이 같이 뜨면 같은 말이 두 번 보인다. 그런데 title 자신이 e2e 계약이라
  // (`toolbar-save` → 「프로젝트 저장 (Ctrl+S)」, `ai-new-chat` → 「새 대화」) 지우지 않고
  // **포인터가 얹힌 동안만** 떼어 둔다.
  let stashedTitle: string | null = null;
  const suppressNativeTitle = (): void => {
    if (stashedTitle !== null) return;
    const title = target.getAttribute("title");
    if (title === null) return;
    stashedTitle = title;
    target.removeAttribute("title");
  };
  const restoreNativeTitle = (): void => {
    if (stashedTitle === null) return;
    target.setAttribute("title", stashedTitle);
    stashedTitle = null;
  };

  const schedule = (): void => {
    cancelPending();
    suppressNativeTitle();
    pendingTarget = target;
    showTimer = setTimeout(() => {
      showTimer = null;
      if (pendingTarget !== target) return;
      showDelayedTooltip(target, spec);
    }, TOOLTIP_DELAY_MS);
  };
  const dismiss = (): void => {
    if (pendingTarget === target) cancelPending();
    if (active?.target === target) hideDelayedTooltip();
    restoreNativeTitle();
  };
  const revealNow = (): void => {
    cancelPending();
    suppressNativeTitle();
    showDelayedTooltip(target, spec);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (active?.target !== target && pendingTarget !== target) return;
    event.stopPropagation();
    dismiss();
  };

  target.addEventListener("pointerenter", schedule);
  target.addEventListener("pointerleave", dismiss);
  target.addEventListener("pointerdown", dismiss);
  target.addEventListener("focus", revealNow);
  target.addEventListener("blur", dismiss);
  target.addEventListener("keydown", onKeyDown as EventListener);

  return (): void => {
    dismiss();
    target.removeEventListener("pointerenter", schedule);
    target.removeEventListener("pointerleave", dismiss);
    target.removeEventListener("pointerdown", dismiss);
    target.removeEventListener("focus", revealNow);
    target.removeEventListener("blur", dismiss);
    target.removeEventListener("keydown", onKeyDown as EventListener);
  };
}

export function hideDelayedTooltip(): void {
  cancelPending();
  active?.element.remove();
  active = null;
}

export function activeDelayedTooltipElement(): HTMLElement | null {
  return active?.element ?? null;
}

function cancelPending(): void {
  if (showTimer !== null) clearTimeout(showTimer);
  showTimer = null;
  pendingTarget = null;
}

function showDelayedTooltip(target: HTMLElement, spec: DelayedTooltipSpec): void {
  if (typeof document === "undefined") return;
  // 다시 렌더된 패널의 옛 노드에는 띄우지 않는다 — 떠 있는 툴팁이 유령으로 남는 경로.
  if (target.isConnected === false) return;
  hideDelayedTooltip();
  const tip = el("div", {
    class: `delayed-tooltip side-below`,
    dataset: { testid: "delayed-tooltip" },
    attrs: { role: "tooltip" },
    text: spec.label,
  });
  document.body.append(tip);
  active = { element: tip, target };
  positionActiveTooltip();
  bindDocumentKeyHandler();
}

function positionActiveTooltip(): void {
  if (!active) return;
  const { element, target } = active;
  const targetRect = readRect(target);
  const placement = computeTooltipPlacement({
    size: readTooltipSize(element),
    target: targetRect,
    viewport: readViewport(),
  });
  element.classList.remove("side-above", "side-below");
  element.classList.add(placement.side === "above" ? "side-above" : "side-below");
  element.style.position = "fixed";
  element.style.left = `${placement.left}px`;
  element.style.top = `${placement.top}px`;
}

function readRect(target: HTMLElement): TooltipRect {
  const rect = target.getBoundingClientRect();
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

function readTooltipSize(element: HTMLElement): TooltipSize {
  const rect = element.getBoundingClientRect();
  return {
    height: rect.height || element.offsetHeight || FALLBACK_TOOLTIP_SIZE.height,
    width: rect.width || element.offsetWidth || FALLBACK_TOOLTIP_SIZE.width,
  };
}

function readViewport(): TooltipViewport {
  const candidate = globalThis as { innerHeight?: number; innerWidth?: number };
  const height = Number(candidate.innerHeight);
  const width = Number(candidate.innerWidth);
  return {
    height: Number.isFinite(height) && height > 0 ? height : 720,
    width: Number.isFinite(width) && width > 0 ? width : 1280,
  };
}

function bindDocumentKeyHandler(): void {
  if (documentKeyHandlerBound || typeof document === "undefined") return;
  documentKeyHandlerBound = true;
  document.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key !== "Escape" || !active) return;
    event.stopPropagation();
    hideDelayedTooltip();
  });
  document.addEventListener("scroll", () => hideDelayedTooltip(), true);
}
