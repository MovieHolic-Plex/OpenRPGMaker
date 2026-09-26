/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editorState } from '@/editor/editorState';
import { resetEditorUiModeForTests, setEditorUiMode, subscribeEditorUiMode } from '@/editor/editorUiMode';
import { renderTilePalette } from '@/editor/panels/tilePalette';
import { resetTileToolbarMenusForTests } from '@/editor/panels/tileToolbarMenus';
import { closeMapContextMenu } from '@/editor/panels/mapContextMenu';
import { renderMapList, resetMapListUiStateForTests } from '@/editor/panels/mapList';
import { resetMapPanelSectionForTests } from '@/editor/workspace/mapPanelSection';
import { createBlankProject } from '@/project/defaults';
import { store } from '@/project/store';
import { listEditorCommands } from '@/editor/commandRegistry';
import { mountDock, renderDockPanels } from '@/editor/workspace/dockHost';
import { getWorkspaceLayout, resetWorkspaceForTests, subscribeWorkspace } from '@/editor/workspace/workspaceStore';
import { layoutFromPreset } from '@/editor/workspace/workspaceLayout';
import { resetInspectionPinsForTests, SIDEBAR_PINS_KEY } from '@/editor/panels/sidebarInspectionPins';

describe('sidebar R1 real renderer ownership', () => {
  let host: HTMLElement;
  let dock: HTMLElement;
  let offMode: () => void;
  let offState: () => void;
  const get = (id: string): HTMLElement => {
    const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Missing control ${id}`);
    return node;
  };
  const escape = () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  beforeEach(() => {
    vi.useFakeTimers();
    resetTileToolbarMenusForTests();
    resetMapListUiStateForTests();
    resetMapPanelSectionForTests();
    resetEditorUiModeForTests('beginner');
    store.replace(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId, layer: 'lower', tool: 'paint', paintShape: 'pen', selectedTile: 0, activePaletteStamp: null });
    host = document.createElement('div'); host.dataset.testid = 'left-palette-root';
    dock = document.createElement('div'); dock.dataset.testid = 'left-map-root';
    document.body.append(host);
    // The editor's renderer subscribes during a Beginner boot, before the first
    // Standard surface exists. No additional render follows a mode notification.
    offMode = subscribeEditorUiMode(() => renderTilePalette(host));
    offState = editorState.subscribe(() => renderTilePalette(host));
    renderTilePalette(host);
  });
  afterEach(() => {
    offMode(); offState(); closeMapContextMenu(); resetTileToolbarMenusForTests();
    host.remove(); dock.remove(); vi.clearAllTimers(); vi.useRealTimers();
  });
  it('removes the mounted open surface when the renderer subscribed before its lifecycle', () => {
    setEditorUiMode('standard', null);
    get('sidebar-map-switcher').click();
    setEditorUiMode('expert', null);
    expect(host.querySelector('[data-sidebar-surface]')).toBeNull();
    expect(get('sidebar-map-switcher').getAttribute('aria-expanded')).toBe('false');
    get('sidebar-map-switcher').click(); escape();
    expect(host.querySelector('[data-sidebar-surface]')).toBeNull();
    expect(document.activeElement).toBe(get('sidebar-map-switcher'));
  });
  it('routes one Escape to the actual map context menu and then restores the map row', () => {
    setEditorUiMode('standard', null);
    get('sidebar-map-switcher').click();
    const id = store.getCurrent().startMapId;
    get(`map-tree-node-${id}`).focus();
    get(`map-tree-node-${id}`).dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    expect(get(`map-context-menu-${id}`).contains(document.activeElement)).toBe(true);
    escape();
    expect(document.querySelector(`[data-testid="map-context-menu-${id}"]`)).toBeNull();
    expect(host.querySelector('[data-testid="sidebar-map-surface"]')).not.toBeNull();
    expect(document.activeElement).toBe(get(`map-tree-node-${id}`));
    escape();
    expect(host.querySelector('[data-testid="sidebar-map-surface"]')).toBeNull();
  });
  it('keeps the map explorer attached while its body-mounted Rename action handles a pointer', () => {
    setEditorUiMode('standard', null);
    get('sidebar-map-switcher').click();
    const id = store.getCurrent().startMapId;
    get(`map-tree-node-${id}`).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const rename = get(`map-menu-rename-${id}`);
    rename.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    rename.click();
    expect(host.querySelector(`[data-testid="map-rename-${id}"]`)).not.toBeNull();
    expect(document.activeElement).toBe(get(`map-rename-${id}`));
  });
  it('reveals the real Expert dock through its renderer rather than only changing collapse state', () => {
    document.body.append(dock);
    setEditorUiMode('expert', null);
    renderMapList(dock);
    get('map-tree-section-toggle').click();
    expect(get('map-tree-section-toggle').getAttribute('aria-expanded')).toBe('false');
    get('sidebar-map-switcher').click();
    expect(get('map-tree-section-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(dock.querySelector('.is-section-collapsed')).toBeNull();
    expect(document.activeElement).toBe(get(`map-tree-node-${store.getCurrent().startMapId}`));
  });
  it('does not commit a cancelled Rename when removing its focused input emits blur', () => {
    setEditorUiMode('standard', null);
    get('sidebar-map-switcher').click();
    const id = store.getCurrent().startMapId;
    const original = store.getCurrent().maps[id]?.name;
    get(`map-tree-node-${id}`).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    get(`map-menu-rename-${id}`).click();
    const input = get(`map-rename-${id}`);
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing actual Rename input');
    input.value = 'Cancelled draft';
    escape();
    input.dispatchEvent(new FocusEvent('blur'));
    expect(store.getCurrent().maps[id]?.name).toBe(original);
  });
  it.each([
    ['inspector', false], ['ruleAudit', false], ['history', false],
    ['inspector', true], ['ruleAudit', true], ['history', true],
  ] as const)('activates the real dock registry for %s with pinned=%s', (inspection, pinned) => {
    setEditorUiMode('expert', null);
    host.remove();
    const root = document.createElement('div'); document.body.append(root);
    const initial = layoutFromPreset('map');
    resetWorkspaceForTests({ ...initial, docks: { ...initial.docks, left: ['maps'] } });
    localStorage.setItem(SIDEBAR_PINS_KEY + 'expert', JSON.stringify(pinned ? [inspection] : []));
    resetInspectionPinsForTests();
    const renderDock = () => renderDockPanels(mountDock({ container: root, zone: 'left', panels: getWorkspaceLayout().docks.left }));
    const unsubscribe = subscribeWorkspace(renderDock);
    renderDock();
    const mapId = editorState.get().currentMapId;
    try {
      listEditorCommands().find(command => command.id === `sidebar-inspection-${inspection}`)?.run();
      expect(root.querySelector('[data-testid="left-palette-root"]')).not.toBeNull();
      const panelId = pinned ? { inspector: 'tile-inspector-dropdown', ruleAudit: 'tile-rule-audit-dropdown', history: 'tile-history-dropdown' }[inspection] : 'toolbar-overflow-dropdown';
      expect(get(panelId).contains(document.activeElement)).toBe(true);
      expect(editorState.get().currentMapId).toBe(mapId);
      expect(JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY + 'expert') ?? '[]')).toEqual(pinned ? [inspection] : []);
      escape();
      expect(root.querySelector(`[data-testid="${panelId}"]`)).toBeNull();
    } finally { unsubscribe(); root.remove(); resetWorkspaceForTests(); }
  });
});
