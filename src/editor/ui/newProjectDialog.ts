// editor/ui/newProjectDialog.ts
// 「새 프로젝트」 인터뷰 다이얼로그 — 한 질문에 한 답.
// 확인 → NewProjectDialogResult, 취소 → null. 헤드리스에서는 기본값으로 즉시 resolve.
//
// 2026-09-11 통합: 행 목록은 첫 화면 웰컴 브리핑 포스터와 같은 레코드에서 파생한다(이름 통일).
// 2026-09-21 인터뷰화: 장르 격자 하나에 이름·선택지가 다 같이 보이던 것을 3단계 질문으로 나눈다.
//   ① 이름 ② 무엇을 만들까요 ③ 게임 화면 크기 — 마지막에 요약을 확인하고 만든다.
//   "해상도"라는 말은 값이 커질수록 캐릭터가 작아지는 반직관 효과 때문에 초보자에게 오해를 부른다.
//   그래서 질문은 "게임 화면 크기"로 물어보고 프리셋은 느낌(클래식/와이드)으로 답하게 한다.
//
// DOM 계약: 모든 단계의 입력이 항상 DOM 에 있다(숨김은 hidden 토글). 기존 testid
// (new-project-name-input, new-project-genre-option-*, new-project-confirm)가 그대로 통한다.

import { el } from "@/util/dom";
import { registerModal, unregisterModal } from "./modalStack";
import { showProjectInterview } from "./projectInterviewDialog";
import type { GameDesignBrief } from "@/project/gameDesignBrief";
import {
  NEW_PROJECT_DIALOG_CHOICE_ORDER,
  newProjectChoiceById,
  newProjectChoiceRowThumb,
  type NewProjectChoice,
  type NewProjectChoiceId,
} from "@/editor/newProjectChoices";

/** 게임 화면 크기 프리셋 — 논리 뷰포트(playResolution)의 느낌 이름. */
export type NewProjectScreenSize = "classic" | "wide";

export type NewProjectDialogResult = {
  readonly title: string;
  /** null = 빈 프로젝트. 값이 있으면 그 선택지의 시스템 프리셋을 씨앗에 적용한다. */
  readonly choiceId: NewProjectChoiceId | null;
  /** 게임 화면 크기. classic = 320×240(기본), wide = 640×360. */
  readonly screenSize: NewProjectScreenSize;
  readonly gameDesignBrief?: GameDesignBrief;
};

export type NewProjectDialogOptions = {
  readonly defaultValue?: string;
  readonly defaultChoiceId?: NewProjectChoiceId | null;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /**
   * 장르를 고르고 확인하면 기획 인터뷰 **전에** 부른다. false 면 다이얼로그에 남는다(빈 프로젝트는 부르지 않는다).
   * 장르 프리셋은 AI 팀이 첫 생성을 맡으므로, 연결 없이 인터뷰를 끝까지 하게 두지 않는다.
   */
  readonly ensureAiConnected?: (presetLabel: string) => Promise<boolean>;
};

export const NEW_PROJECT_DIALOG_TESTIDS = {
  host: "new-project-dialog",
  nameInput: "new-project-name-input",
  /** 선택지 row — blank 또는 선택지 id 가 접미사로 붙는다. */
  genreOption: "new-project-genre-option",
  sizeOption: "new-project-size-option",
  back: "new-project-back",
  next: "new-project-next",
  progress: "new-project-progress",
  confirm: "new-project-confirm",
  cancel: "new-project-cancel",
} as const;

export function newProjectGenreOptionTestId(id: NewProjectChoiceId | null): string {
  return NEW_PROJECT_DIALOG_TESTIDS.genreOption + "-" + (id ?? "blank");
}

export type NewProjectGenreOption = {
  readonly id: NewProjectChoiceId | null;
  readonly label: string;
  /** 한 줄 설명 — 첫 화면 포스터 자막과 같은 문구를 쓴다(과장 금지). */
  readonly blurb: string;
  /** 포스터 그림. 정본 선택지에서 그대로 온다 — 두 표면이 같은 그림을 보여 준다. */
  readonly thumb?: string;
};

function optionFromChoice(choice: NewProjectChoice): NewProjectGenreOption {
  return { id: choice.id, label: choice.label, blurb: choice.blurb, thumb: newProjectChoiceRowThumb(choice) };
}

function orderedChoices(): readonly NewProjectChoice[] {
  return NEW_PROJECT_DIALOG_CHOICE_ORDER
    .map((id) => newProjectChoiceById(id))
    .filter((choice): choice is NewProjectChoice => choice !== undefined);
}

/**
 * 다이얼로그 행 목록 — 빈 프로젝트가 먼저, 그다음 시작 UI가 지원하는 세 장르가 첫 화면과 같은 순서로 온다.
 * 행 id 는 packId 가 아니라 선택지 id 다.
 */
export const NEW_PROJECT_GENRE_OPTIONS: readonly NewProjectGenreOption[] = [
  { id: null, label: "빈 프로젝트", blurb: "장르 설정 없이 빈 맵으로 시작합니다" },
  ...orderedChoices().map(optionFromChoice),
];

export const NEW_PROJECT_SIZE_OPTIONS: readonly {
  readonly id: NewProjectScreenSize;
  readonly label: string;
  readonly blurb: string;
}[] = [
  { id: "classic", label: "클래식", blurb: "도트가 크게 보여요 (320×240 · 4:3)" },
  { id: "wide", label: "와이드", blurb: "요즘 비율로 넓게 보여요 (640×360 · 16:9)" },
];

/** 토스트·요약 문구용 표시 이름. 다이얼로그 밖(menu.ts)이 같은 문자열을 다시 적지 않게 한다. */
export function newProjectChoiceLabel(choiceId: NewProjectChoiceId | null): string {
  if (choiceId === null) return "빈 프로젝트";
  return newProjectChoiceById(choiceId)?.label ?? "빈 프로젝트";
}

function domAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function" &&
    Boolean(document.body)
  );
}

const STEP_COUNT = 3;

export function showNewProjectDialog(opts: NewProjectDialogOptions = {}): Promise<NewProjectDialogResult | null> {
  const fallbackTitle = opts.defaultValue ?? "새 프로젝트";
  if (!domAvailable()) {
    return Promise.resolve({ title: fallbackTitle, choiceId: opts.defaultChoiceId ?? null, screenSize: "classic" });
  }
  return new Promise((resolve) => {
    const opener = typeof document !== "undefined" ? document.activeElement : null;
    const overlay = el("div", {
      class: "app-modal-overlay",
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.host },
    });
    let settled = false;
    let interviewing = false;
    let step = 0;
    let selectedChoiceId: NewProjectChoiceId | null = opts.defaultChoiceId ?? null;
    let selectedSize: NewProjectScreenSize = "classic";
    const done = (value: NewProjectDialogResult | null): void => {
      if (settled) return;
      settled = true;
      unregisterModal(overlay);
      overlay.remove();
      resolve(value);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };

    const nameInput = el("input", {
      class: "app-modal-input",
      attrs: {
        type: "text",
        value: fallbackTitle,
        placeholder: "예: 나의 첫 RPG",
        "aria-label": "새 프로젝트 이름",
      },
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.nameInput },
    }) as HTMLInputElement;

    const optionRows = NEW_PROJECT_GENRE_OPTIONS.map((option) => {
      const radio = el("input", {
        class: "new-project-genre-radio",
        attrs: {
          type: "radio",
          name: "new-project-genre",
          value: option.id ?? "",
          "aria-label": option.label + " — " + option.blurb,
        },
        dataset: { testid: newProjectGenreOptionTestId(option.id) },
      }) as HTMLInputElement;
      radio.checked = option.id === selectedChoiceId;
      radio.addEventListener("change", () => {
        if (radio.checked) {
          selectedChoiceId = option.id;
          confirmButton.textContent = opts.confirmLabel ?? (option.id ? "다음 · 게임 기획" : "만들기");
        }
      });
      // 장르 그림은 첫 화면 포스터와 같은 자산을 쓴다. 빈 프로젝트는 그림이 없으므로 +.
      // 자산이 없으면 img 를 떼어 격자 배경만 남긴다 — 깨진 그림 아이콘을 보여 주지 않는다.
      const art = el("span", {
        class: "new-project-genre-art",
        attrs: { "aria-hidden": "true" },
        children: [el("span", { class: "new-project-genre-placeholder", text: option.id ? option.label : "+" })],
      });
      if (option.thumb) {
        art.append(el("img", {
          attrs: { src: option.thumb, alt: "", decoding: "async", draggable: "false" },
          on: { error: (event) => (event.currentTarget as HTMLElement).remove() },
        }));
      }
      return el("label", {
        class: "new-project-genre-row",
        children: [
          radio,
          art,
          el("span", {
            class: "new-project-genre-text",
            children: [
              el("span", { class: "new-project-genre-label", text: option.label }),
              el("span", { class: "new-project-genre-blurb", text: option.blurb }),
            ],
          }),
        ],
      });
    });

    const sizeRows = NEW_PROJECT_SIZE_OPTIONS.map((option) => {
      const radio = el("input", {
        class: "new-project-choice-radio",
        attrs: {
          type: "radio",
          name: "new-project-size",
          value: option.id,
          "aria-label": option.label + " — " + option.blurb,
        },
        dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.sizeOption + "-" + option.id },
      }) as HTMLInputElement;
      radio.checked = option.id === selectedSize;
      radio.addEventListener("change", () => {
        if (radio.checked) { selectedSize = option.id; refreshSummaryIfVisible(); }
      });
      return el("label", {
        class: "new-project-choice-row",
        children: [
          radio,
          el("span", {
            class: "new-project-size-preview",
            attrs: { "aria-hidden": "true" },
            children: [el("span", {
              class: "new-project-size-preview-box",
              dataset: { sizePreset: option.id },
            })],
          }),
          el("span", {
            class: "new-project-choice-text",
            children: [
              el("span", { class: "new-project-choice-label", text: option.label }),
              el("span", { class: "new-project-choice-blurb", text: option.blurb }),
            ],
          }),
        ],
      });
    });

    const stepQuestion = (text: string): HTMLElement =>
      el("div", { class: "new-project-question", text });
    const stepName = el("div", {
      class: "new-project-step",
      dataset: { testid: "new-project-step-name" },
      children: [stepQuestion("게임 이름을 정하세요"), nameInput],
    });
    const stepGenre = el("div", {
      class: "new-project-step",
      dataset: { testid: "new-project-step-genre" },
      children: [
        stepQuestion("무엇을 만들고 싶나요?"),
        el("div", {
          class: "new-project-genre-list",
          attrs: { role: "radiogroup", "aria-label": "시작 장르" },
          children: optionRows,
        }),
      ],
    });
    const stepSize = el("div", {
      class: "new-project-step",
      dataset: { testid: "new-project-step-size" },
      children: [
        stepQuestion("게임 화면은 어느 쪽이 좋나요?"),
        el("div", {
          class: "new-project-choice-list",
          attrs: { role: "radiogroup", "aria-label": "게임 화면 크기" },
          children: sizeRows,
        }),
        el("div", {
          class: "new-project-summary",
          dataset: { testid: "new-project-summary" },
          text: "",
        }),
      ],
    });
    const stepPanels = [stepName, stepGenre, stepSize];

    const progress = el("span", {
      class: "new-project-progress",
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.progress },
      text: "",
    });

    const STEP_QUESTIONS = ["이름", "장르", "화면"];

    const backButton = el("button", {
      class: "app-modal-button",
      text: "뒤로",
      attrs: { type: "button" },
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.back },
      on: { click: () => showStep(Math.max(0, step - 1)) },
    });
    const nextButton = el("button", {
      class: "app-modal-button is-confirm",
      text: "다음",
      attrs: { type: "button" },
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.next },
      on: { click: () => showStep(Math.min(STEP_COUNT - 1, step + 1)) },
    });
    const confirmButton = el("button", {
      class: "app-modal-button is-confirm",
      text: opts.confirmLabel ?? (selectedChoiceId ? "다음 · 게임 기획" : "만들기"),
      attrs: { type: "button" },
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.confirm },
      on: { click: () => void confirmSelection() },
    });
    const cancelButton = el("button", {
      class: "app-modal-button",
      text: opts.cancelLabel ?? "취소",
      attrs: { type: "button" },
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.cancel },
      on: { click: () => done(null) },
    });

    function summaryText(): string {
      const size = NEW_PROJECT_SIZE_OPTIONS.find((option) => option.id === selectedSize)?.label ?? "클래식";
      return "이렇게 만듭니다 — " + (nameInput.value.trim() || fallbackTitle) + " · "
        + newProjectChoiceLabel(selectedChoiceId) + " · " + size;
    }

    /** 마지막 단계에서라도 방금 고른 선택이 요약에 즉시 반영돼야 한다. */
    function refreshSummaryIfVisible(): void {
      if (step !== STEP_COUNT - 1) return;
      const summary = stepSize.querySelector<HTMLElement>("[data-testid='new-project-summary']");
      if (summary) summary.textContent = summaryText();
    }

    function showStep(next: number): void {
      step = Math.max(0, Math.min(STEP_COUNT - 1, next));
      for (const [index, panel] of stepPanels.entries()) {
        panel.hidden = index !== step;
      }
      progress.textContent = "설정 " + String(step + 1) + "/" + String(STEP_COUNT) + " · " + STEP_QUESTIONS[step]!;
      backButton.hidden = step === 0;
      nextButton.hidden = step === STEP_COUNT - 1;
      confirmButton.hidden = step !== STEP_COUNT - 1;
      if (step === STEP_COUNT - 1) {
        const summary = stepSize.querySelector<HTMLElement>("[data-testid='new-project-summary']");
        if (summary) summary.textContent = summaryText();
      }
    }

    async function confirmSelection(): Promise<void> {
      if (interviewing || settled) return;
      const selection = { title: nameInput.value.trim() || fallbackTitle, choiceId: selectedChoiceId, screenSize: selectedSize };
      if (!selection.choiceId) { done(selection); return; }
      interviewing = true;
      confirmButton.disabled = true;
      try {
        if (opts.ensureAiConnected) {
          const connected = await opts.ensureAiConnected(newProjectChoiceLabel(selection.choiceId)).catch(() => false);
          if (!connected || settled) return;
        }
        const gameDesignBrief = await showProjectInterview(selection.choiceId);
        if (gameDesignBrief && !settled) done({ ...selection, gameDesignBrief });
      } finally { interviewing = false; confirmButton.disabled = false; }
    }

    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        showStep(1);
      }
    });

    const card = el("div", {
      class: "app-modal-card new-project-card",
      attrs: { role: "dialog", "aria-modal": "true", "aria-label": "새 프로젝트" },
      children: [
        el("div", {
          class: "new-project-header",
          children: [
            el("div", { class: "app-modal-title", text: "새 프로젝트" }),
            progress,
          ],
        }),
        el("div", {
          class: "app-modal-message",
          text: "지금 열려 있는 작업은 그대로 보존됩니다.",
        }),
        ...stepPanels,
        el("div", { class: "app-modal-actions", children: [cancelButton, backButton, nextButton, confirmButton] }),
      ],
    });
    card.addEventListener("click", (event) => event.stopPropagation());
    overlay.append(card);
    overlay.addEventListener("click", () => done(null));
    document.body.append(overlay);
    registerModal(overlay, () => done(null));
    showStep(0);
    if (typeof nameInput.focus === "function") nameInput.focus();
    if (typeof nameInput.select === "function") nameInput.select();
  });
}
