// start/home/homeView.ts
// 시작 화면 칸들의 그림·글자. 동작은 호출부(startScreen.ts)가 준다.
//   홈은 2026-11-04 부터 프롬프트 한 장(src/start/firstRun/promptHome.ts)이다 — 배너·최근·컨셉 선반은 걷었다.
//   내 게임: 전체 목록(홈의 「내 게임」 줄과 같은 카드) + 숨김·게임 파일 열기.   예제: 큰 그림 카드 — 누르면 편집기에서 연다.
//   새로 만들기: 컨셉 피드(src/start/conceptFeed) 전체 — 검색·분류·상세·골라서 만들기·빈 프로젝트.
import { el } from "@/util/dom";
import type { RecentProjectEntry } from "../../../electron/shared/start";
import { startIcon } from "../icons";
import { BUILTIN_GAMES, type BuiltinGame, type BuiltinGameId } from "./builtinGames";

export const HOME_TESTIDS = {
  games: "start-my-games",
  game: "start-world",
  newGame: "start-new-game",
  blankGame: "start-blank-game",
  openGameFile: "start-open-game-file",
  cardMenu: "start-world-menu",
  menuOpen: "start-world-menu-open",
  menuRename: "start-world-menu-rename",
  menuForget: "start-world-menu-forget",
  renameDialog: "start-rename-dialog",
  renameInput: "start-rename-input",
  renameSave: "start-rename-save",
  forgetDialog: "start-forget-dialog",
  forgetConfirm: "start-forget-confirm",
  dialogCancel: "start-dialog-cancel",
  builtin: "start-builtin-demos",
  aiNotice: "start-ai-notice",
} as const;

// 2026-11-04 Studio/런타임 분리(B안, http://mdc-server:18301/studio-runtime-split.html): 시작 화면에는 「플레이」 입구가 없다.
// 내 게임·기본 게임은 편집기에서 열고, 플레이는 편집기 「테스트 실행」 하나로 한다.
export type HomeActions = {
  readonly edit: (entry: RecentProjectEntry) => void;
  /** 빈 프로젝트 — 장르 없이 기본 위치에 새 폴더. */
  readonly newGame: () => void;
  /** 게임이 하나도 없을 때의 「첫 게임 만들기」 — 입력창이 있는 홈으로. */
  readonly home: () => void;
  readonly openGameFile: () => void;
  /** 카드 「⋯ → 이름 바꾸기」 — 새 제목을 받아 저장한다(실패하면 던진다). */
  readonly rename: (entry: RecentProjectEntry, title: string) => Promise<void>;
  /** 카드 「⋯ → 목록에서 지우기」 — 최근 목록에서만 뺀다. 폴더·파일은 그대로다. */
  readonly forget: (entry: RecentProjectEntry) => Promise<void>;
  readonly builtinEdit: (id: BuiltinGameId) => void;
  readonly openSettings: () => void;
};

/**
 * 같은 이름(「새 게임」)이 여럿이면 날짜를 붙여 구분한다. 날짜는 마지막 편집(없으면 마지막으로 연) 날이다.
 * 제목은 번역하지 않는 칸(translate="no")이라 날짜는 화면 언어의 날짜 형식으로 직접 만든다(ko 「10월 17일」, en 「Oct 17」).
 */
export function displayTitles(entries: readonly RecentProjectEntry[], locale = "ko"): ReadonlyMap<string, string> {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.title, (counts.get(entry.title) ?? 0) + 1);
  const format = new Intl.DateTimeFormat(locale, { month: locale === "en" ? "short" : "long", day: "numeric" });
  const result = new Map<string, string>();
  for (const entry of entries) {
    if ((counts.get(entry.title) ?? 0) < 2) { result.set(entry.projectDir, entry.title); continue; }
    const at = Date.parse(entry.updatedAt ?? entry.lastOpenedAt ?? "");
    if (!Number.isFinite(at)) { result.set(entry.projectDir, entry.title); continue; }
    result.set(entry.projectDir, `${entry.title} · ${format.format(new Date(at))}`);
  }
  return result;
}

export function coverArt(entry: RecentProjectEntry, className = "hm-cov"): HTMLElement {
  const art = el("span", { class: className, attrs: { "aria-hidden": "true" }, dataset: { coverFor: entry.projectDir } });
  fillCover(art, entry.cover ?? null, entry.title);
  return art;
}

/**
 * 표지. 그림이 없으면 무늬 자리표 + 제목 첫 글자를 둔다(곱 구워지면 data-cover-for 로 이 칸만 바뀐다).
 *
 * 2026-11-01: 예전에는 그림이 없을 때마다 「아직 그림 없음」 을 찍었다. 첫 화면에서 최근 게임 대부분이
 * 회색 박스 + 「아직 그림 없음」 으로 덮이면 화면이 **미완성처럼** 보인다(사용자 「앱을 키자마자 좀 엽엽하다」).
 * 지금은 제목 첫 글자만 남기고, 카드 아래 메타가 무엇인지 말한다.
 */
export function fillCover(art: HTMLElement, cover: string | null, title: string): void {
  if (cover) {
    art.classList.remove("is-empty");
    art.replaceChildren(el("img", { attrs: { src: cover, alt: "", decoding: "async", draggable: "false" } }));
    return;
  }
  art.classList.add("is-empty");
  art.replaceChildren(el("span", { class: "hm-ph", children: [
    el("b", { text: Array.from(title.trim())[0] ?? "?", attrs: { translate: "no" } }),
  ] }));
}

function button(label: string, className: string, testid: string, onClick: () => void, icon?: "gear"): HTMLButtonElement {
  return el("button", {
    class: className, attrs: { type: "button" }, dataset: { testid }, on: { click: onClick },
    children: [...(icon ? [startIcon(icon, "ln-icon")] : []), label],
  });
}

function dialog(testid: string, title: string, body: string, children: readonly HTMLElement[], onClose: () => void): HTMLElement {
  const root = el("div", { class: "ln-dialog-scrim", dataset: { testid }, on: { click: (event) => { if (event.target === event.currentTarget) onClose(); } } });
  const panel = el("div", { class: "ln-dialog", attrs: { role: "dialog", "aria-modal": "true", "aria-label": title }, children: [
    el("h3", { text: title, attrs: { translate: "no" } }),
    ...(body ? [el("p", { text: body })] : []),
    ...children,
  ] });
  root.append(panel);
  root.addEventListener("keydown", (event) => { if ((event as KeyboardEvent).key === "Escape") { event.stopPropagation(); onClose(); } });
  return root;
}

function openRenameDialog(entry: RecentProjectEntry, title: string, actions: HomeActions): void {
  const input = el("input", { class: "ln-input", value: title, attrs: { type: "text", maxlength: "80", "aria-label": "새 이름" }, dataset: { testid: HOME_TESTIDS.renameInput } });
  const error = el("p", { class: "ln-dialog-error", attrs: { role: "alert", hidden: "" } });
  const close = (): void => { root.remove(); };
  const save = el("button", { class: "hm-btn hm-btn-pri", attrs: { type: "button" }, text: "저장", dataset: { testid: HOME_TESTIDS.renameSave } });
  const submit = (): void => {
    const next = input.value.trim();
    if (!next) { input.focus(); return; }
    if (next === entry.title) { close(); return; }
    save.disabled = true;
    error.hidden = true;
    void actions.rename(entry, next).then(close, (reason: unknown) => {
      save.disabled = false;
      error.textContent = reason instanceof Error ? reason.message : String(reason);
      error.hidden = false;
    });
  };
  save.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); submit(); } });
  const cancel = el("button", { class: "hm-btn hm-btn-sec", attrs: { type: "button" }, text: "취소", dataset: { testid: HOME_TESTIDS.dialogCancel }, on: { click: close } });
  const root = dialog(HOME_TESTIDS.renameDialog, "이름 바꾸기", "", [input, error, el("div", { class: "ln-dialog-acts", children: [cancel, save] })], close);
  document.body.append(root);
  input.focus();
  input.select();
}

function openForgetDialog(entry: RecentProjectEntry, title: string, actions: HomeActions): void {
  const error = el("p", { class: "ln-dialog-error", attrs: { role: "alert", hidden: "" } });
  const close = (): void => { root.remove(); };
  const confirm = el("button", { class: "hm-btn hm-btn-danger", attrs: { type: "button" }, text: "목록에서 지우기", dataset: { testid: HOME_TESTIDS.forgetConfirm } });
  confirm.addEventListener("click", () => {
    confirm.disabled = true;
    error.hidden = true;
    void actions.forget(entry).then(close, (reason: unknown) => {
      confirm.disabled = false;
      error.textContent = reason instanceof Error ? reason.message : String(reason);
      error.hidden = false;
    });
  });
  const cancel = el("button", { class: "hm-btn hm-btn-sec", attrs: { type: "button" }, text: "취소", dataset: { testid: HOME_TESTIDS.dialogCancel }, on: { click: close } });
  const root = dialog(HOME_TESTIDS.forgetDialog, `「${title}」을 목록에서 지울까요?`, "파일은 지워지지 않아요. 폴더와 게임 파일은 그대로 남고, 나중에 「폴더 열기」로 다시 불러올 수 있어요.", [error, el("div", { class: "ln-dialog-acts", children: [cancel, confirm] })], close);
  document.body.append(root);
  cancel.focus();
}

function cardMenu(entry: RecentProjectEntry, title: string, index: number, actions: HomeActions): HTMLElement {
  const item = (label: string, testid: string, run: () => void, danger = false): HTMLButtonElement => el("button", {
    class: "hm-menu-item" + (danger ? " is-danger" : ""), attrs: { type: "button", role: "menuitem" }, dataset: { testid: `${testid}-${index}` }, text: label,
    on: { click: () => { close(); run(); } },
  });
  const menu = el("div", { class: "hm-menu", attrs: { role: "menu", hidden: "" }, children: [
    item("열기", HOME_TESTIDS.menuOpen, () => actions.edit(entry)),
    item("이름 바꾸기", HOME_TESTIDS.menuRename, () => openRenameDialog(entry, title, actions)),
    item("목록에서 지우기…", HOME_TESTIDS.menuForget, () => openForgetDialog(entry, title, actions), true),
  ] });
  const button = el("button", {
    class: "hm-more-btn", attrs: { type: "button", "aria-label": `${title} 메뉴`, "aria-haspopup": "menu", "aria-expanded": "false" },
    dataset: { testid: `${HOME_TESTIDS.cardMenu}-${index}` }, text: "⋯",
    on: { click: () => { if (menu.hidden) open(); else close(); } },
  });
  const wrap = el("div", { class: "hm-menu-wrap", children: [button, menu] });
  const onOutside = (event: Event): void => { if (!wrap.contains(event.target as Node)) close(); };
  const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") { event.stopPropagation(); close(); button.focus(); } };
  function open(): void {
    menu.hidden = false; button.setAttribute("aria-expanded", "true"); wrap.closest(".hm-card")?.classList.add("is-menu-open");
    document.addEventListener("pointerdown", onOutside); document.addEventListener("keydown", onKey, true);
  }
  function close(): void {
    menu.hidden = true; button.setAttribute("aria-expanded", "false"); wrap.closest(".hm-card")?.classList.remove("is-menu-open");
    document.removeEventListener("pointerdown", onOutside); document.removeEventListener("keydown", onKey, true);
  }
  return wrap;
}

function gameCard(entry: RecentProjectEntry, title: string, meta: string, index: number, actions: HomeActions): HTMLElement {
  return el("article", { class: "hm-card" + (entry.hiddenReason ? " is-hidden-entry" : ""), children: [
    el("button", {
      class: "hm-card-hit", attrs: { type: "button", title: entry.projectDir, "aria-label": title }, dataset: { testid: `${HOME_TESTIDS.game}-${index}` },
      on: { click: () => actions.edit(entry) },
      children: [coverArt(entry), el("span", { class: "hm-cap", children: [
        el("span", { class: "hm-nm", text: title, attrs: { translate: "no" } }),
        el("span", { class: "hm-mt", text: meta }),
      ] })],
    }),
    cardMenu(entry, title, index, actions),
  ] });
}

/** 「내 게임」 탭 — 최근 편집 순 전체 목록. 게임이 몇 개든 전부 보인다. */
export function myGamesShelf(options: {
  readonly entries: readonly RecentProjectEntry[];
  readonly titles: ReadonlyMap<string, string>;
  readonly meta: (entry: RecentProjectEntry) => string;
  readonly note: HTMLElement | null;
  readonly actions: HomeActions;
}): HTMLElement {
  const { entries, titles, meta, actions } = options;
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.games }, attrs: { "aria-label": "내 게임" }, children: [
    el("div", { class: "hm-shelf hm-games", children: [
      ...entries.map((entry, index) => gameCard(entry, titles.get(entry.projectDir) ?? entry.title, meta(entry), index + 1, actions)),
      el("button", {
        class: "hm-card hm-new", attrs: { type: "button" }, dataset: { testid: HOME_TESTIDS.blankGame }, on: { click: actions.newGame },
        children: [startIcon("plus", "ln-icon"), el("span", { text: "빈 프로젝트" })],
      }),
    ] }),
    ...(options.note ? [options.note] : []),
  ] });
}

/** 게임이 하나도 없는 「내 게임」 탭 — 첫 게임 만들기(누르면 입력창이 있는 홈). */
export function firstRunShelf(actions: HomeActions): HTMLElement {
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.games }, attrs: { "aria-label": "내 게임" }, children: [
    el("div", { class: "hm-empty", children: [
      el("h4", { text: "아직 만든 게임이 없어요" }),
      el("p", { text: "한 줄로 적으면 AI가 첫 게임을 만들어요. AI 없이 직접 그리려면 빈 프로젝트로 시작해요." }),
      el("div", { class: "hm-acts", children: [
        button("첫 게임 만들기", "hm-btn hm-btn-pri", HOME_TESTIDS.newGame, actions.home),
        button("빈 프로젝트", "hm-btn hm-btn-sec", HOME_TESTIDS.blankGame, actions.newGame),
      ] }),
    ] }),
  ] });
}

/** AI 엔진이 없을 때 「새로 만들기」 칸 맨 위에 두는 안내(막지 않는다). */
export function aiNotice(actions: HomeActions): HTMLElement {
  return el("div", { class: "hm-notice hm-notice-inline", dataset: { testid: HOME_TESTIDS.aiNotice }, children: [
    el("b", { children: [el("span", { class: "ln-dot is-off", attrs: { "aria-hidden": "true" } }), "AI 엔진이 아직 없어요"] }),
    el("p", { text: "AI 없이도 예제 열기·편집·빈 프로젝트는 돼요. 조수가 맵을 지어 주게 하려면 이 PC 의 Claude Code · Codex · Gemini CLI 를 연결하세요." }),
    button("설정 열기", "hm-btn hm-btn-sec hm-btn-sm", "start-ai-notice-settings", actions.openSettings, "gear"),
  ] });
}

function builtinCard(game: BuiltinGame, actions: HomeActions): HTMLElement {
  return el("article", { class: "hm-bcard", dataset: { testid: `start-builtin-demo-${game.id}` }, children: [
    el("button", { class: "hm-bcov", attrs: { type: "button", tabindex: "-1", "aria-hidden": "true" }, on: { click: () => actions.builtinEdit(game.id) }, children: [
      el("img", { attrs: { src: game.cover, alt: "", decoding: "async", draggable: "false" } }),
      el("span", { class: "hm-badge", text: "공식" }),
    ] }),
    el("div", { class: "hm-bside", children: [
      el("h4", { class: "hm-bname", text: game.title, attrs: { translate: "no" } }),
      el("p", { class: "hm-bgenre", text: game.genre }),
      el("p", { class: "hm-bdesc", text: game.description }),
      el("div", { class: "hm-acts", children: [
        button("편집기에서 열기", "hm-btn hm-btn-sec hm-btn-sm", `start-builtin-edit-${game.id}`, () => actions.builtinEdit(game.id)),
      ] }),
    ] }),
  ] });
}

export function builtinShelf(actions: HomeActions): HTMLElement {
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.builtin }, attrs: { "aria-label": "예제" }, children: [
    el("p", { class: "hm-lede", text: "열어서 고쳐 보며 배워요. 해 보려면 편집기의 「테스트 실행」을 눌러요." }),
    el("div", { class: "hm-shelf hm-builtins", children: BUILTIN_GAMES.map((game) => builtinCard(game, actions)) }),
  ] });
}
