import { el } from '@/util/dom';
import { field, numberField } from '@/editor/panels/databaseControls';
export { field };
export const button = (text: string, testid: string, click: () => void, primary = false): HTMLButtonElement => el('button', {
  class: `growth-button${primary ? ' is-primary' : ''}`, text, attrs: { type: 'button' }, dataset: { testid }, on: { click },
});
export function textInput(label: string, testid: string, value: string, change: (v: string) => void, multiline = false): HTMLElement {
  const input = multiline ? el('textarea', { value, attrs: { rows: '3' } }) : el('input', { value, attrs: { type: 'text' } });
  input.dataset.testid = testid;
  input.addEventListener('change', () => change(input.value));
  return field(label, input);
}
export function numberInput(label: string, testid: string, value: number, change: (v: number) => void, min = 0, max = 9999): HTMLElement {
  return numberField(label, testid, value, change, { min, max });
}
export function selectInput(label: string, testid: string, value: string, entries: readonly { id: string; name: string }[], change: (v: string) => void): HTMLElement {
  const select = el('select', { dataset: { testid }, attrs: { 'aria-label': label }, children: entries.map(e => el('option', { value: e.id, text: e.name })) });
  select.value = value;
  select.addEventListener('change', () => change(select.value));
  return field(label, select);
}
export function checkInput(label: string, testid: string, checked: boolean, change: (v: boolean) => void): HTMLElement {
  const input = el('input', { attrs: { type: 'checkbox' }, dataset: { testid } });
  input.checked = checked;
  input.addEventListener('change', () => change(input.checked));
  return el('label', { class: 'growth-check', children: [input, el('span', { text: label })] });
}
export const note = (text: string): HTMLElement => el('p', { class: 'growth-note', text });
export const section = (title: string, children: HTMLElement[]): HTMLElement => el('section', { class: 'growth-section', children: [el('h3', { text: title }), ...children] });
