import { el } from '@/util/dom';
import { clearPromptInspection, latestPromptInspection, subscribePromptInspection } from '@/ai/authoring/promptInspection';
import { button, type FeaturePane } from './shared';
export function createPromptInspector(): FeaturePane {
  const content = el('div', { dataset: { testid: 'feature16-inspection-content' }, attrs: { 'aria-live': 'polite' } });
  const render = () => {
    const snapshot = latestPromptInspection();
    content.replaceChildren();
    if (!snapshot) { content.append(el('p', { text: '관측한 요청이 없습니다. AI에 요청하거나 대사 LLM 검토를 실행한 뒤 확인하세요. 아직 관측하지 않은 프롬프트를 재구성하지 않습니다.' })); return; }
    content.append(el('p', { text: `${new Date(snapshot.at).toLocaleString()} · ${snapshot.boundary} · ${snapshot.model}` }),
      el('p', { text: `약 ${snapshot.estimatedTokens.toLocaleString()} 토큰 (문자 수 ÷ 3의 거친 추정, 실제 과금 토큰 아님)` }),
      el('p', { text: snapshot.truncation }),
      el('p', { text: `실제 요청 도구 (${snapshot.toolNames.length}): ${snapshot.toolNames.join(', ') || '없음'}` }));
    for (const section of snapshot.sections) content.append(el('details', { children: [
      el('summary', { text: `${section.name} · ${section.characters.toLocaleString()}자${section.omittedCharacters ? ` · 표시에서 ${section.omittedCharacters.toLocaleString()}자 생략` : ''}` }),
      el('pre', { class: 'ai-authoring-preview', text: section.text }),
    ] }));
  };
  const root = el('section', { dataset: { testid: 'feature16-inspector' }, children: [
    el('p', { text: '가장 최근 전송 시도의 실제 본문입니다. 성공 여부를 뜻하지 않습니다. 키·인증 토큰·이미지는 가립니다. 메모리에만 보관하며 새 대화·프로젝트 전환·페이지 새로고침 또는 비우기로 제거됩니다.' }),
    button('관측 기록 비우기', 'inspection-clear', clearPromptInspection), content,
  ] });
  const dispose = subscribePromptInspection(render); render();
  return { root, dispose };
}
