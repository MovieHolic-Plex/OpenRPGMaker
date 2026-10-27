// 터치 화면의 「탭」 두 가지(2026-10-24).
// 1) 게임 화면 빈 곳을 탭하면 확인(Enter)이다 — 타이틀 시작·대사 넘기기·말 걸기. 단추·대사창·메뉴·상점·전투 위의 탭은 그 UI 의 것이다.
// 2) 겹친 창(대화 기록·백로그)은 짧게 탭하거나 아래/옆으로 쓸어 닫는다 — 키보드 안내(L · Esc)만 있으면 폰에서 갇힌다.
// Phaser 는 DOM MouseEvent 만 듣는다. 여기서는 합성 키(Enter)를 보내 데스크톱과 같은 길을 탄다.

import { snapRowAt } from "@/player/touchListTap";
import { keyTarget } from "@/player/touchPad";

const TAP_MAX_MS = 400;
const TAP_MAX_MOVE = 14;

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
}

export function installTapConfirm(root: HTMLElement, options: TapConfirmOptions = {}): () => void {
  const controller = new AbortController();
  const signal = controller.signal;
  let down: { id: number; x: number; y: number; at: number; target: EventTarget | null } | null = null;
  root.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    down = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), target: event.target };
  }, { capture: true, signal });
  root.addEventListener("pointerup", (event) => {
    const start = down;
    down = null;
    if (!start || start.id !== event.pointerId) return;
    if (performance.now() - start.at > TAP_MAX_MS) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MAX_MOVE) return;
    if (!isBackdrop(start.target)) return;
    // 줄 바로 옆(넓힌 눌림 영역)을 탭한 것은 그 줄의 탭이다(touchListTap) — 타이틀에서 선택된 항목을 확정하지 않는다.
    if (snapRowAt(root, start.target, start.x, start.y)) return;
    if (root.querySelector(BUSY_SELECTOR)) return;
    const dialogueOpen = root.querySelector(".dialogue-overlay:not(:empty) .dialogue-box") !== null;
    // 맵 탭 걷기가 켜진 게임: 필드에서 맵(캔버스 상자 안)을 탭하면 걷기다 — 확인을 보내지 않는다.
    // 캔버스는 pointer-events:none 이라 대상이 캔버스가 아니라 그 조상이다(예전 판정은 그래서 늘 확인을 보냈다). 좌표로 본다.
    if (!dialogueOpen && options.pointerMovement?.() === true && insideCanvas(root, start.x, start.y)) return;
    pressKey("Enter");
  }, { capture: true, signal });
  root.addEventListener("pointercancel", () => { down = null; }, { capture: true, signal });
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
    start = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), scroll: list()?.scrollTop ?? 0 };
  });
  panel.addEventListener("pointerup", (event) => {
    const s = start;
    start = null;
    if (!s || s.id !== event.pointerId) return;
    const dx = event.clientX - s.x;
    const dy = event.clientY - s.y;
    const scrolled = Math.abs((list()?.scrollTop ?? 0) - s.scroll) > 2;
    const tap = performance.now() - s.at <= TAP_MAX_MS && Math.hypot(dx, dy) <= TAP_MAX_MOVE;
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
