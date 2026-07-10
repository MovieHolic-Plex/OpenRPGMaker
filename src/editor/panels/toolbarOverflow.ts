// 클래식 툴바 priority+ 오버플로우 — 안 들어가는 버튼을 ⋯ 팝업으로 수납 (스펙 §5).
import { el } from "@/util/dom";

export function visibleItemCount(
  containerWidth: number,
  itemWidths: readonly number[],
  moreWidth: number,
  gap: number,
): number {
  let total = 0;
  for (let i = 0; i < itemWidths.length; i += 1) {
    total += (itemWidths[i] ?? 0) + (i > 0 ? gap : 0);
  }
  if (total <= containerWidth) return itemWidths.length;

  let used = moreWidth + gap;
  let count = 0;
  for (const width of itemWidths) {
    const next = used + width + (count > 0 ? gap : 0);
    if (next > containerWidth) break;
    used = next;
    count += 1;
  }
  return count;
}

/** row의 자식 버튼을 실측해 넘치는 항목을 ⋯ 팝업으로 옮긴다. 반환: 해제 함수. */
export function installToolbarOverflow(row: HTMLElement): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};

  const moreButton = el("button", {
    class: "rm2k3-tool-button toolbar-overflow-toggle",
    text: "⋯",
    attrs: { type: "button", title: "더 보기", "aria-label": "가려진 툴바 버튼", "aria-expanded": "false" },
    dataset: { testid: "toolbar-overflow-toggle" },
  }) as HTMLButtonElement;
  const popup = el("div", {
    class: "rm2k3-menu-popup toolbar-overflow-popup",
    attrs: { role: "menu" },
    dataset: { testid: "toolbar-overflow-popup" },
  });
  popup.hidden = true;
  moreButton.addEventListener("click", () => {
    popup.hidden = !popup.hidden;
    moreButton.setAttribute("aria-expanded", String(!popup.hidden));
  });
  document.addEventListener("pointerdown", onOutside);
  function onOutside(event: Event): void {
    if (popup.hidden) return;
    if (event.target instanceof Node && (popup.contains(event.target) || moreButton.contains(event.target))) return;
    popup.hidden = true;
    moreButton.setAttribute("aria-expanded", "false");
  }

  // 원본 순서를 기억해 두고, 리사이즈마다 전부 행으로 되돌린 뒤 다시 계산한다.
  const items = Array.from(row.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
  row.append(moreButton, popup);

  const reflow = (): void => {
    for (const item of items) row.insertBefore(item, moreButton);
    moreButton.hidden = true;
    const gap = 4;
    const widths = items.map((item) => item.offsetWidth || 28);
    const count = visibleItemCount(row.clientWidth, widths, moreButton.offsetWidth || 30, gap);
    if (count >= items.length) {
      popup.hidden = true;
      return;
    }
    moreButton.hidden = false;
    for (const item of items.slice(count)) popup.append(item);
  };

  const observer = new ResizeObserver(() => reflow());
  observer.observe(row);
  reflow();
  return () => {
    observer.disconnect();
    document.removeEventListener("pointerdown", onOutside);
  };
}
