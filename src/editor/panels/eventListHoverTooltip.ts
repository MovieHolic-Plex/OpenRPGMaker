import {
  buildEventListTooltipModel,
  renderEventListTooltipElement,
} from "@/editor/eventMarkerUx";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";

let activeTooltip: HTMLElement | null = null;
let activeRow: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

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
  activeTooltip?.remove();
  activeTooltip = null;
  activeRow = null;
}

function showEventListTooltip(row: HTMLElement, event: GameEvent): void {
  if (typeof document === "undefined") return;
  const model = buildEventListTooltipModel(store.getCurrent(), event);

  if (!activeTooltip || !activeTooltip.isConnected || activeRow !== row) {
    activeTooltip?.remove();
    activeTooltip = renderEventListTooltipElement(model);
    document.body.append(activeTooltip);
    activeRow = row;
  }

  positionTooltip(row, activeTooltip);

  activeTooltip.onpointerenter = () => clearHideTimer();
  activeTooltip.onpointerleave = () => {
    clearHideTimer();
    hideTimer = setTimeout(() => hideEventListTooltip(), HIDE_DELAY_MS);
  };
}

function positionTooltip(row: HTMLElement, tip: HTMLElement): void {
  const rowRect = row.getBoundingClientRect();
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
  if (left < 8) left = 8;

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
