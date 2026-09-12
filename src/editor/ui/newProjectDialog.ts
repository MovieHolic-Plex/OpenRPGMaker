// editor/ui/newProjectDialog.ts
// 「새 프로젝트」 다이얼로그 — 이름 입력 + 시작 선택. 정본 목록은 newProjectChoices 다.
// 확인 → { title, choiceId }, 취소 → null. 헤드리스에서는 기본값으로 즉시 resolve.
//
// 2026-09-11 통합: 이 화면의 행 목록은 첫 화면 웰컴 브리핑 포스터와 **같은 레코드**에서 파생한다.
// 그전에는 같은 팩을 서로 다른 이름으로 보여 줬다(실측: story-cutscene = 첫 화면 "회상 스토리",
// 이 화면 "스토리 컷신"; horror-chase = 첫 화면 2장, 이 화면 1행). 그래서 첫 화면에서 고른 이름이
// 여기서 사라진 것처럼 보였다.

import { el } from "@/util/dom";
import { registerModal, unregisterModal } from "./modalStack";
import {
  NEW_PROJECT_DIALOG_CHOICE_ORDER,
  newProjectChoiceById,
  newProjectChoiceRowThumb,
  type NewProjectChoice,
  type NewProjectChoiceId,
} from "@/editor/newProjectChoices";

export type NewProjectDialogResult = {
  readonly title: string;
  /** null = 빈 프로젝트. 값이 있으면 그 선택지의 시스템 프리셋을 씨앗에 적용한다. */
  readonly choiceId: NewProjectChoiceId | null;
};

export type NewProjectDialogOptions = {
  readonly defaultValue?: string;
  readonly defaultChoiceId?: NewProjectChoiceId | null;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
};

export const NEW_PROJECT_DIALOG_TESTIDS = {
  host: "new-project-dialog",
  nameInput: "new-project-name-input",
  /** 선택지 row — blank 또는 선택지 id 가 접미사로 붙는다. */
  genreOption: "new-project-genre-option",
  confirm: "new-project-confirm",
  cancel: "new-project-cancel",
} as const;

export function newProjectGenreOptionTestId(id: NewProjectChoiceId | null): string {
  return `${NEW_PROJECT_DIALOG_TESTIDS.genreOption}-${id ?? "blank"}`;
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
 * 다이얼로그 행 목록 — 빈 프로젝트가 먼저, 그다음 정본 선택지가 첫 화면과 같은 순서로 온다.
 * 행 id 는 packId 가 아니라 **선택지 id** 다: horror-chase 처럼 한 팩에 이름이 둘인 경우
 * 팩 id 로는 어느 포스터를 골랐는지 되돌릴 수 없다.
 */
export const NEW_PROJECT_GENRE_OPTIONS: readonly NewProjectGenreOption[] = [
  { id: null, label: "빈 프로젝트", blurb: "장르 설정 없이 빈 맵으로 시작합니다" },
  ...orderedChoices().map(optionFromChoice),
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

export function showNewProjectDialog(opts: NewProjectDialogOptions = {}): Promise<NewProjectDialogResult | null> {
  const fallbackTitle = opts.defaultValue ?? "새 프로젝트";
  if (!domAvailable()) return Promise.resolve({ title: fallbackTitle, choiceId: opts.defaultChoiceId ?? null });
  return new Promise((resolve) => {
    const opener = typeof document !== "undefined" ? document.activeElement : null;
    const overlay = el("div", {
      class: "app-modal-overlay",
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.host },
    });
    let settled = false;
    let selectedChoiceId: NewProjectChoiceId | null = opts.defaultChoiceId ?? null;
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
          "aria-label": `${option.label} — ${option.blurb}`,
        },
        dataset: { testid: newProjectGenreOptionTestId(option.id) },
      }) as HTMLInputElement;
      radio.checked = option.id === selectedChoiceId;
      radio.addEventListener("change", () => {
        if (radio.checked) selectedChoiceId = option.id;
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

    const confirmSelection = (): void => {
      done({ title: nameInput.value.trim() || fallbackTitle, choiceId: selectedChoiceId });
    };

    const confirmButton = el("button", {
      class: "app-modal-button is-confirm",
      text: opts.confirmLabel ?? "만들기",
      attrs: { type: "button" },
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.confirm },
      on: { click: confirmSelection },
    });
    const cancelButton = el("button", {
      class: "app-modal-button",
      text: opts.cancelLabel ?? "취소",
      attrs: { type: "button" },
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.cancel },
      on: { click: () => done(null) },
    });
    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirmSelection();
      }
    });

    const card = el("div", {
      class: "app-modal-card new-project-card",
      attrs: { role: "dialog", "aria-modal": "true", "aria-label": "새 프로젝트" },
      children: [
        el("div", { class: "app-modal-title", text: "새 프로젝트" }),
        el("div", {
          class: "app-modal-message",
          text: "이름을 정하고 시작 장르를 고르세요. 지금 열려 있는 작업은 그대로 저장된 채 유지됩니다.",
        }),
        nameInput,
        el("div", {
          class: "new-project-genre-list",
          attrs: { role: "radiogroup", "aria-label": "시작 장르" },
          children: optionRows,
        }),
        el("div", { class: "app-modal-actions", children: [cancelButton, confirmButton] }),
      ],
    });
    card.addEventListener("click", (event) => event.stopPropagation());
    overlay.append(card);
    overlay.addEventListener("click", () => done(null));
    document.body.append(overlay);
    registerModal(overlay, () => done(null));
    if (typeof nameInput.focus === "function") nameInput.focus();
    if (typeof nameInput.select === "function") nameInput.select();
  });
}
