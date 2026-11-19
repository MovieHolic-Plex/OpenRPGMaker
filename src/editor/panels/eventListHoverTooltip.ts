import {
  buildEventListTooltipModel,
  renderEventListTooltipElement,
} from "@/editor/eventMarkerUx";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";

let activeTooltip: HTMLElement | null = null;
let activeRow: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let sizeObserver: ResizeObserver | null = null;

const HIDE_DELAY_MS = 80;

/** 맵 이벤트 목록 행에 자세한 호버 팝오버를 붙인다. */
export function bindEventListRowHoverTooltip(row: HTMLElement, event: GameEvent): void {
  const show = (): void => {
    clearHideTimer();
    showEventListTooltip(row, event);
  };
  const scheduleHide = (): void => {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      if (activeRow === row) hideEventListTooltip();
    }, HIDE_DELAY_MS);
  };

  row.addEventListener("pointerenter", show);
  row.addEventListener("pointerleave", scheduleHide);
  row.addEventListener("focus", show);
  row.addEventListener("blur", scheduleHide);
}

export function hideEventListTooltip(): void {
  clearHideTimer();
  sizeObserver?.disconnect();
  sizeObserver = null;
  if (typeof window !== "undefined") {
    window.removeEventListener("scroll", hideOnScroll, true);
    window.removeEventListener("resize", positionActiveTooltip);
  }
  activeTooltip?.remove();
  activeTooltip = null;
  activeRow = null;
}

function showEventListTooltip(row: HTMLElement, event: GameEvent): void {
  if (typeof document === "undefined") return;
  const model = buildEventListTooltipModel(store.getCurrent(), event);

  if (!activeTooltip || !activeTooltip.isConnected || activeRow !== row) {
    hideEventListTooltip();
    activeTooltip = renderEventListTooltipElement(model);
    document.body.append(activeTooltip);
    activeRow = row;
    if (typeof window !== "undefined") {
      window.addEventListener("scroll", hideOnScroll, true);
      window.addEventListener("resize", positionActiveTooltip);
    }
    if (typeof ResizeObserver !== "undefined") {
      sizeObserver = new ResizeObserver(positionActiveTooltip);
      sizeObserver.observe(activeTooltip);
    }
  }

  positionActiveTooltip();

  activeTooltip.onpointerenter = () => clearHideTimer();
  activeTooltip.onpointerleave = () => {
    clearHideTimer();
    hideTimer = setTimeout(() => hideEventListTooltip(), HIDE_DELAY_MS);
  };
}

function hideOnScroll(event: Event): void {
  if (event.target instanceof Node && activeTooltip?.contains(event.target)) return;
  hideEventListTooltip();
}

function positionActiveTooltip(): void {
  if (!activeRow || !activeTooltip) return;
  const tip = activeTooltip;
  const rowRect = activeRow.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const tipWidth = Math.max(1, tipRect.width || tip.offsetWidth || 300);
  const tipHeight = Math.max(1, tipRect.height || tip.offsetHeight || 160);
  const viewport = viewportSize();

  // Prefer to the right of the list row (into the map area).
  let left = rowRect.right + 10;
  let top = rowRect.top;

  if (left + tipWidth > viewport.width - 8) {
    left = rowRect.left - tipWidth - 10;
  }
  left = Math.max(8, Math.min(left, viewport.width - tipWidth - 8));

  if (top + tipHeight > viewport.height - 8) {
    top = viewport.height - tipHeight - 8;
  }
  if (top < 8) top = 8;

  tip.style.position = "fixed";
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
  tip.style.zIndex = "320";
}

function viewportSize(): { readonly width: number; readonly height: number } {
  if (typeof globalThis === "undefined") return { width: 1280, height: 720 };
  const candidate = globalThis as { innerWidth?: number; innerHeight?: number };
  const width = Number(candidate.innerWidth);
  const height = Number(candidate.innerHeight);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 1280,
    height: Number.isFinite(height) && height > 0 ? height : 720,
  };
}

function clearHideTimer(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}
