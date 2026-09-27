/** @vitest-environment happy-dom */
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editorState, editorStateChangedOnlyToolPick } from '@/editor/editorState';
import { renderTilePalette, syncMountedPaletteToolPick } from '@/editor/panels/tilePalette';
import { resetTileToolbarMenusForTests } from '@/editor/panels/tileToolbarMenus';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import { resetInspectionPinsForTests, SIDEBAR_PINS_KEY } from '@/editor/panels/sidebarInspectionPins';
import { listEditorCommands } from '@/editor/commandRegistry';
import { resetModalStackForTest } from '@/editor/ui/modalStack';

describe('focused sidebar', () => {
  let host: HTMLElement;
  let unsubscribe: () => void;
  const find = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  beforeEach(() => {
    vi.useFakeTimers();
    resetTileToolbarMenusForTests();
    resetModalStackForTest();
    localStorage.removeItem(SIDEBAR_PINS_KEY);
    resetInspectionPinsForTests();
    store.replace(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId, layer: 'lower', tool: 'paint', paintShape: 'pen', brushSize: 1, activePaletteStamp: null });
    host = document.createElement('div');
    host.dataset.testid = 'left-palette-root';
    document.body.append(host);
    renderTilePalette(host);
    unsubscribe = editorState.subscribe(() => renderTilePalette(host));
  });
  afterEach(() => {
    unsubscribe();
    resetTileToolbarMenusForTests();
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it('opens a real map tree from the current map without reserving a map dock', () => {
    const trigger = find('sidebar-map-switcher');
    expect(trigger).not.toBeNull();
    trigger?.click();
    expect(find('sidebar-map-surface')?.querySelector('[data-testid="map-tree"]')).not.toBeNull();
    expect(find('tile-palette')).not.toBeNull();
  });
  it('changes the actual brush through one select and hides it for inapplicable tools', () => {
    const size = find('brush-size-select');
    expect(size).toBeInstanceOf(HTMLSelectElement);
    if (!(size instanceof HTMLSelectElement)) throw new Error('missing brush size select');
    size.value = '4';
    size.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editorState.get().brushSize).toBe(4);
    editorState.set({ tool: 'fill' });
    expect(find('brush-size-select')).toBeNull();
    editorState.set({ tool: 'paint' });
    expect(find('brush-size-select')).toHaveProperty('value', '4');
  });
  it('uses the event layer as the single event entry with no tile controls on its surface', () => {
    expect(find('tool-event')).toBeNull();
    selectSidebarLayer('event');
    expect(editorState.get()).toMatchObject({ layer: 'event', tool: 'event' });
    expect(find('tile-brush-controls')).toBeNull();
    expect(find('tile-search-input')).toBeNull();
    expect(find('tool-paint')).toBeNull();
    expect(find('layer-lower')).toBeNull();
  });
  it('returns focus from map search Escape without changing the selected map', () => {
    const mapId = editorState.get().currentMapId;
    find('sidebar-map-switcher')?.click();
    const input = find('map-tree-filter');
    expect(document.activeElement).toBe(input);
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(find('sidebar-map-surface')).toBeNull();
    expect(document.activeElement).toBe(find('sidebar-map-switcher'));
    expect(editorState.get().currentMapId).toBe(mapId);
  });
  it('filters real tiles through the native category selector without changing the picked tile', () => {
    const selectedTile = editorState.get().selectedTile;
    const before = find('tile-palette')?.querySelectorAll('.chipset-tile').length;
    const select = find('tile-category-select');
    if (!(select instanceof HTMLSelectElement)) throw new Error('missing category selector');
    select.value = 'house';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(find('tile-palette')?.querySelectorAll('.chipset-tile').length).not.toBe(before);
    expect(editorState.get().selectedTile).toBe(selectedTile);
    find('palette-filter-clear')?.click();
    expect(document.activeElement).toBe(find('tile-search-input'));
  });

  /**
   * 필터 바의 수는 **팔레트가 실제로 그린 칸**과 같아야 한다.
   *
   * 회귀(2026-09-14 실측, 합본 마을 195칸 · 표준 모드): 필터 바는 타일셋 인덱스 일치 수를
   * 세고 팔레트는 오토타일 대표 축약·변형 숨김·레이어 가시성까지 통과시킨 뒤에 그려서,
   * 덧그림 레이어의 「지형」 칩이 「126개 일치」라고 말하면서 시트는 0칸이었다.
   * 「울타리」도 「11개 일치」인데 표시는 1칸이었다.
   */
  it('reports the count of cells it actually draws, on both layers', () => {
    for (const layer of ['lower', 'upper'] as const) {
      selectSidebarLayer(layer);
      for (const category of ['terrain', 'water', 'house', 'fence', 'decor'] as const) {
        const select = find('tile-category-select');
        if (!(select instanceof HTMLSelectElement)) throw new Error('missing category selector');
        select.value = category;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        const drawn = find('tile-palette')?.querySelectorAll('.chipset-tile').length ?? -1;
        const text = find('palette-filter-status')?.querySelector('span')?.textContent ?? '';
        const shown = Number((text.match(/(\d+)/) ?? [])[1] ?? NaN);
        expect({ layer, category, shown }).toEqual({ layer, category, shown: drawn });
        find('palette-filter-clear')?.click();
      }
    }
  });

  it('explains why a bottom-layer-only category is empty on the upper layer', () => {
    selectSidebarLayer('upper');
    const select = find('tile-category-select');
    if (!(select instanceof HTMLSelectElement)) throw new Error('missing category selector');
    select.value = 'terrain';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(find('tile-palette')?.querySelectorAll('.chipset-tile').length).toBe(0);
    const hint = find('palette-filter-empty')?.textContent ?? '';
    expect(hint).toContain('바닥 레이어 전용');
    expect(hint).toContain('전체');
  });
  it('persists inspection pins across a session reset', () => {
    find('oprn-tool-overflow')?.click();
    find('sidebar-pin-history')?.click();
    expect(JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY) ?? '[]')).toEqual(['history']);
    expect(find('toolbar-toggle-history')?.closest('[data-testid="toolbar-overflow-dropdown"]')).toBeNull();
    expect(host.querySelectorAll('[data-testid="toolbar-toggle-history"]')).toHaveLength(1);
    expect(find('toolbar-toggle-history')).toBeNull();
    resetInspectionPinsForTests();
    expect(find('toolbar-toggle-history')).not.toBeNull();
    find('oprn-tool-overflow')?.click();
    find('sidebar-pin-history')?.click();
    expect(JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY) ?? '[]')).toEqual([]);
    expect(find('toolbar-toggle-history')?.closest('[data-testid="toolbar-overflow-dropdown"]')).not.toBeNull();
  });
  it('opens inspection through the command registry and restores the menu trigger on Escape', () => {
    const command = listEditorCommands().find(item => item.id === 'sidebar-inspection-history');
    expect(command).toBeDefined();
    command?.run();
    expect(find('toolbar-overflow-dropdown')).not.toBeNull();
    expect(find('toolbar-toggle-history')?.getAttribute('aria-checked')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(find('toolbar-overflow-dropdown')).toBeNull();
    expect(document.activeElement).toBe(find('oprn-tool-overflow'));
  });
  it('keeps a map surface behind a child modal and lets Escape close only the child', () => {
    find('sidebar-map-switcher')?.click();
    const properties = find('map-inspector-action-properties');
    if (!properties) throw new Error('Missing map settings action');
    properties.focus();
    properties.click();
    const modal = document.querySelector<HTMLElement>(`[data-testid="map-properties-modal-${store.getCurrent().startMapId}"]`);
    if (!modal) throw new Error('Actual map settings dialog did not open');
    modal.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(find('sidebar-map-surface')).not.toBeNull();
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(modal.isConnected).toBe(false);
    expect(find('sidebar-map-surface')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(find('sidebar-map-surface')).toBeNull();
    expect(document.activeElement).toBe(find('sidebar-map-switcher'));
  });

  it('switches tools in place: the sheet node survives and the toolbar shows the new tool', () => {
    // 본 편집기(editor.ts) 경로와 같은 분기: 도구만 바뀌면 제자리 동기화, 아니면 전체 재생성.
    unsubscribe();
    let previous = editorState.get();
    let rebuilds = 0;
    unsubscribe = editorState.subscribe((state) => {
      const before = previous;
      previous = state;
      if (editorStateChangedOnlyToolPick(before, state) && syncMountedPaletteToolPick()) return;
      rebuilds += 1;
      renderTilePalette(host);
    });
    const sheet = find('tile-palette');
    expect(sheet).not.toBeNull();
    find('tool-fill')?.click();
    expect(editorState.get().tool).toBe('fill');
    expect(rebuilds).toBe(0);
    expect(find('tile-palette')).toBe(sheet);
    expect(find('tool-fill')?.getAttribute('aria-pressed')).toBe('true');
    expect(find('tool-paint')?.getAttribute('aria-pressed')).toBe('false');
    expect(find('tile-brush-state')?.dataset.tool).toBe('fill');
    expect(find('brush-size-select')).toBeNull();
    expect(host.querySelectorAll('[data-testid="oprn-tile-toolbar"]')).toHaveLength(1);
    find('tool-paint')?.click();
    expect(rebuilds).toBe(0);
    expect(find('tile-palette')).toBe(sheet);
    expect(find('brush-size-select')).not.toBeNull();
    // 레이어를 바꾸면 보이는 칸이 달라지므로 전체 재생성이다.
    selectSidebarLayer('upper');
    expect(rebuilds).toBe(1);
  });

  it('filters the sheet once after typing settles, not per keystroke', () => {
    // 필터 상태는 모듈 전역이다 — 앞 테스트가 남긴 분류를 먼저 걷어 낸다.
    const category = find('tile-category-select');
    if (!(category instanceof HTMLSelectElement)) throw new Error('missing category selector');
    category.value = 'all';
    category.dispatchEvent(new Event('change', { bubbles: true }));
    const search = find('tile-search-input');
    if (!(search instanceof HTMLInputElement)) throw new Error('missing tile search');
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    vi.runOnlyPendingTimers();
    const sheet = find('tile-palette');
    for (const value of ['집', '집의']) {
      search.value = value;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // 입력 중에는 시트를 건드리지 않는다.
    expect(find('tile-palette')).toBe(sheet);
    expect(find('palette-filter-status')).toBeNull();
    vi.runOnlyPendingTimers();
    // 멈춘 뒤 한 번 필터가 걸린 시트로 바뀐다 — 입력칸 값은 마지막 글자까지 그대로다.
    expect(find('tile-palette')).not.toBe(sheet);
    expect(find('palette-filter-status')).not.toBeNull();
    expect(find('tile-search-input')).toHaveProperty('value', '집의');
    find('palette-filter-clear')?.click();
  });
});
