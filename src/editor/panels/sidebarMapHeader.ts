import { renderMapList, revealMapInDock } from '@/editor/panels/mapList';
import { makeSidebarSurface } from '@/editor/panels/sidebarSurface';
import { el } from '@/util/dom';

export function makeSidebarMapHeader(map: { readonly id: string; readonly name: string }, rerender: () => void): HTMLElement {
  const docked = document.querySelector('[data-testid="left-map-root"]');
  const switcher = docked
    ? el('button', {
      class: 'btn sidebar-surface-button', text: map.name, attrs: { type: 'button', title: '현재 맵 — 맵 목록에서 보기' },
      dataset: { testid: 'sidebar-map-switcher' },
      on: { click: () => {
        revealMapInDock(map.id);
      } },
    })
    : makeSidebarSurface({ id: 'maps', label: map.name, triggerId: 'sidebar-map-switcher', rerender, body: () => {
      const host = el('div', { class: 'sidebar-map-explorer' });
      renderMapList(host, { variant: 'switcher' });
      return host;
    } });
  // 「맵 설정」 단추는 여기에 두지 않는다 — 같은 창(openMapPropertiesDialog)을 여는 진입이
  // 이미 둘 있다: 선택 칩의 타일셋 이름(palette-tileset-name)과 맵 목록 행의 설정 동작.
  // 세 번째 집을 얹으면 헤더가 넓어져 레이어 전환과 한 줄을 나누지 못한다.
  return el('div', { class: 'sidebar-map-header', dataset: { testid: 'sidebar-map-header' }, children: [
    switcher,
  ] });
}
