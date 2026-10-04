// New project: choose an example, an empty project, or AI planning, then configure one screen.
// AI planning alone opens the connection gate and the paced interview.

import { el } from "@/util/dom";
import { registerModal, unregisterModal } from "./modalStack";
import { START_EXAMPLE_DETAILS, type ProjectStartMode } from "@/start/projectStart";
import "@/styles/shell/dialogs/project-start.css";
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
  readonly startMode?: ProjectStartMode;
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

export function showNewProjectDialog(opts: NewProjectDialogOptions = {}): Promise<NewProjectDialogResult | null> {
  const fallbackTitle = opts.defaultValue ?? "새 프로젝트";
  if (!domAvailable()) return Promise.resolve({ title: fallbackTitle, choiceId: opts.defaultChoiceId ?? null, screenSize: "classic", startMode: opts.defaultChoiceId ? START_EXAMPLE_DETAILS[opts.defaultChoiceId] ? "example" : "ai" : "blank" });
  return new Promise(resolve => {
    const opener = document.activeElement;
    const overlay = el("div", { class: "app-modal-overlay", dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.host } });
    const card = el("section", { class: "app-modal-card project-start-window", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "project-start-title" } });
    let choiceId: NewProjectChoiceId | null = opts.defaultChoiceId === undefined ? "story-cutscene" : opts.defaultChoiceId;
    let startMode: ProjectStartMode = opts.defaultChoiceId === undefined || (choiceId && !START_EXAMPLE_DETAILS[choiceId]) ? "ai" : "example";
    let choosing = opts.defaultChoiceId === null;
    let title = fallbackTitle;
    let screenSize: NewProjectScreenSize = "classic";
    let idea = "";
    let busy = false;
    let settled = false;
    const done = (result: NewProjectDialogResult | null) => {
      if (settled) return;
      settled = true; unregisterModal(overlay); overlay.remove(); resolve(result);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
    const button = (text: string, testid: string, action: () => void, primary = false) => el("button", {
      class: `app-modal-button${primary ? " is-confirm" : ""}`, text, attrs: { type: "button" }, dataset: { testid }, on: { click: action },
    });
    const choose = (id: NewProjectChoiceId | null, mode: ProjectStartMode) => {
      choiceId = id; startMode = mode; choosing = false;
      title = mode === "example" && id ? START_EXAMPLE_DETAILS[id]?.title ?? fallbackTitle : fallbackTitle;
      render();
    };
    const confirm = async () => {
      if (busy || settled) return;
      busy = true;
      const selection = { title: title.trim() || fallbackTitle, choiceId, screenSize, startMode };
      const confirmControl = card.querySelector<HTMLButtonElement>(`[data-testid="${NEW_PROJECT_DIALOG_TESTIDS.confirm}"]`);
      if (confirmControl) confirmControl.disabled = true;
      try {
        if (startMode !== "ai" || !choiceId) { done(selection); return; }
        if (opts.ensureAiConnected && !await opts.ensureAiConnected("새 게임 기획").catch(() => false)) return;
        if (settled) return;
        const brief = await showProjectInterview(choiceId, { initialAnswer: idea });
        if (brief && !settled) done({ ...selection, choiceId: brief.presetId, gameDesignBrief: brief });
      } finally { busy = false; if (!settled) render(); }
    };
    const render = () => {
      if (settled) return;
      card.replaceChildren(el("header", { class: "project-start-header", children: [
        el("div", { children: [el("span", { class: "project-start-kicker", text: choosing ? "새 프로젝트" : "새 게임" }), el("h2", { attrs: { id: "project-start-title" }, text: choosing ? "첫 게임, 작은 장면부터." : startMode === "ai" ? "AI와 게임 기획하기" : "이 장면으로 시작해 볼까요?" })] }),
        button(opts.cancelLabel ?? "취소", NEW_PROJECT_DIALOG_TESTIDS.cancel, () => done(null)),
      ] }));
      if (choosing) {
        card.append(el("p", { class: "project-start-hint", text: "플레이 가능한 예제로 시작하고, 하나씩 바꿔 보세요. 이미지는 장르 참고용입니다. 실제 예제는 작은 마을과 길에서 시작해요." }));
        card.append(el("div", { class: "project-start-examples", children: orderedChoices().map(choice => el("button", {
          class: "project-start-example", attrs: { type: "button" }, dataset: { testid: newProjectGenreOptionTestId(choice.id) }, on: { click: () => choose(choice.id, "example") }, children: [
            el("img", { attrs: { src: choice.thumb, alt: choice.label + " 참고 이미지", decoding: "async" } }),
            el("span", { class: "project-start-example-copy", children: [el("strong", { text: choice.label }), el("span", { text: START_EXAMPLE_DETAILS[choice.id]?.description ?? choice.blurb }), el("span", { class: "project-start-example-action", text: "예제로 시작하기 →" })] }),
          ],
        })) }));
        card.append(el("div", { class: "project-start-other", children: [el("span", { text: "직접 만들고 싶다면" }), button("빈 프로젝트", newProjectGenreOptionTestId(null), () => choose(null, "blank"))] }),
          el("div", { class: "project-start-other", children: [el("span", { text: "아이디어를 AI와 구체화하기" }), button("기획 시작하기", "new-project-ai", () => choose(orderedChoices()[0]?.id ?? null, "ai"))] }));
      } else {
        const choice = choiceId ? newProjectChoiceById(choiceId) : undefined;
        const details = choiceId ? START_EXAMPLE_DETAILS[choiceId] : undefined;
        const nameInput = el("input", { class: "app-modal-input", value: title, attrs: { type: "text", id: "project-start-name", maxlength: "80" }, dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.nameInput } }) as HTMLInputElement;
        nameInput.addEventListener("input", () => { title = nameInput.value; });
        const fields = el("div", { class: "project-start-fields", children: [
          el("label", { attrs: { for: "project-start-name" }, text: "게임 이름" }), nameInput,
        ] });
        if (startMode === "ai") {
          const input = el("textarea", { class: "app-modal-input", value: idea, attrs: { rows: "3", maxlength: "600", "aria-label": "만들고 싶은 게임", placeholder: "예: 눈 내리는 마을에서 잃어버린 기억을 찾는 이야기" } }) as HTMLTextAreaElement;
          input.addEventListener("input", () => { idea = input.value; });
          fields.append(el("label", { text: "아이디어 · 선택" }), input);
        }
        const sizes = el("div", { class: "project-start-size-options", children: NEW_PROJECT_SIZE_OPTIONS.map(size => {
          const radio = el("input", { attrs: { type: "radio", name: "project-start-size", value: size.id, ...(screenSize === size.id ? { checked: "" } : {}) }, dataset: { testid: NEW_PROJECT_DIALOG_TESTIDS.sizeOption + "-" + size.id } }) as HTMLInputElement;
          radio.addEventListener("change", () => { if (radio.checked) screenSize = size.id; });
          return el("label", { children: [radio, el("span", { text: size.label + " · " + size.blurb })] });
        }) });
        fields.append(el("label", { text: "화면 크기" }), sizes);
        card.append(el("div", { class: "project-start-setup", children: [el("section", { class: "project-start-preview", children: [
          ...(choice ? [el("img", { attrs: { src: startMode === "ai" ? "/assets/project-interview/world-poster.webp" : choice.thumb, alt: "게임의 세계 참고 이미지" } })] : []),
          el("div", { children: [el("h3", { text: startMode === "ai" ? "당신의 다음 이야기" : choice?.label ?? "빈 프로젝트" }), el("p", { text: startMode === "ai" ? "고르고, 만들기." : details?.description ?? "빈 맵에서 나만의 장면을 만들어요." }), ...(startMode === "ai" ? [] : [el("ul", { children: (details?.includes ?? ["빈 맵 한 개", "기본 타일과 캐릭터"]).map(text => el("li", { text })) })])] }),
        ] }), fields] }));
        card.append(el("footer", { class: "app-modal-actions", children: [button("시작 방식 다시 고르기", NEW_PROJECT_DIALOG_TESTIDS.back, () => { choosing = true; render(); }), button(opts.confirmLabel ?? (startMode === "ai" ? "다음 · 게임 기획" : choiceId ? "이 예제로 시작" : "프로젝트 만들기"), NEW_PROJECT_DIALOG_TESTIDS.confirm, () => void confirm(), true)] }));
      }
      const content = el("div", { class: "project-start-scroll" });
      for (const child of [...card.children]) {
        if (!child.classList.contains("project-start-header") && !child.classList.contains("app-modal-actions")) content.append(child);
      }
      card.querySelector(".project-start-header")?.after(content);
      card.querySelector<HTMLElement>(choosing ? ".project-start-example" : "input[type=text]")?.focus();
    };
    card.addEventListener("click", event => event.stopPropagation());
    card.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const controls = [...card.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, select, summary")].filter(control => !control.closest("details:not([open])") || control.tagName === "SUMMARY");
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    overlay.addEventListener("click", () => done(null)); overlay.append(card); document.body.append(overlay); registerModal(overlay, () => done(null)); render();
  });
}
