// editor/panels/aiComposer.ts
// 컴포저 셸 — 좌측 메타 레일(/ · ✨ · ☰) + 텍스트 열 + 고정 액션 행 + 팝오버 3종.
//
// 왜 이 구조인가 (실측 근거):
//  - 구 `.ai-command-input-stack` 은 슬래시 목록·컨텍스트 칩·감독 칩·대기 큐를 **흐름 안에서**
//    입력창 위에 쌓았다. 칩이 나타났다 사라질 때마다 바 높이가 바뀌고, ResizeObserver 가
//    `--ai-command-bar-clearance` 를 다시 재서 rising overlay 하단·맵 여백까지 같이 흔들렸다.
//    감독 칩은 첫 글자를 타이핑하는 순간 사라져 레이아웃이 점프했다.
//  - 그래서 규칙 하나: **바 높이 = f(textarea 줄 수)뿐.** 슬래시 목록·액션 메뉴·추천 칩은
//    전부 absolute 팝오버로 흐름에서 빼고, 컨텍스트·대기 큐·상태는 **항상 존재하는**
//    고정 높이 액션 행에 한 줄로 넣는다(나타남/사라짐 자체를 없앤다).
//  - 팝오버는 `.ai-command-bar` 의 직접 자식이고 닫히면 `hidden`(display:none) 이다.
//    투명한 전면 레이어는 두지 않는다 — 보이지 않는 레이어가 맵 클릭을 삼킨 P0 사고가 있었다
//    (2026-08-19, 회귀 스펙 `test/e2e/_ai-assistant-hostile-eval.spec.ts` H 히트테스트).

import { el } from "@/util/dom";

/** 서로 배타적인 컴포저 팝오버. 하나가 열리면 나머지는 닫힌다. */
export type ComposerPopover = "slash" | "suggest" | "menu";

export interface ComposerElements {
  /** 패널에 마운트되는 바 루트(기존 `.ai-command-bar` testid 유지). */
  readonly commandBar: HTMLElement;
  readonly composer: HTMLElement;
  readonly rail: HTMLElement;
  readonly actions: HTMLElement;
  readonly commandMenu: HTMLElement;
  readonly commandMenuToggle: HTMLButtonElement;
  readonly suggestToggle: HTMLButtonElement;
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
  /** 레일 1행 — 슬래시 팝오버 토글(패널이 click 핸들러를 소유). */
  readonly skillToggle: HTMLElement;
  readonly slashHost: HTMLElement;
  readonly contextChips: HTMLElement;
  readonly composerChips: HTMLElement;
  readonly queueIndicator: HTMLElement;
  readonly statusGroup: HTMLElement;
  readonly onPopoverChange?: (kind: ComposerPopover | null) => void;
}

const SUGGEST_LABEL = "추천 지시";

export function createComposerElements(options: ComposerOptions): ComposerElements {
  let openState: ComposerPopover | null = null;

  const suggestToggle = el("button", {
    class: "ai-composer-rail-btn ai-composer-suggest-toggle",
    text: "✨",
    attrs: { type: "button", title: SUGGEST_LABEL, "aria-label": SUGGEST_LABEL, "aria-expanded": "false" },
    dataset: { testid: "ai-suggest-toggle" },
    on: { click: () => openPopover(openState === "suggest" ? null : "suggest") },
  }) as HTMLButtonElement;

  const commandMenuToggle = el("button", {
    class: "ai-composer-rail-btn ai-command-menu-toggle",
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

  // 추천 칩 팝오버 — 빈 입력일 때 자동으로 열리고, 한 글자만 들어와도 닫힌다.
  // 흐름 밖이라 열림/닫힘이 바 높이를 건드리지 않는다(구 구조의 점프 원인).
  const suggestPopover = el("div", {
    class: "ai-composer-popover ai-composer-suggest",
    attrs: { role: "group", "aria-label": SUGGEST_LABEL },
    dataset: { testid: "ai-suggest-popover" },
    children: [options.composerChips],
  });
  suggestPopover.hidden = true;

  options.slashHost.classList.add("ai-composer-popover", "ai-composer-slash");
  options.slashHost.hidden = true;

  const railButtons: HTMLElement[] = [options.skillToggle, suggestToggle, commandMenuToggle];
  for (const button of railButtons) button.classList.add("ai-composer-rail-btn");
  const rail = el("div", {
    class: "ai-composer-rail",
    dataset: { testid: "ai-composer-rail" },
    children: railButtons,
  });

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
        children: [options.contextChips, options.queueIndicator],
      }),
      el("div", {
        class: "ai-composer-actions-trail",
        children: [options.statusGroup, hint, options.sendButton, options.abortButton],
      }),
    ],
  });

  const composer = el("div", {
    class: "ai-composer",
    dataset: { testid: "ai-composer" },
    children: [
      rail,
      el("div", { class: "ai-composer-main", children: [options.input, actions] }),
    ],
  });

  const commandBar = el("div", {
    class: "ai-command-bar",
    dataset: { testid: "ai-command-bar" },
    // 팝오버는 셸의 형제로 두고 absolute 로 띄운다 — 흐름 밖.
    children: [options.slashHost, suggestPopover, commandMenu, composer],
  });

  const popoverOf = (kind: ComposerPopover): HTMLElement =>
    kind === "slash" ? options.slashHost : kind === "suggest" ? suggestPopover : commandMenu;
  const toggleOf = (kind: ComposerPopover): HTMLElement | null =>
    kind === "slash" ? options.skillToggle : kind === "suggest" ? suggestToggle : commandMenuToggle;

  const openPopover = (kind: ComposerPopover | null): void => {
    if (openState === kind) return;
    openState = kind;
    for (const candidate of ["slash", "suggest", "menu"] as const) {
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
    rail,
    actions,
    commandMenu,
    commandMenuToggle,
    suggestToggle,
    hint,
    openPopover,
    openKind: () => openState,
    measuredTop,
    dispose: () => {
      if (typeof document === "undefined" || typeof document.removeEventListener !== "function") return;
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    },
  };
}
