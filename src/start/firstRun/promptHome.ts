// start/firstRun/promptHome.ts
// 첫 사용자(보이는 게임 0개) 시작 화면 — 레일 없이 입력창 하나(설계 http://mdc-server:18301/oprn-first-run-proposal/ P1).
// 화면만 그린다. 만들기·폴더 열기·언어 같은 동작은 startScreen.ts 가 넘긴다.
// 문구는 한국어 원문으로 두고 DOM 번역 계층이 바꾼다. 칩을 눌러 입력창에 넣는 글자만 t() 로 화면 언어에 맞춘다.
import "./promptHome.css";
import { el } from "@/util/dom";
import { getLocale, LOCALE_NATIVE_NAMES, t } from "@/i18n";
import { startIcon } from "../icons";
import { BRAND_MARK_SVG } from "../brandMark";
import { FIRST_RUN_TEXT_LIMIT } from "./firstRunBrief";
import { BUILTIN_GAMES, type BuiltinGameId } from "../home/builtinGames";
import { MAX_USER_IMAGES } from "@/ai/piAgent/userImages";
import { shrinkReferenceImage } from "./referenceImage";

export const PROMPT_HOME_TESTIDS = {
  root: "first-run-home",
  input: "first-run-input",
  submit: "first-run-submit",
  chip: "first-run-chip",
  locale: "first-run-locale",
  builtin: "first-run-builtin",
  builtinCard: "first-run-builtin-card",
  openFolder: "first-run-open-folder",
  blank: "first-run-blank",
  attach: "first-run-attach",
  attachInput: "first-run-attach-input",
  attachThumb: "first-run-attach-thumb",
} as const;

const PAPERCLIP = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 7.6 8.1 12.7a3.3 3.3 0 0 1-4.7-4.7l5.4-5.4a2.2 2.2 0 0 1 3.1 3.1L6.6 11a1.1 1.1 0 0 1-1.6-1.6l4.8-4.8"/></svg>';

export const FIRST_RUN_EXAMPLES = [
  "조선에 떨어진 서양 마법사의 점집 개업기",
  "첫 파트너와 풀숲에서 몬스터를 모으는 모험",
  "10년 만에 사수로 다시 만난 선배와의 오피스 로맨스",
  "폐교에서 하룻밤을 버티는 공포 탈출",
] as const;

export type PromptHomeActions = {
  /** images: 참고 그림(축소한 data URL, 최대 2장). */
  readonly submit: (text: string, images: readonly string[]) => Promise<void>;
  readonly openLocale: () => void;
  readonly builtin: () => void;
  /** 기본 게임 카드 — 그 게임을 바로 플레이한다. */
  readonly builtinPlay: (id: BuiltinGameId) => void;
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
  // 참고 그림 — 고르거나 붙여 넣은 그림을 긴 변 768px 로 줄여 들고 있다가 「만들기 시작」 때 함께 넘긴다.
  let images: string[] = [];
  const fileInput = el("input", {
    class: "fr-attach-input",
    attrs: { type: "file", accept: "image/*", multiple: "", tabindex: "-1", "aria-hidden": "true" },
    dataset: { testid: PROMPT_HOME_TESTIDS.attachInput },
  });
  const attach = el("button", {
    class: "fr-attach",
    attrs: { type: "button", "aria-label": "참고 그림 붙이기" },
    dataset: { testid: PROMPT_HOME_TESTIDS.attach },
    children: [el("span", { class: "fr-icon", html: PAPERCLIP, attrs: { "aria-hidden": "true" } }), el("span", { text: "참고 그림" })],
    on: { click: () => { if (!busy && images.length < MAX_USER_IMAGES) fileInput.click(); } },
  });
  const thumbs = el("div", { class: "fr-thumbs" });
  const renderImages = (): void => {
    thumbs.replaceChildren(...images.map((url, index) => el("span", {
      class: "fr-thumb", dataset: { testid: `${PROMPT_HOME_TESTIDS.attachThumb}-${index}` },
      children: [
        el("img", { class: "fr-thumb-img", attrs: { src: url, alt: "", draggable: "false" } }),
        el("button", {
          class: "fr-thumb-remove", attrs: { type: "button", "aria-label": "참고 그림 빼기" },
          html: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m5 5 6 6M11 5l-6 6"/></svg>',
          on: { click: () => { if (busy) return; images = images.filter((_, i) => i !== index); renderImages(); } },
        }),
      ],
    })));
    attach.disabled = busy || images.length >= MAX_USER_IMAGES;
  };
  const addFiles = async (files: readonly File[]): Promise<void> => {
    for (const file of files) {
      if (images.length >= MAX_USER_IMAGES) break;
      if (!file.type.startsWith("image/")) continue;
      try { images = [...images, await shrinkReferenceImage(file)]; }
      catch (error) { console.warn("[start] 참고 그림을 읽지 못했습니다:", error); }
      renderImages();
    }
  };
  fileInput.addEventListener("change", () => {
    const files = [...(fileInput.files ?? [])];
    fileInput.value = "";
    void addFiles(files);
  });
  input.addEventListener("paste", (event) => {
    const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
    if (!files.length || busy) return;
    event.preventDefault();
    void addFiles(files);
  });
  const setBusy = (next: boolean): void => {
    busy = next;
    input.readOnly = next;
    submitLabel.textContent = next ? BUSY_LABEL : SUBMIT_LABEL;
    for (const chip of chips) chip.disabled = next;
    root.classList.toggle("is-busy", next);
    syncSubmit();
    renderImages();
  };
  const send = (): void => {
    const text = input.value.trim();
    if (busy || !text) return;
    setBusy(true);
    void actions.submit(text, images).finally(() => setBusy(false));
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
      el("span", { class: "fr-brand", attrs: { translate: "no" }, children: [el("span", { class: "fr-brand-mark", html: BRAND_MARK_SVG }), el("span", { text: "OPRN Studio" })] }),
      el("button", {
        class: "fr-locale", attrs: { type: "button", "aria-label": "언어" }, dataset: { testid: PROMPT_HOME_TESTIDS.locale },
        on: { click: () => { if (!busy) actions.openLocale(); } },
        children: [startIcon("globe", "fr-icon"), el("span", { text: LOCALE_NATIVE_NAMES[getLocale()], attrs: { translate: "no" } })],
      }),
    ] }),
    el("main", { class: "fr-main", children: [
      el("h1", { class: "fr-title", text: "어떤 게임을 만들까요?" }),
      el("p", { class: "fr-sub", text: "한 줄로 적으면 AI가 맵·인물·이야기를 지금 바로 만들어요." }),
      el("div", { class: "fr-composer", children: [input, el("div", { class: "fr-composer-foot", children: [attach, thumbs, fileInput, submit] })] }),
      el("div", { class: "fr-chips", attrs: { role: "group", "aria-label": "예시" }, children: chips }),
      // 목업: 「기본 게임으로 먼저 둘러보기」 썸네일 세 장(장르·분량 한 줄). 누르면 그 게임을 바로 플레이한다.
      el("section", { class: "fr-builtin", attrs: { "aria-labelledby": "fr-builtin-h" }, children: [
        el("div", { class: "fr-builtin-head", children: [
          el("h2", { class: "fr-builtin-title", attrs: { id: "fr-builtin-h" }, text: "기본 게임으로 먼저 둘러보기" }),
          link("모두 보기", PROMPT_HOME_TESTIDS.builtin, actions.builtin),
        ] }),
        el("div", { class: "fr-builtin-row", children: BUILTIN_GAMES.map((game) => el("button", {
          class: "fr-bcard", attrs: { type: "button", "aria-label": game.title },
          dataset: { testid: `${PROMPT_HOME_TESTIDS.builtinCard}-${game.id}` },
          on: { click: () => { if (!busy) actions.builtinPlay(game.id); } },
          children: [
            el("img", { class: "fr-bcard-img", attrs: { src: game.cover, alt: "", decoding: "async", loading: "lazy", draggable: "false" } }),
            el("span", { class: "fr-bcard-name", text: game.title.split(":")[0]!.trim(), attrs: { translate: "no" } }),
            el("span", { class: "fr-bcard-meta", text: game.genre }),
          ],
        })) }),
      ] }),
      el("nav", { class: "fr-links", children: [
        link("폴더 열기", PROMPT_HOME_TESTIDS.openFolder, actions.openFolder), dot(),
        link("빈 프로젝트", PROMPT_HOME_TESTIDS.blank, actions.blank),
      ] }),
    ] }),
  ] });

  return { element: root, focus: () => input.focus() };
}
