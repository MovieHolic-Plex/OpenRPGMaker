import { selectTileTool } from '@/editor/panels/tileToolbarActions';
import type { TileToolbarModel } from '@/editor/panels/tileToolbarMenus';
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
