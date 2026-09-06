import { subscribeEditorUiMode } from '@/editor/editorUiMode';
import { el } from '@/util/dom';
import { hasOpenModalLayer } from '@/editor/ui/modalStack';

type SurfaceId = 'maps' | 'tools' | 'assist' | 'kits';
type SurfaceInput = {
  readonly id: SurfaceId;
  readonly label: string;
  readonly triggerId: string;
  readonly rerender: () => void;
  readonly body: () => HTMLElement;
};

let opened: SurfaceId | null = null;
let current: { readonly input: SurfaceInput; readonly panel: HTMLElement; readonly trigger: HTMLElement } | null = null;
let installed = false;
export const SIDEBAR_SURFACE_OPEN = 'oprn:sidebar-surface-open';

export function resetSidebarSurfaceForTests(): void { opened = null; current = null; }

export function closeSidebarSurface(restore = false): void {
  const previous = current;
  opened = null;
  current = null;
  if (!previous) return;
  // Pointerdown dismissal must not detach the outside target before its click.
  previous.panel.remove();
  previous.trigger.setAttribute('aria-expanded', 'false');
  if (restore) previous.trigger.focus();
}

function installListeners(): void {
  if (installed) return;
  installed = true;
  subscribeEditorUiMode(() => { opened = null; current = null; });
  document.addEventListener(SIDEBAR_SURFACE_OPEN, event => {
    if (event instanceof CustomEvent && event.detail !== opened) closeSidebarSurface();
  });
  document.addEventListener('pointerdown', event => {
    if (!current || hasOpenModalLayer() || !(event.target instanceof Node)) return;
    if (!current.panel.contains(event.target) && !current.trigger.contains(event.target)) closeSidebarSurface();
  });
  document.addEventListener('keydown', event => {
    if (!current || event.defaultPrevented || event.key !== 'Escape') return;
    // A child modal/context menu must consume its Escape before this layer.
    event.preventDefault();
    event.stopPropagation();
    closeSidebarSurface(true);
  });
  if (typeof window !== 'undefined') window.addEventListener('resize', positionCurrent);
}

function positionCurrent(): void {
  if (!current?.panel.isConnected) return;
  const { panel, trigger } = current;
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  panel.style.maxHeight = `${window.innerHeight - margin * 2}px`;
  const box = panel.getBoundingClientRect();
  panel.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - box.width - margin))}px`;
  const below = window.innerHeight - rect.bottom - margin;
  panel.style.top = `${Math.max(margin, below >= box.height ? rect.bottom + 4 : rect.top - box.height - 4)}px`;
}

/** Nonmodal auxiliary work surfaces share dismissal, viewport anchoring and focus. */
export function makeSidebarSurface(input: SurfaceInput): HTMLElement {
  installListeners();
  const wrapper = el('div', { class: 'sidebar-surface-trigger' });
  const expanded = opened === input.id;
  const trigger = el('button', {
    class: 'btn sidebar-surface-button', text: input.label,
    attrs: { type: 'button', 'aria-expanded': String(expanded), 'aria-haspopup': 'dialog', title: input.label },
    dataset: { testid: input.triggerId },
    on: { click: () => {
      if (opened === input.id) { closeSidebarSurface(true); return; }
      document.dispatchEvent(new CustomEvent(SIDEBAR_SURFACE_OPEN, { detail: input.id }));
      opened = input.id;
      input.rerender();
      const panel = document.querySelector<HTMLElement>(`[data-sidebar-surface="${input.id}"]`);
      const first = panel?.querySelector<HTMLElement>('.sidebar-surface-body input')
        ?? panel?.querySelector<HTMLElement>('.sidebar-surface-body select')
        ?? panel?.querySelector<HTMLElement>('.sidebar-surface-body button');
      first?.focus();
      positionCurrent();
    } },
  });
  wrapper.append(trigger);
  if (!expanded) return wrapper;
  const panel = el('section', {
    class: `sidebar-surface sidebar-surface-${input.id} oprn-toolbar-dropdown`,
    attrs: { role: 'dialog', 'aria-label': input.label, 'aria-modal': 'false' },
    dataset: { testid: `sidebar-${input.id === 'maps' ? 'map' : input.id}-surface`, sidebarSurface: input.id, focusFallbackAnchor: input.triggerId },
  });
  const body = el('div', { class: 'sidebar-surface-body', children: [input.body()] });
  panel.addEventListener('keydown', event => {
    if (!(event.target instanceof HTMLButtonElement) || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index = buttons.indexOf(event.target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    event.stopPropagation();
    buttons[next]?.focus();
  });
  panel.append(el('header', { class: 'sidebar-surface-heading', children: [
    el('strong', { text: input.label }),
    el('button', { class: 'btn', text: '닫기', attrs: { type: 'button', 'aria-label': `${input.label} 닫기` },
      dataset: { testid: `sidebar-${input.id}-close` }, on: { click: () => closeSidebarSurface(true) } }),
  ] }), body);
  wrapper.append(panel);
  current = { input, panel, trigger };
  requestAnimationFrame(positionCurrent);
  return wrapper;
}
