import { el } from '@/util/dom';
import { store } from '@/project/store';
import { recordProjectSnapshot } from '@/editor/mapEditHistory';
import { normalizeAiAuthoring, type AiAuthoring } from '@/project/aiAuthoring';
export function button(text: string, id: string, run: () => void): HTMLButtonElement {
  return el('button', { text, attrs: { type: 'button' }, dataset: { testid: `feature16-${id}` }, on: { click: run } });
}
export function field(label: string, control: HTMLElement): HTMLElement {
  control.setAttribute('aria-label', label);
  return el('label', { class: 'ai-authoring-field', children: [el('span', { text: label }), control] });
}
export function input(id: string, value = '', type = 'text'): HTMLInputElement {
  return el('input', { value, attrs: { type }, dataset: { testid: `feature16-${id}` } });
}
export function settings(): AiAuthoring { return normalizeAiAuthoring(store.getCurrent().aiAuthoring); }
export function saveSettings(label: string, edit: (draft: AiAuthoring) => void): void {
  recordProjectSnapshot(label);
  store.update(project => {
    const next = normalizeAiAuthoring(project.aiAuthoring);
    edit(next);
    project.aiAuthoring = normalizeAiAuthoring(next);
  }, { label, fields: [{ path: 'aiAuthoring' }] });
}
export interface FeaturePane { root: HTMLElement; dispose: () => void }
