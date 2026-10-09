import { getPlayerPreferences } from '@/player/playerPreferences';
import type { RuntimeJuiceEvent } from "@/player/runtimeJuice";
import { markStatusMenuClosing } from "@/player/playerStatusMenuControllerDom";

const running = new WeakMap<HTMLElement, Animation>();
export const STATUS_MENU_MOTION = { open: 180, close: 120, page: 120, cursor: 80, feedback: 120, vitals: 220 } as const;

function reducedMotion(): boolean {
  return getPlayerPreferences().reduceMenuMotion || typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function animate(node: HTMLElement, frames: Keyframe[], duration: number, fill: FillMode = "none"): Animation | undefined {
  running.get(node)?.cancel();
  if (typeof node.animate !== "function") return undefined;
  const reduced = reducedMotion();
  const animation = node.animate(reduced ? frames.map(({ opacity }) => ({ opacity: opacity ?? 1 })) : frames, {
    duration: reduced ? 40 : duration, easing: "cubic-bezier(.2,.8,.2,1)", fill,
  });
  running.set(node, animation);
  return animation;
}

/** Remove on animation completion. The exit's final frame stays transparent,
 * including when rendering is delayed, and can never delete a reopened menu. */
export function closeStatusMenu(menu: HTMLElement): void {
  markStatusMenuClosing(menu);
  const opacity = typeof getComputedStyle === "function" ? getComputedStyle(menu).opacity : "1";
  const animation = animate(menu, [{ opacity }, { opacity: 0, transform: "translateY(2px)" }], STATUS_MENU_MOTION.close, "forwards");
  if (!animation) { menu.remove(); return; }
  void animation.finished.then(() => menu.remove(), () => {
    if (menu.dataset.statusMenuClosing === "1") menu.remove();
  });
}

export function animateStatusMenuPage(panel: HTMLElement, backwards = false): void {
  const detail = panel.querySelector<HTMLElement>(".status-menu-detail");
  if (detail) animate(detail, [{ opacity: 0.3, transform: `translateX(${backwards ? -2 : 2}px)` }, { opacity: 1, transform: "translateX(0)" }], STATUS_MENU_MOTION.page);
}

export function animateStatusMenuFeedback(menu: HTMLElement, event: RuntimeJuiceEvent): void {
  if (event === "menu-open") {
    animate(menu, [{ opacity: 0, transform: "translateY(2px)" }, { opacity: 1, transform: "translateY(0)" }], STATUS_MENU_MOTION.open);
    return;
  }
  if (event === "menu-back") { animateStatusMenuPage(menu, true); return; }
  const selected = menu.querySelector<HTMLElement>(menu.dataset.statusMenuScreen === "function"
    ? ".status-menu-detail-action.selected" : ".status-menu-command.selected");
  if (!selected) return;
  if (event === "menu-select") {
    animate(selected, [{ opacity: 0.6 }, { opacity: 1 }], STATUS_MENU_MOTION.cursor);
  } else if (event === "menu-invalid") {
    animate(selected, [{ transform: "translateX(0)", outline: "1px solid rgba(255,158,151,.8)" }, { transform: "translateX(1px)", outline: "1px solid rgba(255,158,151,.8)" }, { transform: "translateX(0)" }], STATUS_MENU_MOTION.feedback);
    const message = menu.querySelector<HTMLElement>(".status-menu-message");
    if (message) animate(message, [{ color: "rgba(255,158,151,1)" }, { color: "rgba(255,158,151,1)" }], 800);
  } else if (event === "menu-confirm") {
    animate(selected, [{ opacity: 0.65 }, { opacity: 1 }], STATUS_MENU_MOTION.feedback);
  }
}

export function animateStatusMenuVitals(menu: HTMLElement, before: ReadonlyMap<string, number>): void {
  menu.querySelectorAll<HTMLElement>(".status-menu-target-fill").forEach((bar) => {
    const row = bar.closest<HTMLElement>("[data-testid]");
    const kind = bar.parentElement?.parentElement?.classList.contains("mp") ? "mp" : "hp";
    const previous = before.get(`${row?.dataset.testid}:${kind}`);
    const next = parseFloat(bar.style.width);
    if (previous !== undefined && next !== previous) animate(bar, [{ width: `${previous}%` }, { width: `${next}%` }], STATUS_MENU_MOTION.vitals);
  });
}

export function readStatusMenuVitals(menu: HTMLElement | null): Map<string, number> {
  const values = new Map<string, number>();
  menu?.querySelectorAll<HTMLElement>(".status-menu-target-fill").forEach((bar) => {
    const row = bar.closest<HTMLElement>("[data-testid]");
    const kind = bar.parentElement?.parentElement?.classList.contains("mp") ? "mp" : "hp";
    values.set(`${row?.dataset.testid}:${kind}`, parseFloat(bar.style.width));
  });
  return values;
}
