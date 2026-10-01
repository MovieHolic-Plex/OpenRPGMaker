import { el } from '@/util/dom';
import { t } from '@/i18n';
import { store } from '@/project/store';
import { editorState } from '@/editor/editorState';
import { QUEST_PRESETS, QUEST_CATEGORIES, QUEST_STEP_LABELS, questPresetPrompt, type QuestPresetId } from '@/project/quest/questPresets';
import type { QuestStepKind } from '@/project/quest/questDef';
import { deckIcon } from '../aiDeckIcons';
import { button, field, input, type FeaturePane } from './shared';

/** Each preset owns its draft, so exploring another type never loses edits. */
export function createQuestPresets(apply: (text: string) => void): FeaturePane {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const drafts = new Map(QUEST_PRESETS.map(preset => [preset.id, { idea: t(preset.example), gold: '100', blueprint: [...preset.pattern], custom: preset.id === 'custom' }]));
  let selected: QuestPresetId = 'errand';
  const idea = el('textarea', { attrs: { rows: '4', maxlength: '1200' }, dataset: { testid: 'quest-preset-idea' } });
  const gold = input('quest-gold', '100', 'number');
  gold.min = '0'; gold.max = '999999'; gold.step = '1'; gold.required = true;
  gold.setAttribute('aria-label', '완료 보상');
  const title = el('h3', { class: 'ai-quest-title' });
  const description = el('p', { class: 'ai-quest-description' });
  const category = el('span', { class: 'ai-quest-category' });
  const samples = el('div', { class: 'ai-quest-samples', attrs: { role: 'group', 'aria-label': '이야기 예시' } });
  const rewardChoices = el('div', { class: 'ai-quest-reward-choices', attrs: { role: 'group', 'aria-label': '빠른 보상 선택' } });
  const flow = el('ol', { class: 'ai-quest-flow', dataset: { testid: 'quest-preset-flow' } });
  const previewStory = el('p', { class: 'ai-quest-preview-story', attrs: { translate: 'no' }, dataset: { testid: 'quest-preset-preview-story' } });
  const previewGold = el('strong', { dataset: { testid: 'quest-preset-preview-gold' } });
  const previewMap = el('span', { attrs: { translate: 'no' } });
  const mapName = el('span', { attrs: { translate: 'no' } });
  const status = el('p', { class: 'ai-quest-error', attrs: { role: 'alert' }, dataset: { testid: 'quest-preset-error' } });
  const choices = el('div', { class: 'ai-quest-choices', attrs: { role: 'group', 'aria-label': '퀘스트 유형' } });
  const search = input('quest-search', '', 'search');
  search.placeholder = t('프리셋 검색'); search.setAttribute('aria-label', t('프리셋 검색'));
  const filter = el('select', { dataset: { testid: 'quest-preset-category' }, attrs: { 'aria-label': '퀘스트 분류' }, children: [
    el('option', { attrs: { value: '' }, text: '전체 유형' }), ...QUEST_CATEGORIES.map(name => el('option', { attrs: { value: name }, text: name })),
  ] });
  const listCount = el('p', { class: 'ai-quest-list-count', attrs: { 'aria-live': 'polite' } });
  const filterList = () => {
    const query = search.value.trim().toLocaleLowerCase(); let count = 0;
    for (const control of Array.from(choices.children) as HTMLElement[]) {
      const preset = QUEST_PRESETS.find(item => item.id === control.dataset.preset)!;
      control.hidden = Boolean((filter.value && preset.category !== filter.value) || (query && !`${t(preset.title)} ${t(preset.description)} ${preset.id}`.toLocaleLowerCase().includes(query)));
      if (!control.hidden) count++;
    }
    listCount.textContent = count ? `${count} / ${QUEST_PRESETS.length}` : t('검색 결과가 없습니다.');
  };
  search.addEventListener('input', filterList); filter.addEventListener('change', filterList);
  const builder = el('details', { class: 'ai-quest-builder', dataset: { testid: 'quest-preset-builder' }, children: [el('summary', { text: '단계 직접 구성' })] });
  const builderRows = el('div', { class: 'ai-quest-builder-rows' });
  const renderFlow = () => {
    const draft = drafts.get(selected)!;
    const labels = ['의뢰 수락', ...draft.blueprint.map(kind => QUEST_STEP_LABELS[kind]), '보고하고 보상'];
    flow.replaceChildren(...labels.map((label, index) => el('li', { children: [
      el('span', { class: 'ai-quest-step-number', text: String(index + 1), attrs: { 'aria-hidden': 'true' } }), el('strong', { text: label }),
    ] })));
  };
  const changeBlueprint = (change: (kinds: QuestStepKind[]) => void) => {
    const draft = drafts.get(selected)!; change(draft.blueprint); draft.custom = true;
    renderBuilder(); renderFlow(); status.textContent = '';
  };
  const renderBuilder = () => {
    const draft = drafts.get(selected)!;
    builderRows.replaceChildren(...draft.blueprint.map((kind, index) => {
      const select = el('select', { attrs: { 'aria-label': `${t('목표 종류')} ${index + 1}` }, children: Object.entries(QUEST_STEP_LABELS).map(([value, label]) => el('option', { attrs: { value }, text: label })) });
      select.value = kind;
      select.addEventListener('change', () => changeBlueprint(kinds => { kinds[index] = select.value as QuestStepKind; }));
      const up = button('↑', `quest-step-up-${index}`, () => changeBlueprint(kinds => { [kinds[index - 1], kinds[index]] = [kinds[index], kinds[index - 1]]; }));
      up.disabled = index === 0; up.setAttribute('aria-label', t('단계 위로'));
      const down = button('↓', `quest-step-down-${index}`, () => changeBlueprint(kinds => { [kinds[index + 1], kinds[index]] = [kinds[index], kinds[index + 1]]; }));
      down.disabled = index === draft.blueprint.length - 1; down.setAttribute('aria-label', t('단계 아래로'));
      const remove = button('×', `quest-step-remove-${index}`, () => changeBlueprint(kinds => { kinds.splice(index, 1); }));
      remove.disabled = draft.blueprint.length === 1; remove.setAttribute('aria-label', t('단계 삭제'));
      return el('div', { class: 'ai-quest-builder-row', children: [el('span', { text: String(index + 1) }), select, up, down, remove] });
    }));
    const add = button('단계 추가', 'quest-step-add', () => changeBlueprint(kinds => { kinds.push('talk'); }));
    add.disabled = draft.blueprint.length >= 12;
    const reset = button('기본 구성으로', 'quest-step-reset', () => { const preset = QUEST_PRESETS.find(item => item.id === selected)!; draft.blueprint = [...preset.pattern]; draft.custom = selected === 'custom'; renderBuilder(); renderFlow(); });
    builderRows.append(el('div', { class: 'ai-quest-builder-actions', children: [add, reset] }));
  };
  builder.append(builderRows);

  const refreshPreview = () => {
    const preset = QUEST_PRESETS.find(item => item.id === selected)!;
    previewStory.textContent = idea.value.trim() || t(preset.example);
    previewGold.textContent = gold.checkValidity() ? `${gold.valueAsNumber.toLocaleString()} G` : '—';
    for (const control of Array.from(samples.children)) {
      control.setAttribute('aria-pressed', String(idea.value === t(Number((control as HTMLElement).dataset.sample) === 0 ? preset.example : preset.alternate)));
    }
    for (const control of Array.from(rewardChoices.children)) {
      control.setAttribute('aria-pressed', String(gold.value === (control as HTMLElement).dataset.gold));
    }
  };
  const saveDraft = () => {
    const draft = drafts.get(selected)!; draft.idea = idea.value; draft.gold = gold.value;
    status.textContent = '';
    refreshPreview();
  };
  idea.addEventListener('input', saveDraft);
  gold.addEventListener('input', saveDraft);
  const update = () => {
    const preset = QUEST_PRESETS.find(item => item.id === selected)!;
    const draft = drafts.get(selected)!;
    title.textContent = preset.title;
    description.textContent = preset.description;
    category.textContent = preset.category;
    idea.value = draft.idea;
    gold.value = draft.gold;
    idea.placeholder = preset.example;
    samples.replaceChildren(...[preset.example, preset.alternate].map((story, index) => {
      const control = button(index === 0 ? '첫 예시' : '다른 예시', `quest-sample-${index}`, () => { idea.value = t(story); saveDraft(); });
      control.dataset.sample = String(index); return control;
    }));
    renderBuilder();
    renderFlow();
    for (const control of Array.from(choices.children)) control.setAttribute('aria-pressed', String((control as HTMLElement).dataset.preset === selected));
    status.textContent = '';
    refreshPreview();
  };
  for (const preset of QUEST_PRESETS) {
    const control = button('', `quest-${preset.id}`, () => { if (selected !== preset.id) { selected = preset.id; update(); } });
    control.dataset.preset = preset.id;
    control.append(
      el('span', { class: 'ai-quest-choice-icon', children: [deckIcon(preset.category === '전투와 구조' ? 'shield' : preset.category === '탐험과 퍼즐' ? 'search' : 'scroll', { size: 18 })] }),
      el('span', { class: 'ai-quest-choice-copy', children: [el('strong', { text: preset.title }), el('small', { text: preset.category })] }),
      deckIcon('check', { class: 'ai-quest-choice-check', size: 15 }),
    );
    choices.append(control);
  }
  for (const amount of [0, 100, 300]) {
    const control = button(`${amount} G`, `quest-reward-${amount}`, () => { gold.value = String(amount); saveDraft(); });
    control.dataset.gold = String(amount);
    rewardChoices.append(control);
  }
  const request = button('요청 확인하기', 'quest-apply', () => {
    if (!gold.checkValidity()) { status.textContent = '보상은 0~999999 사이의 정수로 입력하세요.'; gold.focus(); return; }
    const liveMap = store.getCurrent().maps[mapId];
    if (!liveMap) { status.textContent = '먼저 퀘스트를 만들 맵을 열어 주세요.'; return; }
    try { apply(questPresetPrompt({ presetId: selected, idea: idea.value, gold: gold.valueAsNumber, mapId, mapName: liveMap.name, blueprint: drafts.get(selected)!.custom ? drafts.get(selected)!.blueprint : undefined })); }
    catch (cause) { status.textContent = cause instanceof Error ? cause.message : String(cause); }
  });
  request.classList.add('ai-quest-apply');
  request.append(deckIcon('chevron-right', { size: 15 }));
  const refreshMap = () => {
    const map = store.getCurrent().maps[mapId];
    mapName.textContent = previewMap.textContent = map?.name ?? t('선택된 맵 없음');
    request.disabled = !map;
    status.textContent = map ? '' : '먼저 퀘스트를 만들 맵을 열어 주세요.';
  };
  const unsubscribe = store.subscribe(refreshMap);
  const root = el('section', { class: 'ai-quest-presets', dataset: { testid: 'quest-presets' }, children: [
    el('div', { class: 'ai-quest-workspace', children: [
      el('aside', { class: 'ai-quest-sidebar', children: [
        el('h3', { class: 'ai-quest-section-label', text: '퀘스트 유형' }), search, filter, listCount, choices,
        el('p', { class: 'ai-quest-sidebar-note', text: '유형별로 작성한 내용은 이 창을 닫을 때까지 유지됩니다.' }),
      ] }),
      el('div', { class: 'ai-quest-edit', children: [
        category, title, description,
        field('어떤 부탁인가요?', idea),
        el('div', { class: 'ai-quest-example-row', children: [el('span', { text: '예시로 시작' }), samples] }),
        el('div', { class: 'ai-quest-reward', children: [
          field('완료 보상', el('div', { class: 'ai-quest-gold-input', children: [gold, el('span', { text: 'G', attrs: { 'aria-hidden': 'true' } })] })),
          rewardChoices,
        ] }),
        el('p', { class: 'ai-quest-context', children: [deckIcon('pin', { size: 15 }), el('span', { text: '만들 맵' }), mapName] }),
        builder, status,
      ] }),
      el('aside', { class: 'ai-quest-preview', attrs: { 'aria-label': '퀘스트 구성 미리보기' }, children: [
        el('div', { class: 'ai-quest-preview-heading', children: [deckIcon('eye', { size: 15 }), el('h3', { text: '구성 미리보기' })] }),
        previewStory, flow,
        el('div', { class: 'ai-quest-preview-reward', attrs: { 'aria-live': 'polite' }, children: [el('span', { text: '완료 보상' }), previewGold] }),
        el('p', { class: 'ai-quest-preview-map', children: [deckIcon('pin', { size: 15 }), previewMap] }),
        el('p', { class: 'ai-quest-preview-note', text: '인물·장소·대사는 AI가 맵에 맞춰 구성합니다.' }),
      ] }),
    ] }),
    el('footer', { class: 'ai-quest-footer', children: [
      el('p', { children: [deckIcon('spark', { size: 18 }), el('span', { text: '다음 화면에서 요청을 확인하고 AI에게 보내세요.' })] }), request,
    ] }),
  ] });
  update();
  filterList();
  refreshMap();
  return { root, dispose: unsubscribe };
}
