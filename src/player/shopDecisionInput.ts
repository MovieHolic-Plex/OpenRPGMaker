import {
  directionForKey, isCancelKey, isConfirmKey, isShopFocusGroupKey, isShopDetailScrollKey,
} from "@/player/keyBindings";
import { emitRuntimeJuice } from "@/player/runtimeJuice";

const STOCK_GROUPS = [
  ".runtime-shop-item-row", ".runtime-shop-tab", ".runtime-shop-chip",
  "[data-testid='shop-detail-open']", "[data-testid='shop-quantity-input']",
  "[data-testid='shop-confirm']", "[data-testid='shop-item-cancel']",
] as const;
const DETAIL_GROUPS = [
  ".runtime-shop-actor", ".runtime-shop-slot-choice",
  "[data-testid='shop-detail-scroll']", "[data-testid='shop-detail-close']",
] as const;

/** Stock owns its keys locally. Entrance/haggle keep their existing cursor controller. */
export function attachShopDecisionInput(root: HTMLElement, options: {
  readonly initialIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onQuantity: (direction: -1 | 1) => void;
}): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const rows = Array.from(root.querySelectorAll<HTMLElement>(STOCK_GROUPS[0]));
  let selected = Math.max(0, Math.min(options.initialIndex, rows.length - 1));
  const select = (index: number) => {
    selected = index;
    rows.forEach((row, i) => {
      row.classList.toggle("selected", i === index);
      if (i === index) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
    options.onSelect(index);
  };
  const focus = (node: HTMLElement | undefined) => {
    node?.focus({ preventScroll: true });
    node?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  const detailRoot = () => root.querySelector<HTMLElement>("[data-testid='shop-comparison']");
  const groups = () => {
    const detail = detailRoot();
    return (detail ? DETAIL_GROUPS : STOCK_GROUPS).map(selector =>
      Array.from((detail ?? root).querySelectorAll<HTMLElement>(selector))
        .filter(node => !node.matches(":disabled, [aria-disabled='true'], [hidden]"))
    ).filter(group => group.length > 0);
  };
  const representative = (group: HTMLElement[]) => group.find(node =>
    node.matches(".selected, [aria-selected='true'], [aria-pressed='true']")
  ) ?? group[0];
  rows.forEach((row, index) => {
    row.classList.add("rm-nav-item");
    row.addEventListener("focus", () => select(index), { signal });
    row.addEventListener("mouseenter", () => select(index), { signal });
    // Pointer activation must select its own row before the existing trade callback.
    row.addEventListener("click", () => select(index), { signal, capture: true });
  });
  root.addEventListener("keydown", event => {
    if (event.isComposing) return;
    const detail = detailRoot();
    const active = root.ownerDocument.activeElement;
    const ring = groups();
    const groupIndex = ring.findIndex(group => group.some(node => node === active));
    const group = ring[groupIndex];
    const direction = directionForKey(event.key);
    const scrollKey = isShopDetailScrollKey(event.key);
    if (!direction && !isConfirmKey(event.key) && !isCancelKey(event.key)
      && !isShopFocusGroupKey(event.key) && !(detail && scrollKey)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat && (isConfirmKey(event.key) || isCancelKey(event.key) || isShopFocusGroupKey(event.key))) return;
    if (isCancelKey(event.key)) {
      emitRuntimeJuice({ event: "menu-back" });
      root.querySelector<HTMLElement>(detail ? "[data-testid='shop-detail-close']" : "[data-testid='shop-item-cancel']")?.click();
    } else if (isShopFocusGroupKey(event.key)) {
      const next = (groupIndex + (event.shiftKey ? -1 : 1) + ring.length) % ring.length;
      if (ring[next]) focus(representative(ring[next]));
    } else if (detail && active instanceof HTMLElement && active.dataset.testid === "shop-detail-scroll" && scrollKey) {
      const max = Math.max(0, active.scrollHeight - active.clientHeight);
      const page = active.clientHeight;
      const key = event.key.toLowerCase();
      const next = key === "home" ? 0 : key === "end" ? max
        : active.scrollTop + (key === "pageup" ? -page : key === "pagedown" ? page
          : direction === "up" || direction === "left" ? -32 : 32);
      active.scrollTop = Math.max(0, Math.min(max, next));
    } else if (direction) {
      const itemGroup = group?.[0]?.matches(STOCK_GROUPS[0]);
      const quantityGroup = active instanceof HTMLElement && active.dataset.testid === "shop-quantity-input";
      const quantityInput = root.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
      if (!detail && quantityInput && ((itemGroup && (direction === "left" || direction === "right")) || quantityGroup)) {
        options.onQuantity(direction === "left" || direction === "down" ? -1 : 1);
      } else if (group?.length) {
        const index = group.findIndex(node => node === active);
        focus(group[(index + (direction === "left" || direction === "up" ? -1 : 1) + group.length) % group.length]);
        emitRuntimeJuice({ event: "menu-select" });
      }
    } else if (isConfirmKey(event.key)) {
      // The focused native action is the sole confirm route. Inputs/scroll never trade.
      if (active instanceof HTMLButtonElement && root.contains(active) && !active.disabled) active.click();
    }
  }, { signal });
  if (rows.length) { select(selected); focus(rows[selected]); }
  else { const first = groups()[0]; if (first) focus(representative(first)); }
  return () => controller.abort();
}
