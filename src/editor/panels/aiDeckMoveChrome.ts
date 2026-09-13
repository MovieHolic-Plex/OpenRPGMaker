// 조수 데크의 위치 이동 크롬 — aiChatPanel.ts 에서 계약으로 떼낸 조각 (2026-09-12).
//
// 왜 별 모듈인가: aiChatResizeChrome 과 같은 이유다. 이 블록은 패널의 대화/런 상태를
// 하나도 읽지 않는다. 필요한 것은 표면(패널·데크·레일)과 "지금 움직여도 되는 상태인가"
// 한 질문뿐이다. 그 질문을 게터로 받는다 — `collapsed` 같은 가변 클로저를 값으로 넘기면
// 호출 시점이 어긋난다.
//
// 좌표계: 패널(.ai-chat-panel.chat-dock-float)은 캔버스 위 inset:0 투명 오버레이고 데크는
// right/bottom 앵커다. 저장값도 { right, bottom } — 패널 변에서 데크 변까지의 거리(px).
// 변수는 **패널**에 심는다 — 데크(`18-assistant-deck.css`)와 접힘 알약(`02-chat-dock.css`
// 의 is-collapsed inset)이 같은 값을 읽어, 접어도 조수가 그 자리에 남는다.
//
// 손잡이는 데크 상단 레일(.ai-deck-rail)이다. 버튼·팝오버·링크 같은 상호작용 자식은
// 제외하고, 더블클릭은 저장 위치를 지워 기본 자리(우하단)로 되돌린다.
import { clearDeckPosition, loadDeckPosition, saveDeckPosition, type DeckPosition } from "./aiPanelLayout";

export interface DeckMoveChromeDeps {
  /** aside.ai-chat-panel — inset:0 오버레이. 좌표 기준이자 CSS 변수 보유자. */
  readonly panel: HTMLElement;
  /** .ai-deck — 움직이는 표면. 크기 실측에 쓴다. */
  readonly deck: HTMLElement;
  /** .ai-deck-rail — 드래그 손잡이. */
  readonly rail: HTMLElement;
  /** 스튜디오·도킹(전체 기록)·접힘 상태에서는 움직이지 않는다. */
  readonly movable: () => boolean;
}

export interface DeckMoveChrome {
  /** 저장 위치를 패널 CSS 변수(--ai-deck-right/--ai-deck-bottom)에 반영한다. */
  readonly applyPosition: () => void;
  /** 진행 중이던 드래그와 관측자를 걷는다(패널 dispose 경로). */
  readonly dispose: () => void;
}

/** 데크가 패널 변에 바짝 붙어도 손잡이가 보이게 두는 최소 여백. */
const EDGE_MARGIN_PX = 4;
/** 크기를 잴 수 없을 때(숨김·가짜 DOM) 쓰는 최소 점유 추정 — 접힘 알약 크기에 맞췄다. */
const MIN_OCCUPANCY = { width: 200, height: 44 } as const;

// fakeDom 의 matchesSelector 는 단순 선택자 하나만 지원한다 — 콤마 나열 대신 한 번에 하나씩 묻는다.
// `.ai-deck-rail-actions`(아이콘 줄)와 `.ai-composer-popover`(레일에 붙은 ⋯·성향·맥락 팝오버)는
// 통째로 드래그에서 뺀다 — 열린 메뉴의 빈 배경을 눌러도 데크가 따라오면 안 된다.
const DRAG_BLOCK_SELECTORS = [
  ".ai-deck-rail-actions",
  ".ai-composer-popover",
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "summary",
  "[contenteditable]",
] as const;

// 레일의 텍스트 없는 구조 표면만 손잡이다 — 이름 줄(who)·상태 문장(state)·틈(spacer)·레일 자체.
const DRAG_SURFACE_SELECTORS = [".ai-deck-rail-who", ".ai-deck-rail-state", ".ai-deck-rail-spacer"] as const;

const DRAG_HINT = "드래그해서 조수 옮기기 · 더블클릭하면 기본 위치";

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function createDeckMoveChrome(deps: DeckMoveChromeDeps): DeckMoveChrome {
  const { panel, deck, rail, movable } = deps;
  let position: DeckPosition | null = loadDeckPosition();

  // 클램프 기준은 **호스트(.ai-chat-float-host, 항상 inset:0)** 다 — 패널 자체가 아니다.
  // 접히면 패널 inset 이 알약 크기(약 72×44)로 줄어 그 사각형으로 자르면 저장 위치가
  // 가장자리 여백으로 깡그리 뭉개진다(2026-09-12 실측). 호스트는 접혀도 그대로다.
  const hostEl = (): HTMLElement => panel.parentElement ?? panel;
  const hostRect = (): Pick<DOMRect, "width" | "height" | "right" | "bottom"> =>
    hostEl().getBoundingClientRect?.() ?? { width: 0, height: 0, right: 0, bottom: 0 };
  const deckRect = (): Pick<DOMRect, "width" | "height" | "right" | "bottom"> =>
    deck.getBoundingClientRect?.() ?? { width: 0, height: 0, right: 0, bottom: 0 };

  /** 호스트 안에 데크 전체가 남도록 right/bottom 을 자른다. 호스트 크기를 못 재면 상한 없이 둔다. */
  const clampPosition = (pos: DeckPosition): DeckPosition => {
    const host = hostRect();
    const surface = deckRect();
    const width = surface.width > 0 ? surface.width : MIN_OCCUPANCY.width;
    const height = surface.height > 0 ? surface.height : MIN_OCCUPANCY.height;
    const maxRight =
      host.width > 0 ? Math.max(EDGE_MARGIN_PX, host.width - width - EDGE_MARGIN_PX) : Number.POSITIVE_INFINITY;
    const maxBottom =
      host.height > 0 ? Math.max(EDGE_MARGIN_PX, host.height - height - EDGE_MARGIN_PX) : Number.POSITIVE_INFINITY;
    return {
      right: Math.round(clampNumber(pos.right, EDGE_MARGIN_PX, maxRight)),
      bottom: Math.round(clampNumber(pos.bottom, EDGE_MARGIN_PX, maxBottom)),
    };
  };

  const writeVars = (pos: DeckPosition | null): void => {
    if (!pos) {
      panel.style.removeProperty("--ai-deck-right");
      panel.style.removeProperty("--ai-deck-bottom");
      return;
    }
    panel.style.setProperty("--ai-deck-right", `${pos.right}px`);
    panel.style.setProperty("--ai-deck-bottom", `${pos.bottom}px`);
  };

  const applyPosition = (): void => {
    // position 은 사용자가 고른 선호값을 유지하고(리사이즈의 barSize 와 같은 계약),
    // 실제로 심는 값만 지금 크기에 맞춰 자른다 — 창이 다시 커지면 원래 자리로 돌아간다.
    writeVars(position ? clampPosition(position) : null);
  };

  // 힌트는 손잡이 표면에만 단다 — 레일 자체에 달면 레일 아래 붙은 팝오버 항목 위에서도
  // 「드래그해서…」 툴팁이 떠서 열린 메뉴를 훼방한다.
  for (const selector of DRAG_SURFACE_SELECTORS) {
    for (const zone of Array.from(rail.querySelectorAll(selector))) {
      (zone as HTMLElement).title = DRAG_HINT;
    }
  }

  let activeDragCleanup: (() => void) | null = null;
  rail.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!movable()) return;
    if (typeof event.button === "number" && event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const onSurface = target === rail || DRAG_SURFACE_SELECTORS.some((sel) => target.closest(sel));
    if (!onSurface) return;
    if (DRAG_BLOCK_SELECTORS.some((sel) => target.closest(sel))) return;
    event.preventDefault();
    activeDragCleanup?.();
    const host = hostRect();
    const surface = deckRect();
    // 시작 오프셋은 실측 사각형에서 읽는다 — 못 재는 환경(가짜 DOM)이면 저장값으로 시작한다.
    const startRight = host.width > 0 && surface.width > 0 ? host.right - surface.right : (position?.right ?? EDGE_MARGIN_PX);
    const startBottom = host.height > 0 && surface.height > 0 ? host.bottom - surface.bottom : (position?.bottom ?? EDGE_MARGIN_PX);
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    panel.classList.add("is-dragging");
    const body = typeof document === "undefined" ? null : document.body;
    // 포인터가 레일 밖으로 나가도 grabbing 을 유지한다 — 호버 대상 커서가 우선하므로
    // body 에 직접 심고, 기존 값이 있으면 드래그 뒤 되돌린다.
    const previousCursor = body?.style.getPropertyValue("cursor") ?? "";
    body?.style.setProperty("cursor", "grabbing");
    const onMove = (move: PointerEvent): void => {
      moved = true;
      // right/bottom 앵커라 포인터 dx·dy 부호가 반전된다 — 오른쪽으로 끌면 right 가 줄어든다.
      position = clampPosition({
        right: startRight - (move.clientX - startX),
        bottom: startBottom - (move.clientY - startY),
      });
      writeVars(position);
    };
    const cleanupDrag = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      panel.classList.remove("is-dragging");
      if (body) {
        if (previousCursor) body.style.setProperty("cursor", previousCursor);
        else body.style.removeProperty("cursor");
      }
      if (activeDragCleanup === cleanupDrag) activeDragCleanup = null;
    };
    const onUp = (): void => {
      cleanupDrag();
      if (moved && position) saveDeckPosition(position);
    };
    activeDragCleanup = cleanupDrag;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });

  // 더블클릭은 기본 위치 복귀 — 끌어 놓은 자리가 마음에 안 들 때 되돌리는 유일한 출구다.
  rail.addEventListener("dblclick", (event: MouseEvent) => {
    if (!movable() || !position) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const onSurface = target === rail || DRAG_SURFACE_SELECTORS.some((sel) => target.closest(sel));
    if (!onSurface) return;
    if (DRAG_BLOCK_SELECTORS.some((sel) => target.closest(sel))) return;
    position = null;
    clearDeckPosition();
    applyPosition();
  });

  // 데크 높이는 내용이 정한다 — 기록이 열리며 커진 데크가 위로 잘리지 않게 다시 자른다.
  // 호스트 크기 변화(창 리사이즈)도 여기서 따라간다. 접힌 동안에는 호스트가 줄어도
  // 패널(알약)은 크기가 그대로라 관측자가 안 울린다 — 창 리사이즈를 따로 듣는다.
  const positionObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(applyPosition);
  positionObserver?.observe(deck);
  positionObserver?.observe(hostEl());
  const onWindowResize = (): void => applyPosition();
  const win = typeof window === "undefined" ? null : window;
  win?.addEventListener("resize", onWindowResize);

  applyPosition();

  return {
    applyPosition,
    dispose: (): void => {
      positionObserver?.disconnect();
      win?.removeEventListener("resize", onWindowResize);
      activeDragCleanup?.();
      activeDragCleanup = null;
    },
  };
}
