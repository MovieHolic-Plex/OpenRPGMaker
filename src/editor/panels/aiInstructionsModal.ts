// editor/panels/aiInstructionsModal.ts
// 감독 지침 편집 — 이 프로젝트의 조수에게 **항상** 주는 고정 규칙(project.aiInstructions).
//
// 왜 프로젝트에 저장하는가: 지침은 그 게임의 성질("우리 게임은 4방향이다")이지 이 브라우저의
// 설정이 아니다. localStorage 에 두면 프로젝트를 옮긴 순간 규칙이 사라진다.
//
// 왜 대화에 적는 것으로는 안 되는가: 대화에 실린 지시는 압축·새 대화·복원에서 전부 사라진다.
// 이 블록은 시스템 프롬프트의 **예산 밖 고정분**으로 들어가 그 셋을 모두 통과한다
// (ai/projectInstructions.ts · contextBuilder.withProjectInstructions).

import { AI_INSTRUCTIONS_MAX_CHARS, normalizeAiInstructions } from "@/ai/projectInstructions";
import { recordAiUiEvent } from "@/ai/uiEventLog";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

let openBackdrop: HTMLElement | null = null;

export function closeAiInstructionsModal(): void {
  openBackdrop?.remove();
  openBackdrop = null;
}

export function openAiInstructionsModal(options: {
  /** 저장 후 세션 시스템 프롬프트를 갈아끼우도록 패널에 알린다. */
  readonly onSaved: (instructions: string) => void;
} = { onSaved: () => undefined }): HTMLElement {
  closeAiInstructionsModal();

  const current = normalizeAiInstructions(store.getCurrent().aiInstructions);
  const textarea = el("textarea", {
    class: "ai-instructions-input",
    attrs: {
      rows: "10",
      placeholder: "예) 이 게임은 4방향 이동이다. 전투는 턴제이고 사이드뷰를 쓰지 않는다. 타일셋 B 는 쓰지 마라.",
      "aria-label": "감독 지침",
      maxlength: String(AI_INSTRUCTIONS_MAX_CHARS),
    },
    dataset: { testid: "ai-instructions-input" },
    value: current,
  }) as HTMLTextAreaElement;

  const counter = el("span", {
    class: "ai-instructions-counter",
    dataset: { testid: "ai-instructions-counter" },
  });
  const refreshCounter = (): void => {
    counter.textContent = `${textarea.value.length} / ${AI_INSTRUCTIONS_MAX_CHARS}자`;
  };
  refreshCounter();
  textarea.addEventListener("input", refreshCounter);

  const saveButton = el("button", {
    class: "ai-assistant-action ai-instructions-save",
    text: "저장",
    attrs: { type: "button" },
    dataset: { testid: "ai-instructions-save" },
    on: {
      click: () => {
        const next = normalizeAiInstructions(textarea.value);
        if (next === current) {
          // 안 바뀐 저장도 남긴다 — 「지침을 저장했는데 안 먹었다」의 절반은 이 경로다.
          recordAiUiEvent({
            surface: "instructions-modal",
            action: AI_UI_ACTIONS.instructionsSave,
            testid: "ai-instructions-save",
            detail: { chars: next.length, changed: false },
          });
          close();
          return;
        }
        // 프로젝트 데이터를 바꾸는 편집이므로 되돌리기 스냅샷을 남긴다(다른 프로젝트 편집과 동일).
        recordProjectSnapshot("감독 지침 편집");
        recordAiUiEvent({
          surface: "instructions-modal",
          action: AI_UI_ACTIONS.instructionsSave,
          testid: "ai-instructions-save",
          detail: { chars: next.length, beforeChars: current.length, changed: true, cleared: next.length === 0 },
        });
        store.update((draft) => {
          if (next) draft.aiInstructions = next;
          else delete draft.aiInstructions;
        });
        options.onSaved(next);
        toast(next ? "감독 지침을 저장했습니다." : "감독 지침을 비웠습니다.", "ok");
        close();
      },
    },
  });

  const closeButton = el("button", {
    class: "database-modal-close",
    text: "×",
    attrs: { type: "button", "aria-label": "감독 지침 닫기" },
    dataset: { testid: "ai-instructions-close" },
  });

  const backdrop = el("div", {
    class: "database-modal-backdrop ai-instructions-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "ai-instructions-modal" },
    children: [
      el("section", {
        class: "database-modal-window ai-instructions-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "감독 지침" },
        children: [
          el("header", {
            class: "database-modal-header",
            children: [el("h2", { text: "감독 지침" }), closeButton],
          }),
          // `database-modal-body` 는 붙이지 않는다 — sidebar.css 의 (0,3,0) 규칙이 그 클래스에
          // `display:flex; flex-direction:row` 를 박아 안내·입력·저장이 가로로 늘어선다.
          // 자세한 근거는 aiConversationHistoryModal.ts 의 같은 자리 주석.
          el("div", {
            class: "ai-instructions-body",
            dataset: { testid: "ai-instructions-body" },
            children: [
              el("p", {
                class: "ai-instructions-note",
                text: "이 프로젝트의 조수에게 항상 주는 규칙입니다. 새 대화·대화 압축·대화 복원에도 남고, 다른 지침과 충돌하면 이쪽이 이깁니다.",
              }),
              textarea,
              el("div", { class: "ai-instructions-footer", children: [counter, saveButton] }),
            ],
          }),
        ],
      }),
    ],
  });

  const close = (): void => {
    unregisterModal(backdrop);
    backdrop.remove();
    openBackdrop = null;
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.body.append(backdrop);
  // Escape 는 공용 모달 스택이 라우팅한다 — 자체 document 리스너는 데이터베이스 모달의
  // Escape 핸들러와 같은 버블 단계라 등록 순서에 따라 바깥이 먼저 닫혔다.
  registerModal(backdrop, close);
  openBackdrop = backdrop;
  textarea.focus?.();
  return backdrop;
}
