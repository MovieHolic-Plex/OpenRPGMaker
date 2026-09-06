import { getEditorChrome } from '@/editor/editorUiMode';
import { renderMapList } from '@/editor/panels/mapList';
import { openMapPropertiesDialog } from '@/editor/panels/mapPropertiesDialog';
import { makeSidebarSurface } from '@/editor/panels/sidebarSurface';
import { setMapPanelCollapsed } from '@/editor/workspace/mapPanelSection';
import { el } from '@/util/dom';

export function makeSidebarMapHeader(map: { readonly id: string; readonly name: string }, rerender: () => void): HTMLElement {
  const docked = getEditorChrome().mapTree && document.querySelector('[data-testid="left-map-root"]');
  const switcher = docked
    ? el('button', {
      class: 'btn sidebar-surface-button', text: map.name, attrs: { type: 'button', title: '현재 맵 — 맵 목록에서 보기' },
      dataset: { testid: 'sidebar-map-switcher' },
      on: { click: () => {
        setMapPanelCollapsed(false);
        document.querySelector<HTMLElement>('[data-testid="left-map-root"] [role="treeitem"][aria-selected="true"]')?.focus();
      } },
    })
    : makeSidebarSurface({ id: 'maps', label: map.name, triggerId: 'sidebar-map-switcher', rerender, body: () => {
      const host = el('div', { class: 'sidebar-map-explorer' });
      renderMapList(host, { variant: 'switcher' });
      return host;
    } });
  return el('div', { class: 'sidebar-map-header', dataset: { testid: 'sidebar-map-header' }, children: [
    switcher,
    el('button', { class: 'btn', text: '맵 설정', attrs: { type: 'button' }, dataset: { testid: 'sidebar-map-settings' },
      on: { click: () => openMapPropertiesDialog(map.id, map.name) } }),
  ] });
}
