// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit } from '@/editor/mapEditHistory';
import { renderGrowthTreeTab } from '@/editor/panels/growthTree/studio';
import { GROWTH_PRESETS } from '@/project/growth/presets';

afterEach(() => { vi.restoreAllMocks(); resetMapEditHistory(); document.body.replaceChildren(); });
for (const mode of ['promotion', 'skill'] as const) {
  it(`${mode}: browsing and cancel are inert; explicit apply is one undo boundary`, () => {
    store.replace(createBlankProject()); resetMapEditHistory();
    const before = structuredClone(store.getCurrent());
    const update = vi.spyOn(store, 'update');
    const host = document.createElement('div'); document.body.append(host);
    renderGrowthTreeTab(host, mode);
    const click = (id: string) => {
      const b = host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
      expect(b).not.toBeNull(); b?.click();
    };
    click('growth-presets-open');
    const presets = GROWTH_PRESETS.filter(p => p.kind === mode);
    expect(host.querySelectorAll('.growth-preset-card')).toHaveLength(presets.length + GROWTH_PRESETS.filter(p => p.kind === 'bundle').length);
    for (const preset of presets) click(`growth-preset-${preset.id}`);
    expect(store.getCurrent()).toEqual(before);
    expect(update).not.toHaveBeenCalled();
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    click('growth-presets-cancel');
    expect(store.getCurrent()).toEqual(before);
    click('growth-presets-open'); click(`growth-preset-${mode}-vanguard`); click('growth-preset-apply');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[1]?.label).toBeTruthy();
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(host.querySelector('.growth-node.is-selected')).not.toBeNull();
    expect(store.getCurrent().database.classes.slice(0, before.database.classes.length)).toEqual(before.database.classes);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent()).toEqual(before);
  });
}

it('repeated apply appends independent graphs and survives a studio remount with viewport position', () => {
  store.replace(createBlankProject()); resetMapEditHistory();
  const host = document.createElement('div'); document.body.append(host);
  const click = (id: string) => host.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)?.click();
  renderGrowthTreeTab(host, 'skill');
  click('growth-presets-open'); click('growth-preset-skill-vanguard'); click('growth-preset-apply');
  const first = structuredClone(store.getCurrent().growth?.skillTrees[0]);
  click('growth-presets-open'); click('growth-preset-skill-vanguard'); click('growth-preset-apply');
  expect(store.getCurrent().growth?.skillTrees).toHaveLength(2);
  expect(store.getCurrent().growth?.skillTrees[0]).toEqual(first);
  expect(getMapEditHistoryEntries()).toHaveLength(2);
  const viewport = host.querySelector<HTMLElement>('.growth-viewport');
  if (!viewport) throw new Error('Missing canvas viewport');
  viewport.scrollLeft = 320; viewport.scrollTop = 180; viewport.dispatchEvent(new Event('scroll'));
  host.replaceChildren(); renderGrowthTreeTab(host, 'skill');
  expect(host.querySelector('.growth-viewport')?.scrollLeft).toBe(320);
  expect(host.querySelector('.growth-viewport')?.scrollTop).toBe(180);
  click('growth-preview-toggle');
  for (const id of ['growth-presets-open', 'growth-add-tree', 'growth-arrange', 'growth-initial-points']) {
    expect(host.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)?.disabled).toBe(true);
  }
});
