import { el } from "@/util/dom";

export interface ProposalModalElements {
  readonly noticeHost: HTMLElement;
  readonly pill: HTMLButtonElement;
  readonly count: HTMLElement;
  readonly root: HTMLElement;
  readonly open: () => void;
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
    dataset: { testid: "ai-proposal-modal" },
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
  const open = (): void => {
    // 본문(host)이 비어 있으면 헤더만 뜬 빈 껍데기를 열지 않는다.
    if (proposalHost.childElementCount === 0) {
      root.hidden = true;
      pill.hidden = true;
      return;
    }
    root.hidden = false;
    pill.hidden = true;
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
  };
  pill.addEventListener("click", () => open());
  later.addEventListener("click", () => minimize());
  root.addEventListener("click", (event) => {
    if ((event as { target?: unknown }).target === root) minimize();
  });
  root.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") minimize();
  });
  return { noticeHost, pill, count, root, open, minimize, close };
}
