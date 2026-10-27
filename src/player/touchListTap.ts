// 터치 화면의 목록 창 탭 규칙(2026-10-24): 첫 탭은 그 줄로 커서만 옮기고, 이미 커서가 있는 줄을 탭하면 결정이다.
// 예외(EXCLUDE): ESC 메뉴 첫 명령 줄은 한 번 탭으로 고르고 연다(2026-10-25).
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
/**
 * 탭 하나가 곧 행동인 곳: 탭(분류 전환), 이름 입력 글자판, 기록 창, 터치 패드, 입력칸,
 * ESC 메뉴 첫 명령 줄(아이템·스킬·장비…) — 화면을 여는 것뿐이라 되돌리기 쉽고, 두 번 눌러야 열리면 고장처럼 보였다(2026-10-25).
 * 그 안의 목록(아이템 쓰기·장비 바꾸기 등 되돌리기 어려운 결정)은 여전히 첫 탭 = 커서, 두 번째 = 결정이다.
 */
const EXCLUDE = "[role='tab'], .touch-pad, .name-entry-overlay, [data-testid='dialogue-log'], [data-testid='dialogue-backlog'], input, textarea, select, .play-fullscreen-toggle, .status-menu-command-rail";
/** 고르면 바로 여는 줄 무리(EXCLUDE 안이지만 눌림 영역 넓히기는 받는다). */
const ONE_TAP = ".status-menu-command-rail";
/** 눌림 영역을 넓히지 않는 곳 — EXCLUDE 에서 한 번 탭 줄(ONE_TAP)만 뺀 것. */
const NO_SNAP = EXCLUDE.split(", ").filter((selector) => selector !== ONE_TAP).join(", ");
/** 줄 밖 탭을 줄로 받아 주는 거리(화면 px). 줄 둘레 22px — 혼자 선 줄이면 어느 방향이든 44px 이상이다. */
const SNAP_REACH = 22;
/** 떠 있는 동안 맵이 탭을 받지 않는 창(touchTap BUSY 와 같은 무리). */
const MODAL_WINDOW = ".choices-active, [data-testid='main-menu'], .runtime-shop-overlay, [data-testid='battle-scene']";
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

/** 줄 무리에 드는가: 같은 태그 형제 줄 둘 이상이고 선택 표시가 있거나, 한 번 탭 무리(ESC 메뉴 명령 줄)다. */
function isSnapRow(row: Element): boolean {
  if (row.closest(NO_SNAP)) return false;
  const group = siblingsOf(row);
  return group.length >= 2 && (group.some((candidate) => candidate.matches(MARK)) || row.closest(ONE_TAP) !== null);
}

/** 그 자리에 실제로 보이는 줄인가(스크롤·잘림·덮임으로 가려진 줄은 받지 않는다). */
function visibleAt(row: Element, x: number, y: number): boolean {
  const hit = row.ownerDocument.elementFromPoint(x, y);
  return hit !== null && (hit === row || row.contains(hit));
}

/**
 * 손가락 눌림 영역(2026-10-27): 그려진 줄은 PC 와 같게 두고, 줄 사이·줄 끝·창 여백을 탭해도 가장 가까운 줄이 받는다.
 * 탭한 요소가 그 줄을 품은 바탕(목록·창·무대)일 때만이다 — 다른 단추·설명 칸 위 탭은 그대로 그 요소의 것이다.
 * 맵 위 탭은 메뉴·선택지·상점·전투 창이 떠 있을 때(맵이 탭을 안 받을 때)만 그 창 줄로 받는다.
 * 줄에서 SNAP_REACH 안이어야 하고, 여럿이면 가장 가까운 줄이다. 줄 위를 직접 탭하면 그 줄(브라우저 기본)이다.
 */
export function snapRowAt(root: Element, target: EventTarget | null, x: number, y: number): Element | null {
  if (!(target instanceof Element) || !root.contains(target)) return null;
  if (target.closest(NO_SNAP) || target.closest(`${ROW}, a, label, summary`)) return null;
  // 맵(캔버스) 위 탭은 창이 떠 있어 맵이 탭을 받지 않을 때만 창 가장자리 줄로 받는다 — 선택지 창은 둘레 여백이 거의 없다.
  const onMap = target.matches("canvas, .phaser-container");
  let best: Element | null = null;
  let bestDistance = Infinity;
  for (const row of root.querySelectorAll(ROW)) {
    if (onMap ? !row.closest(MODAL_WINDOW) : !target.contains(row)) continue;
    const box = row.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    const dx = Math.max(box.left - x, 0, x - box.right);
    const dy = Math.max(box.top - y, 0, y - box.bottom);
    if (dx > SNAP_REACH || dy > SNAP_REACH) continue;
    const distance = Math.hypot(dx, dy);
    if (distance >= bestDistance || !isSnapRow(row)) continue;
    // 줄 안쪽으로 2px 들인 가장 가까운 점이 실제로 그 줄이어야 한다(무대 배율 때문에 적중 경계가 상자와 1px 가까이 어긋난다).
    const px = Math.min(Math.max(x, box.left + 2), box.right - 2);
    const py = Math.min(Math.max(y, box.top + 2), box.bottom - 2);
    if (!visibleAt(row, px, py)) continue;
    best = row;
    bestDistance = distance;
  }
  return best;
}

/** 그 자리를 탭하면 어느 줄이 받는가(직접 탭 + 넓힌 영역). QA 측정과 바탕 탭(touchTap) 판정이 같이 쓴다. */
export function touchRowAt(root: Element, x: number, y: number): Element | null {
  const target = root.ownerDocument.elementFromPoint(x, y);
  if (!target || !root.contains(target)) return null;
  const direct = target.closest(ROW);
  if (direct && root.contains(direct) && (findListRow(target, root) === direct || (direct.closest(ONE_TAP) && isSnapRow(direct)))) return direct;
  if (direct) return null;
  return snapRowAt(root, target, x, y);
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
  let pending: { row: Element; wasSelected: boolean; at: number; snapped: boolean } | null = null;
  let replaying = false;
  const replayClick = (row: Element): void => {
    replaying = true;
    try { (row as HTMLElement).click(); } finally { replaying = false; }
  };
  (window as unknown as { __oprnTouchRowAt?: (x: number, y: number) => Element | null }).__oprnTouchRowAt = (x, y) => touchRowAt(root, x, y);
  signal.addEventListener("abort", () => { delete (window as unknown as { __oprnTouchRowAt?: unknown }).__oprnTouchRowAt; });
  root.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") { pending = null; return; }
    const row = findListRow(event.target, root);
    if (row) { pending = { row, wasSelected: isRowSelected(row), at: performance.now(), snapped: false }; return; }
    const snapped = snapRowAt(root, event.target, event.clientX, event.clientY);
    pending = snapped ? { row: snapped, wasSelected: isRowSelected(snapped), at: performance.now(), snapped: true } : null;
  }, { capture: true, signal });
  root.addEventListener("click", (event) => {
    if (replaying) return;
    const start = pending;
    pending = null;
    if (!start || performance.now() - start.at > DOWN_TO_CLICK_MS) return;
    if (start.snapped) {
      // 줄 밖(넓힌 영역) 탭: 바탕의 클릭은 삼키고 그 줄을 탭한 것과 똑같이 처리한다.
      if (!start.row.isConnected) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (start.row.closest(ONE_TAP)) { replayClick(start.row); return; }
      if (start.wasSelected) {
        if (start.row.matches("button, [role='menuitem'], [role='option'], [role='button']")) replayClick(start.row);
        else press("Enter");
        return;
      }
      const target = start.row;
      void moveCursorToRow(target).then((ok) => { if (!ok && target.isConnected) replayClick(target); });
      return;
    }
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
      replayClick(row);
    });
  }, { capture: true, signal });
  return () => controller.abort();
}
