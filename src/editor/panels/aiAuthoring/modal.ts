import { el } from '@/util/dom';
import { store } from '@/project/store';
import { registerModal, unregisterModal } from '@/editor/ui/modalStack';
import { createPromptLibrary } from './library';
import { createDialogueInventory } from './dialogue';
import { createPromptInspector } from './inspector';
import { button, type FeaturePane } from './shared';
import './style.css';
export type AiAuthoringTab = 'library' | 'dialogue' | 'inspector';
let closeActive: (() => void) | null = null;
export function closeAiAuthoringModal(): void { closeActive?.(); }
export function openAiAuthoringModal(tab: AiAuthoringTab, options: { composer: string; apply: (text: string) => void }): void {
  closeActive?.();
  const opener = document.activeElement;
  const identity = store.getProjectIdentity().id;
  let pane: FeaturePane | null = null;
  let closed = false;
  const body = el('div', { class: 'ai-authoring-body' });
  const tabs = el('nav', { class: 'ai-authoring-tabs', attrs: { 'aria-label': 'AI 저작 도구' } });
  const dialog = el('section', { class: 'ai-authoring-dialog', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'AI 저작 도구' } });
  const backdrop = el('div', { class: 'ai-authoring-backdrop', dataset: { testid: 'feature16-modal' }, children: [dialog] });
  const close = () => {
    if (closed) return;
    closed = true;
    pane?.dispose(); unsubscribe(); unregisterModal(backdrop); backdrop.remove(); closeActive = null;
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };
  const unsubscribe = store.subscribe(() => { if (store.getProjectIdentity().id !== identity) close(); });
  const show = (next: AiAuthoringTab) => {
    pane?.dispose();
    pane = next === 'library' ? createPromptLibrary(text => { options.apply(text); close(); }, options.composer)
      : next === 'dialogue' ? createDialogueInventory(close) : createPromptInspector();
    body.replaceChildren(pane.root);
    for (const child of Array.from(tabs.children)) child.setAttribute('aria-pressed', String((child as HTMLElement).dataset.tab === next));
  };
  for (const [key, title] of [['library', '프롬프트 라이브러리'], ['dialogue', '대사 목록·문체 검토'], ['inspector', '프롬프트 검사기']] as const) {
    const control = button(title, `tab-${key}`, () => show(key)); control.dataset.tab = key; tabs.append(control);
  }
  dialog.append(el('header', { children: [el('h2', { text: 'AI 저작 도구' }), button('닫기', 'close', close)] }), tabs, body);
  backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) close(); });
  backdrop.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, summary')).filter(node => node.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  closeActive = close; document.body.append(backdrop); registerModal(backdrop, close); show(tab);
  (tabs.querySelector(`[data-tab="${tab}"]`) as HTMLElement)?.focus();
}
