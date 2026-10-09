import { el } from '@/util/dom';
import { isTileCellChange, store } from '@/project/store';
import { selectEditorMap } from '@/editor/mapSelection';
import { openEventEditorModal } from '@/editor/panels/eventEditor/modal';
import { STYLE_RULES_LIMIT } from '@/project/aiAuthoring';
import { collectDialogue, checkDialogueStructure, type DialogueRow, type DialogueFinding } from '@/ai/authoring/dialogueInventory';
import { reviewDialogue } from '@/ai/authoring/dialogueReview';
import { redactPromptText } from '@/ai/authoring/promptInspection';
import { button, field, input, saveSettings, settings, type FeaturePane } from './shared';

export function createDialogueInventory(close: () => void): FeaturePane {
  let rows = collectDialogue(store.getCurrent());
  let findings: DialogueFinding[] = [];
  let controller: AbortController | null = null;
  let disposed = false;
  let limit = 100;
  const search = input('dialogue-search', '', 'search');
  const speaker = el('select', { dataset: { testid: 'feature16-dialogue-speaker' } });
  const map = el('select', { dataset: { testid: 'feature16-dialogue-map' } });
  const rules = el('textarea', { value: settings().dialogueStyleRules, attrs: { rows: '5', maxlength: String(STYLE_RULES_LIMIT), placeholder: '예: 안내인은 존댓말을 쓰고, 경비병은 짧은 명령형으로 말한다.' }, dataset: { testid: 'feature16-style-rules' } });
  const maxChars = input('dialogue-max-chars', String(settings().maxDialogueChars), 'number');
  maxChars.min = '1'; maxChars.max = '10000';
  const status = el('p', { attrs: { role: 'status' }, dataset: { testid: 'feature16-review-status' } });
  const count = el('p', { dataset: { testid: 'feature16-dialogue-count' } });
  const list = el('div', { class: 'ai-authoring-list', dataset: { testid: 'feature16-dialogue-list' } });
  const findingsList = el('div', { class: 'ai-authoring-list', dataset: { testid: 'feature16-review-findings' } });
  const filtered = () => rows.filter(row => (!speaker.value || row.speaker === speaker.value || (speaker.value === '__none__' && !row.speaker))
    && (!map.value || row.mapId === map.value)
    && `${row.text} ${row.speaker} ${row.location}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
  const navigate = (row: DialogueRow) => {
    const current = collectDialogue(store.getCurrent()).find(item => item.id === row.id);
    if (!current || current.text !== row.text) { status.textContent = '원문이 변경되었습니다. 새로 수집한 뒤 이동하세요.'; return; }
    if (!selectEditorMap(row.mapId)) return;
    close();
    openEventEditorModal(row.mapId, row.eventId, { pageId: row.pageId });
  };
  const render = () => {
    const visible = filtered();
    count.textContent = `전체 ${rows.length}개 · 필터 ${visible.length}개 · 표시 ${Math.min(visible.length, limit)}개 (맵 이벤트의 저장된 모든 페이지, 임시 편집 초안·공통 이벤트 제외)`;
    list.replaceChildren(...visible.slice(0, limit).map(row => el('article', { class: 'ai-authoring-card', children: [
      button(`${row.location} · 명령 ${row.path}`, 'dialogue-source', () => navigate(row)),
      el('small', { text: `${row.kind === 'text' ? '대사' : row.kind === 'choice' ? '선택지' : '선택 질문'} · ${row.speaker || '화자 없음'}` }),
      el('p', { text: row.text || '(빈 내용)' }),
    ] })));
    if (!visible.length) list.append(el('p', { text: '해당하는 대사/선택지가 없습니다.' }));
    more.hidden = visible.length <= limit;
  };
  const renderFindings = () => {
    findingsList.replaceChildren(...findings.map(item => {
      const row = rows.find(row => row.id === item.rowId)!;
      return el('article', { class: 'ai-authoring-card', children: [
        el('strong', { text: item.source === 'llm' ? 'LLM 문체 지적' : '구조 검사 (LLM 아님)' }),
        button(`${row.location} · ${row.path}`, 'finding-source', () => navigate(row)),
        el('blockquote', { text: item.quote || '(빈 내용)' }), el('p', { text: item.message }),
      ] });
    }));
  };
  const refillFilters = () => {
    const previousSpeaker = speaker.value; const previousMap = map.value;
    speaker.replaceChildren(el('option', { value: '', text: '모든 화자' }), el('option', { value: '__none__', text: '화자 없음' }),
      ...[...new Set(rows.map(row => row.speaker).filter(Boolean))].sort().map(value => el('option', { value, text: value })));
    map.replaceChildren(el('option', { value: '', text: '모든 맵' }), ...Object.values(store.getCurrent().maps).map(item => el('option', { value: item.id, text: item.name })));
    speaker.value = previousSpeaker; map.value = previousMap;
  };
  const cancel = button('검토 중단', 'review-cancel', () => { stopReview(); status.textContent = '검토를 중단했습니다.'; });
  cancel.disabled = true;
  const run = button('필터 범위 LLM 문체 검토', 'review-llm', () => {
    if (rules.value !== settings().dialogueStyleRules) { status.textContent = '변경한 문체 규칙을 먼저 저장하세요.'; return; }
    controller?.abort();
    const owner = new AbortController(); controller = owner;
    const selected = filtered();
    const original = JSON.stringify(collectDialogue(store.getCurrent()));
    const originalRules = settings().dialogueStyleRules;
    const identity = store.getProjectIdentity().id;
    run.disabled = true; cancel.disabled = false; findings = []; renderFindings();
    status.textContent = `${selected.length}개 원문을 LLM으로 검토 중…`;
    void reviewDialogue(selected, originalRules, owner.signal).then(result => {
      if (disposed || owner.signal.aborted || controller !== owner) return;
      if (store.getProjectIdentity().id !== identity || JSON.stringify(collectDialogue(store.getCurrent())) !== original || settings().dialogueStyleRules !== originalRules || rules.value !== originalRules) {
        status.textContent = '검토 중 원문 또는 규칙이 바뀌었습니다. 결과를 버렸습니다. 새로 수집해 다시 검토하세요.'; return;
      }
      findings = result; renderFindings();
      status.textContent = `LLM 문체 검토 완료 · ${selected.length}개 검토 · 근거 있는 지적 ${result.length}개`;
    }).catch(error => {
      if (!disposed && controller === owner) status.textContent = owner.signal.aborted ? '검토를 중단했습니다.' : `LLM 검토 실패: ${redactPromptText(error instanceof Error ? error.message : String(error))}`;
    }).finally(() => {
      if (!disposed && controller === owner) { controller = null; run.disabled = false; cancel.disabled = true; }
    });
  });
  const stopReview = () => { controller?.abort(); controller = null; run.disabled = false; cancel.disabled = true; };
  const more = button('100개 더 보기', 'dialogue-more', () => { limit += 100; render(); });
  for (const control of [search, speaker, map]) control.addEventListener('input', () => { limit = 100; render(); });
  const root = el('section', { dataset: { testid: 'feature16-dialogue' }, children: [
    el('p', { text: '맵 이벤트의 대사·선택지를 모아 원문 페이지로 이동합니다. 검토는 읽기 전용이며 대사를 자동으로 바꾸지 않습니다.' }),
    el('div', { class: 'ai-authoring-filters', children: [field('대사 검색', search), field('화자', speaker), field('맵', map)] }),
    button('원문 새로 수집', 'dialogue-refresh', () => { stopReview(); rows = collectDialogue(store.getCurrent()); findings = []; limit = 100; refillFilters(); render(); renderFindings(); status.textContent = '원문을 새로 수집했습니다.'; }), count, list, more,
    el('h3', { text: '문체 규칙과 검토' }), field('문체 규칙 (프로젝트에 저장)', rules), field('구조 검사 최대 글자 수', maxChars),
    button('검토 규칙 저장', 'style-save', () => {
      const value = Number(maxChars.value);
      if (!Number.isInteger(value) || value < 1 || value > 10000) { status.textContent = '글자 수는 1~10000 사이 정수로 입력하세요.'; return; }
      saveSettings('대사 문체 규칙 저장', draft => { draft.dialogueStyleRules = rules.value; draft.maxDialogueChars = value; });
      findings = []; renderFindings(); status.textContent = '검토 규칙을 프로젝트에 반영했습니다.';
    }),
    el('div', { class: 'ai-authoring-actions', children: [button('필터 범위 구조 검사', 'review-structure', () => {
      stopReview(); findings = checkDialogueStructure(filtered(), settings().maxDialogueChars); renderFindings();
      status.textContent = `구조 검사 완료 (LLM 아님) · ${filtered().length}개 검사 · ${findings.length}개 지적`;
    }), run, cancel] }), status, findingsList,
  ] });
  refillFilters(); render();
  let sourceFingerprint = JSON.stringify(rows);
  let rulesFingerprint = settings().dialogueStyleRules;
  const unsubscribe = store.subscribe((_project, change) => {
    // Dialogue lives in events; tile painting emits per pointer sample.
    if (isTileCellChange(change)) return;
    const currentRows = collectDialogue(store.getCurrent());
    const fingerprint = JSON.stringify(currentRows);
    const nextRules = settings().dialogueStyleRules;
    if (fingerprint === sourceFingerprint && nextRules === rulesFingerprint) return;
    sourceFingerprint = fingerprint; rulesFingerprint = nextRules;
    stopReview(); findings = []; rows = currentRows;
    refillFilters(); render(); renderFindings();
    status.textContent = '원문 또는 규칙이 변경되어 목록을 갱신하고 이전 검토 결과를 비웠습니다.';
  });
  return { root, dispose: () => { disposed = true; controller?.abort(); unsubscribe(); } };
}
