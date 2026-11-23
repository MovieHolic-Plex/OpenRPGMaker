// editor/panels/aiAnswerLinkRender.ts
// 조수 답변 마크다운의 유일한 렌더 진입점. 마크다운을 그린 뒤 저작물 이름을 이동 버튼으로 바꾼다.
//
// 왜 렌더 후처리인가: 이름은 인라인 문법이 아니라 **본문 텍스트**다. `renderMarkdown` 안에 넣으면
// 세계관 문서·AI 문서 블록처럼 프로젝트 이동과 무관한 마크다운까지 전부 링크가 걸린다. 여기서
// 후처리하면 대상은 "조수가 방금 한 말" 로 한정된다.
import { buildEditorReferenceIndex, findEditorReferences, type EditorReferenceIndex, type EditorReferenceTarget } from "@/editor/aiAnswerLinks";
import { navigateToEditorReference } from "@/editor/editorReferenceNavigation";
import { prefillAiAssistantInput, sendAiBootIntent } from "@/editor/aiBootIntent";
import { splitNextSteps } from "@/ai/nextSteps";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { renderMarkdown } from "@/util/markdown";

/** 이 안의 글자는 산문이 아니다 — 코드·기존 링크·버튼 안에는 손대지 않는다. */
const SKIP_TAGS = new Set(["PRE", "CODE", "A", "BUTTON", "TEXTAREA", "INPUT"]);

export type ReferenceNavigator = (target: EditorReferenceTarget) => boolean;

/**
 * 프로젝트 객체당 색인 하나만 만들어 재사용한다.
 *
 * 기록 복원은 말풍선을 수백 개 연달아 그리는데, 색인은 맵·이벤트 전수를 한 번 훑는다 — 부드마다
 * 다시 만들면 (맵 × 이벤트) 무게에 부드 수까지 곱해진다. `store.getCurrent()` 는 변경 전에는
 * 같은 객체를 돌려주므로 객체당 캐싱이 그대로 무효화 장치가 된다.
 */
const indexByProject = new WeakMap<object, EditorReferenceIndex>();

function liveReferenceIndex(): EditorReferenceIndex {
  const project = store.getCurrent();
  const cached = indexByProject.get(project);
  if (cached) return cached;
  const index = buildEditorReferenceIndex(project);
  indexByProject.set(project, index);
  return index;
}

/** 조수/시스템 말풍선 본문. 마크다운 + 내부 이동 링크 + (첫 판 뒤) 다음 단계 칩. */
export function renderAssistantAnswer(text: string): HTMLElement {
  const { body, steps } = splitNextSteps(text);
  const root = renderMarkdown(body);
  decorateEditorReferences(root, liveReferenceIndex());
  if (steps.length) root.append(nextStepChips(steps));
  return root;
}

/** 누르면 그 문장을 조수에게 보낸다(보낼 수 없는 상태면 입력창에 담기만). */
export function nextStepChips(steps: readonly string[]): HTMLElement {
  return el("div", {
    class: "ai-next-steps",
    dataset: { testid: "ai-next-steps" },
    attrs: { role: "group", "aria-label": "다음에 해 볼 것" },
    children: steps.map((step) => el("button", {
      class: "ai-next-step-chip",
      text: step,
      attrs: { type: "button" },
      dataset: { testid: "ai-next-step-chip" },
      on: { click: (event) => { event.preventDefault(); if (!sendAiBootIntent(step)) prefillAiAssistantInput(step); } },
    })),
  });
}

/**
 * 이미 그려진 트리의 텍스트 노드에서 색인된 이름을 찾아 이동 버튼으로 바꾼다.
 * 돌려주는 값은 만든 링크 수 — 0 이면 아무것도 건드리지 않았다는 뜻이다.
 */
export function decorateEditorReferences(
  root: HTMLElement,
  index: EditorReferenceIndex,
  navigate: ReferenceNavigator = navigateToEditorReference
): number {
  if (index.entries.length === 0) return 0;
  let created = 0;

  const visit = (node: Node): void => {
    const tagName = (node as { tagName?: unknown }).tagName;
    if (typeof tagName === "string") {
      if (SKIP_TAGS.has(tagName.toUpperCase())) return;
      // 자식을 바꾸므로 스냅샷을 돌린다.
      for (const child of [...node.childNodes]) visit(child);
      return;
    }
    const text = node.textContent ?? "";
    const spans = findEditorReferences(text, index);
    if (spans.length === 0) return;

    const pieces: Node[] = [];
    let cursor = 0;
    for (const span of spans) {
      if (span.start > cursor) pieces.push(document.createTextNode(text.slice(cursor, span.start)));
      pieces.push(referenceButton(span.label, span.target, navigate));
      created += 1;
      cursor = span.end;
    }
    if (cursor < text.length) pieces.push(document.createTextNode(text.slice(cursor)));
    (node as unknown as { replaceWith: (...nodes: Node[]) => void }).replaceWith(...pieces);
  };

  for (const child of [...root.childNodes]) visit(child);
  return created;
}

function referenceButton(label: string, target: EditorReferenceTarget, navigate: ReferenceNavigator): HTMLElement {
  const title = target.kind === "ambiguous"
    ? `'${label}' — 같은 이름이 ${target.count}곳 있습니다. 찾기에서 고르세요`
    : `'${label}' 위치로 이동`;
  return el("button", {
    class: "ai-answer-link",
    text: label,
    attrs: { type: "button", title },
    dataset: { testid: "ai-answer-link", refKind: target.kind, refLabel: label },
    on: {
      click: (event) => {
        event.preventDefault();
        event.stopPropagation();
        navigate(target);
      },
    },
  });
}
