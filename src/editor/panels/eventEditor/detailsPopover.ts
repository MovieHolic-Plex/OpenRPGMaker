import { registerModal, unregisterModal } from "@/editor/ui/modalStack";

const layerStops = new WeakMap<HTMLDetailsElement, () => void>();

/**
 * 메뉴를 접고, 그 층과 바깥 pointerdown 리스너를 바로 걷는다.
 * 브라우저의 `toggle` 은 태스크로 늦게 오므로, 닫기 판정보다 먼저 걷으려면 이 경로를 쓴다.
 */
export function closeDetailsLayerNow(details: HTMLDetailsElement): void {
  if (details.open) details.open = false;
  layerStops.get(details)?.();
}

/**
 * `<details>` 메뉴를 Escape 층에 올린다.
 * 열려 있는 동안 Escape 는 이 메뉴만 닫고 요약을 다시 포커스한다. 에디터는 닫지 않는다.
 * 본문이 다시 그려져 노드가 떨어지면 층과 바깥 클릭 리스너를 걷는다.
 */
export function bindDetailsEscape(details: HTMLDetailsElement): void {
  const summary = details.querySelector("summary");
  let listening = false;
  const onPointerDown = (event: Event): void => {
    if (event.target instanceof Node && details.contains(event.target)) return;
    details.open = false;
  };
  const stop = (): void => {
    if (!listening) return;
    listening = false;
    unregisterModal(details);
    document.removeEventListener("pointerdown", onPointerDown, true);
  };
  const closeLayer = (): void => {
    details.open = false;
    if (summary instanceof HTMLElement && summary.isConnected) summary.focus();
  };
  layerStops.set(details, stop);
  details.addEventListener("toggle", () => {
    if (!details.open) {
      stop();
      return;
    }
    if (listening) return;
    listening = true;
    registerModal(details, closeLayer);
    document.addEventListener("pointerdown", onPointerDown, true);
  });
  if (typeof MutationObserver === "undefined" || !document.body) return;
  const observer = new MutationObserver(() => {
    if (details.isConnected) return;
    stop();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
