import { el } from "@/util/dom";
import { isTopModal, registerModal } from "@/editor/ui/modalStack";

/** Move the live surfaces together; never create a second session or duplicate controls. */
export function createAssistantWide(panel: HTMLElement, team: HTMLElement, trigger: HTMLButtonElement, selectMember: () => void): { open(): void; dispose(): void } {
  let close: (() => void) | undefined;
  let teamPercent = 30;
  const open = () => {
    if (close || !panel.isConnected || !team.isConnected) return;
    const origin = document.activeElement as HTMLElement | null;
    const scrollNodes = () => [...panel.querySelectorAll<HTMLElement>(".ai-chat-log, .ai-activity-entries"), ...team.querySelectorAll<HTMLElement>(".ai-team-member-content")].map(node => ({ node, top: node.scrollTop }));
    const scroll = scrollNodes();
    const panelSlot = document.createComment("assistant panel slot");
    const teamSlot = document.createComment("assistant team slot");
    panel.before(panelSlot); team.before(teamSlot);
    const back = el("button", { class: "ai-assistant-wide-back", text: "작게 보기 ↙", attrs: { type: "button", "aria-label": "작은 패널로 돌아가기" }, dataset: { testid: "ai-wide-close" }, on: { click: () => close?.() } });
    const divider = el("div", { class: "ai-assistant-wide-divider", attrs: { role: "separator", tabindex: "0", "aria-label": "대화와 팀 너비 조절", "aria-orientation": "vertical", "aria-valuemin": "50", "aria-valuemax": "80" }, dataset: { testid: "ai-wide-divider" } });
    const content = el("div", { class: "ai-assistant-wide-content", children: [panel, divider, team] });
    const setSplit = (percent: number) => {
      const width = content.getBoundingClientRect().width;
      if (width < 760) return;
      teamPercent = Math.max(300 / width * 100, Math.min(Math.min(50, (width - 420) / width * 100), percent));
      content.style.setProperty("--ai-wide-team-width", `${teamPercent}%`);
      divider.setAttribute("aria-valuenow", String(Math.round(100 - teamPercent)));
    };
    divider.addEventListener("pointerdown", event => { if (event.button !== 0) return; event.preventDefault(); divider.setPointerCapture(event.pointerId); divider.focus(); });
    divider.addEventListener("pointermove", event => { if (!divider.hasPointerCapture(event.pointerId)) return; const bounds = content.getBoundingClientRect(); setSplit((bounds.right - event.clientX) / bounds.width * 100); });
    divider.addEventListener("pointerup", event => { if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId); });
    divider.addEventListener("dblclick", () => setSplit(30));
    divider.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      setSplit(event.key === "Home" ? 30 : teamPercent + (event.key === "ArrowLeft" ? 2 : -2));
    });
    // The existing level control moves with its handlers intact.
    const header = el("header", { class: "ai-assistant-wide-head", children: [el("div", { class: "ai-assistant-wide-title", children: [el("strong", { text: "조수" }), el("span", { text: "대화와 작업 기록" })] })] });
    const moved = [panel.querySelector<HTMLElement>(".ai-activity-toolbar > .ai-activity-setting")].flatMap(node => {
      if (!node) return [];
      const slot = document.createComment("assistant header control slot"); node.before(slot); header.append(node); return [{ node, slot }];
    });
    header.append(back);
    const dialog = el("section", {
      class: "ai-assistant-wide", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "조수와 팀 크게 보기" },
      dataset: { testid: "ai-assistant-wide" },
      children: [header, content],
    });
    const backdrop = el("div", { class: "ai-assistant-wide-backdrop", children: [dialog] });
    trigger.setAttribute("aria-expanded", "true");
    close = registerModal(backdrop, () => {
      const currentScroll = scrollNodes();
      for (const { node, slot } of moved) slot.replaceWith(node);
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
    setSplit(teamPercent);
    selectMember();
    for (const { node, top } of scroll) node.scrollTop = top;
    back.focus({ preventScroll: true });
  };
  trigger.addEventListener("click", open);
  return { open, dispose: () => { close?.(); trigger.removeEventListener("click", open); } };
}
