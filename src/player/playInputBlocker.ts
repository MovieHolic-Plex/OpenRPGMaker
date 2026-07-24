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
  // 자동화(Playwright 등, navigator.webdriver=true)에서는 레거시 e2e 스펙들이
  // 타이틀/메뉴를 신뢰 클릭으로 조작하므로 차단하지 않는다. 단 키보드 전용
  // 동작 자체를 검증하는 스펙은 __rpgzzuForcePointerBlock 훅으로 실차단을 강제한다.
  // 실사용자(webdriver 부재)는 필드 플레이 중 마우스를 막되, 타이틀 메뉴 항목은
  // 클릭으로 시작/이어하기/종료가 되게 예외를 둔다.
  if (isAutomationPointerAllowed()) return false;
  if (isTitleMenuPointerTarget(event.target)) return false;
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
  const forced = (globalThis as { __rpgzzuForcePointerBlock?: boolean }).__rpgzzuForcePointerBlock === true;
  if (forced) return false;
  return typeof navigator !== "undefined" && navigator.webdriver === true;
}

function isTitleMenuPointerTarget(target: EventTarget | null | undefined): boolean {
  return hasClosestTarget(
    target,
    "[data-testid='title-new-game'], [data-testid='title-load-game'], [data-testid='title-quit-game']"
  );
}

function hasClosestTarget(target: EventTarget | null | undefined, selector: string): boolean {
  // Node 단위 테스트 환경에는 Element 글로벌이 없을 수 있어 duck-type 한다.
  if (!target || typeof target !== "object") return false;
  const node = target as { closest?: (selector: string) => unknown };
  if (typeof node.closest !== "function") return false;
  return Boolean(node.closest(selector));
}
