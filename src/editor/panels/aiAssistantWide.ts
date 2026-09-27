import { el } from "@/util/dom";
import { isTopModal, registerModal } from "@/editor/ui/modalStack";

export type WindowControlStyle = "mac" | "windows";

type PlatformNavigator = Pick<Navigator, "platform" | "userAgent"> & { userAgentData?: { platform?: string } };

/** macOS/iOS 는 신호등, 그 외(Windows·Linux)는 오른쪽 캡션 버튼. 두 데스크톱 모두 오른쪽 배치가 기본이다. */
export function detectWindowControlStyle(nav: PlatformNavigator | undefined = globalThis.navigator): WindowControlStyle {
  const platform = `${nav?.userAgentData?.platform ?? ""} ${nav?.platform ?? ""} ${nav?.userAgent ?? ""}`.toLowerCase();
  return /mac|iphone|ipad|ipod/.test(platform) ? "mac" : "windows";
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** 창 버튼 기호. 굵기가 다른 두 가족(신호등의 굵은 기호, Windows 의 가는 선)이라 데크 아이콘과 따로 둔다. */
function controlGlyph(paths: readonly string[], cls = ""): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", `ai-wide-control-glyph ${cls}`.trim());
  svg.setAttribute("viewBox", "0 0 10 10");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of paths) { const node = document.createElementNS(SVG_NS, "path"); node.setAttribute("d", d); svg.append(node); }
  return svg;
}

const GLYPH = {
  close: ["M1.5 1.5l7 7M8.5 1.5l-7 7"],
  minimize: ["M1 5h8"],
  maximize: ["M1.5 1.5h7v7h-7z"],
  restore: ["M1.5 3.5h5v5h-5z", "M3.5 3.5v-2h5v5h-2"],
  macMaximize: ["M2 6.5v-4.5h4.5M8 3.5v4.5h-4.5"],
} as const;

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
    const controlStyle = detectWindowControlStyle();
    // 최소화 = 기존 「작게 보기」(패널로 접기), 닫기 = 큰 창 닫기. 둘 다 창만 닫고 작업은 취소하지 않는다.
    const minimize = el("button", { class: "ai-wide-control is-minimize", attrs: { type: "button", "aria-label": "작은 패널로 돌아가기" }, dataset: { testid: "ai-wide-close" }, on: { click: () => close?.() } });
    const dismiss = el("button", { class: "ai-wide-control is-close", attrs: { type: "button", "aria-label": "크게 보기 닫기" }, dataset: { testid: "ai-wide-dismiss" }, on: { click: () => close?.() } });
    const maximize = el("button", { class: "ai-wide-control is-maximize", attrs: { type: "button", "aria-pressed": "false" }, dataset: { testid: "ai-wide-maximize" } });
    if (controlStyle === "mac") {
      dismiss.append(controlGlyph(GLYPH.close)); minimize.append(controlGlyph(GLYPH.minimize)); maximize.append(controlGlyph(GLYPH.macMaximize));
    } else {
      dismiss.append(controlGlyph(GLYPH.close)); minimize.append(controlGlyph(GLYPH.minimize));
      maximize.append(controlGlyph(GLYPH.maximize, "is-max-glyph"), controlGlyph(GLYPH.restore, "is-restore-glyph"));
    }
    const controls = el("div", {
      class: `ai-wide-controls is-${controlStyle}`, attrs: { role: "group", "aria-label": "창 제어" }, dataset: { testid: "ai-wide-controls", style: controlStyle },
      // macOS 는 닫기·최소화·확대 순서로 왼쪽, Windows 는 최소화·최대화·닫기 순서로 오른쪽.
      children: controlStyle === "mac" ? [dismiss, minimize, maximize] : [minimize, maximize, dismiss],
    });
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
    if (controlStyle === "mac") header.prepend(controls); else header.append(controls);
    const dialog = el("section", {
      class: "ai-assistant-wide", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "조수와 팀 크게 보기" },
      dataset: { testid: "ai-assistant-wide" },
      children: [header, content],
    });
    const backdrop = el("div", { class: "ai-assistant-wide-backdrop", children: [dialog] });
    const setMaximized = (on: boolean) => {
      backdrop.classList.toggle("is-maximized", on);
      maximize.setAttribute("aria-pressed", String(on));
      maximize.setAttribute("aria-label", on ? "이전 크기로 복원" : controlStyle === "mac" ? "화면 가득 키우기" : "최대화");
      requestAnimationFrame(() => setSplit(teamPercent));
    };
    maximize.addEventListener("click", () => setMaximized(!backdrop.classList.contains("is-maximized")));
    setMaximized(false);
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
    minimize.focus({ preventScroll: true });
  };
  trigger.addEventListener("click", open);
  return { open, dispose: () => { close?.(); trigger.removeEventListener("click", open); } };
}
