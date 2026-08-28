// editor/panels/aiComposer.ts
// 컴포저 셸 — 텍스트 영역 + 고정 액션 행 한 줄 + 팝오버 3종. 세로 버튼 열은 없다.
//
// 왜 이 구조인가 (실측 근거):
//  - 구 `.ai-command-input-stack` 은 슬래시 목록·컨텍스트 칩·감독 칩·대기 큐를 **흐름 안에서**
//    입력창 위에 쌓았다. 칩이 나타났다 사라질 때마다 바 높이가 바뀌고, ResizeObserver 가
//    `--ai-command-bar-clearance` 를 다시 재서 rising overlay 하단·맵 여백까지 같이 흔들렸다.
//    실측: 슬래시 목록을 열면 유리 93→377(+284), 사이드 156→401(+245).
//  - 그래서 규칙 하나: **바 높이 = f(textarea 줄 수)뿐.** 슬래시 목록·액션 메뉴·추천 칩은
//    전부 absolute 팝오버로 흐름에서 빼고, 컨텍스트·대기 큐·상태는 **항상 존재하는**
//    고정 높이 액션 행에 한 줄로 넣는다(나타남/사라짐 자체를 없앤다).
//  - 팝오버는 `.ai-command-bar` 의 직접 자식이고 닫히면 `hidden`(display:none) 이다.
//    투명한 전면 레이어는 두지 않는다 — 보이지 않는 레이어가 맵 클릭을 삼킨 P0 사고가 있었다
//    (2026-08-19, 회귀 스펙 `test/e2e/_ai-assistant-hostile-eval.spec.ts` H 히트테스트).
//
// 좌측 메타 레일은 폐기했다(2026-08-21, 감독 지시): 유리·사이드에서 레일 한 열이 버튼
// **하나**만 담아, 열 자체가 그 버튼 하나를 위한 장식이 되고 하단을 어지럽혔다. 이제 메타
// 진입점은 액션 행 좌측의 `☰` 하나뿐이고 설정은 그 메뉴 안의 항목이다.
// 조수 스킬 기능이 제거되면서 슬래시 팝오버(`/` 목록)와 그 앵커 버튼도 함께 사라졌다.

import { el } from "@/util/dom";

/** 서로 배타적인 컴포저 팝오버. 하나가 열리면 나머지는 닫힌다. */
export type ComposerPopover = "suggest" | "menu";

export interface ComposerElements {
  /** 패널에 마운트되는 바 루트(기존 `.ai-command-bar` testid 유지). */
  readonly commandBar: HTMLElement;
  readonly composer: HTMLElement;
  readonly actions: HTMLElement;
  readonly commandMenu: HTMLElement;
  readonly commandMenuToggle: HTMLButtonElement;
  readonly hint: HTMLElement;
  readonly openPopover: (kind: ComposerPopover | null) => void;
  readonly openKind: () => ComposerPopover | null;
  /** 바 + 열려 있는 팝오버를 합친 최상단 y — clearance 계산의 단일 소스. */
  readonly measuredTop: () => number;
  readonly dispose: () => void;
}

export interface ComposerOptions {
  readonly input: HTMLTextAreaElement;
  readonly sendButton: HTMLButtonElement;
  readonly abortButton: HTMLButtonElement;
  readonly contextChips: HTMLElement;
  readonly composerChips: HTMLElement;
  readonly queueIndicator: HTMLElement;
  readonly statusGroup: HTMLElement;
  /**
   * 띠에 상시 노출되는 진입점 2개. 예전에는 숨은 툴바(`ai-chat-toolbar.is-empty` + hidden
   * + inert)에 있었고 CSS 가 `:not(.is-empty)` 를 요구해 **영구히 도달 불가**였다. 도크·접기가
   * 사라진 뒤 조수의 유일한 크롬이 이 액션 행이므로, 여기가 두 버튼의 집이다.
   */
  readonly historyButton?: HTMLButtonElement;
  readonly newSessionButton?: HTMLButtonElement;
  readonly onPopoverChange?: (kind: ComposerPopover | null) => void;
}

export function createComposerElements(options: ComposerOptions): ComposerElements {
  let openState: ComposerPopover | null = null;

  const commandMenuToggle = el("button", {
    class: "ai-composer-menu-btn ai-command-menu-toggle",
    text: "☰",
    attrs: { type: "button", title: "더보기", "aria-label": "더보기 메뉴", "aria-expanded": "false", "aria-haspopup": "menu" },
    dataset: { testid: "ai-command-menu-toggle" },
    on: { click: () => openPopover(openState === "menu" ? null : "menu") },
  }) as HTMLButtonElement;

  const commandMenu = el("div", {
    class: "ai-composer-popover ai-command-menu",
    attrs: { role: "menu" },
    dataset: { testid: "ai-command-menu" },
  });
  commandMenu.hidden = true;

  // 추천 칩 팝오버 — 입력창 포커스 + 빈 값일 때 자동으로 뜬다(전용 토글 버튼 없음).
  // 흐름 밖이라 열림/닫힘이 바 높이를 건드리지 않는다(구 구조의 점프 원인).
  const suggestPopover = el("div", {
    class: "ai-composer-popover ai-composer-suggest",
    attrs: { role: "group", "aria-label": "추천 지시" },
    dataset: { testid: "ai-suggest-popover" },
    children: [options.composerChips],
  });
  suggestPopover.hidden = true;

  // 액션 행: 항상 존재하는 고정 높이 한 줄. 좌측 컨텍스트/대기 큐는 nowrap + 가로 스크롤이라
  // 내용이 길어져도 줄이 늘지 않는다(줄바꿈이 곧 바 높이 변화였다).
  const hint = el("span", {
    class: "ai-composer-hint",
    text: "Enter 전송 · Shift+Enter 줄바꿈",
    dataset: { testid: "ai-composer-hint" },
  });
  const actions = el("div", {
    class: "ai-composer-actions",
    dataset: { testid: "ai-composer-actions" },
    children: [
      el("div", {
        class: "ai-composer-actions-lead",
        children: [commandMenuToggle, options.contextChips, options.queueIndicator],
      }),
      el("div", {
        class: "ai-composer-actions-trail",
        children: [
          options.statusGroup,
          hint,
          ...(options.newSessionButton ? [options.newSessionButton] : []),
          ...(options.historyButton ? [options.historyButton] : []),
          options.sendButton,
          options.abortButton,
        ],
      }),
    ],
  });

  const composer = el("div", {
    class: "ai-composer",
    dataset: { testid: "ai-composer" },
    children: [options.input, actions],
  });

  const commandBar = el("div", {
    class: "ai-command-bar",
    dataset: { testid: "ai-command-bar" },
    // 팝오버는 셸의 형제로 두고 absolute 로 띄운다 — 흐름 밖.
    children: [suggestPopover, commandMenu, composer],
  });

  // 키 힌트는 입력 중에만 필요한 안내다. 상시 노출은 액션 행을 영구 점유했다(실측 160x15).
  // 숨김은 visibility 로 한다 — display 로 빼면 행 높이가 바뀌어 "바 높이 = f(textarea 줄 수)"
  // 불변식이 깨지고 clearance 재측정이 오버레이까지 흔든다.
  const onInputFocus = (): void => actions.classList.add("is-input-focused");
  const onInputBlur = (): void => actions.classList.remove("is-input-focused");
  options.input.addEventListener("focus", onInputFocus);
  options.input.addEventListener("blur", onInputBlur);

  const popoverOf = (kind: ComposerPopover): HTMLElement =>
    kind === "suggest" ? suggestPopover : commandMenu;
  const toggleOf = (kind: ComposerPopover): HTMLElement | null =>
    kind === "suggest" ? null : commandMenuToggle;

  const openPopover = (kind: ComposerPopover | null): void => {
    if (openState === kind) return;
    openState = kind;
    for (const candidate of ["suggest", "menu"] as const) {
      const open = candidate === kind;
      popoverOf(candidate).hidden = !open;
      toggleOf(candidate)?.setAttribute("aria-expanded", String(open));
      toggleOf(candidate)?.classList.toggle("is-active", open);
    }
    commandBar.classList.toggle("has-popover", kind !== null);
    options.onPopoverChange?.(kind);
  };

  // 바깥 클릭·Escape 로 닫힌다 — 이전엔 토글 재클릭만이 유일한 닫기 경로여서
  // 절대배치 메뉴가 좌측 맵트리를 덮은 채 클릭을 가로챘다.
  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (openState === null) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (commandBar.contains(target)) return;
    openPopover(null);
  };
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (openState === null || event.key !== "Escape") return;
    openPopover(null);
  };
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
  }

  const measuredTop = (): number => {
    const barTop = commandBar.getBoundingClientRect().top;
    if (openState === null) return barTop;
    const popoverRect = popoverOf(openState).getBoundingClientRect();
    return popoverRect.height > 0 ? Math.min(barTop, popoverRect.top) : barTop;
  };

  return {
    commandBar,
    composer,
    actions,
    commandMenu,
    commandMenuToggle,
    hint,
    openPopover,
    openKind: () => openState,
    measuredTop,
    dispose: () => {
      options.input.removeEventListener("focus", onInputFocus);
      options.input.removeEventListener("blur", onInputBlur);
      if (typeof document === "undefined" || typeof document.removeEventListener !== "function") return;
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    },
  };
}
