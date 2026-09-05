import { el } from "@/util/dom";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { materializeGenreBlankProjectSystemPreset } from "@/editor/genrePacks";
import { welcomeGenreSystemPresetPlanById } from "@/editor/welcomeGenrePresets";
import {
  WELCOME_GENRE_PRESETS,
  type WelcomeGenrePresetId,
} from "@/editor/welcomeGenrePresets";

export type NewProjectStarter =
  | { readonly kind: "blank" }
  | { readonly kind: "system-preset"; readonly presetId: WelcomeGenrePresetId };

export type NewProjectStarterOption = {
  readonly starter: NewProjectStarter;
  readonly label: string;
  readonly blurb: string;
};

export const NEW_PROJECT_STARTERS: readonly NewProjectStarterOption[] = [
  { starter: { kind: "blank" }, label: "빈 프로젝트", blurb: "아무 설정 없이 빈 맵에서 시작" },
  ...WELCOME_GENRE_PRESETS.map((preset) => ({
    starter: { kind: "system-preset", presetId: preset.id } as const,
    label: preset.label,
    blurb: preset.blurb,
  })),
];

export function resolveNewProjectStarterProject(starter: NewProjectStarter): Project {
  if (starter.kind === "blank") return createBlankProject();
  return materializeGenreBlankProjectSystemPreset(
    welcomeGenreSystemPresetPlanById(starter.presetId),
  ).project;
}

export type NewProjectDialogResult = {
  readonly title: string;
  readonly starter: NewProjectStarter;
} | null;

const NEW_PROJECT_TESTIDS = {
  modal: "new-project-modal",
  input: "new-project-title-input",
  starter: "new-project-starter",
  confirm: "new-project-confirm",
  cancel: "new-project-cancel",
} as const;

export function showNewProjectDialog(defaultTitle: string): Promise<NewProjectDialogResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: NewProjectDialogResult): void => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(value);
    };
    let selected: NewProjectStarter = { kind: "blank" };
    const input = el("input", {
      class: "app-modal-input",
      attrs: { type: "text", value: defaultTitle, placeholder: "예: 나의 첫 RPG", "aria-label": "프로젝트 이름" },
      dataset: { testid: NEW_PROJECT_TESTIDS.input },
    }) as HTMLInputElement;
    const starterList = el("div", {
      class: "new-project-starter-list",
      attrs: { role: "radiogroup", "aria-label": "시작 방식" },
    });
    const paintSelection = (): void => {
      for (const option of Array.from(starterList.querySelectorAll<HTMLElement>("[data-starter-index]"))) {
        const index = Number(option.dataset.starterIndex ?? "-1");
        const entry = NEW_PROJECT_STARTERS[index];
        const active = entry !== undefined
          && (entry.starter.kind === selected.kind
            && (entry.starter.kind === "blank"
              || (selected.kind === "system-preset" && entry.starter.presetId === selected.presetId)));
        option.classList.toggle("is-selected", active);
        option.setAttribute("aria-checked", active ? "true" : "false");
      }
    };
    NEW_PROJECT_STARTERS.forEach((entry, index) => {
      const card = el("button", {
        class: "new-project-starter-card",
        attrs: { type: "button", role: "radio", "aria-checked": index === 0 ? "true" : "false" },
        dataset: { testid: `${NEW_PROJECT_TESTIDS.starter}-${index}`, starterIndex: String(index) },
        children: [
          el("span", { class: "new-project-starter-label", text: entry.label }),
          el("span", { class: "new-project-starter-blurb", text: entry.blurb }),
        ],
        on: {
          click: () => {
            selected = entry.starter;
            paintSelection();
          },
        },
      });
      if (index === 0) card.classList.add("is-selected");
      starterList.append(card);
    });
    const confirmButton = el("button", {
      class: "app-modal-button is-confirm",
      text: "만들기",
      attrs: { type: "button" },
      dataset: { testid: NEW_PROJECT_TESTIDS.confirm },
      on: {
        click: () => {
          const title = input.value.trim() || defaultTitle;
          done({ title, starter: selected });
        },
      },
    });
    const cancelButton = el("button", {
      class: "app-modal-button",
      text: "취소",
      attrs: { type: "button" },
      dataset: { testid: NEW_PROJECT_TESTIDS.cancel },
      on: { click: () => done(null) },
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      done({ title: input.value.trim() || defaultTitle, starter: selected });
    });
    const card = el("div", {
      class: "app-modal-card new-project-card",
      attrs: { role: "dialog", "aria-modal": "true", "aria-label": "새 프로젝트" },
      children: [
        el("div", { class: "app-modal-title", text: "새 프로젝트" }),
        el("div", {
          class: "app-modal-message",
          text: "새 작업의 이름과 시작 방식을 정해 주세요. 지금 열려 있는 작업은 그대로 저장된 채 유지됩니다.",
        }),
        input,
        starterList,
        el("div", { class: "app-modal-actions", children: [cancelButton, confirmButton] }),
      ],
    });
    const overlay = el("div", {
      class: "app-modal-overlay",
      dataset: { testid: NEW_PROJECT_TESTIDS.modal },
    });
    card.addEventListener("click", (event) => event.stopPropagation());
    overlay.append(card);
    overlay.addEventListener("click", () => done(null));
    document.body.append(overlay);
    input.focus();
    input.select();
  });
}
