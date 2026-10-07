// editor/panels/aiSideThreads.ts
// 「다른 스레드」 트레이 — 메인 대화(오른쪽 도크의 로그) 밖에서 도는 실행을 모아 둔다.
//
// 오른쪽 도크는 사용자와 조수의 **하나뿐인 대화**다. 다른 맵에서 같이 도는 실행(맵별 대기열)은 그 대화에 섞여 로그를 길게 만들고,
// 「내가 방금 한 말의 답」과 「다른 맵의 진행」을 구분하기 어려웠다. 그래서 실행 카드(aiMapRunCard)는 로그가 아니라 이 트레이로 보낸다.
// 로그에는 사용자가 쓴 문장과 「다른 스레드로 보냈어요」 한 줄만 남는다.
//
// 대화를 새로 시작하거나 이전 대화를 불러와도(log.replaceChildren) 트레이는 지워지지 않는다 — 도는 일은 대화와 무관하게 계속된다.
// DOM 계약: `ai-side-threads`(루트, data-open) · `ai-side-threads-toggle` · `ai-side-threads-clear`.

import { el } from "@/util/dom";

const isLive = (card: HTMLElement): boolean => card.dataset.state === "waiting" || card.dataset.state === "running";

export interface SideThreads {
  readonly root: HTMLElement;
  /** 실행 카드를 트레이에 올린다. */
  adopt(card: HTMLElement): void;
  /** 트레이를 펴고 그 카드를 보여 준다(받은함의 「검토하기」). */
  reveal(ticketId: number): void;
  dispose(): void;
}

let shared: SideThreads | null = null;

/** aiChatPanel 이 카드를 올릴 때 쓰는 단일 트레이. 마운트 전이면 null — 호출자는 로그로 되돌아간다. */
export function sideThreads(): SideThreads | null {
  return shared;
}

export function createSideThreads(): SideThreads {
  const list = el("div", { class: "ai-side-threads-list", dataset: { testid: "ai-side-threads-list" } });
  const title = el("span", { class: "ai-side-threads-title", text: "다른 스레드" });
  const summary = el("span", { class: "ai-side-threads-summary" });
  const toggle = el("button", {
    class: "ai-side-threads-toggle", attrs: { type: "button", "aria-expanded": "false", title: "다른 맵·영역에서 도는 작업을 펴고 접습니다" },
    dataset: { testid: "ai-side-threads-toggle" }, children: [title, summary],
  });
  const clear = el("button", {
    class: "ai-side-threads-clear", text: "끝난 것 지우기", attrs: { type: "button" }, dataset: { testid: "ai-side-threads-clear" },
  });
  const root = el("section", {
    class: "ai-side-threads", attrs: { "aria-label": "다른 스레드", hidden: "" }, dataset: { testid: "ai-side-threads", open: "false", attention: "none" },
    children: [el("div", { class: "ai-side-threads-head", children: [toggle, clear] }), list],
  });

  const cards = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>(".ai-map-run-card")];
  const setOpen = (open: boolean): void => {
    root.dataset.open = String(open);
    toggle.setAttribute("aria-expanded", String(open));
    list.hidden = !open;
  };
  const refresh = (): void => {
    const all = cards();
    root.hidden = all.length === 0;
    const live = all.filter(isLive);
    const failed = all.filter(card => card.dataset.state === "failed" || card.dataset.state === "cancelled");
    const review = all.filter(card => card.dataset.review === "1");
    summary.textContent = `${live.length ? `${live.length}개 진행 중` : "모두 끝남"}${failed.length ? ` · 실패 ${failed.length}` : ""}`;
    root.dataset.attention = failed.length ? "failed" : review.length ? "review" : "none";
    clear.hidden = all.length === live.length;
  };
  setOpen(false);
  toggle.addEventListener("click", () => setOpen(root.dataset.open !== "true"));
  clear.addEventListener("click", () => {
    for (const card of cards()) if (!isLive(card)) card.remove();
    refresh();
  });
  // 카드 안에서 상태·검토 칸이 바뀌면 머리말을 다시 쓴다.
  const observer = typeof MutationObserver === "function" ? new MutationObserver(refresh) : null;
  observer?.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "data-review"] });

  const api: SideThreads = {
    root,
    adopt(card) {
      list.append(card);
      refresh();
    },
    reveal(ticketId) {
      setOpen(true);
      requestAnimationFrame(() => list.querySelector<HTMLElement>(`.ai-map-run-card[data-ticket-id="${ticketId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    },
    dispose() {
      observer?.disconnect();
      if (shared === api) shared = null;
      root.remove();
    },
  };
  shared = api;
  return api;
}
