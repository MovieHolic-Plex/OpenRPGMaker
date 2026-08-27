export const STATUS_MENU_SELECTOR = "[data-testid='main-menu']";

// 닫힘 juice 동안 패널은 250ms 더 DOM 에 남는다. 그 패널을 "열린 메뉴" 로 세면 ESC 로 닫자마자
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
