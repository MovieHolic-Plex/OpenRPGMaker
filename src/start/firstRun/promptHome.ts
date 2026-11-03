// start/firstRun/promptHome.ts
// 첫 사용자(보이는 게임 0개) 시작 화면 — 레일 없이 입력창 하나(설계 http://mdc-server:18301/oprn-first-run-proposal/ P1).
// 화면만 그린다. 만들기·폴더 열기·언어 같은 동작은 startScreen.ts 가 넘긴다.
// 문구는 한국어 원문으로 두고 DOM 번역 계층이 바꾼다. 칩을 눌러 입력창에 넣는 글자만 t() 로 화면 언어에 맞춘다.
import "./promptHome.css";
import { el } from "@/util/dom";
import { getLocale, LOCALE_NATIVE_NAMES, t } from "@/i18n";
import { startIcon } from "../icons";
import { FIRST_RUN_TEXT_LIMIT } from "./firstRunBrief";

export const PROMPT_HOME_TESTIDS = {
  root: "first-run-home",
  input: "first-run-input",
  submit: "first-run-submit",
  chip: "first-run-chip",
  locale: "first-run-locale",
  builtin: "first-run-builtin",
  openFolder: "first-run-open-folder",
  blank: "first-run-blank",
} as const;

export const FIRST_RUN_EXAMPLES = [
  "조선에 떨어진 서양 마법사의 점집 개업기",
  "첫 파트너와 풀숲에서 몬스터를 모으는 모험",
  "10년 만에 사수로 다시 만난 선배와의 오피스 로맨스",
  "폐교에서 하룻밤을 버티는 공포 탈출",
] as const;

export type PromptHomeActions = {
  readonly submit: (text: string) => Promise<void>;
  readonly openLocale: () => void;
  readonly builtin: () => void;
  readonly openFolder: () => void;
  readonly blank: () => void;
};

export type PromptHome = {
  readonly element: HTMLElement;
  focus(): void;
};

const SUBMIT_LABEL = "만들기 시작";
const BUSY_LABEL = "만드는 중…";

export function createPromptHome(actions: PromptHomeActions): PromptHome {
  let busy = false;
  const input = el("textarea", {
    class: "fr-input",
    attrs: {
      rows: "3", maxlength: String(FIRST_RUN_TEXT_LIMIT), spellcheck: "false",
      placeholder: "예: 회귀한 용사가 마왕의 비서로 취직하는 코믹 RPG", "aria-label": "만들고 싶은 게임",
    },
    dataset: { testid: PROMPT_HOME_TESTIDS.input },
  });
  const submitLabel = el("span", { text: SUBMIT_LABEL });
  const submit = el("button", {
    class: "fr-submit",
    attrs: { type: "button" },
    dataset: { testid: PROMPT_HOME_TESTIDS.submit },
    children: [submitLabel, startIcon("arrow", "fr-icon")],
  });
  const chips = FIRST_RUN_EXAMPLES.map((example, index) => el("button", {
    class: "fr-chip",
    attrs: { type: "button" },
    dataset: { testid: `${PROMPT_HOME_TESTIDS.chip}-${index}` },
    text: example,
    on: { click: () => { if (busy) return; input.value = t(example); syncSubmit(); input.focus(); } },
  }));
  const syncSubmit = (): void => { submit.disabled = busy || input.value.trim() === ""; };
  const setBusy = (next: boolean): void => {
    busy = next;
    input.readOnly = next;
    submitLabel.textContent = next ? BUSY_LABEL : SUBMIT_LABEL;
    for (const chip of chips) chip.disabled = next;
    root.classList.toggle("is-busy", next);
    syncSubmit();
  };
  const send = (): void => {
    const text = input.value.trim();
    if (busy || !text) return;
    setBusy(true);
    void actions.submit(text).finally(() => setBusy(false));
  };
  input.addEventListener("input", syncSubmit);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    send();
  });
  submit.addEventListener("click", send);
  syncSubmit();

  const link = (text: string, testid: string, run: () => void): HTMLButtonElement => el("button", {
    class: "fr-link", attrs: { type: "button" }, dataset: { testid }, text, on: { click: () => { if (!busy) run(); } },
  });
  const dot = (): HTMLElement => el("span", { class: "fr-dot", text: "·", attrs: { "aria-hidden": "true" } });

  const root = el("div", { class: "fr-root", dataset: { testid: PROMPT_HOME_TESTIDS.root }, children: [
    el("header", { class: "fr-top", children: [
      el("span", { class: "fr-brand", text: "OPRN Studio", attrs: { translate: "no" } }),
      el("button", {
        class: "fr-locale", attrs: { type: "button", "aria-label": "언어" }, dataset: { testid: PROMPT_HOME_TESTIDS.locale },
        on: { click: () => { if (!busy) actions.openLocale(); } },
        children: [startIcon("globe", "fr-icon"), el("span", { text: LOCALE_NATIVE_NAMES[getLocale()], attrs: { translate: "no" } })],
      }),
    ] }),
    el("main", { class: "fr-main", children: [
      el("h1", { class: "fr-title", text: "어떤 게임을 만들까요?" }),
      el("p", { class: "fr-sub", text: "한 줄로 적으면 AI가 맵·인물·이야기를 지금 바로 만들어요." }),
      el("div", { class: "fr-composer", children: [input, el("div", { class: "fr-composer-foot", children: [submit] })] }),
      el("div", { class: "fr-chips", attrs: { role: "group", "aria-label": "예시" }, children: chips }),
      el("nav", { class: "fr-links", children: [
        link("먼저 기본 게임 해 보기", PROMPT_HOME_TESTIDS.builtin, actions.builtin), dot(),
        link("폴더 열기", PROMPT_HOME_TESTIDS.openFolder, actions.openFolder), dot(),
        link("빈 프로젝트", PROMPT_HOME_TESTIDS.blank, actions.blank),
      ] }),
    ] }),
  ] });

  return { element: root, focus: () => input.focus() };
}
