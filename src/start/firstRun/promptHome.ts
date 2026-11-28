// start/firstRun/promptHome.ts
// 첫 사용자(보이는 게임 0개) 시작 화면 — 절제된 사선 블레이드 5종 + 3키워드(무대·주인공·사건) 자유 조합.
// 재방문자(게임 1개 이상)나 「직접 적기」를 누른 사용자는 같은 한 장 안의 프롬프트·내 게임 뷰로 전환한다.
// 문구는 한국어 원문으로 두고 DOM 번역 계층이 바꾼다.
import "./promptHome.css";
import { el } from "@/util/dom";
import { getLocale, LOCALE_NATIVE_NAMES, t } from "@/i18n";
import { startIcon } from "../icons";
import { BRAND_MARK_SVG } from "../brandMark";
import { FIRST_RUN_TEXT_LIMIT } from "./firstRunBrief";
import {
  BLADE_KEYWORD_POOLS,
  BLADE_SLOT_ROLES,
  FIRST_RUN_BLADES,
  composeBladeSentence,
  findPlaceTilesetHint,
  pickRandomKeyword,
  rollKeywordSlots,
  type FirstRunBlade,
  type FirstRunBladeSelection,
} from "./firstRunBlades";
import { BUILTIN_GAMES, type BuiltinGameId } from "../home/builtinGames";
import type { AiStatusSummary } from "../settings/localAgents";
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
  error: "first-run-error",
  blades: "first-run-blades",
  blade: "first-run-blade",
  sheet: "first-run-blade-sheet",
  slot: "first-run-slot",
  slotInput: "first-run-slot-input",
  slotRoll: "first-run-slot-roll",
  slotLock: "first-run-slot-lock",
  rerollAll: "first-run-reroll-all",
  bladeBack: "first-run-blade-back",
  bladeSubmit: "first-run-blade-submit",
  directToggle: "first-run-direct-toggle",
  bladesToggle: "first-run-blades-toggle",
} as const;

/** 홈의 「내 게임」 줄에 놓는 카드 수(마지막 칸은 「빈 프로젝트」). 더 있으면 「모두 보기」. */
export const PROMPT_HOME_GAMES = 3;

/** 「내 게임」 줄 한 칸. 그림은 호출부(startScreen)의 coverArt 가 만든다 — 구운 그림이 data-cover-for 로 이 칸에 들어온다. */
export type PromptHomeGame = {
  readonly key: string;
  readonly title: string;
  readonly titleIsDefault?: boolean;
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
  /** 자유 프롬프트 제출. images: 참고 그림(축소한 data URL, 최대 2장). */
  readonly submit: (text: string, images: readonly string[]) => Promise<void>;
  /** 사선 블레이드 + 3키워드 조합 즉시 제출(런처 LLM 초안 대기 생략). 없으면 submit 으로 폴백. */
  readonly submitBlade?: (selection: FirstRunBladeSelection) => Promise<void>;
  readonly openLocale: () => void;
  readonly builtin: () => void;
  /** 예제 행 — 그 게임을 편집기에서 연다(실행은 편집기 「테스트 실행」). */
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
  syncLocale(): void;
  /** 내 게임 줄을 다시 그린다. 빈 배열이면 첫 실행(사선 블레이드) 화면이 된다. */
  setGames(games: readonly PromptHomeGame[], total: number): void;
  setAiStatus(status: AiStatusSummary): void;
  /** 만들기 실패 문구를 입력칸·시트 바로 아래에 둔다. 빈 문자열이면 감춘다. */
  setError(message: string): void;
  /** 오른쪽 상단 끝에 붙일 보조 컨트롤(예: 앱 업데이트 녹색 아이콘). */
  setTrailing(node: HTMLElement | null): void;
};

const SUBMIT_LABEL = "만들기 시작";
const BLADE_SUBMIT_LABEL = "만들기 →";
const BUSY_LABEL = "만드는 중…";

export function createPromptHome(actions: PromptHomeActions): PromptHome {
  let busy = false;
  let totalGames = 0;
  /** 사용자가 명시적으로 뷰를 바꿨는지 — 게임 목록 비동기 로드가 사용자 클릭을 덮지 않게. */
  let manualMode: "blades" | "direct" | null = null;
  let bladesMode = true;
  let activeBladeIdx = 0;
  let sheetOpen = false;
  let slotValues: [string, string, string] = ["", "", ""];
  let slotLocks: [boolean, boolean, boolean] = [false, false, false];

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
  let exampleIndex = 0;
  const chips = [el("button", {
    class: "fr-chip",
    attrs: { type: "button", title: "누를 때마다 다른 예시를 입력창에 넣어요" },
    dataset: { testid: `${PROMPT_HOME_TESTIDS.chip}-0` },
    text: "예시 넣기",
    on: { click: () => {
      if (busy) return;
      input.value = t(FIRST_RUN_EXAMPLES[exampleIndex % FIRST_RUN_EXAMPLES.length]!);
      exampleIndex += 1;
      syncSubmit();
      input.focus();
    } },
  })];
  const syncSubmit = (): void => { submit.disabled = busy || input.value.trim() === ""; };

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

  const errorLine = el("p", { class: "cf-error", attrs: { role: "alert", hidden: "" }, dataset: { testid: PROMPT_HOME_TESTIDS.error } });
  const sheetErrorLine = el("p", { class: "fr-sheet-error", attrs: { role: "alert", hidden: "" } });
  const setError = (message: string): void => {
    errorLine.textContent = message;
    errorLine.hidden = message === "";
    sheetErrorLine.textContent = message;
    sheetErrorLine.hidden = message === "";
  };

  const bladeSubmitBtn = el("button", {
    class: "fr-pick-btn",
    attrs: { type: "button" },
    dataset: { testid: PROMPT_HOME_TESTIDS.bladeSubmit },
    text: BLADE_SUBMIT_LABEL,
  });
  const rerollAllBtn = el("button", {
    class: "fr-ghost-pill",
    attrs: { type: "button" },
    dataset: { testid: PROMPT_HOME_TESTIDS.rerollAll },
    text: "↻ 다시 섞기",
  });
  const bladeBackBtn = el("button", {
    class: "fr-ghost-pill",
    attrs: { type: "button" },
    dataset: { testid: PROMPT_HOME_TESTIDS.bladeBack },
    text: "← 다른 장르",
  });

  const setBusy = (next: boolean): void => {
    busy = next;
    input.readOnly = next;
    submitLabel.textContent = next ? BUSY_LABEL : SUBMIT_LABEL;
    bladeSubmitBtn.textContent = next ? BUSY_LABEL : BLADE_SUBMIT_LABEL;
    bladeSubmitBtn.disabled = next;
    rerollAllBtn.disabled = next;
    bladeBackBtn.disabled = next;
    for (const chip of chips) chip.disabled = next;
    for (const slotInput of slotsHost.querySelectorAll<HTMLInputElement>(".fr-slot-input")) slotInput.readOnly = next;
    root.classList.toggle("is-busy", next);
    syncSubmit();
    renderImages();
  };

  const send = (): void => {
    const text = input.value.trim();
    if (busy || !text) return;
    setError("");
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

  const submitCurrentBlade = (): void => {
    if (busy) return;
    const blade: FirstRunBlade = FIRST_RUN_BLADES[activeBladeIdx] ?? FIRST_RUN_BLADES[0]!;
    const cleaned: [string, string, string] = [
      slotValues[0].trim(),
      slotValues[1].trim(),
      slotValues[2].trim(),
    ];
    const tilesetHint = findPlaceTilesetHint(cleaned[0]);
    const selection: FirstRunBladeSelection = {
      blade,
      keywords: cleaned,
      ...(tilesetHint ? { tilesetHint } : {}),
    };
    setError("");
    setBusy(true);
    const work = actions.submitBlade
      ? actions.submitBlade(selection)
      : actions.submit(composeBladeSentence(blade, cleaned), []);
    void work.finally(() => setBusy(false));
  };
  bladeSubmitBtn.addEventListener("click", submitCurrentBlade);

  const link = (text: string, testid: string, run: () => void): HTMLButtonElement => el("button", {
    class: "fr-link", attrs: { type: "button" }, dataset: { testid }, text, on: { click: () => { if (!busy) run(); } },
  });

  // ── 상단 막대 ──────────────────────────────────────────────────────────
  const directToggle = el("button", {
    class: "fr-top-action",
    attrs: { type: "button" },
    dataset: { testid: PROMPT_HOME_TESTIDS.directToggle },
    text: "직접 적기",
    on: { click: () => { if (!busy) { manualMode = "direct"; applyMode(); input.focus(); } } },
  });
  const bladesToggle = el("button", {
    class: "fr-top-action",
    attrs: { type: "button" },
    dataset: { testid: PROMPT_HOME_TESTIDS.bladesToggle },
    text: "장르 고르기",
    on: { click: () => { if (!busy) { manualMode = "blades"; closeSheet(false); applyMode(); } } },
  });
  const topBlankBtn = el("button", {
    class: "fr-top-action",
    attrs: { type: "button" },
    text: "빈 프로젝트",
    on: { click: () => { if (!busy) actions.blank(); } },
  });
  const aiStatus = el("button", {
    class: "fr-ai", attrs: { type: "button", hidden: "" }, dataset: { testid: PROMPT_HOME_TESTIDS.aiStatus },
    on: { click: () => { if (!busy) actions.openAi?.(); } },
  });
  const moreItems = actions.more ?? [];
  const menuItem = (label: string, testid: string, run: () => void): HTMLButtonElement => el("button", {
    class: "fr-more-item", attrs: { type: "button", role: "menuitem" }, dataset: { testid }, text: label,
    on: { click: () => { closeMore(); moreButton.focus(); if (!busy) run(); } },
  });
  const fileItems = el("div", { class: "fr-more-group", attrs: { role: "none" } });
  const moreMenu = el("div", { class: "fr-more-menu", attrs: { role: "menu", hidden: "" }, children: [
    fileItems,
    ...moreItems.map((item) => menuItem(item.label, item.testid, item.run)),
  ] });
  const moreButton = el("button", {
    class: "fr-more", attrs: { type: "button", "aria-label": "더 보기", "aria-haspopup": "menu", "aria-expanded": "false" },
    dataset: { testid: "first-run-more" }, text: "⋯",
    on: { click: () => { if (moreMenu.hidden) openMore(); else closeMore(); } },
  });
  const onOutside = (event: Event): void => { if (!moreWrap.contains(event.target as Node)) closeMore(); };
  const onMoreKey = (event: KeyboardEvent): void => { if (event.key === "Escape") { closeMore(); moreButton.focus(); } };
  function openMore(): void {
    moreMenu.hidden = false; moreButton.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", onOutside); document.addEventListener("keydown", onMoreKey);
  }
  function closeMore(): void {
    moreMenu.hidden = true; moreButton.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutside); document.removeEventListener("keydown", onMoreKey);
  }
  const moreWrap = el("div", { class: "fr-more-wrap", children: [moreButton, moreMenu] });

  // ── 1단계 사선 블레이드 + 2단계 3키워드 조합 시트 ──────────────────────
  const bladeTrack = el("div", { class: "fr-blades-track" });
  const sheetTitle = el("h2", { class: "fr-sheet-title" });
  const slotsHost = el("div", { class: "fr-slots" });
  const sheet = el("section", {
    class: "fr-sheet",
    attrs: { "aria-label": "키워드 조합", "aria-hidden": "true", inert: "" },
    dataset: { testid: PROMPT_HOME_TESTIDS.sheet },
    children: [
      el("div", { class: "fr-sheet-top", children: [sheetTitle, bladeBackBtn] }),
      slotsHost,
      sheetErrorLine,
      el("div", { class: "fr-sheet-foot", children: [rerollAllBtn, bladeSubmitBtn] }),
    ],
  });
  sheet.inert = true;
  let sheetOpener: HTMLElement | null = null;

  const bladeNodes: HTMLElement[] = FIRST_RUN_BLADES.map((blade, idx) => {
    const pickBtn = el("button", {
      class: "fr-pick-btn",
      attrs: { type: "button" },
      text: "선택 →",
      on: { click: (event) => {
        event.stopPropagation();
        if (!busy && !sheetOpen) openSheet(idx);
      } },
    });
    const node = el("div", {
      class: `fr-blade${idx === activeBladeIdx ? " is-active" : ""}`,
      attrs: { role: "button", tabindex: "0", "aria-label": blade.title },
      dataset: { testid: `${PROMPT_HOME_TESTIDS.blade}-${blade.id}`, bladeId: blade.id },
      children: [
        el("div", { class: "fr-blade-inner", children: [
          el("div", { class: "fr-blade-art", attrs: { "aria-hidden": "true" } }),
          el("div", { class: "fr-blade-vignette", attrs: { "aria-hidden": "true" } }),
          el("div", { class: "fr-blade-line", attrs: { "aria-hidden": "true" } }),
          el("div", { class: "fr-blade-spine", attrs: { "aria-hidden": "true" }, children: [el("span", { text: blade.spine })] }),
          el("div", { class: "fr-blade-copy", children: [
            el("div", { class: "fr-blade-copy-left", children: [
              el("span", { class: "fr-blade-kicker", text: blade.kicker }),
              el("h2", { class: "fr-blade-title", text: blade.title }),
              el("p", { class: "fr-blade-desc", text: blade.desc }),
            ] }),
            pickBtn,
          ] }),
        ] }),
      ],
    });
    node.style.setProperty("--fr-blade-tone", blade.tone);
    const art = node.querySelector<HTMLElement>(".fr-blade-art");
    if (art) art.style.backgroundImage = `url("${blade.image}")`;

    node.addEventListener("mouseenter", () => {
      if (busy || sheetOpen || activeBladeIdx === idx) return;
      activeBladeIdx = idx;
      syncBladeActive();
    });
    node.addEventListener("focus", () => {
      if (busy || sheetOpen || activeBladeIdx === idx) return;
      activeBladeIdx = idx;
      syncBladeActive();
    });
    node.addEventListener("click", () => {
      if (busy || sheetOpen) return;
      if (activeBladeIdx !== idx) {
        activeBladeIdx = idx;
        syncBladeActive();
        return;
      }
      openSheet(idx);
    });
    node.addEventListener("keydown", (event) => {
      if (busy || sheetOpen) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSheet(idx);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        activeBladeIdx = (idx + 1) % FIRST_RUN_BLADES.length;
        syncBladeActive();
        bladeNodes[activeBladeIdx]?.focus();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        activeBladeIdx = (idx - 1 + FIRST_RUN_BLADES.length) % FIRST_RUN_BLADES.length;
        syncBladeActive();
        bladeNodes[activeBladeIdx]?.focus();
      }
    });
    return node;
  });
  bladeTrack.append(...bladeNodes);

  function syncBladeActive(): void {
    bladeNodes.forEach((node, idx) => {
      node.classList.toggle("is-active", idx === activeBladeIdx);
    });
  }

  function renderSlots(rollingIndices: readonly number[] = []): void {
    const active = document.activeElement;
    const focusedTestId = active instanceof HTMLElement && slotsHost.contains(active) ? (active.dataset.testid ?? null) : null;
    const blade = FIRST_RUN_BLADES[activeBladeIdx] ?? FIRST_RUN_BLADES[0]!;
    sheetTitle.textContent = blade.title;
    slotsHost.replaceChildren(...BLADE_SLOT_ROLES.map((role, idx) => {
      const locked = slotLocks[idx] === true;
      const slotInput = el("input", {
        class: "fr-slot-input",
        value: slotValues[idx] ?? "",
        attrs: { type: "text", maxlength: "40", placeholder: t(role.label), "aria-label": role.label, spellcheck: "false" },
        dataset: { testid: `${PROMPT_HOME_TESTIDS.slotInput}-${role.id}` },
      });
      slotInput.readOnly = busy;
      const lockBtn = el("button", {
        class: "fr-slot-btn is-lock",
        attrs: { type: "button", "aria-label": locked ? "고정 해제" : "고정", "aria-pressed": String(locked) },
        dataset: { testid: `${PROMPT_HOME_TESTIDS.slotLock}-${role.id}` },
        text: locked ? "🔒" : "🔓",
        on: { click: () => {
          if (busy) return;
          slotLocks[idx] = !slotLocks[idx];
          renderSlots();
        } },
      });
      const rollBtn = el("button", {
        class: "fr-slot-btn is-roll",
        attrs: { type: "button", "aria-label": `${role.label} 다시 뽑기` },
        dataset: { testid: `${PROMPT_HOME_TESTIDS.slotRoll}-${role.id}` },
        text: "↻",
        on: { click: () => {
          if (busy) return;
          slotLocks[idx] = false;
          slotValues[idx] = pickRandomKeyword(BLADE_KEYWORD_POOLS[idx]!, slotValues[idx]);
          renderSlots([idx]);
        } },
      });
      const box = el("div", {
        class: `fr-slot${locked ? " is-locked" : ""}${rollingIndices.includes(idx) ? " is-rolling" : ""}`,
        dataset: { testid: `${PROMPT_HOME_TESTIDS.slot}-${role.id}` },
        children: [
          el("div", { class: "fr-slot-head", children: [
            el("span", { class: "fr-slot-role", text: role.label }),
            el("div", { class: "fr-slot-btns", children: [rollBtn, lockBtn] }),
          ] }),
          slotInput,
        ],
      });
      box.style.setProperty("--fr-blade-tone", blade.tone);
      slotInput.addEventListener("input", () => {
        slotValues[idx] = slotInput.value;
        // 직접 타이핑한 슬롯은 자동 고정되어 전체 셔플에서 덮어쓰이지 않는다.
        if (!slotLocks[idx] && slotInput.value.trim() !== "") {
          slotLocks[idx] = true;
          box.classList.add("is-locked");
          lockBtn.textContent = "🔒";
          lockBtn.setAttribute("aria-pressed", "true");
        }
      });
      slotInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.isComposing) {
          event.preventDefault();
          submitCurrentBlade();
        }
      });
      return box;
    }));
    if (focusedTestId) {
      slotsHost.querySelector<HTMLElement>(`[data-testid="${focusedTestId}"]`)?.focus();
    }
  }

  function openSheet(idx: number): void {
    sheetOpener = document.activeElement instanceof HTMLElement ? document.activeElement : bladeNodes[idx] ?? null;
    activeBladeIdx = idx;
    sheetOpen = true;
    slotLocks = [false, false, false];
    slotValues = rollKeywordSlots(slotValues, slotLocks);
    syncBladeActive();
    bladeTrack.classList.add("is-locked");
    sheet.inert = false;
    sheet.removeAttribute("inert");
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    setError("");
    renderSlots([0, 1, 2]);
    slotsHost.querySelector<HTMLInputElement>(".fr-slot-input")?.focus();
  }

  function closeSheet(restoreFocus = true): void {
    const wasOpen = sheetOpen;
    sheetOpen = false;
    bladeTrack.classList.remove("is-locked");
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    sheet.inert = true;
    sheet.setAttribute("inert", "");
    setError("");
    if (wasOpen && restoreFocus) {
      const target = sheetOpener && root.contains(sheetOpener) ? sheetOpener : bladeNodes[activeBladeIdx];
      target?.focus();
    }
    sheetOpener = null;
  }

  rerollAllBtn.addEventListener("click", () => {
    if (busy) return;
    const rolled: number[] = [];
    for (let i = 0; i < 3; i += 1) if (!slotLocks[i]) rolled.push(i);
    slotValues = rollKeywordSlots(slotValues, slotLocks);
    renderSlots(rolled);
  });
  bladeBackBtn.addEventListener("click", () => {
    if (!busy) closeSheet();
  });

  const bladesStage = el("section", {
    class: "fr-blades-stage",
    attrs: { "aria-label": "장르 선택" },
    dataset: { testid: PROMPT_HOME_TESTIDS.blades },
    children: [bladeTrack, sheet],
  });

  // ── 「내 게임」 줄 · 예제 줄 (기존 홈 뷰) ─────────────────────────────
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
  const renderLinks = (hasGames: boolean): void => {
    fileItems.replaceChildren(...(hasGames
      ? [menuItem("폴더 열기", PROMPT_HOME_TESTIDS.openFolder, actions.openFolder), ...(actions.openGameFile ? [menuItem("게임 파일 열기", PROMPT_HOME_TESTIDS.gameFile, actions.openGameFile)] : [])]
      : [menuItem("폴더 열기", PROMPT_HOME_TESTIDS.openFolder, actions.openFolder), menuItem("빈 프로젝트", PROMPT_HOME_TESTIDS.blank, actions.blank)]));
  };
  renderLinks(false);
  const localeLabel = el("span", { attrs: { "data-i18n-skip": "" } });
  const syncLocale = (): void => {
    const locale = getLocale();
    localeLabel.textContent = LOCALE_NATIVE_NAMES[locale];
    localeLabel.lang = locale;
  };
  syncLocale();

  const mainView = el("main", { class: "fr-main", children: [
    el("h1", { class: "fr-title", text: "어떤 게임을 만들까요?" }),
    el("p", { class: "fr-sub", text: "한 줄로 적으면 AI가 맵·인물·이야기를 지금 바로 만들어요." }),
    el("div", { class: "fr-composer", children: [input, el("div", { class: "fr-composer-foot", children: [attach, thumbs, fileInput, submit] })] }),
    errorLine,
    el("div", { class: "fr-chips", attrs: { role: "group", "aria-label": "예시" }, children: chips }),
    gamesSection,
    el("details", { class: "fr-builtin cf-browse", attrs: { "aria-labelledby": "fr-builtin-h" }, dataset: { testid: "first-run-builtin-toggle" }, children: [
      el("summary", { class: "fr-builtin-head", children: [
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
            el("span", { class: "fr-bcard-name", text: game.title.split(":")[0]!.trim() }),
            el("span", { class: "fr-bcard-meta", text: game.genre }),
          ] }),
        ],
      })) }),
    ] }),
  ] });

  const trailingSlot = el("span", { attrs: { style: "display:contents" } });
  const root = el("div", { class: "fr-root is-blades", dataset: { testid: PROMPT_HOME_TESTIDS.root }, children: [
    el("header", { class: "fr-top", children: [
      el("span", { class: "fr-brand", attrs: { translate: "no" }, children: [el("span", { class: "fr-brand-mark", html: BRAND_MARK_SVG }), el("span", { text: "OPRN Studio" })] }),
      el("div", { class: "fr-top-right", children: [directToggle, bladesToggle, topBlankBtn, aiStatus, moreWrap, trailingSlot] }),
    ] }),
    bladesStage,
    mainView,
  ] });

  fileItems.before(el("button", {
    class: "fr-more-item fr-locale", attrs: { type: "button", role: "menuitem", "aria-label": "언어" }, dataset: { testid: PROMPT_HOME_TESTIDS.locale },
    on: { click: () => { closeMore(); moreButton.focus(); if (!busy) actions.openLocale(); } },
    children: [startIcon("globe", "fr-icon"), localeLabel],
  }));

  function applyMode(): void {
    bladesMode = manualMode !== null ? manualMode === "blades" : totalGames === 0;
    root.classList.toggle("is-blades", bladesMode);
    directToggle.hidden = !bladesMode;
    topBlankBtn.hidden = !bladesMode;
    bladesToggle.hidden = bladesMode;
    directToggle.textContent = totalGames > 0 ? "내 게임" : "직접 적기";
  }
  applyMode();

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || busy || event.defaultPrevented) return;
    if (bladesMode && sheetOpen) {
      event.preventDefault();
      closeSheet();
    } else if (!bladesMode && totalGames === 0 && manualMode === "direct") {
      event.preventDefault();
      manualMode = "blades";
      applyMode();
    }
  });

  const setGames = (games: readonly PromptHomeGame[], total: number): void => {
    totalGames = total;
    const has = games.length > 0;
    gamesSection.hidden = total === 0;
    root.classList.toggle("has-games", has);
    gamesMore.hidden = total === 0;
    gamesMore.textContent = `모두 보기 (${total})`;
    gamesRow.replaceChildren(...games.slice(0, PROMPT_HOME_GAMES).map((game, index) => el("button", {
      class: "fr-gcard", attrs: { type: "button" }, dataset: { testid: `${PROMPT_HOME_TESTIDS.game}-${index}` },
      on: { click: () => { if (!busy) actions.openGame?.(game.key); } },
      children: [game.cover, el("span", {
        class: "fr-gcard-name", text: game.title,
        attrs: { title: game.title, ...(game.titleIsDefault ? {} : { "data-i18n-skip": "" }) },
      }), el("span", { class: "fr-gcard-meta", text: game.meta })],
    })), ...(has ? [blankCard()] : []));
    renderLinks(has);
    applyMode();
  };

  const setAiStatus = (status: AiStatusSummary): void => {
    aiStatus.hidden = false;
    aiStatus.dataset.tone = status.tone;
    const label = el("span", { text: status.tone === "ok" ? status.text : "AI 연결" });
    if (status.tone === "ok" && status.model) {
      label.append(" · ", el("bdi", { attrs: { "data-i18n-skip": "" }, text: status.model }));
    }
    aiStatus.replaceChildren(el("span", { class: "fr-ai-dot", attrs: { "aria-hidden": "true" } }), label);
  };

  return {
    element: root,
    focus: () => { if (!bladesMode) input.focus(); },
    syncLocale,
    setGames,
    setAiStatus,
    setError,
    setTrailing: (node) => { trailingSlot.replaceChildren(...(node ? [node] : [])); },
  };
}
