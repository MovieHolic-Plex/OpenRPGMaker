const BLOCKED_POINTER_EVENTS = [
  "auxclick",
  "contextmenu",
  "dblclick",
  "mousedown",
  "mouseenter",
  "mousemove",
  "mouseover",
  "mouseup",
  "pointercancel",
  "pointerdown",
  "pointerenter",
  "pointermove",
  "pointerover",
  "pointerup",
  "touchcancel",
  "touchend",
  "touchmove",
  "touchstart",
  "wheel",
] as const;

type PlayPointerEvent = Pick<Event, "type"> & {
  readonly detail?: number;
};

export function installPlayPointerBlocker(root: HTMLElement): () => void {
  const controller = new AbortController();
  const options = { capture: true, passive: false, signal: controller.signal };
  const block = (event: Event): void => {
    if (!shouldBlockPlayPointerEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  for (const type of BLOCKED_POINTER_EVENTS) root.addEventListener(type, block, options);
  root.addEventListener("click", block, options);
  return () => controller.abort();
}

export function shouldBlockPlayPointerEvent(event: PlayPointerEvent): boolean {
  if (event.type !== "click") return true;
  // 키보드 커서 메뉴는 기존 버튼 핸들러를 재사용하기 위해 HTMLElement.click()을 합성한다.
  // 실제 마우스 click은 detail >= 1 이므로 막고, 키보드/테스트용 합성 click(detail 0/없음)은 통과시킨다.
  return typeof event.detail === "number" && event.detail > 0;
}
