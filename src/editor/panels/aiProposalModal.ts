import { el } from "@/util/dom";

export type ProposalPresentationMode = "modal" | "canvas";

export interface ProposalModalElements {
  readonly noticeHost: HTMLElement;
  readonly pill: HTMLButtonElement;
  readonly count: HTMLElement;
  readonly root: HTMLElement;
  readonly open: (mode?: ProposalPresentationMode) => void;
  readonly minimize: () => void;
  readonly close: () => void;
}

export function createProposalModalElements(proposalHost: HTMLElement): ProposalModalElements {
  const noticeHost = el("div", { class: "ai-proposal-notice-host" });
  const pill = el("button", {
    class: "ai-proposal-pill",
    attrs: { type: "button", hidden: "" },
    dataset: { testid: "ai-proposal-reopen" },
  }) as HTMLButtonElement;
  const count = el("span", { class: "ai-proposal-modal-count", dataset: { testid: "ai-proposal-modal-count" } });
  const later = el("button", {
    class: "ai-assistant-action ai-proposal-modal-later",
    text: "나중에",
    attrs: { type: "button", title: "제안을 유지한 채 닫기 (Esc)" },
    dataset: { testid: "ai-proposal-modal-later" },
  }) as HTMLButtonElement;
  const root = el("div", {
    class: "ai-proposal-modal-backdrop",
    attrs: { hidden: "" },
    dataset: { testid: "ai-proposal-modal", presentation: "modal" },
    children: [
      el("div", {
        class: "ai-proposal-modal",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "변경 제안 검토", tabindex: "-1" },
        children: [
          el("div", {
            class: "ai-proposal-modal-header",
            children: [
              el("span", { class: "ai-proposal-modal-title", text: "변경 제안" }),
              count,
              later,
            ],
          }),
          el("div", { class: "ai-proposal-modal-body", children: [proposalHost] }),
        ],
      }),
    ],
  });
  const open = (mode: ProposalPresentationMode = "modal"): void => {
    // 본문(host)이 비어 있으면 헤더만 뜬 빈 껍데기를 열지 않는다.
    if (proposalHost.childElementCount === 0) {
      root.hidden = true;
      pill.hidden = true;
      return;
    }
    root.dataset.presentation = mode;
    if (mode === "canvas") {
      // 안전한 공간 제안은 캔버스 고스트의 실제 승인 버튼으로 먼저 검토한다.
      // 카드와 모달은 그대로 보존해 pill/상세 버튼으로 언제든 전체 검토에 들어갈 수 있다.
      root.hidden = true;
      pill.hidden = false;
      pill.dataset.presentation = "canvas";
      return;
    }
    root.hidden = false;
    pill.hidden = true;
    pill.dataset.presentation = "modal";
  };
  const minimize = (): void => {
    if (root.hidden) return;
    root.hidden = true;
    // 최소화는 승인 대기 유지 — host에 카드가 있을 때만 pill 노출.
    pill.hidden = proposalHost.childElementCount === 0;
  };
  const close = (): void => {
    root.hidden = true;
    pill.hidden = true;
    root.dataset.presentation = "modal";
    pill.dataset.presentation = "modal";
  };
  pill.addEventListener("click", () => open("modal"));
  later.addEventListener("click", () => minimize());
  root.addEventListener("click", (event) => {
    if ((event as { target?: unknown }).target === root) minimize();
  });
  root.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") minimize();
  });
  return { noticeHost, pill, count, root, open, minimize, close };
}
