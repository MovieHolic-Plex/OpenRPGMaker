export const STATUS_MENU_SELECTOR = "[data-testid='main-menu']";

// 퇴장 애니메이션 동안 패널은 DOM 에 남는다. 그 패널을 "열린 메뉴" 로 세면 ESC 로 닫자마자
// 누른 Z 가 필드 조사 대신 메뉴로 들어간다. 복합 선택자는 테스트 fake DOM 이 못 읽어 JS 로 가른다.
export function markStatusMenuClosing(menu: HTMLElement): void {
  menu.dataset.statusMenuClosing = "1";
}

export function currentStatusMenu(layout: HTMLElement): HTMLElement | null {
  const menu = layout.querySelector<HTMLElement>(STATUS_MENU_SELECTOR);
  if (!menu) return null;
  return menu.dataset.statusMenuClosing ? null : menu;
}

export function statusMenuDetailActionButtons(layout: HTMLElement): HTMLButtonElement[] {
  return Array.from(layout.querySelectorAll<HTMLButtonElement>(".status-menu-detail-action:not(:disabled)"));
}

export function wrapStatusMenuIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

/**
 * 열린 오버레이 루트는 유지하고 내용만 갈아끼운다.
 * 커서 이동마다 루트를 제거하면 backdrop-filter 가 맵을 한 프레임 드러낸다.
 * 켜기·끄기는 루트를 붙이거나 떼는 기존 경로를 탄다.
 */
export function adoptStatusMenuPanel(existing: HTMLElement, next: HTMLElement): HTMLElement {
  const rail = existing.querySelector<HTMLElement>(".status-menu-command-rail");
  const nextRail = next.querySelector<HTMLElement>(".status-menu-command-rail");
  const buttons = Array.from(rail?.querySelectorAll<HTMLElement>(".status-menu-command") ?? []);
  const nextButtons = Array.from(nextRail?.querySelectorAll<HTMLElement>(".status-menu-command") ?? []);
  if (rail && nextRail && buttons.length === nextButtons.length && buttons.every((button, i) => button.id === nextButtons[i]?.id)) {
    buttons.forEach((button, i) => {
      const updated = nextButtons[i]!;
      button.className = updated.className;
      button.tabIndex = updated.tabIndex;
      button.setAttribute("aria-current", updated.getAttribute("aria-current") ?? "false");
    });
    rail.setAttribute("aria-activedescendant", nextRail.getAttribute("aria-activedescendant") ?? "");
    rail.style.cssText = nextRail.style.cssText;
    rail.remove();
    nextRail.replaceWith(rail);
  }
  existing.className = next.className;
  const nextCss = next.style.cssText;
  if (typeof nextCss === "string") existing.style.cssText = nextCss;
  for (const name of ["aria-label", "aria-modal", "role"] as const) {
    const value = next.getAttribute(name);
    if (value === null) existing.removeAttribute(name);
    else existing.setAttribute(name, value);
  }
  const nextData = { ...next.dataset };
  for (const key of Object.keys(existing.dataset)) {
    if (!(key in nextData)) delete existing.dataset[key];
  }
  Object.assign(existing.dataset, nextData);
  existing.replaceChildren(...Array.from(next.childNodes));
  return existing;
}
