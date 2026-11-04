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
  games: "first-run-my-games",
  game: "first-run-game",
  gamesMore: "first-run-my-games-more",
  gameFile: "first-run-open-game-file",
  aiStatus: "first-run-ai-status",
} as const;

/** 홈의 「내 게임」 줄에 놓는 카드 수(마지막 칸은 「빈 프로젝트」). 더 있으면 「모두 보기」. */
export const PROMPT_HOME_GAMES = 3;

/** 「내 게임」 줄 한 칸. 그림은 호출부(startScreen)의 coverArt 가 만든다 — 구운 그림이 data-cover-for 로 이 칸에 들어온다. */
export type PromptHomeGame = {
  readonly key: string;
  readonly title: string;
  readonly meta: string;
  readonly cover: HTMLElement;
};

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
  /** 예제 행 — 그 게임을 편집기에서 연다(플레이는 편집기 「테스트 실행」). */
  readonly builtinEdit: (id: BuiltinGameId) => void;
  readonly openFolder: () => void;
  readonly blank: () => void;
  /** 「내 게임」 카드 — 그 게임을 편집기에서 연다. */
  readonly openGame?: (key: string) => void;
  /** 「내 게임」 「모두 보기」 — 전체 목록 칸. */
  readonly allGames?: () => void;
  readonly openGameFile?: () => void;
  /** 오른쪽 위 AI 상태 글자 — 누르면 AI 설정. */
  readonly openAi?: () => void;
  /** 오른쪽 위 「⋯」 — 자주 쓰지 않는 것(새로 만들기 피드·에셋 스토어·설정). */
  readonly more?: readonly { readonly label: string; readonly testid: string; readonly run: () => void }[];
};

export type PromptHome = {
  readonly element: HTMLElement;
  focus(): void;
  /** 내 게임 줄을 다시 그린다. 빈 배열이면 줄을 감추고 처음 온 사람의 화면이 된다. */
  setGames(games: readonly PromptHomeGame[], total: number): void;
  setAiStatus(status: { readonly tone: "ok" | "warn" | "off"; readonly text: string }): void;
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

  // 오른쪽 위: AI 상태 글자 · 언어 · 「⋯」(자주 쓰지 않는 것). 예전 런처의 레일 바닥 줄이 여기로 왔다.
  const aiStatus = el("button", {
    class: "fr-ai", attrs: { type: "button", hidden: "" }, dataset: { testid: PROMPT_HOME_TESTIDS.aiStatus },
    on: { click: () => { if (!busy) actions.openAi?.(); } },
  });
  const moreItems = actions.more ?? [];
  const moreMenu = el("div", { class: "fr-more-menu", attrs: { role: "menu", hidden: "" }, children: moreItems.map((item) => el("button", {
    class: "fr-more-item", attrs: { type: "button", role: "menuitem" }, dataset: { testid: item.testid }, text: item.label,
    on: { click: () => { closeMore(); if (!busy) item.run(); } },
  })) });
  const moreButton = el("button", {
    class: "fr-more", attrs: { type: "button", "aria-label": "더 보기", "aria-haspopup": "menu", "aria-expanded": "false" },
    dataset: { testid: "first-run-more" }, text: "⋯",
    on: { click: () => { if (moreMenu.hidden) openMore(); else closeMore(); } },
  });
  const onOutside = (event: Event): void => { if (!moreWrap.contains(event.target as Node)) closeMore(); };
  const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") { closeMore(); moreButton.focus(); } };
  function openMore(): void {
    moreMenu.hidden = false; moreButton.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", onOutside); document.addEventListener("keydown", onKey);
  }
  function closeMore(): void {
    moreMenu.hidden = true; moreButton.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutside); document.removeEventListener("keydown", onKey);
  }
  const moreWrap = el("div", { class: "fr-more-wrap", children: moreItems.length ? [moreButton, moreMenu] : [] });

  // 「내 게임」 줄 — 다시 온 사람도 같은 한 장을 본다(2026-11-04, 어두운 레일 런처를 대신한다).
  const gamesRow = el("div", { class: "fr-games-row" });
  const gamesMore = link("모두 보기", PROMPT_HOME_TESTIDS.gamesMore, () => actions.allGames?.());
  const gamesSection = el("section", { class: "fr-games", attrs: { "aria-labelledby": "fr-games-h", hidden: "" }, dataset: { testid: PROMPT_HOME_TESTIDS.games }, children: [
    el("div", { class: "fr-builtin-head", children: [el("h2", { class: "fr-builtin-title", attrs: { id: "fr-games-h" }, text: "내 게임" }), gamesMore] }),
    gamesRow,
  ] });
  const blankCard = (): HTMLElement => el("button", {
    class: "fr-gcard fr-gcard-new", attrs: { type: "button" }, dataset: { testid: `${PROMPT_HOME_TESTIDS.game}-new` },
    on: { click: () => { if (!busy) actions.blank(); } },
    children: [el("span", { class: "fr-gcard-cov fr-gcard-plus", attrs: { "aria-hidden": "true" }, text: "+" }), el("span", { class: "fr-gcard-name", text: "빈 프로젝트" }), el("span", { class: "fr-gcard-meta", text: "AI 없이 직접 그리기" })],
  });
  const links = el("nav", { class: "fr-links" });
  const renderLinks = (hasGames: boolean): void => {
    links.replaceChildren(...(hasGames
      ? [link("폴더 열기", PROMPT_HOME_TESTIDS.openFolder, actions.openFolder), ...(actions.openGameFile ? [dot(), link("게임 파일 열기", PROMPT_HOME_TESTIDS.gameFile, actions.openGameFile)] : [])]
      : [link("폴더 열기", PROMPT_HOME_TESTIDS.openFolder, actions.openFolder), dot(), link("빈 프로젝트", PROMPT_HOME_TESTIDS.blank, actions.blank)]));
  };
  renderLinks(false);

  const root = el("div", { class: "fr-root", dataset: { testid: PROMPT_HOME_TESTIDS.root }, children: [
    el("header", { class: "fr-top", children: [
      el("span", { class: "fr-brand", attrs: { translate: "no" }, children: [el("span", { class: "fr-brand-mark", html: BRAND_MARK_SVG }), el("span", { text: "OPRN Studio" })] }),
      el("div", { class: "fr-top-right", children: [
        aiStatus,
        el("button", {
          class: "fr-locale", attrs: { type: "button", "aria-label": "언어" }, dataset: { testid: PROMPT_HOME_TESTIDS.locale },
          on: { click: () => { if (!busy) actions.openLocale(); } },
          children: [startIcon("globe", "fr-icon"), el("span", { text: LOCALE_NATIVE_NAMES[getLocale()], attrs: { translate: "no" } })],
        }),
        moreWrap,
      ] }),
    ] }),
    el("main", { class: "fr-main", children: [
      el("h1", { class: "fr-title", text: "어떤 게임을 만들까요?" }),
      el("p", { class: "fr-sub", text: "한 줄로 적으면 AI가 맵·인물·이야기를 지금 바로 만들어요." }),
      el("div", { class: "fr-composer", children: [input, el("div", { class: "fr-composer-foot", children: [attach, thumbs, fileInput, submit] })] }),
      el("div", { class: "fr-chips", attrs: { role: "group", "aria-label": "예시" }, children: chips }),
      gamesSection,
      // 「예제 열어 보기」 작은 행 세 개(2026-11-04, Studio/런타임 분리 B안 http://mdc-server:18301/studio-runtime-split.html).
      // 누르면 편집기에서 연다 — 첫 화면이 「할 게임 고르기」로 보이지 않게, 바로 플레이하는 그림 카드를 버렸다.
      el("section", { class: "fr-builtin", attrs: { "aria-labelledby": "fr-builtin-h" }, children: [
        el("div", { class: "fr-builtin-head", children: [
          el("h2", { class: "fr-builtin-title", attrs: { id: "fr-builtin-h" }, children: [
            el("span", { text: "예제 열어 보기" }),
            el("span", { class: "fr-builtin-tag", text: "고쳐 보며 배우기" }),
          ] }),
          link("모두 보기", PROMPT_HOME_TESTIDS.builtin, actions.builtin),
        ] }),
        el("div", { class: "fr-builtin-row", children: BUILTIN_GAMES.map((game) => el("button", {
          class: "fr-bcard", attrs: { type: "button", "aria-label": `${game.title} — 편집기에서 열기` },
          dataset: { testid: `${PROMPT_HOME_TESTIDS.builtinCard}-${game.id}` },
          on: { click: () => { if (!busy) actions.builtinEdit(game.id); } },
          children: [
            el("img", { class: "fr-bcard-img", attrs: { src: game.cover, alt: "", decoding: "async", loading: "lazy", draggable: "false" } }),
            el("span", { class: "fr-bcard-text", children: [
              el("span", { class: "fr-bcard-name", text: game.title.split(":")[0]!.trim(), attrs: { translate: "no" } }),
              el("span", { class: "fr-bcard-meta", text: game.genre }),
            ] }),
          ],
        })) }),
      ] }),
      links,
    ] }),
  ] });

  const setGames = (games: readonly PromptHomeGame[], total: number): void => {
    const has = games.length > 0;
    gamesSection.hidden = !has;
    root.classList.toggle("has-games", has);
    gamesMore.hidden = total <= PROMPT_HOME_GAMES;
    gamesMore.textContent = `${t("모두 보기")} (${total})`;
    gamesRow.replaceChildren(...games.slice(0, PROMPT_HOME_GAMES).map((game, index) => el("button", {
      class: "fr-gcard", attrs: { type: "button", title: game.title }, dataset: { testid: `${PROMPT_HOME_TESTIDS.game}-${index}` },
      on: { click: () => { if (!busy) actions.openGame?.(game.key); } },
      children: [game.cover, el("span", { class: "fr-gcard-name", text: game.title, attrs: { translate: "no" } }), el("span", { class: "fr-gcard-meta", text: game.meta })],
    })), ...(has ? [blankCard()] : []));
    renderLinks(has);
  };
  const setAiStatus = (status: { readonly tone: "ok" | "warn" | "off"; readonly text: string }): void => {
    aiStatus.hidden = false;
    aiStatus.dataset.tone = status.tone;
    aiStatus.replaceChildren(el("span", { class: "fr-ai-dot", attrs: { "aria-hidden": "true" } }), el("span", { text: status.tone === "ok" ? status.text : "AI 연결" }));
  };

  return { element: root, focus: () => input.focus(), setGames, setAiStatus };
}
