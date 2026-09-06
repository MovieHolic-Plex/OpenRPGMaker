// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import { applyGrowthPreset } from '@/project/growth/presets';
import { emptyGrowth } from '@/project/growth/types';
import { renderGrowthTreeTab } from '@/editor/panels/growthTree/studio';
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit } from '@/editor/mapEditHistory';

afterEach(() => { vi.restoreAllMocks(); resetMapEditHistory(); document.body.replaceChildren(); });
function mount(mode: 'promotion' | 'skill', crowded = false) {
  const project = createBlankProject();
  if (crowded) {
    project.growth = emptyGrowth();
    for (let y = 60; y <= 9848; y += 456) for (let x = 56; x <= 9504; x += 744) project.growth.classPositions[`occupied-${x}-${y}`] = { x, y };
  }
  store.replace(project); resetMapEditHistory();
  const before = structuredClone(store.getCurrent()), update = vi.spyOn(store, 'update');
  const host = document.createElement('div'); document.body.append(host);
  renderGrowthTreeTab(host, mode);
  const click = (id: string) => { const b = host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`); if (!b) throw new Error(`Missing ${id}`); b.click(); };
  return { host, click, before, update };
}
for (const mode of ['promotion', 'skill'] as const) {
  it(`${mode}: initially renders detached connected nodes and edges without any writes`, () => {
    const { host, before, update } = mount(mode);
    const preview = host.querySelector('[data-testid="growth-preset-preview"]');
    expect(preview).not.toBeNull();
    expect(preview!.querySelectorAll('.growth-node').length).toBeGreaterThan(1);
    expect(preview!.querySelectorAll('.growth-wires path').length).toBeGreaterThan(0);
    expect(store.getCurrent()).toEqual(before); expect(update).not.toHaveBeenCalled();
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    if (mode === 'promotion') expect(host.querySelector('.growth-body .growth-node')).not.toBeNull();
  });
  it(`${mode}: full destination blocks Apply, never preview selection/inspection/zoom`, () => {
    const { host, click, before, update } = mount(mode, true);
    click('growth-presets-open'); click('growth-preset-bundle-arcane');
    expect(host.querySelectorAll('.growth-preset-browser .growth-node').length).toBeGreaterThan(1);
    host.querySelector<HTMLButtonElement>('.growth-preset-browser .growth-node')!.click();
    click('growth-preset-zoom-in'); click('growth-preset-apply');
    expect(host.querySelector('[data-testid="growth-preset-status"]')?.textContent).toBeTruthy();
    expect(host.querySelectorAll('.growth-preset-browser .growth-node').length).toBeGreaterThan(1);
    expect(store.getCurrent()).toEqual(before); expect(update).not.toHaveBeenCalled();
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    click('growth-presets-cancel');
    expect(host.querySelector('[data-testid="growth-preset-preview"] .growth-node')).not.toBeNull();
  });
  it(`${mode}: applies once and navigates the same imported bundle across both studios with one undo`, () => {
    const { host, click, before, update } = mount(mode);
    click('growth-preset-apply');
    expect(update).toHaveBeenCalledTimes(1); expect(getMapEditHistoryEntries()).toHaveLength(1);
    const applied = structuredClone(store.getCurrent());
    const tree = applied.growth!.skillTrees[0]!;
    click(mode === 'promotion' ? 'growth-bundle-skills' : 'growth-bundle-promotion');
    expect(host.querySelector(`[data-testid="growth-studio-${mode === 'promotion' ? 'skill' : 'promotion'}"]`)).not.toBeNull();
    if (mode === 'promotion') expect(host.querySelector<HTMLInputElement>('[data-testid="growth-tree-name"]')?.value).toBe(tree.name);
    click(mode === 'promotion' ? 'growth-bundle-promotion' : 'growth-bundle-skills');
    expect(host.querySelector('[data-testid="growth-bundle-assign-actor"]')).not.toBeNull();
    expect(store.getCurrent()).toEqual(applied); expect(update).toHaveBeenCalledTimes(1);
    expect(undoMapEdit()).toBe(true); expect(store.getCurrent()).toEqual(before);
  });
}
it('skill bundle preview selects its nonempty trees and links qualified prerequisite nodes', () => {
  const { host, before, update } = mount('skill');
  const select = host.querySelector<HTMLSelectElement>('[data-testid="growth-preset-tree"]');
  expect(select?.options.length).toBe(5);
  select!.value = select!.options[1]!.value; select!.dispatchEvent(new Event('change', { bubbles: true }));
  expect(host.querySelector('[data-testid="growth-preset-cross-tree"]')).not.toBeNull();
  host.querySelector<HTMLButtonElement>('[data-testid="growth-preset-cross-tree"]')!.click();
  expect(host.querySelector<HTMLSelectElement>('[data-testid="growth-preset-tree"]')?.value).toBe(select!.options[0]!.value);
  expect(store.getCurrent()).toEqual(before); expect(update).not.toHaveBeenCalled();
});

it('keeps authored coordinate bounds when a cross-tree portal offsets the drawing', () => {
  const project = createBlankProject(); applyGrowthPreset(project, 'bundle-vanguard');
  const tree = project.growth!.skillTrees[1]!, node = tree.nodes[0]!;
  node.x = 10000;
  store.replace(project); resetMapEditHistory();
  const host = document.createElement('div'); document.body.append(host); renderGrowthTreeTab(host, 'skill');
  host.querySelector<HTMLButtonElement>(`[data-testid="growth-list-${tree.id}"]`)!.click();
  host.querySelector<HTMLButtonElement>(`[data-testid="growth-node-${node.id}"]`)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
  expect(store.getCurrent().growth!.skillTrees[1]!.nodes[0]!.x).toBe(10000);
});
