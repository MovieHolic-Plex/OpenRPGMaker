import { isTextEntryTarget } from "@/player/keyBindings";

const BLOCKED_POINTER_EVENTS = [
  "auxclick",
  "contextmenu",
  "dblclick",
  "dragstart",
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
  "selectstart",
  "touchcancel",
  "touchend",
  "touchmove",
  "touchstart",
  "wheel",
] as const;

type PlayPointerEvent = Pick<Event, "type" | "target"> & {
  readonly detail?: number;
};

/** 누름으로 취급하는 이벤트. 이동·호버는 포커스를 건드리지 않는다. */
const PRESS_EVENTS = new Set<string>(["mousedown", "pointerdown", "touchstart"]);

export function installPlayPointerBlocker(root: HTMLElement): () => void {
  const controller = new AbortController();
  const options = { capture: true, passive: false, signal: controller.signal };
  const block = (event: Event): void => {
    if (!shouldBlockPlayPointerEvent(event)) return;
    if (PRESS_EVENTS.has(event.type)) releaseStrandedTextEntryFocus(event.target);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  for (const type of BLOCKED_POINTER_EVENTS) root.addEventListener(type, block, options);
  root.addEventListener("click", block, options);
  return () => controller.abort();
}

/**
 * 플레이 화면을 누르면 텍스트 필드에 갇힌 키보드 소유권을 되돌린다.
 *
 * 왜 여기인가(실측 2026-09-17): 편집기 타일 검색창에 포커스가 한 번 들어가면 테스트
 * 플레이에서 방향키가 죽는다 — input.ts 의 이동 두 경로가 isTextEntryFocused() 로
 * 스스로를 끄기 때문이다. 이 차단기가 mousedown 을 preventDefault 하므로 브라우저의
 * 기본 포커스 이전까지 취소되어, 플레이 화면을 눌러도 영영 복구되지 않았다
 * (편집기 캔버스는 mapSurfaceFocus.ts 로 이미 해결돼 있었고 플레이 쪽만 비어 있었다).
 * 누름을 가로채 기본 동작을 없애는 쪽이 포커스 이전까지 책임진다.
 */
function releaseStrandedTextEntryFocus(pressed: EventTarget | null): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  // 누른 대상이 그 텍스트 필드 자신이면 사용자가 방금 고른 포커스다. 빼앗지 않는다.
  if (!isTextEntryTarget(active) || active === pressed) return;
  (active as HTMLElement).blur?.();
}

export function shouldBlockPlayPointerEvent(event: PlayPointerEvent): boolean {
  if (isExplicitPointerOwner(event.target)) return false;
  if (event.type !== "click") return true;
  // 키보드 커서 메뉴는 기존 버튼 핸들러를 재사용하기 위해 HTMLElement.click()을 합성한다.
  // 실제 마우스 click은 detail >= 1 이므로 막고, 키보드/테스트용 합성 click(detail 0/없음)은 통과시킨다.
  return typeof event.detail === "number" && event.detail > 0;
}

export function isExplicitPointerOwner(target: EventTarget | null | undefined): boolean {
  return hasClosestTarget(
    target,
    "[data-play-input-owner='touch-controls'], [data-play-input-owner='host-fullscreen'], [data-play-input-owner='license-notice'], [data-play-input-owner='play-ui']",
  );
}

function hasClosestTarget(target: EventTarget | null | undefined, selector: string): boolean {
  // Node 단위 테스트 환경에는 Element 글로벌이 없을 수 있어 duck-type 한다.
  if (!target || typeof target !== "object") return false;
  const node = target as { closest?: (selector: string) => unknown };
  if (typeof node.closest !== "function") return false;
  return Boolean(node.closest(selector));
}
