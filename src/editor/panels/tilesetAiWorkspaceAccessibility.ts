let lastFocusTestId: string | null = null;
let inertBackground: readonly { readonly element: HTMLElement; readonly wasInert: boolean }[] = [];

export function prepareTilesetAiWorkspace(host: HTMLElement): void {
  lastFocusTestId = null;
  inertBackground = Array.from(document.body.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== host)
    .map((element) => ({ element, wasInert: element.inert }));
  for (const entry of inertBackground) entry.element.inert = true;
}

export function releaseTilesetAiWorkspace(): void {
  for (const entry of inertBackground) entry.element.inert = entry.wasInert;
  inertBackground = [];
  lastFocusTestId = null;
}

export function rememberTilesetAiWorkspaceFocus(host: HTMLElement): void {
  if (!(document.activeElement instanceof HTMLElement)) return;
  if (host.contains(document.activeElement)) lastFocusTestId = document.activeElement.dataset.testid ?? null;
}

export function restoreTilesetAiWorkspaceFocus(host: HTMLElement): void {
  const matching = lastFocusTestId ? findTestId(host, lastFocusTestId) : null;
  if (matching && !matching.matches(":disabled")) {
    matching.focus({ preventScroll: true });
    return;
  }
  const fallback = host.querySelector<HTMLElement>('[data-testid="tileset-ai-workspace-question"]')
    ?? host.querySelector<HTMLElement>('[data-testid="tileset-ai-workspace-status"]')
    ?? host.querySelector<HTMLElement>(".tileset-ai-workspace");
  lastFocusTestId = fallback?.dataset.testid ?? null;
  fallback?.focus({ preventScroll: true });
}

export function containTilesetAiWorkspaceTab(host: HTMLElement, event: KeyboardEvent): void {
  const focusable = Array.from(host.querySelectorAll<HTMLElement>(
    'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  ));
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  const active = document.activeElement;
  if (!host.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function findTestId(host: HTMLElement, testId: string): HTMLElement | null {
  return Array.from(host.querySelectorAll<HTMLElement>("[data-testid]"))
    .find((element) => element.dataset.testid === testId) ?? null;
}
