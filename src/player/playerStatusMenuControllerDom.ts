export function currentStatusMenu(layout: HTMLElement): HTMLElement | null {
  return layout.querySelector<HTMLElement>("[data-testid='main-menu']");
}

export function statusMenuDetailActionButtons(layout: HTMLElement): HTMLButtonElement[] {
  return Array.from(layout.querySelectorAll<HTMLButtonElement>(".status-menu-detail-action:not(:disabled)"));
}

export function wrapStatusMenuIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
