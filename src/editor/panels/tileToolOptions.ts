import { copySelection, pasteClipboard } from '@/editor/mapClipboard';
import { selectMapModeTool, selectTileTool } from '@/editor/panels/tileToolbarActions';
import type { TileToolbarModel } from '@/editor/panels/tileToolbarMenus';
import { closeSidebarSurface, makeSidebarSurface } from '@/editor/panels/sidebarSurface';
import { el } from '@/util/dom';

export function makePaintShapeSelect(model: TileToolbarModel): HTMLElement {
  const select = el('select', {
    attrs: { 'aria-label': '칠하기 모양' }, dataset: { testid: 'paint-shape-select' },
    on: { change: event => {
      if (!(event.currentTarget instanceof HTMLSelectElement)) return;
      const value = event.currentTarget.value;
      if (value === 'pen' || value === 'rect' || value === 'round') selectTileTool(value);
      model.rerender();
    } },
  });
  for (const [value, text] of [['pen', '자유선'], ['rect', '사각형'], ['round', '타원']] as const) {
    select.append(el('option', { value, text }));
  }
  select.value = model.state.paintShape;
  return el('label', { class: 'sidebar-shape-select', children: [el('span', { text: '모양' }), select] });
}

export function makeTileToolsMenu(model: TileToolbarModel): HTMLElement {
  return makeSidebarSurface({ id: 'tools', label: '도구', triggerId: 'sidebar-tools-menu', rerender: model.rerender, body: () => {
    const body = el('div', { class: 'sidebar-tool-options', dataset: { testid: 'tool-grid' } });
    // 칠하기 모양은 사이드바 옵션줄이 소유한다(advanced 게이트로 여기 중복 노출하지 않는다).
    for (const [id, label] of [['eyedropper', '타일 집기 (I)'], ['pan', '화면 밀기 (4)'], ['collision', '통행 표시 (6)'], ['relief', '높이 (절벽)']] as const) {
      body.append(el('button', { class: 'oprn-option-item', text: label,
        attrs: { type: 'button', title: label, 'aria-pressed': String(model.state.tool === id) }, dataset: { testid: `tool-${id}` },
        on: { click: () => { selectMapModeTool(id); closeSidebarSurface(true); model.rerender(); } } }));
    }
    body.append(el('button', { class: 'oprn-option-item', text: '복사 (선택 영역)', attrs: { type: 'button' }, dataset: { testid: 'copy-button' },
      on: { click: () => { void copySelection(model.map.id); closeSidebarSurface(true); } } }));
    body.append(el('button', { class: 'oprn-option-item', text: '붙여넣기', attrs: { type: 'button' }, dataset: { testid: 'paste-button' },
      on: { click: () => { const target = model.state.selection ?? { x: 0, y: 0 }; void pasteClipboard(model.map.id, target.x, target.y); closeSidebarSurface(true); } } }));
    return body;
  } });
}
