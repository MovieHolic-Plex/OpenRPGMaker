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
// 진입점은 액션 행 좌측의 `☰` 와 `⌾`(성향) 둘이고, 나머지 설정은 ☰ 메뉴 안의 항목이다.
// 조수 스킬 기능이 제거되면서 슬래시 팝오버(`/` 목록)와 그 앵커 버튼도 함께 사라졌다.
//
// `⌾` 성향(2026-08-30 감독 지시): AI 가 대화에서 배운 취향 목록. 배웠다는 알림이 채팅 버블로
// 뜨므로 확인·삭제도 같은 패널에 있어야 한다(AI 설정 모달에 두면 배운 자리와 고치는 자리가
// 갈라진다). 같은 팝오버 기계에 세 번째 종류로 넣었다 — 배타적 열림·바깥 클릭·Escape 를
// 공짜로 얻고, 흐름 밖이라 "바 높이 = f(textarea 줄 수)" 불변식도 그대로다.

import { el } from "@/util/dom";

/** 서로 배타적인 컴포저 팝오버. 하나가 열리면 나머지는 닫힌다. */
export type ComposerPopover = "suggest" | "menu" | "preference";

const POPOVER_KINDS = ["suggest", "menu", "preference"] as const;

export interface ComposerElements {
  /** 패널에 마운트되는 바 루트(기존 `.ai-command-bar` testid 유지). */
  readonly commandBar: HTMLElement;
  readonly composer: HTMLElement;
  readonly actions: HTMLElement;
  readonly commandMenu: HTMLElement;
  readonly commandMenuToggle: HTMLButtonElement;
  readonly newChatButton: HTMLButtonElement;
  /** 성향 팝오버 토글. `preferenceContent` 를 주지 않았으면 null. */
  readonly preferenceToggle: HTMLButtonElement | null;
  readonly hint: HTMLElement;
  readonly openPopover: (kind: ComposerPopover | null) => void;
  readonly openKind: () => ComposerPopover | null;
  /** 바 + 열려 있는 팝오버를 합친 최상단 y — clearance 계산의 단일 소스. */
  readonly measuredTop: () => number;
  readonly dispose: () => void;
}

export interface ComposerOptions {
  readonly input: HTMLTextAreaElement;
  readonly collapseButton: HTMLButtonElement;
  readonly sendButton: HTMLButtonElement;
  readonly abortButton: HTMLButtonElement;
  readonly contextChips: HTMLElement;
  readonly composerChips: HTMLElement;
  readonly queueIndicator: HTMLElement;
  readonly statusGroup: HTMLElement;
  readonly onNewChat: () => void;
  readonly onPopoverChange?: (kind: ComposerPopover | null) => void;
  /**
   * "AI 가 기억한 내 성향" 팝오버의 내용. **주입으로 받는다** — 컴포저가
   * `aiPreferenceMemorySettings` 를 직접 import 하면 성향 저장소(localStorage 접근)가
   * 컴포저 단위 테스트의 모듈 그래프에 들어온다. 안 주면 버튼도 팝오버도 만들지 않는다.
   */
  readonly preferenceContent?: HTMLElement;
  /** 성향 팝오버가 열릴 때. 목록을 다시 읽는 자리다(대화 중 증류로 내용이 바뀐다). */
  readonly onPreferenceOpen?: () => void;
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

  const newChatButton = el("button", {
    class: "ai-composer-menu-btn ai-new-chat",
    text: "+",
    attrs: { type: "button", title: "새 대화", "aria-label": "새 대화 시작" },
    dataset: { testid: "ai-new-chat" },
    on: { click: options.onNewChat },
  }) as HTMLButtonElement;

  const commandMenu = el("div", {
    class: "ai-composer-popover ai-command-menu",
    attrs: { role: "menu" },
    dataset: { testid: "ai-command-menu" },
  });
  commandMenu.hidden = true;

  // 성향 버튼 — ☰ 옆 작은 토글. 아이콘은 ⌾("기억해 둔 점") 하나로 두고 라벨은 title/aria 에 둔다.
  // 액션 행은 고정 높이 한 줄이라 글자 라벨을 넣으면 컨텍스트 칩 자리를 먹는다.
  const preferenceToggle = options.preferenceContent
    ? (el("button", {
      class: "ai-composer-menu-btn ai-preference-toggle",
      text: "⌾",
      attrs: {
        type: "button",
        title: "AI 가 기억한 내 성향 — 확인·고정·삭제",
        "aria-label": "AI 가 기억한 내 성향",
        "aria-expanded": "false",
        "aria-haspopup": "dialog",
      },
      dataset: { testid: "ai-preference-toggle" },
      on: { click: () => openPopover(openState === "preference" ? null : "preference") },
    }) as HTMLButtonElement)
    : null;

  const preferencePopover = el("div", {
    class: "ai-composer-popover ai-preference-popover",
    attrs: { role: "dialog", "aria-label": "AI 가 기억한 내 성향" },
    dataset: { testid: "ai-preference-popover" },
    ...(options.preferenceContent ? { children: [options.preferenceContent] } : {}),
  });
  preferencePopover.hidden = true;

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
        // 접기(#5efa6611) 와 새 대화(#198) 는 둘 다 이 고정 행의 왼쪽에 산다 — 한쪽이 다른 쪽을
        // 밀어내면 도크별 접기나 새 대화 진입점이 사라진다.
        children: [
          options.collapseButton,
          newChatButton,
          commandMenuToggle,
          ...(preferenceToggle ? [preferenceToggle] : []),
          options.contextChips,
          options.queueIndicator,
        ],
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
    children: [options.input, actions],
  });

  const commandBar = el("div", {
    class: "ai-command-bar",
    dataset: { testid: "ai-command-bar" },
    // 팝오버는 셸의 형제로 두고 absolute 로 띄운다 — 흐름 밖.
    children: [suggestPopover, commandMenu, preferencePopover, composer],
  });

  // 키 힌트는 입력 중에만 필요한 안내다. 상시 노출은 액션 행을 영구 점유했다(실측 160x15).
  // 숨김은 visibility 로 한다 — display 로 빼면 행 높이가 바뀌어 "바 높이 = f(textarea 줄 수)"
  // 불변식이 깨지고 clearance 재측정이 오버레이까지 흔든다.
  const onInputFocus = (): void => actions.classList.add("is-input-focused");
  const onInputBlur = (): void => actions.classList.remove("is-input-focused");
  options.input.addEventListener("focus", onInputFocus);
  options.input.addEventListener("blur", onInputBlur);

  const popoverOf = (kind: ComposerPopover): HTMLElement =>
    kind === "suggest" ? suggestPopover : kind === "preference" ? preferencePopover : commandMenu;
  const toggleOf = (kind: ComposerPopover): HTMLElement | null =>
    kind === "suggest" ? null : kind === "preference" ? preferenceToggle : commandMenuToggle;

  const openPopover = (kind: ComposerPopover | null): void => {
    if (openState === kind) return;
    // 성향 팝오버는 내용을 주지 않았으면 존재하지 않는다 — 열라는 요청을 조용히 닫기로 바꾼다.
    const target = kind === "preference" && !options.preferenceContent ? null : kind;
    if (openState === target) return;
    openState = target;
    for (const candidate of POPOVER_KINDS) {
      const open = candidate === target;
      popoverOf(candidate).hidden = !open;
      toggleOf(candidate)?.setAttribute("aria-expanded", String(open));
      toggleOf(candidate)?.classList.toggle("is-active", open);
    }
    commandBar.classList.toggle("has-popover", target !== null);
    // 목록 갱신은 **열기 직후** 한 번만 — 매 턴 갱신하면 닫힌 팝오버를 위해 localStorage 를 계속 읽는다.
    if (target === "preference") options.onPreferenceOpen?.();
    options.onPopoverChange?.(target);
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
    newChatButton,
    preferenceToggle,
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
