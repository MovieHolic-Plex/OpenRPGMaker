// editor/proposalInlineApproval.ts
// 캔버스 고스트 프리뷰 위 인라인 승인 툴바 (스펙 §3 2-B).
// aiProposalCard가 pending 제안의 실제 수락/거부 경로를 등록하고,
// agentPreviewRenderers가 마커에 툴바를 붙인다. 동일 핸들러 = 동일 lint/undo 경로.
import { el } from "@/util/dom";

export interface InlineProposalActions {
  readonly accept: () => void;
  readonly reject: () => void;
  /** 채팅 제안 카드로 스크롤 — 영역 작업 pending에는 없음. */
  readonly focusCard?: () => void;
  /** 누르고 있는 동안 원본(before)을 보여주는 홀드 버튼 — 영역 작업 pending 전용. */
  readonly holdOrigin?: {
    readonly label: string;
    readonly start: () => void;
    readonly end: () => void;
  };
}

let current: InlineProposalActions | null = null;
const listeners = new Set<() => void>();

export function setInlineProposalActions(actions: InlineProposalActions | null): void {
  current = actions;
  for (const listener of listeners) listener();
}

export function getInlineProposalActions(): InlineProposalActions | null {
  return current;
}

export function subscribeInlineProposalActions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function buildInlineApprovalToolbar(actions: InlineProposalActions): HTMLElement {
  const children: HTMLElement[] = [
    el("button", {
      class: "ghost-inline-btn is-accept",
      text: "✓ 적용",
      attrs: { type: "button", title: "이 제안을 프로젝트에 적용" },
      dataset: { testid: "ghost-inline-accept" },
      on: { click: () => actions.accept() },
    }),
    el("button", {
      class: "ghost-inline-btn is-reject",
      text: "✗ 거부",
      attrs: { type: "button", title: "제안 거부(초안 폐기)" },
      dataset: { testid: "ghost-inline-reject" },
      on: { click: () => actions.reject() },
    }),
  ];
  if (actions.focusCard) {
    const focusCard = actions.focusCard;
    children.push(
      el("button", {
        class: "ghost-inline-btn",
        text: "상세",
        attrs: { type: "button", title: "채팅 패널의 제안 카드로 이동" },
        dataset: { testid: "ghost-inline-detail" },
        on: { click: () => focusCard() },
      }),
    );
  }
  if (actions.holdOrigin) {
    const hold = actions.holdOrigin;
    let holding = false;
    const start = (): void => {
      if (holding) return;
      holding = true;
      hold.start();
    };
    const end = (): void => {
      if (!holding) return;
      holding = false;
      hold.end();
    };
    children.push(
      el("button", {
        class: "ghost-inline-btn is-hold",
        text: hold.label,
        attrs: { type: "button", title: "누르고 있는 동안 변경 전 원본을 보여줍니다" },
        dataset: { testid: "ghost-inline-hold-origin" },
        on: {
          pointerdown: start,
          pointerup: end,
          pointerleave: end,
          // 키보드 접근: Space/Enter 누름-뗌
          keydown: (event) => {
            const key = (event as KeyboardEvent).key;
            if (key === " " || key === "Enter") {
              event.preventDefault();
              start();
            }
          },
          keyup: (event) => {
            const key = (event as KeyboardEvent).key;
            if (key === " " || key === "Enter") end();
          },
          blur: end,
        },
      }),
    );
  }
  return el("div", {
    class: "ghost-inline-approval",
    attrs: { role: "toolbar", "aria-label": "AI 제안 인라인 승인" },
    dataset: { testid: "ghost-inline-approval" },
    children,
  });
}
