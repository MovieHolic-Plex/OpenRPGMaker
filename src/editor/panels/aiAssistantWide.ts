import { el } from "@/util/dom";
import { isTopModal, registerModal } from "@/editor/ui/modalStack";

/** Move the live surfaces together; never create a second session or duplicate controls. */
export function createAssistantWide(panel: HTMLElement, team: HTMLElement, trigger: HTMLButtonElement, selectMember: () => void): { open(): void; dispose(): void } {
  let close: (() => void) | undefined;
  const open = () => {
    if (close || !panel.isConnected || !team.isConnected) return;
    const origin = document.activeElement as HTMLElement | null;
    const scrollNodes = () => [...panel.querySelectorAll<HTMLElement>(".ai-chat-log, .ai-activity-entries"), ...team.querySelectorAll<HTMLElement>(".ai-team-member-content")].map(node => ({ node, top: node.scrollTop }));
    const scroll = scrollNodes();
    const panelSlot = document.createComment("assistant panel slot");
    const teamSlot = document.createComment("assistant team slot");
    panel.before(panelSlot); team.before(teamSlot);
    const back = el("button", { text: "작은 패널로 돌아가기", attrs: { type: "button" }, dataset: { testid: "ai-wide-close" }, on: { click: () => close?.() } });
    const content = el("div", { class: "ai-assistant-wide-content", children: [panel, team] });
    const dialog = el("section", {
      class: "ai-assistant-wide", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "조수와 팀 크게 보기" },
      dataset: { testid: "ai-assistant-wide" },
      children: [el("header", { class: "ai-assistant-wide-head", children: [el("strong", { text: "조수 · 팀" }), el("span", { text: "대화와 팀 작업을 함께 확인하세요." }), back] }), content],
    });
    const backdrop = el("div", { class: "ai-assistant-wide-backdrop", children: [dialog] });
    trigger.setAttribute("aria-expanded", "true");
    close = registerModal(backdrop, () => {
      const currentScroll = scrollNodes();
      panelSlot.replaceWith(panel); teamSlot.replaceWith(team);
      backdrop.remove(); close = undefined;
      for (const { node, top } of currentScroll) node.scrollTop = top;
      trigger.setAttribute("aria-expanded", "false");
      origin?.isConnected && origin.focus({ preventScroll: true });
    });
    backdrop.addEventListener("click", event => { if (event.target === backdrop && isTopModal(backdrop)) close?.(); });
    dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab" || !isTopModal(backdrop)) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], summary, [tabindex="0"]')].filter(node => node.getClientRects().length && !node.matches(":disabled") && !node.closest("[hidden]"));
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    document.body.append(backdrop);
    selectMember();
    for (const { node, top } of scroll) node.scrollTop = top;
    back.focus({ preventScroll: true });
  };
  trigger.addEventListener("click", open);
  return { open, dispose: () => { close?.(); trigger.removeEventListener("click", open); } };
}
