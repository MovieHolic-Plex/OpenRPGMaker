import { el } from '@/util/dom';

/**
 * 장소·지역 라이브러리의 보조 필터(그림체·공간 형태·용도·출처·쓰임)를 「필터」 하나로 접는다.
 * 전에는 검색 + 드롭다운 3 + 분류 칩 + 출처 칩 + 쓰임 칩이 네 줄로 카드 위를 덮었다.
 * 셸은 리프레시마다 통째로 다시 만들어지므로 펼침 상태는 모듈에 둔다.
 */
let drawerOpen = false;

export function renderSpatialFilterDrawer(activeCount: number, children: readonly HTMLElement[]): HTMLElement {
  const details = document.createElement('details');
  details.className = 'spatial-filter-drawer';
  details.dataset.testid = 'spatial-filter-drawer';
  details.open = drawerOpen;
  details.addEventListener('toggle', () => { drawerOpen = details.open; });
  details.append(
    el('summary', {
      text: activeCount > 0 ? `필터 ${activeCount}` : '필터',
      class: activeCount > 0 ? 'is-active' : '',
      attrs: { title: '그림체·공간 형태·용도·출처·쓰임으로 좁힙니다' },
    }),
    el('div', { class: 'spatial-filter-drawer-body', children: [...children] }),
  );
  return details;
}
