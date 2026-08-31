// 조수 입력줄의 크기 조절 크롬 — aiChatPanel.ts 에서 계약으로 떼낸 조각 (2026-08-30).
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
import { el } from "@/util/dom";
import { loadPanelBarSize, PANEL_SIZE_LIMITS, savePanelBarSize } from "./aiPanelLayout";

type Size = { width: number; height: number };

export interface ChatResizeChromeDeps {
  readonly panel: HTMLElement;
  readonly commandBar: HTMLElement;
  /** 스튜디오·도킹·접힘 상태에서는 크기를 만지지 않는다. */
  readonly resizable: () => boolean;
}

export interface ChatResizeChrome {
  /** 캡슐 왼쪽 모서리에 붙는 separator. 패널이 컴포저 꼬리를 다시 붙일 때마다 재장착한다. */
  readonly handle: HTMLElement;
  /** 저장된 폭을 캡슐에 바른다. 접힘 뒤 호출한다. */
  readonly applySize: () => void;
  readonly syncAria: () => void;
  readonly mountHandle: () => void;
  /** 드래그 중이던 포인터 리스너를 걷는다(패널 dispose 경로). */
  readonly dispose: () => void;
}

export function createChatResizeChrome(deps: ChatResizeChromeDeps): ChatResizeChrome {
  const { panel, commandBar, resizable } = deps;
  const sizeProps = ["width", "height", "maxWidth", "maxHeight"] as const;
  let barSize: Size | null = loadPanelBarSize();
  const viewportNow = (): Size =>
    typeof window === "undefined"
      ? { width: 1280, height: 900 }
      : { width: window.innerWidth, height: window.innerHeight };
  // 패널에 남아 있을 수 있는 인라인 크기를 비운다 — 캡슐은 CSS 변수로만 커진다.
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
  const measuredSurface = (): DOMRect | Size =>
    commandBar.getBoundingClientRect?.() ?? { width: 640, height: 120 };

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
    const limits = widthLimits();
    const rect = measuredSurface();
    handle.setAttribute("aria-valuemin", String(limits.min));
    handle.setAttribute("aria-valuemax", String(limits.max));
    handle.setAttribute("aria-valuenow", String(Math.round(rect.width || barSize?.width || limits.min)));
  };

  const applySize = (): void => {
    clearPanelSize();
    commandBar.style.removeProperty("--ai-float-bar-width");
    if (!resizable() || !barSize) return;
    commandBar.style.setProperty("--ai-float-bar-width", `${clampWidth(barSize.width)}px`);
  };

  const mountHandle = (): void => {
    handle.remove();
    handle.classList.add("is-edge-start");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", "조수 입력줄 폭 조절");
    commandBar.append(handle);
    syncAria();
  };

  const updateBarSize = (width: number, height: number, commit: boolean): void => {
    barSize = { width: clampWidth(width), height: Math.round(height) };
    applySize();
    syncAria();
    if (commit) savePanelBarSize(barSize);
  };

  let activeResizeCleanup: (() => void) | null = null;
  handle.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!resizable()) return;
    event.preventDefault();
    activeResizeCleanup?.();
    const startX = event.clientX;
    const rect = measuredSurface();
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
    const rect = measuredSurface();
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
