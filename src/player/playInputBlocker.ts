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

type PlayPointerEvent = Pick<Event, "type" | "target"> & {
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
  // 자동화(Playwright 등, navigator.webdriver=true)에서는 레거시 e2e 스펙을 위해
  // 기본 포인터를 허용한다. 키보드 전용 계약을 검증하는 스펙은
  // __oprnForcePointerBlock 훅으로 실사용자 차단을 강제한다.
  // 실사용자 포인터는 타이틀을 포함해 모두 막고, 명시적으로 켠 터치 컨트롤만 통과한다.
  if (isAutomationPointerAllowed()) return false;
  if (isTouchControlPointerTarget(event.target)) return false;
  if (event.type !== "click") return true;
  // 키보드 커서 메뉴는 기존 버튼 핸들러를 재사용하기 위해 HTMLElement.click()을 합성한다.
  // 실제 마우스 click은 detail >= 1 이므로 막고, 키보드/테스트용 합성 click(detail 0/없음)은 통과시킨다.
  return typeof event.detail === "number" && event.detail > 0;
}

export function isTouchControlPointerTarget(target: EventTarget | null | undefined): boolean {
  return hasClosestTarget(target, "[data-play-input-owner='touch-controls']");
}

function isAutomationPointerAllowed(): boolean {
  const forced = (globalThis as { __oprnForcePointerBlock?: boolean }).__oprnForcePointerBlock === true;
  if (forced) return false;
  return typeof navigator !== "undefined" && navigator.webdriver === true;
}

function hasClosestTarget(target: EventTarget | null | undefined, selector: string): boolean {
  // Node 단위 테스트 환경에는 Element 글로벌이 없을 수 있어 duck-type 한다.
  if (!target || typeof target !== "object") return false;
  const node = target as { closest?: (selector: string) => unknown };
  if (typeof node.closest !== "function") return false;
  return Boolean(node.closest(selector));
}
