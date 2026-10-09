import { emitRuntimeJuice, type RuntimeJuiceOptions } from "@/player/runtimeJuice";
import {
  isCancelKey,
  isConfirmKey,
  moveCursorIndex,
  navDirection,
} from "@/player/runtimeKeyboardMenu";

// RM2003식 커서 메뉴: 방향키로 선택 이동, 결정(Z/Enter/Space)은 선택 항목의 click 을
// 합성, 취소(X/Esc)는 cancelEl 의 click 을 합성한다. 도메인 로직은 기존 버튼 click
// 핸들러에 있으므로 이 헬퍼는 "선택 관리 + click 합성"만 한다.
export type CursorMenuOptions = {
  // 순서대로 순회할 항목(버튼). disabled/hidden 은 자동 제외.
  readonly items: readonly HTMLElement[];
  // 취소키가 누를 요소(대개 "취소"/"닫기" 버튼). 없으면 취소키 무시.
  readonly cancelEl?: HTMLElement | null;
  readonly initialIndex?: number;
  // 격자 이동 열 수(기본 1=1D 리스트, ←→↑↓ 모두 ±1).
  readonly columns?: number;
  readonly wrap?: boolean;
  // 커서가 이동할 때마다 호출(사이드 패널 갱신 등).
  readonly onSelect?: (index: number) => void;
  // ←→ 처리 훅(수량 조절 등). true 반환 시 커서 이동 없이 이벤트 소비.
  readonly onHorizontal?: (dir: -1 | 1, index: number) => boolean;
  /**
   * RM2003 System SE 중 커서·취소음을 울린다(opt-in). 기본이 꺼짐인 이유: 이 헬퍼는
   * 맵·전투·상태 메뉴가 함께 쓰므로 무조건 울리면 게임 전체 소리가 한꺼번에 바뀐다.
   *
   * 결정음은 여기서 울리지 않는다. 결정은 성공일 수도 거절일 수도 있고, RM2003 은
   * 거절에 버저만 울린다(scene_shop.cpp). 결정/버저 판단은 도메인 핸들러 몫이다.
   */
  readonly sound?: boolean;
  readonly audioContext?: Pick<RuntimeJuiceOptions, "project" | "session">;
  /**
   * 호출부가 **방금 새로 만든** DOM 에 붙인다고 보장할 때 true. 그러면 첫 선택이 첫 행일 때 scrollIntoView 를
   * 건너뛴다(새 목록은 맨 위에서 시작하므로 결과가 같다). 방금 만든 DOM 의 레이아웃을 강제해 상점 첫 진입 키
   * 처리 한 번에 26~60ms 를 썼다(브라우저 실측). 기존 컨테이너를 재사용하면 스크롤이 남아 있을 수 있으니 주지 마라.
   */
  readonly freshDom?: boolean;
};

/** setIndex 를 부른 원인. 커서음은 키보드 이동에만 울린다 — 마우스가 스칠 때마다 삑삑거리면 못 쓴다. */
type SelectCause = "key" | "pointer" | "focus" | "init";

const NAV_ITEM_CLASS = "rm-nav-item";

export function attachCursorMenu(root: HTMLElement, opts: CursorMenuOptions): () => void {
  const items = opts.items.filter(isSelectable);
  const controller = new AbortController();
  const { signal } = controller;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let index = clampIndex(opts.initialIndex ?? 0, items.length);

  for (const el of items) el.classList.add(NAV_ITEM_CLASS);

  // 첫 선택의 스크롤 생략은 호출부가 새 DOM 을 보장할 때만(opts.freshDom).
  const applySelection = (initial = false): void => {
    items.forEach((el, i) => {
      const selected = i === index;
      if (selected) {
        el.classList.add("selected");
        el.setAttribute("aria-current", "true");
        if (!(initial && i === 0 && opts.freshDom)) el.scrollIntoView?.({ block: "nearest" });
      } else {
        el.classList.remove("selected");
        el.removeAttribute?.("aria-current");
      }
    });
  };

  const setIndex = (next: number, cause: SelectCause = "key"): void => {
    const clamped = clampIndex(next, items.length);
    if (clamped === index) return;
    index = clamped;
    applySelection();
    if (opts.sound && cause === "key") emitRuntimeJuice({ ...opts.audioContext, event: "menu-select" });
    opts.onSelect?.(index);
  };

  const handle = (event: KeyboardEvent): void => {
    if (signal.aborted) return;
    if (event.isComposing) return; // IME 조합 중 무시
    const dir = navDirection(event.key);
    if (dir) {
      if ((dir === "left" || dir === "right") && opts.onHorizontal) {
        const consumed = opts.onHorizontal(dir === "left" ? -1 : 1, index);
        if (consumed) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      if (items.length) {
        event.preventDefault();
        event.stopPropagation();
        setIndex(moveCursorIndex(index, items.length, dir, { columns: opts.columns, wrap: opts.wrap }));
      }
      return;
    }
    if (isConfirmKey(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      items[index]?.click();
      return;
    }
    if (isCancelKey(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      // cancelEl 이 없으면 취소키가 무시되므로 소리도 울리지 않는다(빈 약속 금지).
      if (opts.sound && opts.cancelEl) emitRuntimeJuice({ ...opts.audioContext, event: "menu-back" });
      opts.cancelEl?.click();
    }
  };

  // 마우스 호버 → 커서 동기화(키보드·마우스 일관). 소리는 울리지 않는다.
  items.forEach((el, i) => {
    el.addEventListener("mouseenter", () => setIndex(i, "pointer"), { signal });
  });

  // Tab 포커스 → 커서 동기화. 이게 없으면 브라우저 포커스는 A 행에 있는데 결정키는
  // items[index](=B 행)를 click 해서 "포커스한 것과 다른 항목이 실행"된다(실측: 포커스
  // shop-buy-k_b, 커서 다 → Enter 로 k_c 구매). 커서가 포커스를 따라가면 두 모델이 하나가 된다.
  root.addEventListener(
    "focusin",
    ((event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const hit = items.findIndex((el) => el === target || el.contains(target));
      if (hit >= 0) setIndex(hit, "focus");
    }) as EventListener,
    { signal }
  );

  if (typeof root.tabIndex === "number" && root.tabIndex < 0) root.tabIndex = 0;
  root.addEventListener("keydown", handle as EventListener, { signal });
  // root 가 포커스를 못 받아도 동작하도록 window 폴백(battleDom 패턴).
  // 포커스가 root 안(자식 포함)이면 root 리스너가 이미 처리하므로 건너뛴다.
  if (typeof window !== "undefined") {
    window.addEventListener(
      "keydown",
      ((event: KeyboardEvent) => {
        if (!root.isConnected) return;
        if (root.contains(document.activeElement)) return;
        handle(event);
      }) as EventListener,
      { signal }
    );
  }

  applySelection(true);
  if (items.length) opts.onSelect?.(index);
  focusSilently(root);

  return () => {
    controller.abort();
    for (const el of items) {
      el.classList.remove(NAV_ITEM_CLASS, "selected");
      el.removeAttribute?.("aria-current");
    }
    if (previousFocus?.isConnected) focusSilently(previousFocus);
  };
}

function isSelectable(el: HTMLElement | null | undefined): el is HTMLElement {
  if (!el) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  if (el.hidden) return false;
  return true;
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, index));
}

function focusSilently(el: HTMLElement): void {
  try {
    el.focus({ preventScroll: true });
  } catch {
    /* jsdom/fakeDom 등에서 focus 미지원이면 무시 */
  }
}
