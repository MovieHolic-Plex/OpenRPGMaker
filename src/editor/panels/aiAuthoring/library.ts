import { el } from '@/util/dom';
import { genId } from '@/util/id';
import { applyTemplate, templateSlots, TEMPLATE_BODY_LIMIT, type PromptTemplate } from '@/project/aiAuthoring';
import { button, field, input, saveSettings, settings, type FeaturePane } from './shared';

export function createPromptLibrary(apply: (text: string) => void, composer: string): FeaturePane {
  const search = input('library-search', '', 'search');
  const list = el('div', { class: 'ai-authoring-list', dataset: { testid: 'feature16-library-list' } });
  const editor = el('div', { class: 'ai-authoring-form' });
  const status = el('p', { attrs: { role: 'status' }, dataset: { testid: 'feature16-library-status' } });
  let selectedId: string | null = null;
  const name = input('template-name'); name.maxLength = 120;
  const tags = input('template-tags');
  const body = el('textarea', { attrs: { rows: '9', maxlength: String(TEMPLATE_BODY_LIMIT), placeholder: '예: {{인물}}의 {{장소}} 인사말을 작성해 줘.' }, dataset: { testid: 'feature16-template-body' } });
  const variables = el('div', { class: 'ai-authoring-variables', dataset: { testid: 'feature16-template-variables' } });
  const preview = el('pre', { class: 'ai-authoring-preview', dataset: { testid: 'feature16-template-preview' } });
  let values: Record<string, string> = Object.create(null);
  const updatePreview = () => {
    try { preview.textContent = applyTemplate(body.value, values); }
    catch (error) { preview.textContent = error instanceof Error ? error.message : String(error); }
  };
  const renderVariables = () => {
    variables.replaceChildren(...templateSlots(body.value).map((slot, index) => {
      const control = input(`slot-${index}`, values[slot] ?? '');
      control.addEventListener('input', () => { values[slot] = control.value; updatePreview(); });
      return field(slot, control);
    }));
    updatePreview();
  };
  const select = (template?: PromptTemplate) => {
    confirmingDelete = false; remove.textContent = '삭제';
    selectedId = template?.id ?? null;
    name.value = template?.name ?? '';
    tags.value = template?.tags.join(', ') ?? '';
    body.value = template?.body ?? '';
    values = Object.create(null);
    status.textContent = template ? `편집 중: ${template.name}` : '새 템플릿';
    remove.disabled = !template;
    renderVariables();
  };
  const renderList = () => {
    const query = search.value.trim().toLocaleLowerCase();
    const templates = settings().templates.filter(item => `${item.name} ${item.tags.join(' ')} ${item.body}`.toLocaleLowerCase().includes(query));
    list.replaceChildren(...templates.map(item => button(`${item.name}${item.tags.length ? ` · ${item.tags.join(', ')}` : ''}`, 'template-item', () => select(item))));
    if (!templates.length) list.append(el('p', { text: '저장된 템플릿이 없거나 검색 결과가 없습니다.' }));
  };
  const save = button('템플릿 저장', 'template-save', () => {
    if (!name.value.trim() || !body.value.trim()) { status.textContent = '이름과 본문을 입력하세요.'; return; }
    const nextTags = tags.value.split(',').map(tag => tag.trim()).filter(Boolean);
    if (nextTags.length > 30 || nextTags.some(tag => tag.length > 60)) { status.textContent = '태그는 30개까지, 각 60자 이내로 입력하세요.'; return; }
    const next: PromptTemplate = { id: selectedId ?? genId('prompt'), name: name.value.trim(), tags: nextTags, body: body.value };
    saveSettings('프롬프트 템플릿 저장', draft => {
      const index = draft.templates.findIndex(item => item.id === next.id);
      if (index >= 0) draft.templates[index] = next; else draft.templates.push(next);
    });
    select(next); renderList(); status.textContent = '프로젝트에 반영했습니다. 프로젝트 저장 상태에서 디스크/원격 저장을 확인하세요.';
  });
  let confirmingDelete = false;
  const remove = button('삭제', 'template-delete', () => {
    if (!selectedId) return;
    if (!confirmingDelete) { confirmingDelete = true; remove.textContent = '삭제 확인'; return; }
    saveSettings('프롬프트 템플릿 삭제', draft => { draft.templates = draft.templates.filter(item => item.id !== selectedId); });
    confirmingDelete = false; remove.textContent = '삭제'; select(); renderList();
  });
  name.addEventListener('input', () => { confirmingDelete = false; remove.textContent = '삭제'; });
  body.addEventListener('input', renderVariables);
  search.addEventListener('input', renderList);
  editor.append(field('이름', name), field('태그 (쉼표 구분)', tags), field('본문 · 변수는 {{이름}}', body),
    el('div', { class: 'ai-authoring-actions', children: [save, remove] }),
    el('h3', { text: '변수와 적용 미리보기' }), variables, preview,
    button('입력창에 덧붙이기', 'template-apply', () => {
      try {
        if (!body.value.trim()) throw new Error('본문을 입력하세요.');
        apply(applyTemplate(body.value, values));
      } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
    }));
  const root = el('section', { dataset: { testid: 'feature16-library' }, children: [
    el('p', { text: '이 프로젝트와 함께 저장됩니다. 적용은 입력창에 내용을 덧붙이며 AI에 자동 전송하지 않습니다.' }),
    field('템플릿 검색', search), button('새 템플릿', 'template-new', () => select()),
    button('현재 입력으로 만들기', 'template-from-composer', () => { select(); body.value = composer; renderVariables(); }),
    el('div', { class: 'ai-authoring-columns', children: [list, editor] }), status,
  ] });
  select(); renderList();
  return { root, dispose: () => undefined };
}
