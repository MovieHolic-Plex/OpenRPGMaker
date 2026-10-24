// 터치 화면의 목록 창 탭 규칙(2026-10-24): 첫 탭은 그 줄로 커서만 옮기고, 이미 커서가 있는 줄을 탭하면 결정이다.
// 장비·아이템·스킬·상점·기록 칸·선택지·전투 명령 등 「선택 표시가 있는 목록」이면 어느 창이든 똑같이 동작한다.
//
// 창마다 커서 모델이 따로 있으므로(runtimeCursorMenu·상태 메뉴 리듀서·상점·대사 선택지·전투) 여기서는 그 안을
// 건드리지 않는다. 화면에 보이는 선택 표시(.selected / aria-current / aria-selected)를 읽고,
//   1) 마우스가 스친 것처럼(mouseover/mouseenter) 알려 커서를 맞춰 보고,
//   2) 안 되면 방향키를 한 칸씩 보내며 선택 표시가 그 줄에 닿을 때까지 걷는다.
// 키는 데스크톱·패드와 같은 길이라 창의 규칙(건너뛰는 칸, 비활성 행)을 그대로 따른다. 다가가지 못하면(다른 창이
// 키를 받는 중) 보낸 키를 되돌리고 원래 클릭을 그대로 흘려 보낸다 — 예전 동작(바로 실행)으로 떨어질 뿐 막히지 않는다.

import { keyTarget } from "@/player/touchPad";

const MARK = ".selected, [aria-current='true'], [aria-selected='true']";
const ROW = "button, [role='menuitem'], [role='option'], [role='button'], li, .rm-nav-item";
/** 탭 하나가 곧 행동인 곳: 탭(분류 전환), 이름 입력 글자판, 기록 창, 터치 패드, 입력칸. */
const EXCLUDE = "[role='tab'], .touch-pad, .name-entry-overlay, [data-testid='dialogue-log'], [data-testid='dialogue-backlog'], input, textarea, select, .play-fullscreen-toggle";
const MAX_STEPS = 40;
const DOWN_TO_CLICK_MS = 1500;

type Locator = { readonly anchor: string | null; readonly path: readonly number[] };

function siblingsOf(row: Element): Element[] {
  const parent = row.parentElement;
  if (!parent) return [];
  return [...parent.children].filter((child) => child.tagName === row.tagName && child.matches(ROW) && !(child as HTMLElement).hidden);
}

/** 탭한 요소에서 위로 올라가며 「선택 표시가 있는 무리의 한 줄」을 찾는다. */
export function findListRow(target: EventTarget | null, root: Element): Element | null {
  if (!(target instanceof Element)) return null;
  if (target.closest(EXCLUDE)) return null;
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    if (!el.matches(ROW)) continue;
    const group = siblingsOf(el);
    if (group.length >= 2 && group.some((row) => row.matches(MARK))) return el;
  }
  return null;
}

export function isRowSelected(row: Element): boolean {
  return row.matches(MARK);
}

/** 다시 그려도 같은 줄을 찾도록: 가장 가까운 id/testid 조상 + 자식 번호 경로. */
function locate(row: Element): Locator {
  const path: number[] = [];
  for (let el: Element | null = row; el; el = el.parentElement) {
    if (el.id) return { anchor: `#${CSS.escape(el.id)}`, path: path.reverse() };
    const testid = el.getAttribute("data-testid");
    if (testid && el.ownerDocument.querySelectorAll(`[data-testid="${CSS.escape(testid)}"]`).length === 1) {
      return { anchor: `[data-testid="${CSS.escape(testid)}"]`, path: path.reverse() };
    }
    const parent = el.parentElement;
    if (!parent) break;
    path.push([...parent.children].indexOf(el));
  }
  return { anchor: null, path: [] };
}

function resolve(loc: Locator, fallback: Element): Element | null {
  if (fallback.isConnected) return fallback;
  if (!loc.anchor) return null;
  let el: Element | null = document.querySelector(loc.anchor);
  for (const index of loc.path) el = el?.children[index] ?? null;
  return el;
}

function center(el: Element): { x: number; y: number; h: number; w: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height, w: r.width };
}

function press(key: string): void {
  const target = keyTarget();
  target.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent("keyup", { key, code: key, bubbles: true, cancelable: true }));
}

const OPPOSITE: Record<string, string> = { ArrowUp: "ArrowDown", ArrowDown: "ArrowUp", ArrowLeft: "ArrowRight", ArrowRight: "ArrowLeft" };

const frame = (): Promise<void> => new Promise((done) => {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => done());
  else setTimeout(done, 16);
});

/** 무리 안에서 지금 선택 표시가 붙은 줄. */
function selectedIn(row: Element): Element | null {
  return siblingsOf(row).find((candidate) => candidate.matches(MARK)) ?? null;
}

/**
 * 커서를 그 줄로 옮긴다. 성공하면 true. 못 옮기면 보낸 키를 되돌리고 false.
 * 줄마다 방향을 다시 잰다 — 두 열 격자(아이템 칸·타일 메뉴)도 같은 방법으로 닿는다.
 */
export async function moveCursorToRow(row: Element): Promise<boolean> {
  const loc = locate(row);
  row.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  row.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
  await frame();
  let target = resolve(loc, row);
  if (!target) return false;
  if (isRowSelected(target)) return true;
  const sent: string[] = [];
  const undo = (): void => { for (const key of sent.reverse()) press(OPPOSITE[key]!); };
  for (let step = 0; step < MAX_STEPS; step += 1) {
    target = resolve(loc, row);
    if (!target) return false;
    if (isRowSelected(target)) return true;
    const current = selectedIn(target);
    if (!current) { undo(); return false; }
    const a = center(current);
    const b = center(target);
    const dy = b.y - a.y;
    const dx = b.x - a.x;
    const vertical = Math.abs(dy) > Math.max(4, Math.min(a.h, b.h) / 2);
    const keys = vertical ? [dy > 0 ? "ArrowDown" : "ArrowUp", dx > 0 ? "ArrowRight" : "ArrowLeft"] : [dx > 0 ? "ArrowRight" : "ArrowLeft", dy > 0 ? "ArrowDown" : "ArrowUp"];
    const before = Math.hypot(dx, dy);
    let moved = false;
    for (const key of keys) {
      press(key);
      sent.push(key);
      await frame();
      const t = resolve(loc, row);
      if (!t) return false;
      if (isRowSelected(t)) return true;
      const now = selectedIn(t);
      if (now && now !== current && Math.hypot(center(t).x - center(now).x, center(t).y - center(now).y) < before) { moved = true; break; }
      // 다가가지 못한 키는 되돌린다(감은 목록 끝에서 반대편으로 넘어간 경우 포함).
      press(OPPOSITE[key]!);
      sent.pop();
      await frame();
    }
    if (!moved) { undo(); return false; }
  }
  undo();
  return false;
}

/**
 * 터치 레이아웃의 목록 탭 규칙을 건다. 눌렀을 때 그 줄이 이미 선택돼 있었으면 원래 클릭(결정)을 그대로 두고,
 * 아니었으면 클릭을 삼키고 커서만 옮긴다. 마우스 클릭은 건드리지 않는다(데스크톱은 예전대로).
 */
export function installTouchListTap(root: HTMLElement): () => void {
  const controller = new AbortController();
  const signal = controller.signal;
  let pending: { row: Element; wasSelected: boolean; at: number } | null = null;
  let replaying = false;
  root.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") { pending = null; return; }
    const row = findListRow(event.target, root);
    pending = row ? { row, wasSelected: isRowSelected(row), at: performance.now() } : null;
  }, { capture: true, signal });
  root.addEventListener("click", (event) => {
    if (replaying) return;
    const start = pending;
    pending = null;
    if (!start || performance.now() - start.at > DOWN_TO_CLICK_MS) return;
    const row = findListRow(event.target, root);
    if (!row) return;
    if (start.row.isConnected && row !== start.row && !row.contains(start.row) && !start.row.contains(row)) return;
    if (start.wasSelected) {
      // 버튼이 아닌 줄(클릭 처리기가 없을 수 있다)은 결정키로 보낸다 — 창이 커서 줄을 결정한다.
      if (!row.matches("button, [role='menuitem'], [role='option'], [role='button']")) press("Enter");
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    void moveCursorToRow(row).then((ok) => {
      if (ok || !row.isConnected) return;
      // 이 줄의 무리가 키를 받지 않는다(다른 창이 활성) — 예전처럼 바로 실행한다.
      replaying = true;
      try { (row as HTMLElement).click(); } finally { replaying = false; }
    });
  }, { capture: true, signal });
  return () => controller.abort();
}
