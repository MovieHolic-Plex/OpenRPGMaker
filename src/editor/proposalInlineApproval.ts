// editor/proposalInlineApproval.ts
// 캔버스 고스트 프리뷰 위 인라인 승인 툴바 (스펙 §3 2-B).
// aiProposalCard가 pending 제안의 실제 수락/거부 경로를 등록하고,
// agentPreviewRenderers가 마커에 툴바를 붙인다. 동일 핸들러 = 동일 lint/undo 경로.
import { el } from "@/util/dom";

export interface InlineProposalActions {
  readonly accept: () => void;
  readonly reject: () => void;
  readonly focusCard: () => void;
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
  return el("div", {
    class: "ghost-inline-approval",
    attrs: { role: "toolbar", "aria-label": "AI 제안 인라인 승인" },
    dataset: { testid: "ghost-inline-approval" },
    children: [
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
      el("button", {
        class: "ghost-inline-btn",
        text: "상세",
        attrs: { type: "button", title: "채팅 패널의 제안 카드로 이동" },
        dataset: { testid: "ghost-inline-detail" },
        on: { click: () => actions.focusCard() },
      }),
    ],
  });
}
