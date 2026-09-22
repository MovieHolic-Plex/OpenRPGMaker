import { el } from '@/util/dom';
import type { SpatialGalleryCard } from './spatialCatalog';
import { classifyRegionCard, matchesRegionClassification, regionLibraryFilters, REGION_CATEGORIES } from './spatialRegionClassification';
import { patchSpatialSession } from './spatialAuthoringSession';
import './spatialPlaceLibrary.css';

/** 지역 라이브러리 컨트롤 — 장소 라이브러리 머리와 같은 두 줄 구조(제목줄 + 도구줄). */
export function renderRegionLibraryControls(cards: readonly SpatialGalleryCard[], refresh: () => void): HTMLElement {
  const values = cards.map(classifyRegionCard), f = regionLibraryFilters;
  const update = () => { patchSpatialSession({ listView: true }); refresh(); };
  const select = (label: string, key: 'style' | 'category' | 'origin', options: readonly string[]) => {
    const input = el('select', { attrs: { 'aria-label': label }, dataset: { testid: `region-filter-${key}` }, children: [el('option', { text: `모든 ${label}`, attrs: { value: '' } }), ...[...new Set([...options, ...(f[key] ? [f[key]] : [])])].map(value => el('option', { text: value, attrs: { value } }))] });
    input.value = f[key]; input.addEventListener('change', () => { f[key] = input.value; update(); }); return input;
  };
  const search = el('input', { value: f.search, attrs: { type: 'search', placeholder: '지역 이름으로 검색', 'aria-label': '지역 검색' }, dataset: { testid: 'region-filter-search' } });
  search.addEventListener('input', () => { const pos = search.selectionStart; f.search = search.value; update(); const next = document.querySelector<HTMLInputElement>('[data-testid="region-filter-search"]'); next?.focus(); if (pos !== null) next?.setSelectionRange(pos, pos); });
  const tabs = el('div', { class: 'place-library-tabs', attrs: { role: 'tablist', 'aria-label': '지역 유형' } });
  for (const value of ['', ...new Set([...REGION_CATEGORIES, ...values.map(v => v.category)])]) {
    tabs.append(el('button', { text: value || '전체', class: value === f.category ? 'is-active' : '', attrs: { type: 'button', role: 'tab', 'aria-selected': String(value === f.category) }, on: { click: () => { f.category = value; update(); } } }));
  }
  return el('section', { class: 'place-library-controls', children: [
    el('div', { class: 'place-library-heading', children: [
      el('div', { class: 'place-library-title', children: [
        el('strong', { text: '지역 라이브러리' }),
        el('span', { class: 'place-library-count', text: `${cards.filter(matchesRegionClassification).length}개`, dataset: { testid: 'region-library-count' } }),
      ] }),
    ] }),
    el('div', { class: 'place-library-filters', children: [
      search,
      select('그림체', 'style', values.map(v => v.style)),
      select('출처', 'origin', ['참고 사례', '내 설계', '마을 설계서']),
      tabs,
    ] }),
  ] });
}
