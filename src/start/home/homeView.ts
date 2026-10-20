// start/home/homeView.ts
// 첫 화면 각 칸의 그림·글자. 동작은 호출부(startScreen.ts)가 준다.
//   홈(2026-10-21): 배너(이어서 만들기 / 처음이면 기본 게임) · 최근 게임 몇 개 · 지금 만들 수 있는 게임(컨셉 몇 개) · 기본 게임(작은 카드).
//   내 게임: 전체 목록 + 숨김·게임 파일 열기.   기본 게임: 장면 넘겨 보기가 있는 큰 카드.
//   새로 만들기: 컨셉 피드(src/start/conceptFeed) 전체 — 검색·분류·상세·골라서 만들기·빈 프로젝트.
import { el } from "@/util/dom";
import { getLocale } from "@/i18n";
import { localizedConcept, type GameConcept } from "@/concepts/format";
import type { RecentProjectEntry } from "../../../electron/shared/start";
import { conceptStageArt } from "../conceptFeed/stageArt";
import { startIcon } from "../icons";
import { BUILTIN_GAMES, type BuiltinGame, type BuiltinGameId } from "./builtinGames";

export const HOME_TESTIDS = {
  hero: "start-hero",
  heroContinue: "start-continue",
  heroPlay: "start-hero-play",
  games: "start-my-games",
  game: "start-world",
  gamePlay: "start-world-play",
  gameEdit: "start-world-edit",
  newGame: "start-new-game",
  showAll: "start-show-all",
  openGameFile: "start-open-game-file",
  builtin: "start-builtin-demos",
  aiNotice: "start-ai-notice",
  recent: "start-home-recent",
  recentMore: "start-home-recent-more",
  concepts: "start-home-concepts",
  concept: "start-home-concept",
  conceptsMore: "start-home-concepts-more",
  builtinHome: "start-home-builtin",
  builtinMore: "start-home-builtin-more",
} as const;

/** 홈에 놓는 최근 게임 · 컨셉 수. 나머지는 「내 게임」·「새로 만들기」 칸에 있다. */
export const HOME_RECENT = 4;
export const HOME_CONCEPTS = 8;

/** 선반 한 줄에 놓는 카드 수(마지막 칸은 「새 게임」). 넘으면 「모두 보기」. */
export const SHELF_GAMES = 5;

export type HomeActions = {
  readonly edit: (entry: RecentProjectEntry) => void;
  readonly play: (entry: RecentProjectEntry) => void;
  readonly newGame: () => void;
  readonly openGameFile: () => void;
  readonly builtinPlay: (id: BuiltinGameId) => void;
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

/** 표지. 그림이 없으면 무늬 자리표 + 제목 첫 글자 + 「아직 그림 없음」(곧 구워지면 data-cover-for 로 이 칸만 바뀐다). */
export function coverArt(entry: RecentProjectEntry, className = "hm-cov"): HTMLElement {
  const art = el("span", { class: className, attrs: { "aria-hidden": "true" }, dataset: { coverFor: entry.projectDir } });
  fillCover(art, entry.cover ?? null, entry.title);
  return art;
}

export function fillCover(art: HTMLElement, cover: string | null, title: string): void {
  if (cover) {
    art.classList.remove("is-empty");
    art.replaceChildren(el("img", { attrs: { src: cover, alt: "", decoding: "async", draggable: "false" } }));
    return;
  }
  art.classList.add("is-empty");
  art.replaceChildren(el("span", { class: "hm-ph", children: [
    el("b", { text: Array.from(title.trim())[0] ?? "?", attrs: { translate: "no" } }),
    el("em", { text: "아직 그림 없음" }),
  ] }));
}

function button(label: string, className: string, testid: string, onClick: () => void, icon?: "play" | "plus" | "gear"): HTMLButtonElement {
  return el("button", {
    class: className, attrs: { type: "button" }, dataset: { testid }, on: { click: onClick },
    children: [...(icon === "play" ? [el("span", { class: "hm-cursor", text: "▶", attrs: { "aria-hidden": "true" } })] : icon ? [startIcon(icon, "ln-icon")] : []), label],
  });
}

/** 배너 — 마지막으로 작업한 게임. 표지를 흐린 배경 + 오른쪽 액자로 둔다(어떤 그림이든 화면이 비거나 뭉개지지 않게). */
export function continueHero(entry: RecentProjectEntry, title: string, meta: string, actions: HomeActions): HTMLElement {
  const frame = coverArt(entry, "hm-hero-frame");
  const bg = el("span", { class: "hm-hero-bg", attrs: { "aria-hidden": "true" }, dataset: { coverBgFor: entry.projectDir } });
  if (entry.cover) bg.style.backgroundImage = `url("${entry.cover}")`;
  return el("section", { class: "hm-hero", dataset: { testid: HOME_TESTIDS.hero }, attrs: { "aria-label": "이어서 만들기" }, children: [
    bg,
    el("span", { class: "hm-hero-shade", attrs: { "aria-hidden": "true" } }),
    el("button", { class: "hm-hero-frame-hit", attrs: { type: "button", tabindex: "-1", "aria-hidden": "true" }, on: { click: () => actions.edit(entry) }, children: [frame] }),
    el("div", { class: "hm-hero-info", children: [
      el("span", { class: "hm-kicker", text: "마지막으로 작업한 게임" }),
      el("h2", { text: title, attrs: { translate: "no" } }),
      el("p", { class: "hm-hero-meta", text: meta }),
      el("div", { class: "hm-acts", children: [
        button("이어서 만들기", "hm-btn hm-btn-pri", HOME_TESTIDS.heroContinue, () => actions.edit(entry), "play"),
        button("플레이", "hm-btn hm-btn-sec", HOME_TESTIDS.heroPlay, () => actions.play(entry)),
      ] }),
    ] }),
  ] });
}

/** 처음 켠 상태의 배너 — 기본 게임 「폴른 스타」를 먼저 해 보게 한다. */
export function firstRunHero(actions: HomeActions): HTMLElement {
  const game = BUILTIN_GAMES[0]!;
  const bg = el("span", { class: "hm-hero-bg", attrs: { "aria-hidden": "true" } });
  bg.style.backgroundImage = `url("${game.frames[1] ?? game.cover}")`;
  return el("section", { class: "hm-hero is-first", dataset: { testid: HOME_TESTIDS.hero }, attrs: { "aria-label": "처음이라면 먼저 해 보세요" }, children: [
    bg,
    el("span", { class: "hm-hero-shade", attrs: { "aria-hidden": "true" } }),
    el("button", { class: "hm-hero-frame-hit", attrs: { type: "button", tabindex: "-1", "aria-hidden": "true" }, on: { click: () => actions.builtinPlay(game.id) }, children: [
      el("span", { class: "hm-hero-frame", children: [el("img", { attrs: { src: game.cover, alt: "", decoding: "async", draggable: "false" } })] }),
    ] }),
    el("div", { class: "hm-hero-info", children: [
      el("span", { class: "hm-kicker", text: "처음이라면 먼저 해 보세요" }),
      el("h2", { text: game.title, attrs: { translate: "no" } }),
      el("p", { class: "hm-hero-meta", text: "이 앱으로 만든 게임이에요 — 열어서 어떻게 만들었는지 볼 수 있어요" }),
      el("div", { class: "hm-acts", children: [
        button("플레이", "hm-btn hm-btn-pri", HOME_TESTIDS.heroPlay, () => actions.builtinPlay(game.id), "play"),
        button("편집기에서 보기", "hm-btn hm-btn-sec", HOME_TESTIDS.heroContinue, () => actions.builtinEdit(game.id)),
      ] }),
    ] }),
  ] });
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
      button("플레이", "hm-btn hm-btn-pri hm-btn-xs", `${HOME_TESTIDS.gamePlay}-${index}`, () => actions.play(entry), "play"),
      button("편집", "hm-btn hm-btn-sec hm-btn-xs", `${HOME_TESTIDS.gameEdit}-${index}`, () => actions.edit(entry)),
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
    el("p", { text: "AI 없이도 플레이·편집·빈 프로젝트는 돼요. 조수가 맵을 지어 주게 하려면 이 PC 의 Claude Code · Codex · Gemini CLI 를 연결하세요." }),
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
    el("button", { class: "hm-bcov", attrs: { type: "button", tabindex: "-1", "aria-hidden": "true" }, on: { click: () => actions.builtinPlay(game.id) }, children: [
      cover, el("span", { class: "hm-badge is-gold", text: "공식" }),
    ] }),
    el("div", { class: "hm-bside", children: [
      el("h4", { class: "hm-bname", text: game.title, attrs: { translate: "no" } }),
      el("p", { class: "hm-bgenre", text: game.genre }),
      el("p", { class: "hm-bdesc", text: game.description }),
      el("div", { class: "hm-acts", children: [
        button("플레이", "hm-btn hm-btn-pri hm-btn-sm", `start-builtin-play-${game.id}`, () => actions.builtinPlay(game.id), "play"),
        button("편집기에서 보기", "hm-btn hm-btn-ghost hm-btn-sm", `start-builtin-edit-${game.id}`, () => actions.builtinEdit(game.id)),
      ] }),
      el("div", { class: "hm-thumbs", attrs: { "aria-hidden": "true" }, children: thumbs }),
    ] }),
  ] });
}

export function builtinShelf(actions: HomeActions): HTMLElement {
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.builtin }, attrs: { "aria-labelledby": "hm-builtin-h" }, children: [
    shelfHead("기본 게임", "설치되어 있어 AI 없이 바로 플레이할 수 있어요", [], "hm-builtin-h"),
    el("div", { class: "hm-shelf hm-builtins", children: BUILTIN_GAMES.map((game) => builtinCard(game, actions)) }),
  ] });
}

// ── 홈 칸 전용 ────────────────────────────────────────────────────────────

/** 홈의 「최근 게임」 — 앞의 몇 개만. 더 있으면 「모두 보기」가 「내 게임」 칸으로 간다. */
export function recentShelf(options: {
  /** 배너 게임을 뺀 나머지. */
  readonly entries: readonly RecentProjectEntry[];
  /** 배너까지 센 전체 수(「모두 보기 (n)」). */
  readonly total: number;
  readonly titles: ReadonlyMap<string, string>;
  readonly meta: (entry: RecentProjectEntry) => string;
  readonly actions: HomeActions;
  readonly onMore: () => void;
}): HTMLElement {
  const { entries, titles, meta, actions } = options;
  const shown = entries.slice(0, HOME_RECENT);
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.recent }, attrs: { "aria-labelledby": "hm-recent-h" }, children: [
    shelfHead("최근 게임", null, [
      el("button", { class: "hm-more", attrs: { type: "button" }, dataset: { testid: HOME_TESTIDS.recentMore }, text: entries.length > HOME_RECENT ? `모두 보기 (${options.total}) ›` : "내 게임 ›", on: { click: options.onMore } }),
    ], "hm-recent-h"),
    el("div", { class: "hm-shelf hm-recent", children: shown.map((entry, index) => gameCard(entry, titles.get(entry.projectDir) ?? entry.title, meta(entry), index + 1, actions)) }),
  ] });
}

function conceptCard(concept: GameConcept, onOpen: (concept: GameConcept) => void, thumb: (concept: GameConcept) => Promise<string>): HTMLElement {
  const local = localizedConcept(concept, getLocale());
  const stage = conceptStageArt(concept);
  const image = el("img", { attrs: { alt: "", decoding: "async", loading: "lazy", draggable: "false" } });
  if (stage) image.src = stage;
  else void thumb(concept).then((url) => { image.src = url; }, () => undefined);
  return el("article", { class: "hm-card hm-concept", children: [
    el("button", {
      class: "hm-card-hit", attrs: { type: "button", "aria-label": local.title }, dataset: { testid: HOME_TESTIDS.concept, slug: concept.slug },
      on: { click: () => onOpen(concept) },
      children: [el("span", { class: "hm-cov", children: [image] }), el("span", { class: "hm-cap", children: [
        el("span", { class: "hm-nm", text: local.title, attrs: { translate: "no" } }),
        el("span", { class: "hm-mt", text: local.hook, attrs: { translate: "no" } }),
      ] })],
    }),
  ] });
}

/** 홈의 「지금 만들 수 있는 게임」 — 지금 칩셋으로 지을 수 있는 컨셉 몇 개. 누르면 「새로 만들기」 칸의 그 컨셉 상세. */
export function conceptShelf(options: {
  readonly concepts: readonly GameConcept[] | null;
  readonly onOpen: (concept: GameConcept) => void;
  readonly onMore: () => void;
  readonly thumb: (concept: GameConcept) => Promise<string>;
}): HTMLElement {
  const { concepts } = options;
  const cards = concepts === null
    ? Array.from({ length: HOME_CONCEPTS }, () => el("div", { class: "hm-card hm-skel", attrs: { "aria-hidden": "true" }, children: [el("span", { class: "hm-cov" }), el("span", { class: "hm-cap", children: [el("span", { class: "hm-nm", text: "\u00a0" }), el("span", { class: "hm-mt", text: "\u00a0" })] })] }))
    : concepts.slice(0, HOME_CONCEPTS).map((concept) => conceptCard(concept, options.onOpen, options.thumb));
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.concepts }, attrs: { "aria-labelledby": "hm-concepts-h" }, children: [
    shelfHead("지금 만들 수 있는 게임", "고르면 이름·폴더·화면 크기는 자동으로 정해져요", [
      el("button", { class: "hm-more", attrs: { type: "button" }, dataset: { testid: HOME_TESTIDS.conceptsMore }, text: "모두 보기 ›", on: { click: options.onMore } }),
    ], "hm-concepts-h"),
    el("div", { class: "hm-shelf hm-concepts", children: cards }),
  ] });
}

/** 홈의 「기본 게임」 — 그림 · 제목 · 플레이만. 장면 넘겨 보기와 소개 글은 「기본 게임」 칸에 있다. */
export function builtinHomeShelf(actions: HomeActions, onMore: () => void): HTMLElement {
  return el("section", { class: "hm-shelf-sec", dataset: { testid: HOME_TESTIDS.builtinHome }, attrs: { "aria-labelledby": "hm-builtin-home-h" }, children: [
    shelfHead("기본 게임", "AI 없이 바로 플레이", [
      el("button", { class: "hm-more", attrs: { type: "button" }, dataset: { testid: HOME_TESTIDS.builtinMore }, text: "자세히 ›", on: { click: onMore } }),
    ], "hm-builtin-home-h"),
    el("div", { class: "hm-shelf hm-builtin-row", children: BUILTIN_GAMES.map((game) => el("article", { class: "hm-card hm-bmini", dataset: { testid: `start-home-builtin-${game.id}` }, children: [
      el("button", {
        class: "hm-card-hit", attrs: { type: "button", "aria-label": game.title }, on: { click: () => actions.builtinPlay(game.id) },
        children: [
          el("span", { class: "hm-cov", children: [el("img", { attrs: { src: game.cover, alt: "", decoding: "async", draggable: "false" } }), el("span", { class: "hm-badge is-gold", text: "공식" })] }),
          el("span", { class: "hm-cap", children: [el("span", { class: "hm-nm", text: game.title, attrs: { translate: "no" } }), el("span", { class: "hm-mt", text: game.genre })] }),
        ],
      }),
      el("div", { class: "hm-card-acts", children: [
        button("플레이", "hm-btn hm-btn-pri hm-btn-xs", `start-home-builtin-play-${game.id}`, () => actions.builtinPlay(game.id), "play"),
        button("편집", "hm-btn hm-btn-sec hm-btn-xs", `start-home-builtin-edit-${game.id}`, () => actions.builtinEdit(game.id)),
      ] }),
    ] })) }),
  ] });
}
