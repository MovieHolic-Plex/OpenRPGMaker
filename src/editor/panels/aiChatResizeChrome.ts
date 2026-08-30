// 조수 패널의 크기 조절 크롬 — aiChatPanel.ts 에서 계약으로 떼낸 조각 (2026-08-30).
//
// 왜 별 모듈인가: 이 블록은 패널의 대화/런 상태를 하나도 읽지 않는다. 필요한 것은 표면
// 두 개(패널, 컴포저 바)와 "지금 어느 도크인가 / 크기를 바꿔도 되는 상태인가 / 유리 카드가
// 접혔는가" 세 질문뿐이다. 그래서 그 세 질문을 게터로 받는다 — 패널의 `collapsed`,
// `glassFolded` 같은 가변 클로저를 값으로 넘기면 호출 시점이 어긋난다.
//
// 도크마다 사용자가 실제로 보는 크기의 소유자가 다르다: glass 는 카드(패널 자신),
// side 는 에디터 셸 컬럼(그래서 폭 변경을 콜백으로 셸에 넘긴다), float 은 컴포저 캡슐이다.
// 저장은 기존 도크별 PanelSize 키를 그대로 쓴다.
import type { ChatDock } from "@/editor/chatDock";
import { el } from "@/util/dom";
import {
  clampPanelSize,
  clampPanelSizeToViewport,
  loadDockPanelSize,
  PANEL_SIZE_LIMITS,
  SIDE_CHAT_WIDTH,
  saveDockPanelSize,
} from "./aiPanelLayout";

type Size = { width: number; height: number };

export interface ChatResizeChromeDeps {
  readonly panel: HTMLElement;
  readonly commandBar: HTMLElement;
  /** 지금 도크. 패널은 `readChatDock()` 을 그대로 넘긴다. */
  readonly currentDock: () => ChatDock;
  /** 스튜디오·도킹·접힘 상태에서는 크기를 만지지 않는다. */
  readonly resizable: () => boolean;
  /** 유리 카드가 접혔으면 높이 인라인 값을 비워 CSS 의 `height: auto` 가 이기게 한다. */
  readonly glassFolded: () => boolean;
  readonly onSideWidthPreview?: (width: number, panelHeight: number) => void;
  readonly onSideWidthCommit?: (width: number, panelHeight: number) => void;
}

export interface ChatResizeChrome {
  /** 도크에 맞는 표면에 붙는 separator. 패널이 컴포저 꼬리를 다시 붙일 때마다 재장착한다. */
  readonly handle: HTMLElement;
  /** 저장된 도크별 크기를 실제 표면에 바른다. 접힘/도크 전환 뒤 호출한다. */
  readonly applySize: () => void;
  readonly syncAria: () => void;
  readonly mountHandle: () => void;
  /** 드래그 중이던 포인터 리스너를 걷는다(패널 dispose 경로). */
  readonly dispose: () => void;
}

export function createChatResizeChrome(deps: ChatResizeChromeDeps): ChatResizeChrome {
  const { panel, commandBar, currentDock, resizable, glassFolded } = deps;
  const sizeProps = ["width", "height", "maxWidth", "maxHeight"] as const;
  const dockSizes: Record<ChatDock, Size | null> = {
    glass: loadDockPanelSize("glass"),
    side: loadDockPanelSize("side"),
    float: loadDockPanelSize("float"),
  };
  const viewportNow = (): Size =>
    typeof window === "undefined"
      ? { width: 1280, height: 900 }
      : { width: window.innerWidth, height: window.innerHeight };
  const clearPanelSize = (): void => {
    for (const prop of sizeProps) panel.style[prop] = "";
  };
  const floatWidthLimits = (): { min: number; max: number } => ({
    min: PANEL_SIZE_LIMITS.minWidth,
    max: Math.max(PANEL_SIZE_LIMITS.minWidth, Math.min(PANEL_SIZE_LIMITS.maxWidth, viewportNow().width - 24)),
  });
  const clampWidthForDock = (dock: ChatDock, width: number): number => {
    const limits = dock === "side" ? SIDE_CHAT_WIDTH : floatWidthLimits();
    return Math.round(Math.min(limits.max, Math.max(limits.min, width)));
  };
  const measuredSurface = (dock: ChatDock): DOMRect | Size =>
    (dock === "float" ? commandBar : panel).getBoundingClientRect?.() ?? { width: dock === "float" ? 640 : 360, height: 120 };

  const handle = el("div", {
    class: "ai-chat-resize-handle",
    attrs: {
      role: "separator",
      tabindex: "0",
      "aria-orientation": "vertical",
      title: "드래그하거나 방향키로 조수 크기 조절",
      "aria-label": "조수 크기 조절",
    },
    dataset: { testid: "ai-resize-handle" },
  });

  const syncAria = (): void => {
    const dock = currentDock();
    const limits = dock === "glass"
      ? { min: PANEL_SIZE_LIMITS.minWidth, max: PANEL_SIZE_LIMITS.maxWidth }
      : dock === "side" ? SIDE_CHAT_WIDTH : floatWidthLimits();
    const rect = measuredSurface(dock);
    handle.setAttribute("aria-valuemin", String(limits.min));
    handle.setAttribute("aria-valuemax", String(limits.max));
    handle.setAttribute("aria-valuenow", String(Math.round(rect.width || dockSizes[dock]?.width || limits.min)));
  };

  const applySize = (): void => {
    const dock = currentDock();
    clearPanelSize();
    commandBar.style.removeProperty("--ai-float-bar-width");
    if (!resizable()) return;
    if (dock === "glass" && dockSizes.glass) {
      const fitted = clampPanelSizeToViewport(dockSizes.glass, viewportNow());
      // 폭은 접혀도 유지한다 — 안 그러면 CSS clamp(360px,38vw,520px) 로 돌아가서
      // 펼치는 순간 카드 폭이 튄다. 높이는 컴포저 한 줄로 줄어야 하므로 인라인 값을
      // 비워 17-assistant-modern-shell.css 끝의 `height: auto` 가 이기게 한다.
      panel.style.width = `${fitted.width}px`;
      panel.style.maxWidth = `${fitted.width}px`;
      if (!glassFolded()) {
        panel.style.height = `${fitted.height}px`;
        panel.style.maxHeight = `${fitted.height}px`;
      }
    } else if (dock === "float" && dockSizes.float) {
      const width = clampWidthForDock("float", dockSizes.float.width);
      commandBar.style.setProperty("--ai-float-bar-width", `${width}px`);
    }
  };

  const mountHandle = (): void => {
    const dock = currentDock();
    handle.remove();
    handle.classList.toggle("is-corner-end", dock === "glass");
    handle.classList.toggle("is-edge-start", dock !== "glass");
    handle.setAttribute("aria-orientation", dock === "glass" ? "horizontal" : "vertical");
    handle.setAttribute(
      "aria-label",
      dock === "glass" ? "조수 카드 폭과 높이 조절" : dock === "side" ? "조수 사이드 폭 조절" : "조수 입력줄 폭 조절",
    );
    (dock === "float" ? commandBar : panel).append(handle);
    syncAria();
  };

  const updateDockSize = (dock: ChatDock, width: number, height: number, commit: boolean): void => {
    if (dock === "glass") {
      dockSizes.glass = clampPanelSize({ width, height });
    } else {
      const next = { width: clampWidthForDock(dock, width), height: Math.round(height) };
      dockSizes[dock] = next;
      if (dock === "side") {
        if (commit) deps.onSideWidthCommit?.(next.width, next.height);
        else deps.onSideWidthPreview?.(next.width, next.height);
      }
    }
    applySize();
    syncAria();
    if (commit && dockSizes[dock]) {
      // editor callback is the side shell's owner; direct panel renders still persist for unit/embedded use.
      if (dock !== "side" || !deps.onSideWidthCommit) saveDockPanelSize(dock, dockSizes[dock]!);
    }
  };

  let activeResizeCleanup: (() => void) | null = null;
  handle.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!resizable()) return;
    event.preventDefault();
    activeResizeCleanup?.();
    const dock = currentDock();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = measuredSurface(dock);
    const startWidth = rect.width || dockSizes[dock]?.width || (dock === "float" ? 640 : 360);
    const startHeight = rect.height || dockSizes[dock]?.height || 620;
    const onMove = (move: PointerEvent): void => {
      const dx = move.clientX - startX;
      const dy = move.clientY - startY;
      updateDockSize(dock, startWidth + (dock === "glass" ? dx : -dx), startHeight + (dock === "glass" ? dy : 0), false);
    };
    const cleanupResize = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (activeResizeCleanup === cleanupResize) activeResizeCleanup = null;
    };
    const onUp = (): void => {
      cleanupResize();
      const size = dockSizes[dock];
      if (size) updateDockSize(dock, size.width, size.height, true);
    };
    activeResizeCleanup = cleanupResize;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  handle.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!resizable()) return;
    const dock = currentDock();
    const step = event.shiftKey ? 32 : 8;
    const rect = measuredSurface(dock);
    const current = dockSizes[dock] ?? { width: rect.width || (dock === "float" ? 640 : 360), height: rect.height || 620 };
    let width = current.width;
    let height = current.height;
    if (event.key === "ArrowLeft") width += dock === "glass" ? -step : step;
    else if (event.key === "ArrowRight") width += dock === "glass" ? step : -step;
    else if (dock === "glass" && event.key === "ArrowUp") height -= step;
    else if (dock === "glass" && event.key === "ArrowDown") height += step;
    else return;
    event.preventDefault();
    updateDockSize(dock, width, height, true);
  });

  // 반응형: 창이 좁아지면 저장 크기는 보존하고 실제 표면만 viewport 에 맞춘다.
  const onViewportResize = (): void => {
    applySize();
    syncAria();
  };
  if (typeof window !== "undefined") window.addEventListener("resize", onViewportResize);

  applySize();
  mountHandle();

  return {
    handle,
    applySize,
    syncAria,
    mountHandle,
    dispose: (): void => {
      activeResizeCleanup?.();
      activeResizeCleanup = null;
      if (typeof window !== "undefined") window.removeEventListener("resize", onViewportResize);
    },
  };
}
