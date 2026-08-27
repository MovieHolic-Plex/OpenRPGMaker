/**
 * @file sidebarFocus.ts
 * @description 좌측 사이드바 패널 재렌더 포커스 생존 및 툴바 roving tabindex 지원 헬퍼.
 *
 * 배경:
 *  - editorState 변경 시 전체 좌패널이 clearChildren 으로 다시 빌드되어,
 *    키보드로 버튼(Enter/Space)을 누른 직후 activeElement 가 BODY 로 추락하는 회귀가 있었다.
 *  - 툴바([role="toolbar"])가 키보드 탐색(화살표/Home/End)과 roving tabindex 를 지원하지 않아
 *    키보드 포커스가 모든 버튼을 거쳐야 했고 화살표 입력 시 맵이 스크롤되던 문제를 해결한다.
 */

export interface FocusSnapshot {
  readonly testId?: string;
  readonly pathIndices?: readonly number[];
  readonly tagName: string;
  readonly fallbackAnchorTestId?: string;
}

/**
 * 컨테이너 내부에 현재 포커스가 있는 경우 포커스 식별자(data-testid 또는 인덱스 경로)를 캡처한다.
 * 포커스가 컨테이너 외부(캔버스, AI 패널, 다른 입력 등)에 있다면 null 을 반환한다.
 */
export function captureFocus(container: HTMLElement | null): FocusSnapshot | null {
  if (!container || typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement) || !container.contains(active)) {
    return null;
  }

  let fallbackAnchorTestId: string | undefined;
  if (isInsideOverflowDropdown(active)) {
    fallbackAnchorTestId = "oprn-tool-overflow";
  }

  const testId = active.dataset.testid;
  if (testId) {
    return {
      testId,
      tagName: active.tagName,
      fallbackAnchorTestId,
    };
  }

  // Fallback: 컨테이너부터 activeElement 까지의 DOM 인덱스 경로
  const path: number[] = [];
  let curr: HTMLElement | null = active;
  while (curr && curr !== container && curr.parentElement) {
    const parent: HTMLElement = curr.parentElement;
    const index = Array.prototype.indexOf.call(parent.children, curr);
    path.unshift(index);
    curr = parent;
  }

  return {
    pathIndices: path,
    tagName: active.tagName,
    fallbackAnchorTestId,
  };
}

/**
 * 이전에 캡처한 포커스 스냅샷을 기반으로 새로 렌더링된 컨테이너 내부의 일치하는 요소에 포커스를 복원한다.
 */
export function restoreFocus(container: HTMLElement | null, snapshot: FocusSnapshot | null): void {
  if (!container || !snapshot || typeof document === "undefined") return;

  if (snapshot.testId) {
    const target = container.querySelector<HTMLElement>(`[data-testid="${cssEscape(snapshot.testId)}"]`);
    if (target && typeof target.focus === "function") {
      target.focus();
      return;
    }
  }

  if (snapshot.fallbackAnchorTestId) {
    const anchor = container.querySelector<HTMLElement>(`[data-testid="${cssEscape(snapshot.fallbackAnchorTestId)}"]`);
    if (anchor && typeof anchor.focus === "function") {
      anchor.focus();
      return;
    }
  }

  if (snapshot.pathIndices && snapshot.pathIndices.length > 0) {
    let curr: Element | null = container;
    for (const idx of snapshot.pathIndices) {
      if (!curr || !curr.children || idx < 0 || idx >= curr.children.length) {
        curr = null;
        break;
      }
      curr = curr.children[idx];
    }
    if (curr instanceof HTMLElement && typeof curr.focus === "function") {
      curr.focus();
    }
  }
}

/**
 * 좌측 패널 내 [role="toolbar"] 요소들에 대해 roving tabindex 를 적용하고
 * 방향키(ArrowLeft/ArrowRight/ArrowUp/ArrowDown), Home, End 키보드 탐색을 위임 처리한다.
 */
export function applyRovingTabindex(container: HTMLElement): void {
  for (const toolbar of findToolbars(container)) {
    setupToolbarRoving(toolbar);
  }
}

export function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/**
 * 좌패널 안의 도구막대를 찾는다.
 *
 * querySelectorAll 한 방으로 끝내고 싶지만 수동 스캔을 남긴 이유가 있다: 테스트 하네스
 * test/fakeDom.ts 의 matchesSelector 는 `.class` / `[data-*=...]` / 태그만 해석하고
 * `[role="toolbar"]` 같은 일반 속성 선택자를 매칭하지 못해 빈 배열을 준다(실측: 이 대비
 * 경로를 지우자 test/sidebarFocus.test.ts 의 화살표 이동 케이스가 결정적으로 깨졌다).
 * 실제 브라우저에서는 첫 줄에서 끝나고, 스캔은 하네스에서만 쓰인다.
 */
function findToolbars(container: HTMLElement): HTMLElement[] {
  const matched = Array.from(container.querySelectorAll<HTMLElement>('[role="toolbar"], .oprn-tile-toolbar, [data-testid="oprn-tile-toolbar"]'));
  if (matched.length > 0) return matched;

  const found: HTMLElement[] = [];
  const scan = (node: Element): void => {
    if (node instanceof HTMLElement && isToolbar(node)) found.push(node);
    for (const child of Array.from(node.children)) scan(child);
  };
  scan(container);
  return found;
}

function isToolbar(node: HTMLElement): boolean {
  return (
    node.getAttribute("role") === "toolbar" ||
    node.classList.contains("oprn-tile-toolbar") ||
    node.dataset.testid === "oprn-tile-toolbar"
  );
}

/**
 * 이 노드가 ⋯ 오버플로 드롭다운 안에 있는가.
 *
 * `closest('[data-testid="..."], .oprn-overflow-dropdown')` 로 쓰면 실제 브라우저에서는 되지만
 * 테스트 하네스(test/fakeDom.ts)의 선택자 해석이 쉼표 목록 + 속성 선택자를 못 받아 항상 null 을
 * 준다(실측: 그 상태에서 드롭다운 제외와 포커스 대체 앵커가 둘 다 조용히 죽었다).
 * 그래서 조상을 직접 걷는다 — 두 환경에서 같은 답을 준다.
 */
function isInsideOverflowDropdown(node: HTMLElement | null): boolean {
  for (let n: HTMLElement | null = node; n; n = n.parentElement) {
    if (n.dataset?.testid === "toolbar-overflow-dropdown") return true;
    if (n.classList?.contains("oprn-overflow-dropdown") || n.classList?.contains("oprn-toolbar-dropdown")) return true;
  }
  return false;
}

function isDropdownButton(btn: HTMLButtonElement): boolean {
  return isInsideOverflowDropdown(btn);
}

function setupToolbarRoving(toolbar: HTMLElement): void {
  const getEnabledButtons = (): HTMLButtonElement[] => {
    const buttons = toolbar.querySelectorAll<HTMLButtonElement>("button");
    return Array.from(buttons).filter((b) => !b.disabled && !b.hidden && !isDropdownButton(b));
  };

  const updateTabIndices = (): void => {
    const buttons = getEnabledButtons();
    if (buttons.length === 0) return;

    // 활성(active 또는 aria-pressed="true" 또는 aria-checked="true") 버튼이 우선
    let activeIndex = buttons.findIndex(
      (b) =>
        b.classList.contains("active") ||
        b.classList.contains("is-active") ||
        b.getAttribute("aria-pressed") === "true" ||
        b.getAttribute("aria-checked") === "true"
    );

    // 포커스가 툴바 버튼 중 하나에 있는 경우 그 버튼이 activeIndex
    const currentFocusIndex = buttons.findIndex((b) => b === document.activeElement);
    if (currentFocusIndex >= 0) {
      activeIndex = currentFocusIndex;
    } else if (activeIndex < 0) {
      activeIndex = 0;
    }

    buttons.forEach((btn, idx) => {
      btn.setAttribute("tabindex", idx === activeIndex ? "0" : "-1");
    });
  };

  updateTabIndices();

  // 이미 리스너가 등록되었는지 확인하는 플래그
  if ((toolbar as unknown as { __roving_installed?: boolean }).__roving_installed) return;
  (toolbar as unknown as { __roving_installed?: boolean }).__roving_installed = true;

  toolbar.addEventListener("keydown", (event: KeyboardEvent) => {
    const target = event.target;
    if (target instanceof HTMLElement && isInsideOverflowDropdown(target)) {
      return;
    }

    const key = event.key;
    if (
      key !== "ArrowRight" &&
      key !== "ArrowLeft" &&
      key !== "ArrowUp" &&
      key !== "ArrowDown" &&
      key !== "Home" &&
      key !== "End"
    ) {
      return;
    }

    const buttons = getEnabledButtons();
    if (buttons.length === 0) return;

    const focusedIndex = buttons.findIndex((b) => b === document.activeElement);
    if (focusedIndex < 0) return;

    event.preventDefault();
    event.stopPropagation();

    let targetIndex = focusedIndex;
    if (key === "ArrowRight" || key === "ArrowDown") {
      targetIndex = (focusedIndex + 1) % buttons.length;
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      targetIndex = (focusedIndex - 1 + buttons.length) % buttons.length;
    } else if (key === "Home") {
      targetIndex = 0;
    } else if (key === "End") {
      targetIndex = buttons.length - 1;
    }

    const targetButton = buttons[targetIndex];
    if (targetButton) {
      buttons.forEach((b, idx) => b.setAttribute("tabindex", idx === targetIndex ? "0" : "-1"));
      targetButton.focus();
    }
  });

  toolbar.addEventListener("focusin", (event: FocusEvent) => {
    const target = event.target;
    if (target instanceof HTMLButtonElement && !isDropdownButton(target)) {
      const buttons = getEnabledButtons();
      const idx = buttons.indexOf(target);
      if (idx >= 0) {
        buttons.forEach((b, i) => b.setAttribute("tabindex", i === idx ? "0" : "-1"));
      }
    }
  });
}
