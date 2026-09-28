// start/startScreen.ts
// 데스크톱 앱 첫 화면(start-screen.html) — 런처형: 왼쪽 레일(새 게임·폴더 열기) + 이어서 만들기·최근 작업.
//
// 왜 다시 만들었나 (2026-09-27): 옛 화면은 크림색 카드에 버튼 둘과 경로 목록뿐이었다. 목록 20줄 중
// 19줄이 QA 가 남긴 `/tmp/oprn-packaged-*` 경로였고, 「새 프로젝트」는 장르도 묻지 않고 빈 편집기로
// 넘어간 뒤 캔버스 위 브리핑이 다시 「어떤 게임을 만들까요?」를 물었다. 이 화면이 그 질문을 가져간다.
//
// 번들을 가볍게 둔다: 장르 씨앗·인터뷰·AI 모듈은 편집기 몫이다(편집기 트리를 import 하면 수십 MB 가 된다).
// 여기서는 폴더만 만들고, 고른 장르·한 문장은 startIntent 로 편집기 부팅에 넘긴다(src/editor/startScreenHandoff.ts).

import "./startScreen.css";
import { APP_VERSION, PRODUCT_BRAND } from "@/brand";
import { NEW_PROJECT_CHOICES, type NewProjectChoice, type NewProjectChoiceId } from "@/editor/newProjectChoices";
import type { RecentProjectEntry, RecentTeamEntry } from "../../electron/shared/start";
import type { OprnBridgeStart } from "@/project/persistence/electronRepository";
import { el } from "@/util/dom";
import { getLocale, initI18n, LOCALE_NATIVE_NAMES, setLocale, SUPPORTED_LOCALES, t, type SupportedLocale } from "@/i18n";
import { writeStartScreenIntent } from "./startIntent";

export const START_SCREEN_TESTIDS = {
  root: "start-screen",
  newGame: "start-new-game",
  openFolder: "start-open-folder",
  joinTeam: "start-join-team",
  navRecent: "start-nav-recent",
  navNew: "start-nav-new",
  continueCard: "start-continue",
  continueOpen: "start-continue-open",
  newCard: "start-new-card",
  recentCard: "start-recent-card",
  hiddenToggle: "start-hidden-toggle",
  intentInput: "start-intent-input",
  genreOption: "start-genre-option",
  titleInput: "start-title-input",
  location: "start-location",
  changeLocation: "start-change-location",
  create: "start-create",
  back: "start-back",
  error: "start-error",
  joinInput: "start-join-input",
  joinSubmit: "start-join-submit",
  recentTeam: "start-recent-team",
} as const;

const DEFAULT_TITLE = "새 게임";
/** 격자 첫 칸은 「새 게임」이라 최근 프로젝트는 11장까지 — 넓은 창에서 네 칸 세 줄이 찬다. */
const MAX_GRID = 11;
/** 최근 작업이 하나도 없을 때(첫 방문) 히어로 판에 까는 키아트. */
const WELCOME_ART = "/assets/generated/welcome/start-hero.jpg";

type View = "home" | "new" | "join";

type State = {
  view: View;
  entries: readonly RecentProjectEntry[];
  loaded: boolean;
  showHidden: boolean;
  choiceId: NewProjectChoiceId | null;
  intent: string;
  title: string;
  /** 사용자가 고른 상위 위치. null 이면 호스트 기본(문서/OPRN Games). */
  root: string | null;
  projectDir: string | null;
  busy: boolean;
  error: string;
  joinUrl: string;
  teams: readonly RecentTeamEntry[];
};

/** 첫 화면에 보이는 장르 — 새 프로젝트 다이얼로그·웰컴과 같은 정본(featured)만 쓴다. */
const GENRES: readonly NewProjectChoice[] = NEW_PROJECT_CHOICES.filter((choice) => choice.featured);

/** 새 게임 입력판 뒤에 까는 그림 — 고른 장르의 포스터, 없으면(빈 프로젝트) 키아트. */
function composeArt(choiceId: NewProjectChoiceId | null): string {
  return GENRES.find((choice) => choice.id === choiceId)?.thumb ?? WELCOME_ART;
}

export function formatRelativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return minutes + "분 전";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "시간 전";
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return days + "일 전";
  const date = new Date(at);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  // 한 템플릿으로 써야 번역 카탈로그가 날짜 순서까지 바꿀 수 있다(Sep 28 / 9月28日).
  return sameYear
    ? `${date.getMonth() + 1}월 ${date.getDate()}일`
    : `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** 최근 목록을 보이는 것과 숨긴 것으로 가른다. 숨김은 임시 폴더(QA 찌꺼기)와 사라진 폴더다. */
export function partitionRecentEntries(entries: readonly RecentProjectEntry[]): {
  readonly visible: readonly RecentProjectEntry[];
  readonly temporary: number;
  readonly missing: number;
} {
  const visible = entries.filter((entry) => !entry.hiddenReason);
  return {
    visible,
    temporary: entries.filter((entry) => entry.hiddenReason === "temporary").length,
    missing: entries.filter((entry) => entry.hiddenReason === "missing").length,
  };
}

/**
 * 「2시간 전 편집」「어제 열어 봄」을 한 문장으로 만든다. 「{0} 편집」 조각은 카탈로그에서 Edit {0} 라
 * 이어 붙이면 번역이 틀리므로, 경우마다 통째로 적어 번역 카탈로그가 문장 단위로 찾게 한다.
 */
function activityLabel(iso: string | null | undefined, kind: "edited" | "opened", now = Date.now()): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const edited = kind === "edited";
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return edited ? "방금 편집" : "방금 열어 봄";
  if (minutes < 60) return edited ? `${minutes}분 전 편집` : `${minutes}분 전 열어 봄`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return edited ? `${hours}시간 전 편집` : `${hours}시간 전 열어 봄`;
  const days = Math.floor(hours / 24);
  if (days === 1) return edited ? "어제 편집" : "어제 열어 봄";
  if (days < 7) return edited ? `${days}일 전 편집` : `${days}일 전 열어 봄`;
  const date = new Date(at);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (date.getFullYear() === new Date(now).getFullYear()) return edited ? `${month}월 ${day}일 편집` : `${month}월 ${day}일 열어 봄`;
  const year = date.getFullYear();
  return edited ? `${year}년 ${month}월 ${day}일 편집` : `${year}년 ${month}월 ${day}일 열어 봄`;
}

function entryMeta(entry: RecentProjectEntry): string {
  const parts: string[] = [];
  // 저장 행의 시각이 있으면 편집 시각, 없으면(빈 폴더) 마지막으로 연 시각이다 — 둘을 같은 말로 부르지 않는다.
  const activity = activityLabel(entry.updatedAt, "edited") || activityLabel(entry.lastOpenedAt, "opened");
  if (activity) parts.push(activity);
  if (typeof entry.mapCount === "number" && entry.mapCount > 0) parts.push(`맵 ${entry.mapCount}개`);
  if (entry.hiddenReason === "temporary") parts.push("임시 폴더");
  if (entry.hiddenReason === "missing") parts.push("폴더 없음");
  return parts.join(" · ");
}

function icon(name: "plus" | "folder" | "clock" | "sparkle" | "back" | "blank" | "arrow" | "team"): HTMLElement {
  return el("span", { class: "start-icon start-icon-" + name, attrs: { "aria-hidden": "true" } });
}

/** 숨긴 항목 안내. 문장을 조각으로 이어 붙이면 번역 카탈로그가 찾지 못하므로 경우마다 한 문장으로 쓴다. */
function hiddenEntriesNote(temporary: number, missing: number, showing: boolean): string {
  if (temporary > 0 && missing > 0) {
    return showing
      ? `임시 폴더의 테스트 프로젝트 ${temporary}개와 찾을 수 없는 폴더 ${missing}개를 함께 보여 주는 중입니다.`
      : `임시 폴더의 테스트 프로젝트 ${temporary}개와 찾을 수 없는 폴더 ${missing}개를 숨겼습니다.`;
  }
  if (temporary > 0) {
    return showing ? `임시 폴더의 테스트 프로젝트 ${temporary}개를 함께 보여 주는 중입니다.` : `임시 폴더의 테스트 프로젝트 ${temporary}개를 숨겼습니다.`;
  }
  return showing ? `찾을 수 없는 폴더 ${missing}개를 함께 보여 주는 중입니다.` : `찾을 수 없는 폴더 ${missing}개를 숨겼습니다.`;
}

/**
 * 레일 아래 언어 고르기. 데스크톱 앱은 이 화면에서 시작하므로 편집기의 「보기 → 언어」까지 가지 않고도 바꿀 수 있어야 한다.
 * 고른 값은 편집기와 같은 localStorage(oprn:locale)에 남는다. 언어 이름은 그 언어로 쓴다(translate="no").
 */
function localePicker(): HTMLElement {
  const select = el("select", {
    class: "start-locale-select",
    attrs: { "aria-label": "언어", translate: "no" },
    dataset: { testid: "start-locale-select" },
    children: SUPPORTED_LOCALES.map((locale) => el("option", { text: LOCALE_NATIVE_NAMES[locale], attrs: { value: locale, lang: locale } })),
  });
  select.value = getLocale();
  select.addEventListener("change", () => void setLocale(select.value as SupportedLocale));
  return select;
}

function coverArt(entry: RecentProjectEntry, className: string): HTMLElement {
  const art = el("span", { class: className, attrs: { "aria-hidden": "true" }, dataset: { coverFor: entry.projectDir } });
  if (entry.cover) {
    art.append(el("img", { attrs: { src: entry.cover, alt: "", decoding: "async", draggable: "false" } }));
  } else {
    // 그림이 아직 없다 — 시작 화면이 곧 굽는다(refreshCovers). 그 사이, 또는 그릴 수 없는 맵이면 제목 첫 글자.
    art.classList.add("is-empty");
    art.append(el("span", { class: "start-cover-initial", text: Array.from(entry.title.trim())[0] ?? "?" }));
  }
  return art;
}

/** 시작 화면이 그림을 다시 구울 항목 — 그림이 없거나 낡았고, 숨김(임시·사라진 폴더)이 아닌 것. */
export function entriesNeedingCover(entries: readonly RecentProjectEntry[]): readonly RecentProjectEntry[] {
  return entries.filter((entry) => !entry.hiddenReason && (!entry.cover || entry.coverStale === true));
}

export function mountStartScreen(host: HTMLElement, bridge: OprnBridgeStart | undefined): void {
  const state: State = {
    view: "home",
    entries: [],
    loaded: false,
    showHidden: false,
    choiceId: null,
    intent: "",
    // 입력칸 값은 번역 계층이 건드리지 않으므로 기본 제목은 여기서 직접 번역한다.
    title: t(DEFAULT_TITLE),
    root: null,
    projectDir: null,
    busy: false,
    error: "",
    joinUrl: "",
    teams: [],
  };

  host.dataset.testid = START_SCREEN_TESTIDS.root;
  const errorBox = el("p", { class: "start-error", attrs: { role: "alert" }, dataset: { testid: START_SCREEN_TESTIDS.error } });
  const main = el("section", { class: "start-main", attrs: { "aria-live": "polite" } });

  const setError = (message: string): void => {
    state.error = message;
    errorBox.textContent = message;
    errorBox.hidden = message === "";
  };
  setError("");

  const goEditor = (): void => {
    window.location.href = "/index.html";
  };

  const run = async (work: () => Promise<void>): Promise<void> => {
    if (state.busy) return;
    state.busy = true;
    host.classList.add("is-busy");
    setError("");
    try {
      await work();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      state.busy = false;
      host.classList.remove("is-busy");
    }
  };

  const openFolder = (): void => void run(async () => {
    if (!bridge) throw new Error("데스크톱 앱에서만 폴더를 열 수 있습니다.");
    const opened = await bridge.openFolder();
    if (opened) goEditor();
  });

  const openEntry = (entry: RecentProjectEntry): void => void run(async () => {
    if (!bridge?.openRecent) throw new Error("데스크톱 앱에서만 최근 프로젝트를 열 수 있습니다.");
    const opened = await bridge.openRecent({ projectDir: entry.projectDir });
    if (!opened) {
      state.entries = state.entries.map((candidate) => candidate.projectDir === entry.projectDir ? { ...candidate, hiddenReason: "missing" } : candidate);
      render();
      throw new Error("「" + entry.title + "」 폴더를 찾을 수 없습니다: " + entry.projectDir);
    }
    goEditor();
  });

  let suggestSeq = 0;
  const refreshLocation = async (): Promise<void> => {
    if (!bridge?.suggestProjectDir) return;
    const seq = ++suggestSeq;
    try {
      const suggested = await bridge.suggestProjectDir({ title: state.title, ...(state.root ? { root: state.root } : {}) });
      if (seq !== suggestSeq) return;
      state.projectDir = suggested.projectDir;
    } catch {
      if (seq !== suggestSeq) return;
      state.projectDir = null;
    }
    const code = main.querySelector<HTMLElement>("[data-testid='" + START_SCREEN_TESTIDS.location + "']");
    if (code) code.textContent = state.projectDir ?? "저장 위치를 정하지 못했습니다";
  };

  const showView = (view: View, choiceId?: NewProjectChoiceId | null): void => {
    state.view = view;
    if (choiceId !== undefined) state.choiceId = choiceId;
    setError("");
    render();
    if (view === "new") {
      void refreshLocation();
      main.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    }
    if (view === "join") {
      main.querySelector<HTMLInputElement>("#start-join-url")?.focus();
      if (bridge?.recentTeams) {
        void bridge.recentTeams().then((teams) => {
          state.teams = teams;
          if (state.view === "join" && !state.busy) render();
        }).catch(() => {});
      }
    }
  };

  const create = (): void => void run(async () => {
    if (!bridge) throw new Error("데스크톱 앱에서만 새 게임을 만들 수 있습니다.");
    const title = state.title.trim() || t(DEFAULT_TITLE);
    if (!state.projectDir) await refreshLocation();
    if (!state.projectDir) throw new Error("저장 위치를 정하지 못했습니다. 「위치 바꾸기」로 위치를 골라 주세요.");
    const created = await bridge.createProject({ title, projectDir: state.projectDir });
    if (!created) throw new Error("새 게임 폴더를 만들지 못했습니다.");
    try {
      writeStartScreenIntent(window.sessionStorage, {
        projectDir: created.projectDir,
        title,
        choiceId: state.choiceId,
        intent: state.intent.trim(),
      });
    } catch {
      // sessionStorage 를 못 쓰면 빈 프로젝트로 연다 — 폴더는 이미 만들어졌다.
    }
    goEditor();
  });

  const chooseRoot = (): void => void run(async () => {
    if (!bridge?.chooseProjectRoot) return;
    const root = await bridge.chooseProjectRoot();
    if (!root) return;
    state.root = root;
    await refreshLocation();
  });

  // 참여하는 쪽도 앱이다. 주 프로세스가 호스트 페이지를 앱 창으로 열고, 첫 페이지가 뜨면 돌아온다.
  const joinTeam = (url: string): void => void run(async () => {
    if (!bridge?.joinTeam) throw new Error("데스크톱 앱에서만 팀에 참여할 수 있습니다.");
    const result = await bridge.joinTeam({ url });
    if (!result.ok) throw new Error(result.error);
    state.joinUrl = "";
    if (bridge.recentTeams) state.teams = await bridge.recentTeams();
    if (state.view === "join") render();
  });

  // ── 레일 ──────────────────────────────────────────────────────────────
  const navRecent = el("button", {
    class: "start-nav-item",
    attrs: { type: "button" },
    dataset: { testid: START_SCREEN_TESTIDS.navRecent },
    children: [icon("clock"), "최근 작업"],
    on: { click: () => showView("home") },
  });
  const navNew = el("button", {
    class: "start-nav-item",
    attrs: { type: "button" },
    dataset: { testid: START_SCREEN_TESTIDS.navNew },
    children: [icon("sparkle"), "새 게임"],
    on: { click: () => showView("new") },
  });
  const rail = el("aside", {
    class: "start-rail",
    children: [
      el("div", {
        class: "start-brand",
        children: [
          el("span", { class: "start-logo", text: "O", attrs: { "aria-hidden": "true" } }),
          el("span", { class: "start-brand-text", children: [
            el("span", { class: "start-brand-name", text: PRODUCT_BRAND }),
            el("span", { class: "start-brand-tag", text: "RPG 제작 스튜디오" }),
          ] }),
        ],
      }),
      el("button", {
        class: "start-btn start-btn-primary start-btn-block",
        attrs: { type: "button" },
        dataset: { testid: START_SCREEN_TESTIDS.newGame },
        children: [icon("plus"), "새 게임 만들기"],
        on: { click: () => showView("new", null) },
      }),
      el("button", {
        class: "start-btn start-btn-block",
        attrs: { type: "button" },
        dataset: { testid: START_SCREEN_TESTIDS.openFolder },
        children: [icon("folder"), "폴더 열기"],
        on: { click: openFolder },
      }),
      el("button", {
        class: "start-btn start-btn-block",
        attrs: { type: "button" },
        dataset: { testid: START_SCREEN_TESTIDS.joinTeam },
        children: [icon("team"), "팀에 참여"],
        on: { click: () => showView("join") },
      }),
      el("nav", { class: "start-nav", attrs: { "aria-label": "시작 화면" }, children: [navRecent, navNew] }),
      el("div", { class: "start-rail-foot", children: [localePicker(), el("span", { text: APP_VERSION })] }),
    ],
  });

  // ── 홈 ────────────────────────────────────────────────────────────────
  /**
   * 가장 최근 프로젝트를 판 전체로 보인다 — 시작 맵 그림이 배경이다. 판 전체가 「열기」 단추이고(투명 단추를 뒤에 깐다),
   * 앞의 단추들은 같은 판 위에서 따로 눌린다. 그림은 applyCover 가 나중에 바꿔 끼울 수 있게 data-hero-for 를 단다.
   */
  const heroFor = (entry: RecentProjectEntry): HTMLElement => {
    const hero = el("section", {
      class: "start-hero" + (entry.cover ? "" : " is-empty-art"),
      attrs: { "aria-label": "이어서 만들기" },
      dataset: { testid: START_SCREEN_TESTIDS.continueCard, heroFor: entry.projectDir },
    });
    if (entry.cover) hero.append(el("img", { class: "start-hero-bg", attrs: { src: entry.cover, alt: "", decoding: "async", draggable: "false" } }));
    hero.append(
      el("button", {
        class: "start-hero-open",
        attrs: { type: "button", "aria-label": entry.title + " 열기" },
        dataset: { testid: START_SCREEN_TESTIDS.continueOpen },
        on: { click: () => openEntry(entry) },
      }),
      el("div", { class: "start-hero-body", children: [
        el("span", { class: "start-kicker", text: "이어서 만들기" }),
        el("h1", { class: "start-hero-title", text: entry.title }),
        el("span", { class: "start-hero-meta", text: entryMeta(entry) }),
        el("span", { class: "start-path", text: entry.projectDir }),
        el("div", { class: "start-hero-actions", children: [
          // 판 전체 단추(start-hero-open)와 같은 일을 하는 겉모양이다. 키보드·화면 낭독기는 판 단추 하나만 만난다.
          el("span", {
            class: "start-btn start-btn-primary start-btn-lg",
            attrs: { "aria-hidden": "true" },
            children: ["계속 만들기", icon("arrow")],
          }),
          el("button", {
            class: "start-btn start-btn-lg",
            attrs: { type: "button" },
            children: [icon("plus"), "새 게임"],
            on: { click: () => showView("new", null) },
          }),
        ] }),
      ] }),
    );
    return hero;
  };

  const genrePosters = (onPick: (id: NewProjectChoiceId | null) => void, selected: NewProjectChoiceId | null | undefined): HTMLElement => {
    const poster = (id: NewProjectChoiceId | null, label: string, blurb: string, thumb: string | null): HTMLButtonElement => {
      const button = el("button", {
        class: "start-poster" + (thumb ? "" : " is-blank"),
        attrs: {
          type: "button",
          "aria-label": label + " — " + blurb,
          ...(selected !== undefined ? { "aria-pressed": String(selected === id) } : {}),
        },
        dataset: { testid: START_SCREEN_TESTIDS.genreOption + "-" + (id ?? "blank") },
        on: { click: () => onPick(id) },
        children: thumb
          ? [
              el("img", { attrs: { src: thumb, alt: "", decoding: "async", loading: "lazy", draggable: "false" } }),
              el("span", { class: "start-poster-veil", attrs: { "aria-hidden": "true" } }),
              el("span", { class: "start-poster-text", children: [
                el("span", { class: "start-poster-title", text: label }),
                el("span", { class: "start-poster-blurb", text: blurb }),
              ] }),
            ]
          : [
              icon("blank"),
              el("span", { class: "start-poster-text", children: [
                el("span", { class: "start-poster-title", text: label }),
                el("span", { class: "start-poster-blurb", text: blurb }),
              ] }),
            ],
      });
      return button;
    };
    return el("div", {
      class: "start-posters",
      attrs: { role: "group", "aria-label": "시작 장르" },
      children: [
        ...GENRES.map((choice) => poster(choice.id, choice.posterTitle ?? choice.label, choice.blurb, choice.thumb)),
        poster(null, "빈 프로젝트", "장르 설정 없이 시작", null),
      ],
    });
  };

  const renderHome = (): HTMLElement[] => {
    if (!state.loaded) return [el("div", { class: "start-loading", text: "최근 작업을 읽는 중…" })];
    const { visible, temporary, missing } = partitionRecentEntries(state.entries);
    const list = state.showHidden ? state.entries : visible;
    const out: HTMLElement[] = [];
    if (list.length === 0) {
      out.push(
        el("section", { class: "start-hero is-art is-welcome", children: [
          el("img", { class: "start-hero-bg", attrs: { src: WELCOME_ART, alt: "", decoding: "async", draggable: "false" } }),
          el("div", { class: "start-hero-body", children: [
            el("span", { class: "start-kicker", text: "NEW GAME" }),
            el("h1", { class: "start-hero-title", text: "첫 게임을 만들어 볼까요?" }),
            el("p", { class: "start-sub", text: "장르를 고르면 시스템 설정을 갖춘 채 시작합니다. 한 문장으로 적으면 AI가 첫 장면을 만들어요." }),
            el("div", { class: "start-hero-actions", children: [
              el("button", {
                class: "start-btn start-btn-primary start-btn-lg",
                attrs: { type: "button" },
                children: [icon("sparkle"), "새 게임 만들기"],
                on: { click: () => showView("new", null) },
              }),
              el("button", {
                class: "start-btn start-btn-lg",
                attrs: { type: "button" },
                children: [icon("folder"), "폴더 열기"],
                on: { click: openFolder },
              }),
            ] }),
          ] }),
        ] }),
        el("h2", { class: "start-section", text: "장르에서 바로 시작" }),
        genrePosters((id) => showView("new", id), undefined),
      );
    } else {
      const [first, ...rest] = list;
      out.push(heroFor(first!));
      out.push(el("h2", { class: "start-section", children: [
        "최근 프로젝트",
        ...(rest.length > 0 ? [el("span", { class: "start-section-count", text: String(rest.length) })] : []),
      ] }));
      out.push(el("div", {
        class: "start-grid",
        children: [
          el("button", {
            class: "start-card is-new",
            attrs: { type: "button", "aria-label": "새 게임 만들기" },
            dataset: { testid: START_SCREEN_TESTIDS.newCard },
            on: { click: () => showView("new", null) },
            children: [el("span", { class: "start-new-card-body", children: [
              icon("plus"),
              el("span", { text: "새 게임" }),
              el("small", { text: "장르·한 문장으로 시작" }),
            ] })],
          }),
          ...rest.slice(0, state.showHidden ? rest.length : MAX_GRID).map((entry, index) => el("button", {
            class: "start-card" + (entry.hiddenReason ? " is-hidden-entry" : ""),
            attrs: { type: "button", "aria-label": entry.title + " 열기", title: entry.projectDir },
            dataset: { testid: START_SCREEN_TESTIDS.recentCard + "-" + index },
            on: { click: () => openEntry(entry) },
            children: [
              coverArt(entry, "start-card-art"),
              el("span", { class: "start-card-body", children: [
                el("span", { class: "start-card-title", text: entry.title }),
                el("span", { class: "start-meta", text: entryMeta(entry) }),
              ] }),
            ],
          })),
        ],
      }));
    }
    if (temporary + missing > 0) {
      out.push(el("p", { class: "start-hidden-note", children: [
        el("span", { text: hiddenEntriesNote(temporary, missing, state.showHidden) }),
        el("button", {
          class: "start-link",
          attrs: { type: "button", "aria-pressed": String(state.showHidden) },
          dataset: { testid: START_SCREEN_TESTIDS.hiddenToggle },
          text: state.showHidden ? "다시 숨기기" : "보기",
          on: { click: () => { state.showHidden = !state.showHidden; render(); } },
        }),
      ] }));
    }
    return out;
  };

  // ── 새 게임 ───────────────────────────────────────────────────────────
  const renderNew = (): HTMLElement[] => {
    const intent = el("textarea", {
      class: "start-input start-intent",
      value: state.intent,
      attrs: {
        id: "start-intent",
        rows: "2",
        maxlength: "600",
        placeholder: "예: 눈 내리는 마을에 잠을 파는 여관이 있어요",
      },
      dataset: { testid: START_SCREEN_TESTIDS.intentInput },
      on: { input: (event) => { state.intent = (event.currentTarget as HTMLTextAreaElement).value; } },
    });
    const titleInput = el("input", {
      class: "start-input",
      value: state.title,
      attrs: { id: "start-title", type: "text", maxlength: "80", autocomplete: "off" },
      dataset: { testid: START_SCREEN_TESTIDS.titleInput },
      on: {
        input: (event) => { state.title = (event.currentTarget as HTMLInputElement).value; void refreshLocation(); },
        keydown: (event) => { if ((event as KeyboardEvent).key === "Enter") { event.preventDefault(); create(); } },
      },
    });
    return [
      el("div", { class: "start-new-head", children: [
        el("button", {
          class: "start-btn start-btn-icon",
          attrs: { type: "button", "aria-label": "최근 작업으로 돌아가기" },
          dataset: { testid: START_SCREEN_TESTIDS.back },
          children: [icon("back")],
          on: { click: () => showView("home") },
        }),
        el("h1", { class: "start-title", text: "새 게임" }),
      ] }),
      el("div", { class: "start-compose", children: [
        el("img", {
          class: "start-compose-bg",
          attrs: { src: composeArt(state.choiceId), alt: "", decoding: "async", draggable: "false" },
          dataset: { testid: "start-compose-art" },
        }),
        el("label", { class: "start-compose-title", attrs: { for: "start-intent" }, text: "어떤 게임을 만들까요?" }),
        intent,
        el("p", { class: "start-hint", text: "한 문장이면 충분해요. 적어 두면 편집기가 열리자마자 AI 조수가 첫 장면을 만듭니다. 장르를 고르면 먼저 몇 가지 질문으로 기획을 정하고, 적어 둔 문장은 첫 답으로 담깁니다." }),
      ] }),
      el("div", { class: "start-field", children: [
        el("span", { class: "start-label", attrs: { id: "start-genre-label" }, text: "시작 장르" }),
        genrePosters((id) => {
          state.choiceId = id;
          main.querySelectorAll<HTMLButtonElement>(".start-posters .start-poster").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.testid === START_SCREEN_TESTIDS.genreOption + "-" + (id ?? "blank")));
          });
          const art = main.querySelector<HTMLImageElement>(".start-compose-bg");
          if (art) art.src = composeArt(id);
        }, state.choiceId),
      ] }),
      el("div", { class: "start-row", children: [
        el("div", { class: "start-field start-field-grow", children: [
          el("label", { class: "start-label", attrs: { for: "start-title" }, text: "게임 이름" }),
          titleInput,
        ] }),
      ] }),
      el("div", { class: "start-footer", children: [
        el("p", { class: "start-location", children: [
          icon("folder"),
          el("span", { class: "start-location-label", text: "저장 위치" }),
          el("code", { text: state.projectDir ?? "…", dataset: { testid: START_SCREEN_TESTIDS.location } }),
          el("button", {
            class: "start-link",
            attrs: { type: "button" },
            dataset: { testid: START_SCREEN_TESTIDS.changeLocation },
            // 「바꾸기」 하나로 쓰면 카탈로그의 치환 뜻(Replace)을 받는다 — 저장 위치를 바꾸는 단추라 뜻을 밝힌다.
            text: "위치 바꾸기",
            on: { click: chooseRoot },
          }),
        ] }),
        el("button", {
          class: "start-btn start-btn-primary start-btn-lg",
          attrs: { type: "button" },
          dataset: { testid: START_SCREEN_TESTIDS.create },
          text: "만들기",
          on: { click: create },
        }),
      ] }),
    ];
  };

  // ── 팀에 참여 ─────────────────────────────────────────────────────────
  const renderJoin = (): HTMLElement[] => {
    const urlInput = el("input", {
      class: "start-input",
      value: state.joinUrl,
      attrs: {
        id: "start-join-url",
        type: "url",
        inputmode: "url",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "예: http://192.168.0.10:9840",
        "aria-describedby": "start-join-hint",
      },
      dataset: { testid: START_SCREEN_TESTIDS.joinInput },
      on: {
        input: (event) => { state.joinUrl = (event.currentTarget as HTMLInputElement).value; },
        keydown: (event) => { if ((event as KeyboardEvent).key === "Enter") { event.preventDefault(); joinTeam(state.joinUrl); } },
      },
    });
    const out: HTMLElement[] = [
      el("div", { class: "start-new-head", children: [
        el("button", {
          class: "start-btn start-btn-icon",
          attrs: { type: "button", "aria-label": "최근 작업으로 돌아가기" },
          dataset: { testid: START_SCREEN_TESTIDS.back },
          children: [icon("back")],
          on: { click: () => showView("home") },
        }),
        el("h1", { class: "start-title", text: "팀에 참여" }),
      ] }),
      el("div", { class: "start-field", children: [
        el("label", { class: "start-label", attrs: { for: "start-join-url" }, text: "호스트 주소 또는 초대 링크" }),
        el("div", { class: "start-row", children: [
          el("div", { class: "start-field-grow", children: [urlInput] }),
          el("button", {
            class: "start-btn start-btn-primary",
            attrs: { type: "button" },
            dataset: { testid: START_SCREEN_TESTIDS.joinSubmit },
            text: "참여",
            on: { click: () => joinTeam(state.joinUrl) },
          }),
        ] }),
        el("p", {
          class: "start-hint",
          attrs: { id: "start-join-hint" },
          text: "호스트 컴퓨터에서 파일 → 팀 협업 시작을 누르면 주소가 나옵니다. 같은 네트워크에 있어야 합니다. 프로젝트는 호스트 컴퓨터에 저장됩니다.",
        }),
      ] }),
    ];
    if (state.teams.length > 0) {
      out.push(el("h2", { class: "start-section", text: "최근 참여한 팀" }));
      out.push(el("div", {
        class: "start-team-list",
        children: state.teams.map((team, index) => el("button", {
          class: "start-team",
          attrs: { type: "button", "aria-label": t("{0} 에 다시 참여").replace("{0}", new URL(team.url).host) },
          dataset: { testid: START_SCREEN_TESTIDS.recentTeam + "-" + index },
          on: { click: () => joinTeam(team.url) },
          children: [
            icon("team"),
            el("span", { class: "start-team-host", text: new URL(team.url).host }),
            el("span", { class: "start-meta", text: formatRelativeTime(team.lastJoinedAt) }),
          ],
        })),
      }));
    }
    return out;
  };

  const render = (): void => {
    const home = state.view === "home";
    const renderView = (): HTMLElement[] => state.view === "home" ? renderHome() : state.view === "new" ? renderNew() : renderJoin();
    navRecent.classList.toggle("is-active", home);
    navNew.classList.toggle("is-active", state.view === "new");
    if (home) { navRecent.setAttribute("aria-current", "page"); navNew.removeAttribute("aria-current"); }
    else if (state.view === "new") { navNew.setAttribute("aria-current", "page"); navRecent.removeAttribute("aria-current"); }
    else { navNew.removeAttribute("aria-current"); navRecent.removeAttribute("aria-current"); }
    main.replaceChildren(...renderView(), errorBox);
  };

  /** 구운 그림을 상태에 넣고, 화면에 있는 그 카드의 그림 칸만 바꾼다(전체를 다시 그리면 포커스가 튄다). */
  const applyCover = (projectDir: string, cover: string): void => {
    state.entries = state.entries.map((entry) => entry.projectDir === projectDir ? { ...entry, cover, coverStale: false } : entry);
    for (const art of main.querySelectorAll<HTMLElement>("[data-cover-for]")) {
      if (art.dataset.coverFor !== projectDir) continue;
      art.classList.remove("is-empty");
      art.replaceChildren(el("img", { attrs: { src: cover, alt: "", decoding: "async", draggable: "false" } }));
    }
    for (const hero of main.querySelectorAll<HTMLElement>("[data-hero-for]")) {
      if (hero.dataset.heroFor !== projectDir) continue;
      hero.classList.remove("is-empty-art");
      const current = hero.querySelector<HTMLImageElement>(".start-hero-bg");
      if (current) current.src = cover;
      else hero.prepend(el("img", { class: "start-hero-bg", attrs: { src: cover, alt: "", decoding: "async", draggable: "false" } }));
    }
  };

  /**
   * 그림이 없거나 낡은 프로젝트의 시작 맵을 여기서 굽는다. 한 장씩 차례로 — 프로젝트마다 타일셋 그림을 읽으므로
   * 한꺼번에 돌리면 첫 화면이 버벅인다. 굽는 모듈은 필요할 때만 받는다(번들 칩셋 목록이 첫 화면 번들을 키운다).
   */
  const refreshCovers = async (): Promise<void> => {
    const start = bridge;
    if (!start?.coverSource || !start.saveCover) return;
    const targets = entriesNeedingCover(state.entries);
    if (targets.length === 0) return;
    let renderProjectCover: typeof import("./startCover").renderProjectCover;
    try {
      ({ renderProjectCover } = await import("./startCover"));
    } catch (error) {
      console.warn("[start] 카드 그림 모듈을 받지 못했습니다:", error);
      return;
    }
    for (const entry of targets) {
      try {
        const source = await start.coverSource({ projectDir: entry.projectDir });
        if (!source) continue;
        const cover = await renderProjectCover(source);
        if (!cover) continue;
        applyCover(entry.projectDir, cover);
        await start.saveCover({ projectDir: entry.projectDir, dataUrl: cover });
      } catch (error) {
        console.warn("[start] 카드 그림을 굽지 못했습니다:", entry.projectDir, error);
      }
    }
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.view !== "home" && !state.busy) showView("home");
  });

  host.replaceChildren(rail, main);
  render();

  if (!bridge) {
    state.loaded = true;
    render();
    setError("시작 화면은 데스크톱 앱에서만 동작합니다.");
    return;
  }
  void bridge.recentProjects()
    .then((entries) => { state.entries = entries; })
    .catch((error: unknown) => {
      console.error("[start] 최근 프로젝트를 읽지 못했습니다:", error);
      setError("최근 프로젝트 목록을 읽지 못했습니다.");
    })
    .finally(() => {
      state.loaded = true;
      // 최근 작업이 하나도 없으면 첫 방문이다 — 홈이 장르 포스터를 보여 준다.
      render();
      void refreshCovers();
    });
}

const host = typeof document !== "undefined" ? document.getElementById("start-app") : null;
// 편집기와 같은 번역 계층을 먼저 켠다 — 한국어면 카탈로그도 옵서버도 없다.
if (host) void initI18n().finally(() => mountStartScreen(host, window.oprn?.start));
