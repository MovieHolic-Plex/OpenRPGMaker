// 조수 입력줄·기록 카드의 크기 조절 크롬 — aiChatPanel.ts 에서 계약으로 떼낸 조각 (2026-08-30).
//
// 왜 별 모듈인가: 이 블록은 패널의 대화/런 상태를 하나도 읽지 않는다. 필요한 것은 표면
// 두 개(패널, 컴포저 바)와 "크기를 바꿔도 되는 상태인가" 한 질문뿐이다. 그 질문을 게터로
// 받는다 — 패널의 `collapsed` 같은 가변 클로저를 값으로 넘기면 호출 시점이 어긋난다.
//
// 2026-08-31: 도크 축(glass/side/float)이 걷히면서 이 모듈도 표면 하나만 본다. 예전에는
// 도크마다 "사용자가 보는 크기"의 소유자가 달라서(glass=카드, side=에디터 셸 컬럼,
// float=컴포저 캡슐) 도크별 저장 키·클램프·핸들 위치를 셋씩 들고 있었다. 지금은 캡슐뿐이라
// **폭 한 축**만 바꾸고, 높이는 입력줄의 줄 수가 정한다. 패널에 인라인 크기를 바르는 경로도
// 없어졌다 — 남은 일은 캡슐의 `--ai-float-bar-width` 하나다.
//
// 같은 날 후속: 입력줄 위에 뜨는 기록 카드가 그 폭을 상속하지 못하고 640px 폴백에
// 고정돼 있었다(`--ai-float-bar-width` 가 캡슐 인라인이라 형제 `.ai-chat-body` 에 안 흐른다).
// 변수를 **패널**에도 심어 기록 카드가 같이 넓어지고, 기록 카드 상단 핸들로 높이만
// 따로 조절한다. 입력줄 높이는 여전히 줄 수 계약이다.
import { el } from "@/util/dom";
import {
  clampLogHeight,
  DEFAULT_LOG_HEIGHT,
  loadLogHeight,
  loadPanelBarSize,
  PANEL_SIZE_LIMITS,
  saveLogHeight,
  savePanelBarSize,
} from "./aiPanelLayout";

type Size = { width: number; height: number };

export interface ChatResizeChromeDeps {
  readonly panel: HTMLElement;
  readonly commandBar: HTMLElement;
  /** 입력줄 위에 뜨는 기록 카드. 폭은 패널 변수를 상속하고, 높이는 상단 핸들이 정한다. */
  readonly logBody: HTMLElement;
  /** 스튜디오·도킹·접힘 상태에서는 크기를 만지지 않는다. */
  readonly resizable: () => boolean;
  /** 기록이 펼쳐져 있고 전체 기록/스튜디오가 아닐 때만 높이를 만진다. */
  readonly logResizable: () => boolean;
}

export interface ChatResizeChrome {
  /** 캡슐 왼쪽 모서리에 붙는 separator. 패널이 컴포저 꼬리를 다시 붙일 때마다 재장착한다. */
  readonly handle: HTMLElement;
  /** 기록 카드 상단의 높이 separator. */
  readonly logHandle: HTMLElement;
  /** 저장된 폭·기록 높이를 캡슐/패널에 바른다. 접힘 뒤 호출한다. */
  readonly applySize: () => void;
  readonly syncAria: () => void;
  readonly mountHandle: () => void;
  /** 드래그 중이던 포인터 리스너를 걷는다(패널 dispose 경로). */
  readonly dispose: () => void;
}

export function createChatResizeChrome(deps: ChatResizeChromeDeps): ChatResizeChrome {
  const { panel, commandBar, logBody, resizable, logResizable } = deps;
  const sizeProps = ["width", "height", "maxWidth", "maxHeight"] as const;
  let barSize: Size | null = loadPanelBarSize();
  let logHeight: number | null = loadLogHeight();
  const viewportNow = (): Size =>
    typeof window === "undefined"
      ? { width: 1280, height: 900 }
      : { width: window.innerWidth, height: window.innerHeight };
  // 패널에 남아 있을 수 있는 인라인 크기를 비운다 — 캡슐·기록은 CSS 변수로만 커진다.
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
  const clearanceNow = (): number => {
    const raw = panel.style.getPropertyValue?.("--ai-command-bar-clearance") ?? "";
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    const rect = commandBar.getBoundingClientRect?.();
    return Math.max(72, Math.ceil(rect?.height ?? 110) + 24);
  };
  const clampHeight = (height: number): number => clampLogHeight(height, viewportNow(), clearanceNow());
  const measuredBar = (): DOMRect | Size =>
    commandBar.getBoundingClientRect?.() ?? { width: 640, height: 120 };
  const measuredLog = (): DOMRect | Size =>
    logBody.getBoundingClientRect?.() ?? { width: 640, height: DEFAULT_LOG_HEIGHT };

  const handle = el("div", {
    class: "ai-chat-resize-handle",
    attrs: {
      role: "separator",
      tabindex: "0",
      "aria-orientation": "vertical",
      title: "드래그하거나 방향키로 조수 폭 조절",
      "aria-label": "조수 입력줄 폭 조절",
    },
    dataset: { testid: "ai-resize-handle" },
  });

  const logHandle = el("div", {
    class: "ai-chat-resize-handle is-log-top",
    attrs: {
      role: "separator",
      tabindex: "0",
      "aria-orientation": "horizontal",
      title: "드래그하거나 위/아래 키로 기록 높이 조절",
      "aria-label": "조수 기록 높이 조절",
    },
    dataset: { testid: "ai-log-resize-handle" },
  });

  const applyWidthVar = (widthPx: string | null): void => {
    if (!widthPx) {
      panel.style.removeProperty("--ai-float-bar-width");
      commandBar.style.removeProperty("--ai-float-bar-width");
      return;
    }
    panel.style.setProperty("--ai-float-bar-width", widthPx);
    commandBar.style.setProperty("--ai-float-bar-width", widthPx);
  };

  const applyLogHeightVar = (heightPx: string | null): void => {
    if (!heightPx) {
      panel.style.removeProperty("--ai-float-log-height");
      return;
    }
    panel.style.setProperty("--ai-float-log-height", heightPx);
  };

  const syncAria = (): void => {
    const limits = widthLimits();
    const rect = measuredBar();
    handle.setAttribute("aria-valuemin", String(limits.min));
    handle.setAttribute("aria-valuemax", String(limits.max));
    handle.setAttribute("aria-valuenow", String(Math.round(rect.width || barSize?.width || limits.min)));
    const heightNow = Math.round(measuredLog().height || logHeight || DEFAULT_LOG_HEIGHT);
    logHandle.setAttribute("aria-valuemin", String(clampHeight(0)));
    logHandle.setAttribute("aria-valuemax", String(clampHeight(Number.POSITIVE_INFINITY)));
    logHandle.setAttribute("aria-valuenow", String(clampHeight(heightNow)));
  };

  const applySize = (): void => {
    clearPanelSize();
    applyWidthVar(null);
    applyLogHeightVar(null);
    if (!resizable()) return;
    if (barSize) applyWidthVar(`${clampWidth(barSize.width)}px`);
    if (logHeight !== null) applyLogHeightVar(`${clampHeight(logHeight)}px`);
    syncAria();
  };

  const mountHandle = (): void => {
    handle.remove();
    handle.classList.add("is-edge-start");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", "조수 입력줄 폭 조절");
    commandBar.append(handle);
    logHandle.remove();
    logBody.prepend(logHandle);
    syncAria();
  };

  const updateBarSize = (width: number, height: number, commit: boolean): void => {
    barSize = { width: clampWidth(width), height: Math.round(height) };
    applySize();
    if (commit) savePanelBarSize(barSize);
  };

  const updateLogHeight = (height: number, commit: boolean): void => {
    logHeight = clampHeight(height);
    applySize();
    if (commit) saveLogHeight(logHeight);
  };

  let activeResizeCleanup: (() => void) | null = null;
  handle.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!resizable()) return;
    event.preventDefault();
    activeResizeCleanup?.();
    const startX = event.clientX;
    const rect = measuredBar();
    const startWidth = rect.width || barSize?.width || 640;
    const startHeight = rect.height || barSize?.height || 620;
    // 핸들은 캡슐 왼쪽 끝에 있다 — 왼쪽으로 끌면 넓어진다(dx 부호 반전).
    const onMove = (move: PointerEvent): void => {
      updateBarSize(startWidth - (move.clientX - startX), startHeight, false);
    };
    const cleanupResize = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
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
    const rect = measuredBar();
    const current = barSize ?? { width: rect.width || 640, height: rect.height || 620 };
    let width = current.width;
    if (event.key === "ArrowLeft") width += step;
    else if (event.key === "ArrowRight") width -= step;
    else return;
    event.preventDefault();
    updateBarSize(width, current.height, true);
  });

  logHandle.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!logResizable()) return;
    event.preventDefault();
    event.stopPropagation();
    activeResizeCleanup?.();
    const startY = event.clientY;
    const rect = measuredLog();
    const startHeight = rect.height || logHeight || DEFAULT_LOG_HEIGHT;
    // 핸들은 카드 상단 — 위로 끌면 높아진다.
    const onMove = (move: PointerEvent): void => {
      updateLogHeight(startHeight + (startY - move.clientY), false);
    };
    const cleanupResize = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (activeResizeCleanup === cleanupResize) activeResizeCleanup = null;
    };
    const onUp = (): void => {
      cleanupResize();
      if (logHeight !== null) updateLogHeight(logHeight, true);
    };
    activeResizeCleanup = cleanupResize;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  logHandle.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!logResizable()) return;
    const step = event.shiftKey ? 32 : 8;
    const rect = measuredLog();
    const current = (logHeight ?? rect.height) || DEFAULT_LOG_HEIGHT;
    let height = current;
    if (event.key === "ArrowUp") height += step;
    else if (event.key === "ArrowDown") height -= step;
    else return;
    event.preventDefault();
    updateLogHeight(height, true);
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
    logHandle,
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
