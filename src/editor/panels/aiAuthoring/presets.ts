import { el } from '@/util/dom';
import { t } from '@/i18n';
import { store } from '@/project/store';
import { editorState } from '@/editor/editorState';
import {
  AUTHORING_PRESET_CATEGORIES, AUTHORING_PRESETS, authoringPresetById,
  authoringPresetPrompt, searchAuthoringPresets, type AuthoringPresetCategory,
} from '@/project/authoringPresets';
import { button, field, input, type FeaturePane } from './shared';

/** Catalog, assistant tools and request drafts all use the same bundled definitions. */
export function createAuthoringPresets(apply: (text: string) => void): FeaturePane {
  let selectedId = AUTHORING_PRESETS[0].id;
  const drafts = new Map(AUTHORING_PRESETS.map(preset => [preset.id, t(preset.example)]));
  const list = el('div', { class: 'ai-authoring-list ai-play-preset-list', attrs: { role: 'group', 'aria-label': '플레이 유형' } });
  const count = el('p', { attrs: { 'aria-live': 'polite' }, dataset: { testid: 'authoring-preset-count' } });
  const title = el('h3', { dataset: { testid: 'authoring-preset-title' } });
  const description = el('p');
  const idea = el('textarea', { attrs: { rows: '4', maxlength: '1200' }, dataset: { testid: 'authoring-preset-idea' } });
  const flow = el('ol', { dataset: { testid: 'authoring-preset-flow' } });
  const checks = el('ul', { dataset: { testid: 'authoring-preset-checks' } });
  const context = el('p', { attrs: { translate: 'no' }, dataset: { testid: 'authoring-preset-map' } });
  const status = el('p', { attrs: { role: 'alert' }, dataset: { testid: 'authoring-preset-error' } });
  const search = input('authoring-preset-search', '', 'search');
  const category = el('select', { dataset: { testid: 'authoring-preset-category' }, children: [
    el('option', { attrs: { value: '' }, text: '모든 분류' }),
    ...AUTHORING_PRESET_CATEGORIES.map(entry => el('option', { attrs: { value: entry.id }, text: entry.label })),
  ] });
  const currentMap = () => {
    const project = store.getCurrent();
    return project.maps[editorState.get().currentMapId ?? project.startMapId];
  };
  const request = button('요청 확인하기', 'authoring-preset-apply', () => {
    const map = currentMap();
    if (!map) { status.textContent = '먼저 만들 맵을 열어 주세요.'; return; }
    apply(authoringPresetPrompt(selectedId, idea.value, map));
  });
  const refreshContext = () => {
    const map = currentMap();
    context.textContent = map ? `${t('만들 맵')}: ${map.name}` : t('선택된 맵 없음');
    request.disabled = !map;
    status.textContent = map ? '' : '먼저 만들 맵을 열어 주세요.';
  };
  const renderDetail = () => {
    const preset = authoringPresetById(selectedId)!;
    title.textContent = preset.title;
    description.textContent = preset.description;
    idea.value = drafts.get(selectedId)!;
    flow.replaceChildren(...preset.steps.map(step => el('li', { children: [
      el('strong', { text: step.title }), el('p', { text: step.output }),
    ] })));
    checks.replaceChildren(...preset.checks.map(check => el('li', { text: check })));
    for (const control of Array.from(list.children)) {
      control.setAttribute('aria-pressed', String((control as HTMLElement).dataset.preset === selectedId));
    }
  };
  const renderList = () => {
    const matches = searchAuthoringPresets(category.value as AuthoringPresetCategory || undefined, search.value);
    // Keep selection in the filtered set; drafts survive filtering and switching types.
    if (matches.length && !matches.some(preset => preset.id === selectedId)) selectedId = matches[0].id;
    list.replaceChildren(...matches.map(preset => {
      const control = button('', `authoring-preset-${preset.id}`, () => { selectedId = preset.id; renderDetail(); });
      control.dataset.preset = preset.id;
      control.append(el('strong', { text: preset.title }), el('small', { text: preset.description }));
      return control;
    }));
    count.textContent = matches.length ? `${matches.length} / ${AUTHORING_PRESETS.length}` : t('검색 결과가 없습니다.');
    request.hidden = matches.length === 0;
    detail.hidden = matches.length === 0;
    if (matches.length) renderDetail();
  };
  idea.addEventListener('input', () => drafts.set(selectedId, idea.value));
  search.addEventListener('input', renderList);
  category.addEventListener('change', renderList);
  const detail = el('div', { children: [title, description, context, field('어떤 구간을 만들까요?', idea),
    button('예시로 시작', 'authoring-preset-example', () => {
      idea.value = t(authoringPresetById(selectedId)!.example); drafts.set(selectedId, idea.value);
    }),
    el('h3', { text: '작성 흐름' }), flow,
    el('h3', { text: '확인할 결과' }), checks, status, request,
  ] });
  const root = el('section', { dataset: { testid: 'authoring-presets' }, children: [
    el('p', { text: '유형을 고르고 요청을 작성하면 AI가 현재 프로젝트에 맞게 구성합니다.' }),
    el('div', { class: 'ai-authoring-filters', children: [field('분류', category), field('플레이 프리셋 검색', search)] }),
    count, el('div', { class: 'ai-authoring-columns', children: [list, detail] }),
    el('p', { text: '다음 화면에서 요청을 확인하고 AI에게 보내세요.' }),
  ] });
  const unsubscribeProject = store.subscribe(refreshContext);
  const unsubscribeEditor = editorState.subscribe(refreshContext);
  renderList(); refreshContext();
  return { root, dispose: () => { unsubscribeProject(); unsubscribeEditor(); } };
}
