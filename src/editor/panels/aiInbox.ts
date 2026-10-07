// editor/panels/aiInbox.ts
// 도크 맨 위 「내 확인이 필요해요」 — 승인·실패만 모은다. 비어 있으면 아예 보이지 않는다.
//
// 상태 줄이 「무슨 일을」이면 받은함은 「내가 할 일」이다. 진행 중인 일은 여기 올리지 않는다(지도·상태 줄이 맡는다).
// 적용/되돌리기는 로그 카드·팀 패널의 검토 버튼과 같은 클로저(currentTeamReviewActions)를 부른다 — 두 버튼, 한 동작.

import { currentTeamReviewActions } from "@/ai/piAgent/teamActivity";
import { el } from "@/util/dom";
import { sideThreads } from "./aiSideThreads";
import { dismissPresence, needsUser, subscribeAiPresence, type Presence } from "./aiPresence";

export function createAiInbox(options: { readonly openLogs: () => void }): { root: HTMLElement; dispose(): void } {
  const list = el("div", { class: "ai-inbox-list" });
  const count = el("span", { class: "ai-inbox-count" });
  const root = el("section", {
    class: "ai-inbox", attrs: { "aria-label": "내 확인이 필요해요", hidden: "" }, dataset: { testid: "ai-inbox" },
    children: [el("div", { class: "ai-inbox-head", children: [el("span", { text: "내 확인이 필요해요" }), count] }), list],
  });

  const card = (presence: Presence): HTMLElement => {
    const where = presence.mapName && presence.source === "background" ? ` · ${presence.mapName}` : "";
    // 다른 맵에서 돈 실행의 검토는 그 실행 카드(다른 스레드 트레이)가 쥐고 있다 — 거기로 데려간다.
    if (presence.state === "review" && presence.source === "background") {
      return el("article", {
        class: "ai-inbox-card is-review", dataset: { testid: "ai-inbox-card", state: "review", tone: String(presence.tone), source: "background" },
        children: [
          el("h4", { text: `변경 검토 — ${presence.name}${where}` }),
          el("p", { text: "초안이에요, 아직 적용 전 · 「다른 스레드」의 작업 카드에서 적용하거나 버릴 수 있어요." }),
          el("div", { class: "ai-inbox-actions", children: [
            el("button", { class: "ai-inbox-btn is-primary", text: "검토하기", attrs: { type: "button" }, dataset: { testid: "ai-inbox-open-run" }, on: { click: () => {
              window.dispatchEvent(new Event("oprn:ai-open-chat"));
              if (presence.ticketId !== undefined) sideThreads()?.reveal(presence.ticketId);
            } } }),
          ] }),
        ],
      });
    }
    if (presence.state === "review") {
      const actions = (): ReturnType<typeof currentTeamReviewActions> => currentTeamReviewActions();
      const report = actions()?.openReport;
      return el("article", {
        class: "ai-inbox-card is-review", dataset: { testid: "ai-inbox-card", state: "review", tone: String(presence.tone) },
        children: [
          el("h4", { text: `변경 검토 — ${presence.name}` }),
          el("p", { text: presence.note ? `${presence.note} · 초안이에요, 아직 적용 전` : "초안이에요, 아직 적용 전" }),
          el("div", { class: "ai-inbox-actions", children: [
            el("button", { class: "ai-inbox-btn is-primary", text: "적용", attrs: { type: "button" }, dataset: { testid: "ai-inbox-apply" }, on: { click: () => actions()?.apply() } }),
            ...(report ? [el("button", { class: "ai-inbox-btn", text: "변경 보기", attrs: { type: "button" }, on: { click: () => actions()?.openReport?.() } })] : []),
            el("button", { class: "ai-inbox-btn", text: "버리기", attrs: { type: "button" }, dataset: { testid: "ai-inbox-discard" }, on: { click: () => actions()?.discard() } }),
          ] }),
        ],
      });
    }
    return el("article", {
      class: "ai-inbox-card is-failed", dataset: { testid: "ai-inbox-card", state: "failed", tone: String(presence.tone) },
      children: [
        el("h4", { text: `${presence.action} — ${presence.name}${where}` }),
        ...(presence.note ? [el("p", { text: presence.note, attrs: { translate: "no" } })] : []),
        el("div", { class: "ai-inbox-actions", children: [
          el("button", { class: "ai-inbox-btn", text: "기록 보기", attrs: { type: "button" }, on: { click: () => options.openLogs() } }),
          el("button", { class: "ai-inbox-btn", text: "확인했어요", attrs: { type: "button" }, dataset: { testid: "ai-inbox-dismiss" }, on: { click: () => dismissPresence(presence.id) } }),
        ] }),
      ],
    });
  };

  const off = subscribeAiPresence(presences => {
    const items = presences.filter(needsUser);
    root.hidden = items.length === 0;
    count.textContent = items.length ? String(items.length) : "";
    list.replaceChildren(...items.map(card));
  });
  return { root, dispose: off };
}
