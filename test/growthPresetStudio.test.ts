// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import { getMapEditHistoryEntries, resetMapEditHistory } from '@/editor/mapEditHistory';
import { renderGrowthTreeTab } from '@/editor/panels/growthTree/studio';

afterEach(() => { vi.restoreAllMocks(); resetMapEditHistory(); document.body.replaceChildren(); });

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
