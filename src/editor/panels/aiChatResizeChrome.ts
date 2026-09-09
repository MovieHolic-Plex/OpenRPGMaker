// 조수 데크의 크기 조절 크롬 — aiChatPanel.ts 에서 계약으로 떼낸 조각 (2026-08-30).
//
// 왜 별 모듈인가: 이 블록은 패널의 대화/런 상태를 하나도 읽지 않는다. 필요한 것은 표면
// (패널, 데크)과 "크기를 바꿔도 되는 상태인가" 한 질문뿐이다. 그 질문을 게터로
// 받는다 — 패널의 `collapsed` 같은 가변 클로저를 값으로 넘기면 호출 시점이 어긋난다.
//
// 2026-08-31: 도크 축(glass/side/float)이 걷히면서 이 모듈도 표면 하나만 본다. **폭 한 축**만
// 바꾸고, 높이는 입력줄의 줄 수가 정한다.
//
// 2026-09-03 데크: 기록 카드와 입력줄이 한 표면(`.ai-deck`)이 되면서 기록 높이 축(상단 핸들,
// `oprn:ai-log-height`)을 걷었다 — 대화 영역 높이는 CSS `max-height: min(660px, 62vh)` 가 정하고
// 넘치면 안에서 스크롤한다. 핸들은 데크 왼쪽 가장자리 하나이고 폭 변수(`--ai-float-bar-width`)는
// 패널과 데크에 함께 심는다.
import { el } from "@/util/dom";
import { loadPanelBarSize, PANEL_SIZE_LIMITS, savePanelBarSize } from "./aiPanelLayout";

type Size = { width: number; height: number };

export interface ChatResizeChromeDeps {
  readonly panel: HTMLElement;
  /** 폭을 갖는 표면 — 데크. 핸들이 이 요소의 왼쪽 가장자리에 붙는다. */
  readonly deck: HTMLElement;
  /** 스튜디오·도킹·접힘 상태에서는 크기를 만지지 않는다. */
  readonly resizable: () => boolean;
}

export interface ChatResizeChrome {
  /** 데크 왼쪽 모서리에 붙는 separator. 패널이 데크를 다시 조립할 때마다 재장착한다. */
  readonly handle: HTMLElement;
  /** 저장된 폭을 데크/패널에 바른다. 접힘 뒤 호출한다. */
  readonly applySize: () => void;
  readonly syncAria: () => void;
  readonly mountHandle: () => void;
  /** 드래그 중이던 포인터 리스너를 걷는다(패널 dispose 경로). */
  readonly dispose: () => void;
}

export function createChatResizeChrome(deps: ChatResizeChromeDeps): ChatResizeChrome {
  const { panel, deck, resizable } = deps;
  const sizeProps = ["width", "height", "maxWidth", "maxHeight"] as const;
  let barSize: Size | null = loadPanelBarSize();
  const viewportNow = (): Size =>
    typeof window === "undefined"
      ? { width: 1280, height: 900 }
      : { width: window.innerWidth, height: window.innerHeight };
  // 패널에 남아 있을 수 있는 인라인 크기를 비운다 — 데크는 CSS 변수로만 커진다.
  const clearPanelSize = (): void => {
    for (const prop of sizeProps) panel.style[prop] = "";
  };
  const widthLimits = (): { min: number; max: number } => ({
    min: PANEL_SIZE_LIMITS.minWidth,
    max: Math.max(PANEL_SIZE_LIMITS.minWidth, Math.min(PANEL_SIZE_LIMITS.maxWidth, viewportNow().width - 24)),
  });
  const clampWidth = (width: number): number => {
    const limits = widthLimits();
    return Math.round(Math.min(limits.max, Math.max(limits.min, width)));
  };
  const measuredDeck = (): DOMRect | Size => deck.getBoundingClientRect?.() ?? { width: 640, height: 120 };
  /** Displayed/gesture width: viewport-clamped. barSize keeps the preferred saved value. */
  const effectiveWidth = (): number => {
    if (barSize) return clampWidth(barSize.width);
    return Math.round(measuredDeck().width) || 640;
  };

  const handle = el("div", {
    class: "ai-chat-resize-handle is-edge-start",
    attrs: {
      role: "separator",
      tabindex: "0",
      "aria-orientation": "vertical",
      title: "드래그하거나 방향키로 조수 폭 조절",
      "aria-label": "조수 입력줄 폭 조절",
    },
    dataset: { testid: "ai-resize-handle" },
  });

  const applyWidthVar = (widthPx: string | null): void => {
    if (!widthPx) {
      panel.style.removeProperty("--ai-float-bar-width");
      deck.style.removeProperty("--ai-float-bar-width");
      return;
    }
    panel.style.setProperty("--ai-float-bar-width", widthPx);
    deck.style.setProperty("--ai-float-bar-width", widthPx);
  };

  const syncAria = (): void => {
    const limits = widthLimits();
    // Effective (clamped) width only — never advertise preferred barSize above valuemax.
    const now = effectiveWidth();
    handle.setAttribute("aria-valuemin", String(limits.min));
    handle.setAttribute("aria-valuemax", String(limits.max));
    handle.setAttribute("aria-valuenow", String(now));
  };
  const sizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncAria);
  sizeObserver?.observe(deck);

  const applySize = (): void => {
    clearPanelSize();
    applyWidthVar(null);
    if (!resizable()) return;
    if (barSize) applyWidthVar(`${clampWidth(barSize.width)}px`);
    syncAria();
  };

  const mountHandle = (): void => {
    handle.remove();
    deck.append(handle);
    syncAria();
  };

  const updateBarSize = (width: number, height: number, commit: boolean): void => {
    barSize = { width: clampWidth(width), height: Math.round(height) };
    applySize();
    if (commit) savePanelBarSize(barSize);
  };

  let activeResizeCleanup: (() => void) | null = null;
  handle.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!resizable()) return;
    event.preventDefault();
    activeResizeCleanup?.();
    const startX = event.clientX;
    const rect = measuredDeck();
    // Effective clamped width — not raw preferred barSize (may exceed viewport max) and not a
    // mid-transition layout rect (Firefox F10 under-shot).
    const startWidth = effectiveWidth();
    const startHeight = barSize?.height ?? (Math.round(rect.height) || 620);
    panel.classList.add("is-resizing");
    deck.classList.add("is-resizing");
    // 핸들은 데크 왼쪽 끝에 있다 — 왼쪽으로 끌면 넓어진다(dx 부호 반전).
    const onMove = (move: PointerEvent): void => {
      updateBarSize(startWidth - (move.clientX - startX), startHeight, false);
    };
    const cleanupResize = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      panel.classList.remove("is-resizing");
      deck.classList.remove("is-resizing");
      if (activeResizeCleanup === cleanupResize) activeResizeCleanup = null;
    };
    const onUp = (): void => {
      cleanupResize();
      if (barSize) updateBarSize(barSize.width, barSize.height, true);
    };
    activeResizeCleanup = cleanupResize;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  handle.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!resizable()) return;
    const step = event.shiftKey ? 32 : 8;
    const rect = measuredDeck();
    const current = barSize ?? { width: rect.width || 640, height: rect.height || 620 };
    let width = current.width;
    if (event.key === "ArrowLeft") width += step;
    else if (event.key === "ArrowRight") width -= step;
    else return;
    event.preventDefault();
    updateBarSize(width, current.height, true);
  });

  // 반응형: 창이 좁아지면 저장 크기는 보존하고 실제 표면만 viewport 에 맞춘다.
  const onViewportResize = (): void => {
    applySize();
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
      sizeObserver?.disconnect();
      activeResizeCleanup?.();
      activeResizeCleanup = null;
      if (typeof window !== "undefined") window.removeEventListener("resize", onViewportResize);
    },
  };
}
