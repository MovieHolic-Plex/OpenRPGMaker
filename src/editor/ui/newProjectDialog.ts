// editor/ui/newProjectDialog.ts
// 「새 프로젝트」 메뉴 다이얼로그 — 이름 입력 + 시작 장르 선택.
// 확인 → { title, packId }, 취소 → null. 헤드리스에서는 기본값으로 즉시 resolve.

import { GENRE_PACK_IDS, type GenrePackId } from "@/project/genrePackId";
import { WELCOME_GENRE_PRESETS } from "@/editor/welcomeGenrePresets";
import { el } from "@/util/dom";
import { registerModal, unregisterModal } from "./modalStack";

export type NewProjectDialogResult = {
  readonly title: string;
  /** null = 빈 프로젝트. 공식 팩이면 그 팩의 시스템 프리셋을 적용한다. */
  readonly packId: GenrePackId | null;
};

export type NewProjectDialogOptions = {
  readonly defaultValue?: string;
  readonly defaultPackId?: GenrePackId | null;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
};

export const NEW_PROJECT_DIALOG_TESTIDS = {
  host: "new-project-dialog",
  nameInput: "new-project-name-input",
  /** 장르 옵션 row — blank 또는 팩 id 가 접미사로 붙는다. */
  genreOption: "new-project-genre-option",
  confirm: "new-project-confirm",
  cancel: "new-project-cancel",
} as const;

export function newProjectGenreOptionTestId(id: GenrePackId | null): string {
  return `${NEW_PROJECT_DIALOG_TESTIDS.genreOption}-${id ?? "blank"}`;
}

type GenreOption = {
  readonly id: GenrePackId | null;
  readonly label: string;
  /** 한 줄 설명 — applyGenrePreset 가 실제로 켜는 것만 쓴다(과장 금지). */
  readonly blurb: string;
  /**
   * 장르 그림 — 기본은 첫 화면 포스터의 thumb 을 그대로 쓴다. 포스터가 그림을 나눠 갖는
   * 팩만 여기서 갈라 준다: 다이얼로그는 전부를 한 화면에 깔아 보이므로, 중복이 보이면
   * 골랐을 때 무엇이 달라지는지 읽히지 않는다.
   */
  readonly thumb?: string;
};

export const NEW_PROJECT_GENRE_OPTIONS: readonly GenreOption[] = [
  { id: null, label: "빈 프로젝트", blurb: "장르 설정 없이 빈 맵으로 시작합니다" },
  { id: "adventure-jrpg", label: "모험 JRPG", blurb: "파티 모험 · 던전 탐험용 기본 설정" },
  {
    id: "action-rpg",
    label: "2D 액션 RPG",
    blurb: "실시간 전투 시스템을 켭니다 — 싸울 맵은 따로 지정합니다",
    // 포스터 원반은 모험 JRPG 와 같은 slide-04 다. 필드 조작이 보이는 그림으로 갈라 둔다.
    thumb: "/assets/generated/welcome/slide-00-hero.png",
  },
  { id: "monster-collect", label: "몬스터 수집", blurb: "포획 · 도감 · 몬스터 파티 전투를 켭니다" },
  { id: "horror-chase", label: "공포 추격", blurb: "탐험 호러 — 장르 표시만 지정됩니다" },
  { id: "story-cutscene", label: "스토리 컷신", blurb: "회상 · 감정 연출 중심 — 장르 표시만 지정됩니다" },
  { id: "farm-life", label: "농장 생활", blurb: "시간 · 호감 · 농사 시스템을 켭니다" },
];

export function newProjectPackLabel(packId: GenrePackId | null): string {
  return NEW_PROJECT_GENRE_OPTIONS.find((option) => option.id === packId)?.label ?? "빈 프로젝트";
}

GENRE_PACK_IDS.forEach((id) => {
  if (!NEW_PROJECT_GENRE_OPTIONS.some((option) => option.id === id)) {
    throw new Error(`Missing new-project genre option for pack: ${id}`);
  }
});

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
  if (!domAvailable()) return Promise.resolve({ title: fallbackTitle, packId: opts.defaultPackId ?? null });
  return new Promise((resolve) => {
    const opener = typeof document !== "undefined" ? document.activeElement : null;
    const overlay = el("div", {
      class: "app-modal-overlay",
      dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.host },
    });
    let settled = false;
    let selectedPackId: GenrePackId | null = opts.defaultPackId ?? null;
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
      radio.checked = option.id === selectedPackId;
      radio.addEventListener("change", () => {
        if (radio.checked) selectedPackId = option.id;
      });
      // 장르 그림은 첫 화면 포스터와 같은 자산을 쓴다. 빈 프로젝트는 그림이 없으므로 +.
      // 자산이 없으면 img 를 떼어 격자 배경만 남긴다 — 깨진 그림 아이콘을 보여 주지 않는다.
      const thumb = option.thumb
        ?? WELCOME_GENRE_PRESETS.find((preset) => preset.packId === option.id)?.thumb;
      const art = el("span", {
        class: "new-project-genre-art",
        attrs: { "aria-hidden": "true" },
        children: [el("span", { class: "new-project-genre-placeholder", text: option.id ? option.label : "+" })],
      });
      if (thumb) {
        art.append(el("img", {
          attrs: { src: thumb, alt: "", decoding: "async", draggable: "false" },
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
      done({ title: nameInput.value.trim() || fallbackTitle, packId: selectedPackId });
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
