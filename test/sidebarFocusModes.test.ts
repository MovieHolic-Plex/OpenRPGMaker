/** @vitest-environment happy-dom */
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editorState } from '@/editor/editorState';
import { chromeForMode, resetEditorUiModeForTests, setEditorUiMode, subscribeEditorUiMode } from '@/editor/editorUiMode';
import { renderTilePalette } from '@/editor/panels/tilePalette';
import { resetTileToolbarMenusForTests } from '@/editor/panels/tileToolbarMenus';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import { resetInspectionPinsForTests, SIDEBAR_PINS_KEY } from '@/editor/panels/sidebarInspectionPins';
import { listEditorCommands } from '@/editor/commandRegistry';
import { resetModalStackForTest } from '@/editor/ui/modalStack';

describe('focused standard and expert sidebar', () => {
  let host: HTMLElement;
  let unsubscribe: () => void;
  let unsubscribeMode: () => void;
  const find = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  beforeEach(() => {
    vi.useFakeTimers();
    resetEditorUiModeForTests('standard');
    resetTileToolbarMenusForTests();
    resetModalStackForTest();
    localStorage.removeItem(SIDEBAR_PINS_KEY + 'expert');
    resetInspectionPinsForTests();
    store.replace(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId, layer: 'lower', tool: 'paint', paintShape: 'pen', brushSize: 1, activePaletteStamp: null });
    host = document.createElement('div');
    host.dataset.testid = 'left-palette-root';
    document.body.append(host);
    unsubscribeMode = subscribeEditorUiMode(() => renderTilePalette(host));
    renderTilePalette(host);
    unsubscribe = editorState.subscribe(() => renderTilePalette(host));
  });
  afterEach(() => {
    unsubscribe();
    unsubscribeMode();
    resetTileToolbarMenusForTests();
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it('opens a real map tree from the current map without reserving a standard dock', () => {
    expect(chromeForMode('standard').mapTree).toBe(false);
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
  it('persists expert inspection pins without exposing or resetting them in Standard', () => {
    setEditorUiMode('expert', null);
    find('oprn-tool-overflow')?.click();
    find('sidebar-pin-history')?.click();
    expect(JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY + 'expert') ?? '[]')).toEqual(['history']);
    expect(find('toolbar-toggle-history')?.closest('[data-testid="toolbar-overflow-dropdown"]')).toBeNull();
    expect(host.querySelectorAll('[data-testid="toolbar-toggle-history"]')).toHaveLength(1);
    setEditorUiMode('standard', null);
    expect(find('toolbar-toggle-history')).toBeNull();
    resetInspectionPinsForTests();
    setEditorUiMode('expert', null);
    expect(find('toolbar-toggle-history')).not.toBeNull();
    find('oprn-tool-overflow')?.click();
    find('sidebar-pin-history')?.click();
    expect(JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY + 'expert') ?? '[]')).toEqual([]);
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
  it('does not reopen auxiliary work when returning to a mode', () => {
    find('palette-brush-assist-toggle')?.click();
    expect(find('sidebar-assist-surface')).not.toBeNull();
    setEditorUiMode('expert', null);
    setEditorUiMode('standard', null);
    expect(find('sidebar-assist-surface')).toBeNull();
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
});
