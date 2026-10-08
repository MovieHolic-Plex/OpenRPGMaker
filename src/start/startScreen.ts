// start/startScreen.ts
// 데스크톱 앱 첫 화면(start-screen.html) = 새 게임 컨셉 피드(2026-10-07, docs/superpowers/specs/2026-10-07-concept-feed-design.md).
//
// 왜 바꿨나: 이전 화면은 로비 히어로·예제 카드·AI 인터뷰(장르 4개 → 질문 5개)·빈 프로젝트 확인 화면이 섞여 있었고,
// 편집기 메뉴 「새 프로젝트」와 환영 화면도 저마다 다른 모양이었다. 이제 세 입구가 같은 피드(src/start/conceptFeed)를 쓰고,
// 컨셉을 고르면 이름·폴더·화면 크기를 묻지 않고 바로 만든다. 확정 기획은 startIntent 로 그 폴더의 편집기 부팅에 넘긴다.
// 위 막대에 폴더 열기·팀 참여·언어가 있고, 최근 프로젝트는 피드 위 「이어하기」 줄이다.

import "./startScreen.css";
import { mountWindowControls } from "./windowControls";
import { APP_VERSION } from "@/brand";
import type { RecentProjectEntry, RecentTeamEntry } from "../../electron/shared/start";
import type { OprnBridgeStart } from "@/project/persistence/electronRepository";
import { el } from "@/util/dom";
import { getLocale, initI18n, LOCALE_NATIVE_NAMES, setLocale, SUPPORTED_LOCALES, t, type SupportedLocale } from "@/i18n";
import { writeStartScreenIntent } from "./startIntent";
import { createConceptFeed, type ConceptFeed } from "./conceptFeed/conceptFeed";
import { launcherMakeHandler } from "./conceptFeed/launcherMake";
import { createConceptSource } from "@/concepts/source";

export const START_SCREEN_TESTIDS = {
  root: "start-screen",
  openFolder: "start-open-folder",
  joinTeam: "start-join-team",
  continueRow: "start-continue",
  recentCard: "start-recent-card",
  hiddenToggle: "start-hidden-toggle",
  back: "start-back",
  error: "start-error",
  joinInput: "start-join-input",
  joinSubmit: "start-join-submit",
  recentTeam: "start-recent-team",
} as const;

const BLANK_TITLE = "새 게임";
/** 이어하기 줄에 보이는 최근 프로젝트 수. */
const MAX_CONTINUE = 11;

type View = "home" | "join";

type State = {
  view: View;
  entries: readonly RecentProjectEntry[];
  loaded: boolean;
  showHidden: boolean;
  busy: boolean;
  joinUrl: string;
  teams: readonly RecentTeamEntry[];
};

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
  const state: State = { view: "home", entries: [], loaded: false, showHidden: false, busy: false, joinUrl: "", teams: [] };
  host.dataset.testid = START_SCREEN_TESTIDS.root;
  const errorBox = el("p", { class: "start-error start-floating-error", attrs: { role: "alert" }, dataset: { testid: START_SCREEN_TESTIDS.error } });
  const setError = (message: string): void => {
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
      renderContinue();
      throw new Error("「" + entry.title + "」 폴더를 찾을 수 없습니다: " + entry.projectDir);
    }
    goEditor();
  });

  /** 빈 프로젝트 — 장르 없이 기본 위치에 새 폴더. */
  const createBlank = (): void => void run(async () => {
    if (!bridge) throw new Error("데스크톱 앱에서만 새 게임을 만들 수 있습니다.");
    const title = t(BLANK_TITLE);
    const suggested = await bridge.suggestProjectDir?.({ title }).catch(() => null);
    const created = await bridge.createProject({ title, ...(suggested?.projectDir ? { projectDir: suggested.projectDir } : {}) });
    if (!created) throw new Error("새 게임 폴더를 만들지 못했습니다.");
    try {
      writeStartScreenIntent(window.sessionStorage, { projectDir: created.projectDir, title, choiceId: null, intent: "", startMode: "blank", screenSize: "wide" });
    } catch { /* 인계를 못 써도 빈 폴더는 그대로 열린다. */ }
    goEditor();
  });

  // 참여하는 쪽도 앱이다. 주 프로세스가 호스트 페이지를 앱 창으로 열고, 첫 페이지가 뜨면 돌아온다.
  const joinTeam = (url: string): void => void run(async () => {
    if (!bridge?.joinTeam) throw new Error("데스크톱 앱에서만 팀에 참여할 수 있습니다.");
    const result = await bridge.joinTeam({ url });
    if (!result.ok) throw new Error(result.error);
    state.joinUrl = "";
    if (bridge.recentTeams) state.teams = await bridge.recentTeams();
    if (state.view === "join") renderJoinView();
  });

  // ── 이어하기 줄 ───────────────────────────────────────────────────────
  const continueRow = el("section", { class: "cf-continue", attrs: { "aria-label": "이어하기" }, dataset: { testid: START_SCREEN_TESTIDS.continueRow } });
  continueRow.hidden = true;
  const renderContinue = (): void => {
    const { visible, temporary, missing } = partitionRecentEntries(state.entries);
    const list = (state.showHidden ? state.entries : visible).slice(0, state.showHidden ? state.entries.length : MAX_CONTINUE);
    continueRow.hidden = !state.loaded || (list.length === 0 && temporary + missing === 0);
    continueRow.replaceChildren(
      el("h2", { text: "이어하기" }),
      el("div", { class: "cf-continue-row", children: list.map((entry, index) => el("button", {
        class: "cf-continue-card" + (entry.hiddenReason ? " is-hidden-entry" : ""),
        attrs: { type: "button", "aria-label": entry.title + " 열기", title: entry.projectDir },
        dataset: { testid: START_SCREEN_TESTIDS.recentCard + "-" + index },
        on: { click: () => openEntry(entry) },
        children: [
          coverArt(entry, "cf-continue-art"),
          el("span", { class: "cf-continue-title", text: entry.title, attrs: { translate: "no" } }),
          el("span", { class: "cf-continue-meta", text: entryMeta(entry) }),
        ],
      })) }),
      ...(temporary + missing > 0 ? [el("p", { class: "cf-continue-note", children: [
        el("span", { text: hiddenEntriesNote(temporary, missing, state.showHidden) }), " ",
        el("button", {
          class: "cf-link", attrs: { type: "button", "aria-pressed": String(state.showHidden) },
          dataset: { testid: START_SCREEN_TESTIDS.hiddenToggle },
          text: state.showHidden ? "다시 숨기기" : "보기",
          on: { click: () => { state.showHidden = !state.showHidden; renderContinue(); } },
        }),
      ] })] : []),
    );
  };

  // ── 피드 ──────────────────────────────────────────────────────────────
  const topButton = (label: string, testid: string, icon: "folder" | "team", onClick: () => void): HTMLElement => el("button", {
    class: "cf-top-btn", attrs: { type: "button" }, dataset: { testid }, on: { click: onClick },
    children: [el("span", { class: "start-icon start-icon-" + icon, attrs: { "aria-hidden": "true" } }), label],
  });
  const source = createConceptSource();
  const ensureAiConnected = async (label: string): Promise<boolean> => {
    const { ensureAiConnectedForPreset } = await import("@/editor/ui/aiConnectGate");
    return ensureAiConnectedForPreset({ presetLabel: label });
  };
  let feed: ConceptFeed | null = null;
  const mountFeed = (): ConceptFeed => createConceptFeed({
    mode: "launcher",
    source,
    continueRow,
    topActions: [
      topButton("폴더 열기", START_SCREEN_TESTIDS.openFolder, "folder", openFolder),
      topButton("팀에 참여", START_SCREEN_TESTIDS.joinTeam, "team", () => showView("join")),
      localePicker(),
      el("span", { class: "cf-version", text: APP_VERSION }),
    ],
    onBlank: createBlank,
    beforeDraft: () => ensureAiConnected("내가 쓴 컨셉"),
    onMake: async (concept, tweak) => {
      if (!bridge) throw new Error("데스크톱 앱에서만 새 게임을 만들 수 있습니다.");
      if (state.busy) return false;
      state.busy = true;
      try {
        return await launcherMakeHandler(bridge, {
          ensureAiConnected,
          made: (slug) => source.made(slug),
          goEditor,
          storage: window.sessionStorage,
        })(concept, tweak);
      } finally {
        state.busy = false;
      }
    },
  });

  // ── 팀에 참여 ─────────────────────────────────────────────────────────
  const joinView = el("section", { class: "start-join-view" });
  const renderJoinView = (): void => {
    const urlInput = el("input", {
      class: "start-input",
      value: state.joinUrl,
      attrs: {
        id: "start-join-url", type: "url", inputmode: "url", autocomplete: "off", spellcheck: "false",
        placeholder: "예: http://192.168.0.10:9840", "aria-describedby": "start-join-hint",
      },
      dataset: { testid: START_SCREEN_TESTIDS.joinInput },
      on: {
        input: (event) => { state.joinUrl = (event.currentTarget as HTMLInputElement).value; },
        keydown: (event) => { if ((event as KeyboardEvent).key === "Enter") { event.preventDefault(); joinTeam(state.joinUrl); } },
      },
    });
    joinView.replaceChildren(
      el("div", { class: "start-new-head", children: [
        el("button", {
          class: "start-btn start-btn-icon", attrs: { type: "button", "aria-label": "새 게임으로 돌아가기" },
          dataset: { testid: START_SCREEN_TESTIDS.back }, children: [icon("back")], on: { click: () => showView("home") },
        }),
        el("h1", { class: "start-title", text: "팀에 참여" }),
      ] }),
      el("div", { class: "start-field", children: [
        el("label", { class: "start-label", attrs: { for: "start-join-url" }, text: "호스트 주소 또는 초대 링크" }),
        el("div", { class: "start-row", children: [
          el("div", { class: "start-field-grow", children: [urlInput] }),
          el("button", { class: "start-btn start-btn-primary", attrs: { type: "button" }, dataset: { testid: START_SCREEN_TESTIDS.joinSubmit }, text: "참여", on: { click: () => joinTeam(state.joinUrl) } }),
        ] }),
        el("p", { class: "start-hint", attrs: { id: "start-join-hint" }, text: "호스트 컴퓨터에서 파일 → 팀 협업 시작을 누르면 주소가 나옵니다. 같은 네트워크에 있어야 합니다. 프로젝트는 호스트 컴퓨터에 저장됩니다." }),
      ] }),
      ...(state.teams.length > 0 ? [
        el("h2", { class: "start-section", text: "최근 참여한 팀" }),
        el("div", { class: "start-team-list", children: state.teams.map((team, index) => el("button", {
          class: "start-team",
          attrs: { type: "button", "aria-label": t("{0} 에 다시 참여").replace("{0}", new URL(team.url).host) },
          dataset: { testid: START_SCREEN_TESTIDS.recentTeam + "-" + index },
          on: { click: () => joinTeam(team.url) },
          children: [icon("team"), el("span", { class: "start-team-host", text: new URL(team.url).host }), el("span", { class: "start-meta", text: formatRelativeTime(team.lastJoinedAt) })],
        })) }),
      ] : []),
    );
  };

  const showView = (view: View): void => {
    if (state.busy) return;
    state.view = view;
    host.dataset.view = view;
    setError("");
    if (view === "join") {
      feed?.dispose();
      feed = null;
      renderJoinView();
      host.replaceChildren(joinView, errorBox);
      joinView.querySelector<HTMLInputElement>("#start-join-url")?.focus();
      if (bridge?.recentTeams) {
        void bridge.recentTeams().then((teams) => {
          state.teams = teams;
          if (state.view === "join" && !state.busy) renderJoinView();
        }).catch(() => {});
      }
      return;
    }
    feed = mountFeed();
    host.replaceChildren(feed.element, errorBox);
    renderContinue();
  };

  /** 구운 그림을 상태에 넣고, 화면에 있는 그 카드의 그림 칸만 바꾼다(전체를 다시 그리면 포커스가 튄다). */
  const applyCover = (projectDir: string, cover: string): void => {
    state.entries = state.entries.map((entry) => entry.projectDir === projectDir ? { ...entry, cover, coverStale: false } : entry);
    for (const art of host.querySelectorAll<HTMLElement>("[data-cover-for]")) {
      if (art.dataset.coverFor !== projectDir) continue;
      art.classList.remove("is-empty");
      art.replaceChildren(el("img", { attrs: { src: cover, alt: "", decoding: "async", draggable: "false" } }));
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
    if (event.key === "Escape" && state.view === "join" && !state.busy) showView("home");
  });

  showView("home");

  if (!bridge) {
    state.loaded = true;
    renderContinue();
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
      renderContinue();
      void refreshCovers();
    });
}

const host = typeof document !== "undefined" ? document.getElementById("start-app") : null;
// 편집기와 같은 번역 계층을 먼저 켠다 — 한국어면 카탈로그도 옵서버도 없다.
if (host) { mountWindowControls(); void initI18n().finally(() => mountStartScreen(host, window.oprn?.start)); }
