// start/home/homeView.ts
// 시작 화면 칸들의 그림·글자. 동작은 호출부(startScreen.ts)가 준다.
//   홈은 2026-11-04 부터 프롬프트 한 장(src/start/firstRun/promptHome.ts)이다 — 배너·최근·컨셉 선반은 걷었다.
//   내 게임: 전체 목록 + 숨김·게임 파일 열기.   예제: 장면 넘겨 보기가 있는 큰 카드.
//   새로 만들기: 컨셉 피드(src/start/conceptFeed) 전체 — 검색·분류·상세·골라서 만들기·빈 프로젝트.
import { el } from "@/util/dom";
import type { RecentProjectEntry } from "../../../electron/shared/start";
import { startIcon } from "../icons";
import { BUILTIN_GAMES, type BuiltinGame, type BuiltinGameId } from "./builtinGames";

export const HOME_TESTIDS = {
  games: "start-my-games",
  game: "start-world",
  gameEdit: "start-world-edit",
  newGame: "start-new-game",
  showAll: "start-show-all",
  openGameFile: "start-open-game-file",
  builtin: "start-builtin-demos",
  aiNotice: "start-ai-notice",
} as const;

/** 선반 한 줄에 놓는 카드 수(마지막 칸은 「새 게임」). 넘으면 「모두 보기」. */
export const SHELF_GAMES = 5;

// 2026-11-04 Studio/런타임 분리(B안, http://mdc-server:18301/studio-runtime-split.html): 시작 화면에는 「플레이」 입구가 없다.
// 내 게임·기본 게임은 편집기에서 열고, 플레이는 편집기 「테스트 실행」 하나로 한다.
export type HomeActions = {
  readonly edit: (entry: RecentProjectEntry) => void;
  readonly newGame: () => void;
  readonly openGameFile: () => void;
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

function button(label: string, className: string, testid: string, onClick: () => void, icon?: "play" | "plus" | "gear"): HTMLButtonElement {
  return el("button", {
    class: className, attrs: { type: "button" }, dataset: { testid }, on: { click: onClick },
    children: [...(icon === "play" ? [el("span", { class: "hm-cursor", text: "▶", attrs: { "aria-hidden": "true" } })] : icon ? [startIcon(icon, "ln-icon")] : []), label],
  });
}

function shelfHead(title: string, sub: string | null, right: readonly HTMLElement[], id: string): HTMLElement {
  return el("div", { class: "hm-sh", children: [
    el("h3", { text: title, attrs: { id } }),
    ...(sub ? [el("small", { text: sub })] : []),
    ...(right.length ? [el("div", { class: "hm-sh-right", children: [...right] })] : []),
  ] });
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
    el("div", { class: "hm-card-acts", children: [
      button("편집", "hm-btn hm-btn-pri hm-btn-xs", `${HOME_TESTIDS.gameEdit}-${index}`, () => actions.edit(entry)),
    ] }),
  ] });
}

/** 「내 게임」 선반. 배너에 올린 게임도 다시 넣는다(선반은 전체 목록의 앞부분이다). */
export function myGamesShelf(options: {
  readonly entries: readonly RecentProjectEntry[];
  readonly titles: ReadonlyMap<string, string>;
  readonly meta: (entry: RecentProjectEntry) => string;
  readonly showAll: boolean;
  readonly onToggleAll: () => void;
  readonly note: HTMLElement | null;
  readonly actions: HomeActions;
}): HTMLElement {
  const { entries, titles, meta, showAll, actions } = options;
  const shown = showAll ? entries : entries.slice(0, SHELF_GAMES);
  const right: HTMLElement[] = [
    el("button", { class: "hm-more", attrs: { type: "button" }, dataset: { testid: HOME_TESTIDS.openGameFile }, text: "게임 파일 열기", on: { click: actions.openGameFile } }),
  ];
  if (entries.length > SHELF_GAMES) {
    right.push(el("button", {
      class: "hm-more", attrs: { type: "button", "aria-expanded": String(showAll) }, dataset: { testid: HOME_TESTIDS.showAll },
      text: showAll ? "접기" : `모두 보기 (${entries.length})`, on: { click: options.onToggleAll },
    }));
  }
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.games }, attrs: { "aria-labelledby": "hm-games-h" }, children: [
    shelfHead("내 게임", "최근 편집 순", right, "hm-games-h"),
    el("div", { class: "hm-shelf hm-games", children: [
      ...shown.map((entry, index) => gameCard(entry, titles.get(entry.projectDir) ?? entry.title, meta(entry), index + 1, actions)),
      el("button", {
        class: "hm-card hm-new", attrs: { type: "button" }, dataset: { testid: HOME_TESTIDS.newGame }, on: { click: actions.newGame },
        children: [startIcon("plus", "ln-icon"), el("span", { text: "새 게임" })],
      }),
    ] }),
    ...(options.note ? [options.note] : []),
  ] });
}

/** 게임이 하나도 없는 「내 게임」 칸 — 첫 게임 만들기 카드(누르면 「새로 만들기」 칸). */
export function firstRunShelf(actions: HomeActions): HTMLElement {
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.games }, attrs: { "aria-labelledby": "hm-games-h" }, children: [
    shelfHead("내 게임", null, [
      el("button", { class: "hm-more", attrs: { type: "button" }, dataset: { testid: HOME_TESTIDS.openGameFile }, text: "게임 파일 열기", on: { click: actions.openGameFile } }),
    ], "hm-games-h"),
    el("div", { class: "hm-shelf hm-first", children: [
      el("button", {
        class: "hm-card hm-new hm-new-first", attrs: { type: "button" }, dataset: { testid: HOME_TESTIDS.newGame }, on: { click: actions.newGame },
        children: [startIcon("plus", "ln-icon"), el("b", { text: "첫 게임 만들기" }), el("small", { text: "컨셉을 고르거나 직접 적어 시작해요" })],
      }),
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
  const cover = el("img", { attrs: { src: game.cover, alt: "", decoding: "async", draggable: "false" } });
  const thumbs = game.frames.map((frame, index) => el("button", {
    class: "hm-thumb" + (index === 0 ? " is-on" : ""), attrs: { type: "button", "aria-label": `장면 ${index + 1}`, tabindex: "-1" },
    on: {
      mouseenter: () => show(index),
      focus: () => show(index),
      click: () => show(index),
    },
    children: [el("img", { attrs: { src: frame, alt: "", decoding: "async", draggable: "false" } })],
  }));
  function show(index: number): void {
    cover.src = game.frames[index] ?? game.cover;
    thumbs.forEach((thumb, other) => thumb.classList.toggle("is-on", other === index));
  }
  return el("article", { class: "hm-bcard", dataset: { testid: `start-builtin-demo-${game.id}` }, on: { mouseleave: () => show(0) }, children: [
    el("button", { class: "hm-bcov", attrs: { type: "button", tabindex: "-1", "aria-hidden": "true" }, on: { click: () => actions.builtinEdit(game.id) }, children: [
      cover, el("span", { class: "hm-badge is-gold", text: "공식" }),
    ] }),
    el("div", { class: "hm-bside", children: [
      el("h4", { class: "hm-bname", text: game.title, attrs: { translate: "no" } }),
      el("p", { class: "hm-bgenre", text: game.genre }),
      el("p", { class: "hm-bdesc", text: game.description }),
      el("div", { class: "hm-acts", children: [
        button("편집기에서 열기", "hm-btn hm-btn-pri hm-btn-sm", `start-builtin-edit-${game.id}`, () => actions.builtinEdit(game.id)),
      ] }),
      el("div", { class: "hm-thumbs", attrs: { "aria-hidden": "true" }, children: thumbs }),
    ] }),
  ] });
}

export function builtinShelf(actions: HomeActions): HTMLElement {
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.builtin }, attrs: { "aria-labelledby": "hm-builtin-h" }, children: [
    shelfHead("예제", "열어서 고쳐 보며 배우기 — 해 보려면 편집기 「테스트 실행」", [], "hm-builtin-h"),
    el("div", { class: "hm-shelf hm-builtins", children: BUILTIN_GAMES.map((game) => builtinCard(game, actions)) }),
  ] });
}
