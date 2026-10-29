// 터치 화면의 「탭」 두 가지(2026-10-24).
// 1) 게임 화면 빈 곳을 탭하면 확인(Enter)이다 — 타이틀 시작·대사 넘기기·말 걸기. 단추·대사창·메뉴·상점·전투 위의 탭은 그 UI 의 것이다.
// 2) 겹친 창(대화 기록·백로그)은 짧게 탭하거나 아래/옆으로 쓸어 닫는다 — 키보드 안내(L · Esc)만 있으면 폰에서 갇힌다.
// Phaser 는 DOM MouseEvent 만 듣는다. 여기서는 합성 키(Enter)를 보내 데스크톱과 같은 길을 탄다.

import { snapRowAt } from "@/player/touchListTap";
import { inputTime, keyTarget } from "@/player/touchPad";

export { inputTime };

/**
 * 탭으로 치는 누름: 이보다 짧고 덜 움직였으면 탭이다. 2026-10-30 400ms·14px 에서 넓혔다 — 화면이 바쁘면 손을 뗀 이벤트가
 * 수백 ms 늦게 와 정상 탭이 버려졌고, 엄지 탭은 손가락 굴림만으로 10~18px 움직인다(애플·안드로이드 터치 슬롭 관례 ~16~20px).
 */
export const TAP_MAX_MS = 700;
export const TAP_MAX_MOVE = 20;

/** 이 요소 자체(자식 UI 가 아닌 바탕)를 탭했을 때만 확인으로 친다. */
const BACKDROP_SELECTOR = [
  "canvas",
  ".phaser-container",
  ".play-stage",
  ".play-viewport",
  ".dialogue-overlay",
  ".dialogue-scrim",
  ".dialogue-ambient-layer",
  "[data-testid='title-screen']",
  ".rm-title-screen",
].join(", ");

/** 이것들이 떠 있으면 바탕 탭은 아무 일도 하지 않는다 — 선택지를 잘못 고르거나 메뉴 항목을 지나치지 않게. */
const BUSY_SELECTOR = [
  ".choices-active",
  "[data-testid='main-menu']",
  ".runtime-shop-overlay",
  "[data-testid='battle-scene']",
  "[data-testid='dialogue-log']",
  "[data-testid='dialogue-backlog']",
  ".name-entry-overlay",
].join(", ");

function isBackdrop(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("button, a, input, select, textarea, [role='button'], [role='menuitem'], .dialogue-box, .touch-pad, .play-fullscreen-toggle")) return false;
  return target.matches(BACKDROP_SELECTOR) || target.closest(".phaser-container") !== null;
}

export interface TapConfirmOptions {
  /** 맵을 탭해 걷는 게임(system.pointerMovement) — 필드의 캔버스 탭은 걷기에 맡긴다. */
  readonly pointerMovement?: () => boolean;
  /** 확인·취소가 접수될 때 짧게 떨지(플레이어 옵션 「진동」). */
  readonly haptics?: () => boolean;
}

/** 두 손가락 탭 = 취소(Esc) — RPG 쯔꾸르 MZ 의 터치 규약. 두 번째 손가락이 이 안에 닿아야 한 몸짓이다. */
export const TWO_FINGER_WINDOW_MS = 300;
/** 두 손가락을 다 떼기까지 이보다 길면 탭이 아니다(핀치·잡고 있기). */
const TWO_FINGER_MAX_MS = 700;

type TouchStart = { id: number; x: number; y: number; at: number; target: EventTarget | null; handled: boolean };

/** 대사가 떠 있고(선택지·메뉴·기록 없음) 바탕을 눌렀는가 — 누르는 순간 넘긴다. */
function isDialoguePress(root: HTMLElement, target: EventTarget | null, x: number, y: number): boolean {
  if (!isBackdrop(target)) return false;
  if (root.querySelector(BUSY_SELECTOR)) return false;
  if (root.querySelector("[data-dialogue-hidden]")) return false; // 숨긴 대사: 누름은 다시 보이기만 한다(dialogue.ts).
  if (root.querySelector(".dialogue-overlay:not(:empty) .dialogue-box") === null) return false;
  return !snapRowAt(root, target, x, y);
}

export function installTapConfirm(root: HTMLElement, options: TapConfirmOptions = {}): () => void {
  const controller = new AbortController();
  const signal = controller.signal;
  const buzz = (ms: number): void => {
    if (options.haptics?.() === false) return;
    try { if (typeof navigator.vibrate === "function") navigator.vibrate(ms); } catch { /* 정책 */ }
  };
  const live = new Map<number, TouchStart>();
  let down: TouchStart | null = null;
  // 두 손가락 탭: 둘째 손가락이 닿으면 한 손가락 탭 판정을 버리고, 둘 다 뗄 때 취소를 보낸다.
  let twoFinger: { at: number; points: Map<number, { x: number; y: number }>; moved: boolean } | null = null;
  const onControls = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest(".touch-pad, button, [role='button'], .play-fullscreen-toggle") !== null;
  root.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    const start: TouchStart = { id: event.pointerId, x: event.clientX, y: event.clientY, at: inputTime(event), target: event.target, handled: false };
    // 첫 손가락(isPrimary)이면 다른 손가락은 없다 — 놓친 pointerup 으로 남은 기록을 비운다.
    if (event.isPrimary) { live.clear(); twoFinger = null; }
    live.set(event.pointerId, start);
    if (live.size === 2 && !twoFinger) {
      const first = [...live.values()].find((point) => point.id !== event.pointerId);
      // 조이스틱을 쥔 채 다른 손가락으로 화면을 누르는 것은 두 손가락 탭이 아니다.
      if (first && !first.handled && start.at - first.at <= TWO_FINGER_WINDOW_MS && !onControls(first.target) && !onControls(event.target)) {
        twoFinger = { at: first.at, points: new Map([[first.id, { x: first.x, y: first.y }], [start.id, { x: start.x, y: start.y }]]), moved: false };
        down = null;
        return;
      }
    }
    if (live.size > 2) { twoFinger = null; down = null; return; }
    if (live.size > 1) return;
    down = start;
    // 대사는 누르는 순간 넘긴다(RPG 쯔꾸르 MZ 의 터치 트리거와 같다). 뗄 때 판정하던 예전 방식은 400ms 를 넘게 누르거나
    // 화면이 바빠 손을 뗀 이벤트가 늦게 오면 탭을 버렸다(2026-10-30 실측: 70ms 탭 세 번 중 두 번이 버려짐).
    if (isDialoguePress(root, event.target, event.clientX, event.clientY)) {
      start.handled = true;
      buzz(6);
      pressKey("Enter");
    }
  }, { capture: true, signal });
  root.addEventListener("pointermove", (event) => {
    const origin = twoFinger?.points.get(event.pointerId);
    if (twoFinger && origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > TAP_MAX_MOVE) twoFinger.moved = true;
  }, { capture: true, signal });
  root.addEventListener("pointerup", (event) => {
    live.delete(event.pointerId);
    if (twoFinger) {
      if (!twoFinger.points.has(event.pointerId) || live.size > 0) return;
      const gesture = twoFinger;
      twoFinger = null;
      if (gesture.moved || inputTime(event) - gesture.at > TWO_FINGER_MAX_MS) return;
      // 대사·선택지가 떠 있을 때는 취소를 보내지 않는다 — 대사를 건너뛰거나 선택지를 닫지 않게.
      if (root.querySelector(".dialogue-overlay:not(:empty) .dialogue-box, .choices-active")) return;
      buzz(10);
      pressKey("Escape");
      return;
    }
    const start = down;
    down = null;
    if (!start || start.id !== event.pointerId || start.handled) return;
    if (inputTime(event) - start.at > TAP_MAX_MS) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MAX_MOVE) return;
    if (!isBackdrop(start.target)) return;
    // 줄 바로 옆(넓힌 눌림 영역)을 탭한 것은 그 줄의 탭이다(touchListTap) — 타이틀에서 선택된 항목을 확정하지 않는다.
    if (snapRowAt(root, start.target, start.x, start.y)) return;
    if (root.querySelector(BUSY_SELECTOR)) return;
    const dialogueOpen = root.querySelector(".dialogue-overlay:not(:empty) .dialogue-box") !== null;
    // 맵 탭 걷기가 켜진 게임: 필드에서 맵(캔버스 상자 안)을 탭하면 걷기다 — 확인을 보내지 않는다.
    // 캔버스는 pointer-events:none 이라 대상이 캔버스가 아니라 그 조상이다(예전 판정은 그래서 늘 확인을 보냈다). 좌표로 본다.
    if (!dialogueOpen && options.pointerMovement?.() === true && insideCanvas(root, start.x, start.y)) return;
    buzz(6);
    pressKey("Enter");
  }, { capture: true, signal });
  root.addEventListener("pointercancel", (event) => {
    live.delete(event.pointerId);
    if (live.size === 0) twoFinger = null;
    down = null;
  }, { capture: true, signal });
  return () => controller.abort();
}

function insideCanvas(root: HTMLElement, x: number, y: number): boolean {
  const canvas = root.querySelector<HTMLCanvasElement>(".play-stage canvas, canvas");
  if (!canvas) return false;
  const r = canvas.getBoundingClientRect();
  return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
}

function pressKey(key: string): void {
  const target = keyTarget();
  target.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent("keyup", { key, code: key, bubbles: true, cancelable: true }));
}

/** 겹친 창을 탭(움직임 없는 짧은 누름) 또는 쓸기(아래·옆 60px 이상)로 닫는다. 목록 스크롤은 그대로 둔다. */
export function installTapOrSwipeToClose(panel: HTMLElement, close: () => void): void {
  let start: { id: number; x: number; y: number; at: number; scroll: number } | null = null;
  const list = (): HTMLElement | null => panel.querySelector<HTMLElement>("ol, ul");
  panel.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY, at: inputTime(event), scroll: list()?.scrollTop ?? 0 };
  });
  panel.addEventListener("pointerup", (event) => {
    const s = start;
    start = null;
    if (!s || s.id !== event.pointerId) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    const scrolled = Math.abs((list()?.scrollTop ?? 0) - s.scroll) > 2;
    const tap = inputTime(event) - s.at <= TAP_MAX_MS && Math.hypot(dx, dy) <= TAP_MAX_MOVE;
    // 목록이 맨 위에서 더 내려 당겨지거나(스크롤 안 됨), 옆으로 크게 쓸면 닫는다.
    const swipe = !scrolled && (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3 || dy > 80 && (list()?.scrollTop ?? 0) <= 0);
    if (tap || swipe) {
      event.preventDefault();
      event.stopPropagation();
      // 같은 누름의 click 이 뒤의 게임(대사 넘기기)에 닿지 않게 한 번 삼킨다.
      const swallow = (clickEvent: Event): void => { clickEvent.stopPropagation(); clickEvent.preventDefault(); };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, true), 400);
      close();
    }
  });
  panel.addEventListener("pointercancel", () => { start = null; });
}

/** 터치 UI 로 열린 화면인가(playSurface 가 `data-touch-ui` 를 단다). */
export function isTouchUiHost(node: Element | null | undefined): boolean {
  return Boolean(node?.closest?.("[data-touch-ui='true']"));
}
