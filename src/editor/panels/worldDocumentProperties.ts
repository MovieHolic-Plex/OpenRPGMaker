import { el } from "@/util/dom";

/**
 * 문서 속성 칩 바 — 본문 위 한 줄. 속성 레일(세로 272px)을 대신한다.
 * 값은 칩으로 늘 보이고, 길거나 드문 것(연결·출처·「AI가 읽는 것」)은 `worldPopoverChip` 으로 접는다.
 * 문서 스크롤과 분리된 고정 줄이다 — 레이아웃(`.world-document-layout`)이 첫 행에 둔다.
 */
export function worldPropertyBar(children: readonly HTMLElement[]): HTMLElement {
  return el("div", {
    class: "world-property-bar",
    attrs: { role: "group", "aria-label": "문서 속성" },
    dataset: { testid: "world-document-properties" },
    children,
  });
}

export type WorldPopoverChipOptions = {
  /** 칩에 늘 보이는 한 줄 요약(번역은 DOM 계층이 한다). */
  readonly label: string;
  readonly body: readonly (HTMLElement | string)[];
  readonly open: boolean;
  readonly onToggle: (open: boolean) => void;
  readonly testid?: string;
  readonly tone?: "warn";
  /** 막대 오른쪽 끝 칩은 팝오버를 오른쪽 정렬로 펼친다. */
  readonly align?: "end";
  readonly title?: string;
};

/**
 * 칩을 누르면 아래로 펼쳐지는 팝오버. `<details>` 하나라 키보드(Enter·Space)·스크린리더 확장 상태가 그대로 되고,
 * Esc 와 바깥 클릭으로 닫힌다. 다시 그려져도 열린 채 이어지도록 열림 상태는 호출부가 쥔다(`onToggle`).
 */
export function worldPopoverChip(options: WorldPopoverChipOptions): HTMLDetailsElement {
  const summary = el("summary", {
    class: "world-chip world-chip-trigger",
    text: options.label,
    ...(options.title ? { attrs: { title: options.title } } : {}),
    dataset: options.testid ? { testid: `${options.testid}-trigger` } : {},
  });
  const details = el("details", {
    class: `world-chip-pop${options.align === "end" ? " align-end" : ""}${options.tone ? ` tone-${options.tone}` : ""}`,
    attrs: { ...(options.open ? { open: "" } : {}) },
    dataset: options.testid ? { testid: options.testid } : {},
    children: [
      summary,
      el("div", { class: "world-chip-pop-body", attrs: { role: "group", "aria-label": options.label }, children: [...options.body] }),
    ],
  });
  // 처음부터 open 속성을 달고 만들면 브라우저가 토글 이벤트를 한 번 쏜다 — 사용자의 조작이 아니므로 알리지 않는다.
  let lastOpen = options.open;
  wirePopoverDismiss(details, summary, () => {
    if (details.open === lastOpen) return;
    lastOpen = details.open;
    options.onToggle(details.open);
  });
  return details;
}

/**
 * `<details>` 를 팝오버처럼 닫는 공통 배선: Esc(포커스는 트리거로), 바깥 누름. `onToggle` 은 열림이 바뀔 때마다 불린다.
 * 바깥 누름 리스너는 열려 있는 동안만 문서에 걸고, 요소가 떨어져 나가면 스스로 뗀다.
 */
export function wirePopoverDismiss(details: HTMLDetailsElement, trigger: HTMLElement, onToggle: () => void): void {
  const closeOnOutside = (event: Event): void => {
    if (!details.isConnected) { stopListening(); return; }
    if (event.target instanceof Node && details.contains(event.target)) return;
    details.open = false;
  };
  // Esc 는 window 캡처에서 먼저 받는다 — 자료집 창은 modalStack 이 document 캡처에서 Esc 를 가져가 창째 닫으므로,
  // 팝오버가 열려 있는 동안만 그보다 앞에서 팝오버 하나만 닫는다.
  const closeOnEscape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (!details.isConnected || !details.open) { stopListening(); return; }
    event.preventDefault();
    event.stopPropagation();
    const hadFocus = details.contains(document.activeElement);
    details.open = false;
    if (hadFocus) trigger.focus();
  };
  const stopListening = (): void => {
    document.removeEventListener("pointerdown", closeOnOutside, true);
    window.removeEventListener("keydown", closeOnEscape, true);
  };
  details.addEventListener("toggle", () => {
    stopListening();
    if (details.open) {
      document.addEventListener("pointerdown", closeOnOutside, true);
      window.addEventListener("keydown", closeOnEscape, true);
    }
    onToggle();
  });
}

/** 한 번에 하나만 열리게 하는 호출부용 열림 상태 헬퍼. */
export function popoverToggle(
  current: () => string | undefined,
  set: (id: string | undefined) => void,
  id: string,
): { readonly open: boolean; readonly onToggle: (open: boolean) => void } {
  return {
    open: current() === id,
    onToggle: (open) => {
      if (open) set(id);
      else if (current() === id) set(undefined);
    },
  };
}
