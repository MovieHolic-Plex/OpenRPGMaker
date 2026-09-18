import { el } from '@/util/dom';
import type { SpatialGalleryCard } from './spatialCatalog';
import { classifyPlaceCard, PLACE_CATEGORIES, PLACE_ENVIRONMENTS, placeLibraryFilters } from './spatialPlaceClassification';
import { openNewPlaceDialog } from './spatialNewPlaceDialog';
import { patchSpatialSession } from './spatialAuthoringSession';
import { openDialog } from './databaseEnemyRecordSupport';
import './spatialPlaceLibrary.css';
const customCategories = new Set<string>();
export function renderPlaceLibraryControls(cards: readonly SpatialGalleryCard[], refresh: () => void): HTMLElement {
  const values = cards.map(classifyPlaceCard), f = placeLibraryFilters;
  const update = () => { patchSpatialSession({ listView: true }); refresh(); };
  const select = (label: string, key: 'style' | 'environment' | 'purpose', options: readonly string[]) => {
    const input = el('select', { attrs: { 'aria-label': label }, dataset: { testid: `place-filter-${key}` }, children: [el('option', { text: `모든 ${label}`, attrs: { value: '' } }), ...[...new Set([...options, ...(f[key] ? [f[key]] : [])])].map(value => el('option', { text: value, attrs: { value } }))] });
    input.value = f[key]; input.addEventListener('change', () => { f[key] = input.value; update(); }); return input;
  };
  const search = el('input', { value: f.search, attrs: { type: 'search', placeholder: '장소 이름·용도로 검색', 'aria-label': '장소 검색' }, dataset: { testid: 'place-filter-search' } });
  search.addEventListener('input', () => { const pos = search.selectionStart; f.search = search.value; update(); const next = document.querySelector<HTMLInputElement>('[data-testid="place-filter-search"]'); next?.focus(); if (pos !== null) next?.setSelectionRange(pos, pos); });
  const tabs = el('div', { class: 'place-library-tabs', attrs: { role: 'tablist', 'aria-label': '장소 유형' } });
  for (const value of ['', ...new Set([...PLACE_CATEGORIES, ...customCategories, ...values.map(v => v.category)])]) {
    tabs.append(el('button', { text: value || '전체', class: value === f.category ? 'is-active' : '', attrs: { type: 'button', role: 'tab', 'aria-selected': String(value === f.category) }, on: { click: () => { f.category = value; update(); } } }));
  }
  tabs.append(el('button', { text: '＋ 분류', attrs: { type: 'button' }, on: { click: () => {
    let close = () => {}; const input = el('input', { attrs: { maxlength: '40', 'aria-label': '새 장소 유형', placeholder: '예: 교통시설' } });
    const form = el('form', { children: [input, el('button', { text: '추가', attrs: { type: 'submit' } })] });
    form.addEventListener('submit', e => { e.preventDefault(); const name = input.value.trim(); if (!name) return; customCategories.add(name); f.category = name; close(); update(); });
    close = openDialog('place-category-dialog', '장소 유형 추가', [form, el('p', { text: '이 유형으로 만든 장소를 저장하면 분류도 함께 저장됩니다.' })], [{ label: '취소', testid: 'place-category-cancel' }]);
  } } }));
  return el('section', { class: 'place-library-controls', children: [
    el('div', { class: 'place-library-heading', children: [el('div', { children: [el('strong', { text: '장소 라이브러리' }), el('p', { text: '그림체를 고르고, 유형과 공간 형태로 필요한 장소를 찾으세요.' })] }), el('button', { text: '＋ 장소 만들기', class: 'spatial-action is-primary', on: { click: () => openNewPlaceDialog(refresh) } })] }),
    el('div', { class: 'place-library-filters', children: [select('그림체', 'style', values.map(v => v.style)), select('공간 형태', 'environment', PLACE_ENVIRONMENTS), select('용도', 'purpose', values.flatMap(v => v.purposes)), search] }), tabs,
    el('small', { text: 'EasyRPG · Tibo는 호환 확장 소재입니다. 기본 장소는 모든 프로젝트에서 사용할 수 있습니다.' }),
  ] });
}
