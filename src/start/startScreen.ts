// start/startScreen.ts
// 데스크톱 앱 첫 화면(start-screen.html) — 「플레이」·「만들기」 두 갈래 런처(2026-10-17).
//
// 왜 바꿨나: 2026-10-07 판은 화면 전체가 새 게임 컨셉 피드였다(레일 「홈·탐색·내 프로젝트·템플릿」, 위 막대 「새 게임」).
// 이 앱은 만든 게임을 하는 샌드박스로 간다. 첫 화면이 「만드는 홈」 하나면 플레이를 끼울 자리가 없어서, 지금 두 갈래로 나눈다.
//   - 플레이: 이어서 플레이(시작 화면에서 마지막으로 플레이한 월드) + 내 월드 + 게임 파일(.oprn) 열기.
//   - 만들기: 이어서 만들기(최근 편집한 월드) + 새로 만들기(장르 인터뷰·빈 프로젝트) + 컨셉 피드(src/start/conceptFeed).
// 두 갈래는 같은 월드 카드(src/start/playFeed)를 쓰고 주 단추만 바꾼다. 공유 월드(store.openrpgmaker.com)는 아직 잇지 않는다.
// 「플레이」는 그 폴더를 열고 편집기 문서를 플레이 모드로 부팅한다(startIntent 의 START_PLAY_URL).

import "./startScreen.css";
import { mountWindowControls } from "./windowControls";
import { APP_VERSION } from "@/brand";
import type { RecentProjectEntry, RecentTeamEntry } from "../../electron/shared/start";
import type { OprnBridgeStart } from "@/project/persistence/electronRepository";
import { el } from "@/util/dom";
import { getLocale, initI18n, LOCALE_NATIVE_NAMES, setLocale, SUPPORTED_LOCALES, t, type SupportedLocale } from "@/i18n";
import { START_PLAY_URL, writeStartScreenIntent } from "./startIntent";
import { createConceptFeed, type ConceptFeed } from "./conceptFeed/conceptFeed";
import { launcherBriefHandler, launcherMakeHandler } from "./conceptFeed/launcherMake";
import { createConceptSource } from "@/concepts/source";
import { OPRN_GAME_FILE_ACCEPT, readOprnGameFile } from "@/player/oprnGameFile";
import { serialize } from "@/project/io";
import { createLauncherShell, readLauncherMode, topButton, writeLauncherMode, type LauncherMode } from "./launcherShell";
import { readPlayedLog, recordPlayed, worldGrid, worldLead, worldsByLastPlayed, type PlayedLog, type WorldAction, type WorldListOptions } from "./playFeed/playFeed";
import { startIcon } from "./icons";

export const START_SCREEN_TESTIDS = {
  root: "start-screen",
  openFolder: "start-open-folder",
  openGameFile: "start-open-game-file",
  joinTeam: "start-join-team",
  continueMaking: "start-continue",
  playHome: "start-play-home",
  worldSearch: "start-world-search",
  world: "start-world",
  worldPlay: "start-world-play",
  worldEdit: "start-world-edit",
  worldMake: "start-world-make",
  showAll: "start-show-all",
  hiddenToggle: "start-hidden-toggle",
  back: "start-back",
  error: "start-error",
  joinInput: "start-join-input",
  joinSubmit: "start-join-submit",
  recentTeam: "start-recent-team",
} as const;

const BLANK_TITLE = "새 게임";
/** 「이어서 만들기」·「이어서 플레이」 판 오른쪽 줄에 놓는 수. 나머지는 「모두 보기」·「내 월드」 격자. */
const SIDE_ROWS = 4;

type View = "home" | "join";

type State = {
  mode: LauncherMode;
  view: View;
  entries: readonly RecentProjectEntry[];
  played: PlayedLog;
  loaded: boolean;
  showHidden: boolean;
  showAllMaking: boolean;
  worldQuery: string;
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

type ActivityKind = "edited" | "opened" | "played";

/**
 * 「2시간 전 편집」「어제 플레이」를 한 문장으로 만든다. 「{0} 편집」 조각은 카탈로그에서 Edit {0} 라
 * 이어 붙이면 번역이 틀리므로, 경우마다 통째로 적어 번역 카탈로그가 문장 단위로 찾게 한다.
 */
function activityLabel(iso: string | null | undefined, kind: ActivityKind, now = Date.now()): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const pick = (edited: string, opened: string, played: string): string => kind === "edited" ? edited : kind === "opened" ? opened : played;
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return pick("방금 편집", "방금 열어 봄", "방금 플레이");
  if (minutes < 60) return pick(`${minutes}분 전 편집`, `${minutes}분 전 열어 봄`, `${minutes}분 전 플레이`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return pick(`${hours}시간 전 편집`, `${hours}시간 전 열어 봄`, `${hours}시간 전 플레이`);
  const days = Math.floor(hours / 24);
  if (days === 1) return pick("어제 편집", "어제 열어 봄", "어제 플레이");
  if (days < 7) return pick(`${days}일 전 편집`, `${days}일 전 열어 봄`, `${days}일 전 플레이`);
  const date = new Date(at);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (date.getFullYear() === new Date(now).getFullYear()) return pick(`${month}월 ${day}일 편집`, `${month}월 ${day}일 열어 봄`, `${month}월 ${day}일 플레이`);
  const year = date.getFullYear();
  return pick(`${year}년 ${month}월 ${day}일 편집`, `${year}년 ${month}월 ${day}일 열어 봄`, `${year}년 ${month}월 ${day}일 플레이`);
}

/** 만들기 쪽 한 줄 — 편집 시각(없으면 마지막으로 연 시각)과 맵 수. */
function makingMeta(entry: RecentProjectEntry): string {
  const parts: string[] = [];
  // 저장 행의 시각이 있으면 편집 시각, 없으면(빈 폴더) 마지막으로 연 시각이다 — 둘을 같은 말로 부르지 않는다.
  const activity = activityLabel(entry.updatedAt, "edited") || activityLabel(entry.lastOpenedAt, "opened");
  if (activity) parts.push(activity);
  if (typeof entry.mapCount === "number" && entry.mapCount > 0) parts.push(`맵 ${entry.mapCount}개`);
  if (entry.hiddenReason === "temporary") parts.push("임시 폴더");
  if (entry.hiddenReason === "missing") parts.push("폴더 없음");
  return parts.join(" · ");
}

/** 플레이 쪽 한 줄 — 시작 화면에서 마지막으로 플레이한 시각. 플레이한 적이 없으면 만들기 쪽과 같은 줄. */
function playingMeta(entry: RecentProjectEntry, played: PlayedLog): string {
  return activityLabel(played[entry.projectDir], "played") || makingMeta(entry);
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
    class: "ln-locale",
    attrs: { "aria-label": "언어", translate: "no" },
    dataset: { testid: "start-locale-select" },
    children: SUPPORTED_LOCALES.map((locale) => el("option", { text: LOCALE_NATIVE_NAMES[locale], attrs: { value: locale, lang: locale } })),
  });
  select.value = getLocale();
  select.addEventListener("change", () => void setLocale(select.value as SupportedLocale));
  return select;
}

/** 시작 화면이 그림을 다시 구울 항목 — 그림이 없거나 낡았고, 숨김(임시·사라진 폴더)이 아닌 것. */
export function entriesNeedingCover(entries: readonly RecentProjectEntry[]): readonly RecentProjectEntry[] {
  return entries.filter((entry) => !entry.hiddenReason && (!entry.cover || entry.coverStale === true));
}

function localStore(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function section(testid: string | null, head: readonly HTMLElement[], body: readonly HTMLElement[]): HTMLElement {
  return el("section", {
    class: "ln-sec",
    ...(testid ? { dataset: { testid } } : {}),
    children: [el("div", { class: "ln-sec-head", children: [...head] }), ...body],
  });
}

export function mountStartScreen(host: HTMLElement, bridge: OprnBridgeStart | undefined): void {
  const state: State = {
    mode: readLauncherMode(localStore()) ?? "make",
    view: "home",
    entries: [],
    played: readPlayedLog(localStore()),
    loaded: false,
    showHidden: false,
    showAllMaking: false,
    worldQuery: "",
    busy: false,
    joinUrl: "",
    teams: [],
  };
  host.dataset.testid = START_SCREEN_TESTIDS.root;
  const errorBox = el("p", { class: "ln-error", attrs: { role: "alert" }, dataset: { testid: START_SCREEN_TESTIDS.error } });
  const setError = (message: string): void => {
    errorBox.textContent = message;
    errorBox.hidden = message === "";
  };
  setError("");

  const goEditor = (): void => {
    window.location.href = "/index.html";
  };
  /** 열어 둔 폴더를 플레이 모드로 부팅한다. 플레이 기록은 「이어서 플레이」 순서가 된다. */
  const goPlay = (projectDir: string): void => {
    recordPlayed(localStore(), projectDir);
    window.location.href = START_PLAY_URL;
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

  /** 최근 목록의 폴더를 연다. 사라졌으면 숨김으로 돌리고 던진다. */
  const openRecentFolder = async (entry: RecentProjectEntry): Promise<void> => {
    if (!bridge?.openRecent) throw new Error("데스크톱 앱에서만 최근 프로젝트를 열 수 있습니다.");
    const opened = await bridge.openRecent({ projectDir: entry.projectDir });
    if (opened) return;
    state.entries = state.entries.map((candidate) => candidate.projectDir === entry.projectDir ? { ...candidate, hiddenReason: "missing" } : candidate);
    renderWorlds();
    throw new Error("「" + entry.title + "」 폴더를 찾을 수 없습니다: " + entry.projectDir);
  };
  const editEntry = (entry: RecentProjectEntry): void => void run(async () => {
    await openRecentFolder(entry);
    goEditor();
  });
  const playEntry = (entry: RecentProjectEntry): void => void run(async () => {
    await openRecentFolder(entry);
    goPlay(entry.projectDir);
  });

  /**
   * 받은 게임 파일(.oprn)을 플레이한다. 플레이는 폴더 단위라 기본 위치에 그 게임의 폴더를 하나 만들어 풀고 연다 —
   * 그 뒤로는 「내 월드」에 남아 다시 플레이하거나 고쳐 볼 수 있다.
   */
  const openGameFile = (): void => {
    if (state.busy) return;
    const input = el("input", { attrs: { type: "file", accept: OPRN_GAME_FILE_ACCEPT } });
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      void run(async () => {
        if (!bridge) throw new Error("데스크톱 앱에서만 게임 파일을 열 수 있습니다.");
        const read = await readOprnGameFile(file);
        if (!read.ok) throw new Error(read.message);
        // 받은 게임을 그대로 새 폴더의 시드로 심는다 — 직렬화 형식은 편집기 저장과 같다.
        const title = read.project.meta.title.trim().slice(0, 80) || file.name.replace(/\.[^.]+$/, "") || t(BLANK_TITLE);
        const suggested = await bridge.suggestProjectDir?.({ title }).catch(() => null);
        const created = await bridge.createProject({ title, seed: serialize(read.project), ...(suggested?.projectDir ? { projectDir: suggested.projectDir } : {}) });
        if (!created) throw new Error("게임 파일을 풀 폴더를 만들지 못했습니다.");
        goPlay(created.projectDir);
      });
    }, { once: true });
    input.click();
  };

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

  // ── 월드 카드: 두 갈래가 같은 카드를 쓰고 주 단추만 바꾼다 ─────────────
  const playAside: WorldAction = { label: "플레이", testid: START_SCREEN_TESTIDS.worldPlay, run: playEntry };
  const play: WorldAction = { ...playAside, icon: "play" };
  const edit: WorldAction = { label: "편집", testid: START_SCREEN_TESTIDS.worldEdit, run: editEntry };
  const makeOn: WorldAction = { label: "이어서 만들기", testid: START_SCREEN_TESTIDS.worldMake, run: editEntry };
  const playOptions = (): WorldListOptions => ({ meta: (entry) => playingMeta(entry, state.played), open: play, aside: edit, cardTestid: START_SCREEN_TESTIDS.world });
  const makeOptions: WorldListOptions = { meta: makingMeta, open: makeOn, aside: playAside, cardTestid: START_SCREEN_TESTIDS.world };

  const hiddenNote = (): HTMLElement | null => {
    const { temporary, missing } = partitionRecentEntries(state.entries);
    if (temporary + missing === 0) return null;
    return el("p", { class: "ln-note", children: [
      el("span", { text: hiddenEntriesNote(temporary, missing, state.showHidden) }), " ",
      el("button", {
        class: "ln-link", attrs: { type: "button", "aria-pressed": String(state.showHidden) },
        dataset: { testid: START_SCREEN_TESTIDS.hiddenToggle },
        text: state.showHidden ? "다시 숨기기" : "보기",
        on: { click: () => { state.showHidden = !state.showHidden; renderWorlds(); } },
      }),
    ] });
  };
  const listed = (): readonly RecentProjectEntry[] => state.showHidden ? state.entries : partitionRecentEntries(state.entries).visible;

  /** 만들기 갈래 맨 위 「이어서 만들기」 — 컨셉 피드의 lead 칸에 얹는다. 월드가 없으면 비워 두고 「새로 만들기」가 맨 위가 된다. */
  const makingLead = el("div", { class: "ln-making" });
  const renderMakingLead = (): void => {
    const worlds = listed();
    const [first, ...rest] = worlds;
    if (!state.loaded || !first) {
      makingLead.replaceChildren(...(state.loaded ? [hiddenNote()].filter((node): node is HTMLElement => node !== null) : []));
      return;
    }
    const more = rest.length > SIDE_ROWS;
    makingLead.replaceChildren(section(START_SCREEN_TESTIDS.continueMaking, [
      el("h2", { text: "이어서 만들기" }),
      ...(more ? [el("button", {
        class: "ln-link", attrs: { type: "button", "aria-expanded": String(state.showAllMaking) }, dataset: { testid: START_SCREEN_TESTIDS.showAll },
        text: state.showAllMaking ? "접기" : "모두 보기",
        on: { click: () => { state.showAllMaking = !state.showAllMaking; renderMakingLead(); } },
      })] : []),
    ], [
      worldLead(first, { ...makeOptions, side: { title: "내 월드", entries: rest.slice(0, SIDE_ROWS) } }),
      ...(more && state.showAllMaking ? [worldGrid(rest.slice(SIDE_ROWS), { ...makeOptions, firstIndex: SIDE_ROWS + 1 })] : []),
      ...[hiddenNote()].filter((node): node is HTMLElement => node !== null),
    ]));
  };

  /** 플레이 갈래 본문. */
  const playPage = el("div", { class: "ln-page" });
  const playBody = el("div", { class: "ln-scroll", dataset: { testid: START_SCREEN_TESTIDS.playHome }, children: [playPage] });
  const worldSearchInput = el("input", {
    attrs: { type: "search", maxlength: "80", autocomplete: "off", "aria-label": "월드 검색", placeholder: t("월드 검색") },
    dataset: { testid: START_SCREEN_TESTIDS.worldSearch },
    on: { input: (event) => { state.worldQuery = (event.currentTarget as HTMLInputElement).value; renderPlayPage(); } },
  });
  const worldSearch = el("div", { class: "ln-search", children: [startIcon("search", "ln-icon"), worldSearchInput] });
  const builtinDemoSection = (): HTMLElement => {
    const demos = [
      {
        id: "chrono-bell",
        title: "폴른 스타: 추락한 별과 태엽의 성녀",
        meta: "중세 마법 판타지 JRPG · 안드로이드 이리스의 귀환 여정 제1막 · 6컷 오프닝",
        thumb: "/assets/generated/welcome/slide-04.png",
      },
      {
        id: "emerald-crown",
        title: "에메랄드 크라운: 새벽섬의 수호자",
        meta: "몬스터 수집 RPG · 8개 맵 · 스타터 선택 · 성소 보스전",
        thumb: "/assets/generated/welcome/slide-01.png",
      },
    ] as const;
    return section("start-builtin-demos", [
      el("h2", { text: "기본 데모 게임" }),
      el("p", { text: "설치된 공식 대표작 · AI 연결 없이 즉시 실행" }),
    ], [
      el("div", {
        class: "ln-grid",
        children: demos.map((demo) => el("article", {
          class: "ln-card",
          dataset: { testid: `start-builtin-demo-${demo.id}` },
          children: [
            el("button", {
              class: "ln-card-hit",
              attrs: { type: "button", title: demo.title },
              dataset: { testid: `start-builtin-play-${demo.id}` },
              on: { click: () => { window.location.href = `/index.html?demo=${demo.id}&play=1`; } },
              children: [
                el("span", {
                  class: "ln-art",
                  attrs: { "aria-hidden": "true" },
                  children: [el("img", { attrs: { src: demo.thumb, alt: "", decoding: "async", draggable: "false" } })],
                }),
                el("span", { class: "ln-world-title", text: demo.title, attrs: { translate: "no" } }),
              ],
            }),
            el("div", {
              class: "ln-card-meta",
              children: [
                el("span", { text: demo.meta }),
                el("button", {
                  class: "ln-link",
                  attrs: { type: "button" },
                  dataset: { testid: `start-builtin-play-btn-${demo.id}` },
                  text: "플레이",
                  on: { click: () => { window.location.href = `/index.html?demo=${demo.id}&play=1`; } },
                }),
                el("button", {
                  class: "ln-link",
                  attrs: { type: "button" },
                  dataset: { testid: `start-builtin-edit-${demo.id}` },
                  text: "편집",
                  on: { click: () => { window.location.href = `/index.html?demo=${demo.id}`; } },
                }),
              ],
            }),
          ],
        })),
      }),
    ]);
  };

  const renderPlayPage = (): void => {
    if (!state.loaded) {
      playPage.replaceChildren(el("p", { class: "ln-loading", text: "월드를 불러오는 중…" }));
      return;
    }
    const worlds = listed();
    const query = state.worldQuery.trim().toLocaleLowerCase();
    if (query) {
      const found = worlds.filter((entry) => entry.title.toLocaleLowerCase().includes(query));
      playPage.replaceChildren(section(null, [el("h2", { text: "검색 결과" })], [
        found.length > 0 ? worldGrid(found, { ...playOptions(), firstIndex: 0 }) : el("p", { class: "ln-loading", text: "맞는 월드가 없어요." }),
      ]));
      return;
    }
    if (worlds.length === 0) {
      playPage.replaceChildren(
        builtinDemoSection(),
        el("div", { class: "ln-empty", children: [
          el("h1", { text: "아직 플레이할 월드가 없어요" }),
          el("p", { text: "만든 게임은 여기에 모입니다. 받은 .oprn 게임 파일도 바로 열 수 있어요." }),
          el("div", { class: "ln-lead-actions", children: [
            el("button", { class: "ln-btn ln-btn-primary", attrs: { type: "button" }, text: "게임 파일 열기", on: { click: openGameFile } }),
            el("button", { class: "ln-btn ln-btn-secondary", attrs: { type: "button" }, text: "만들기로 가기", on: { click: () => setMode("make") } }),
          ] }),
          ...[hiddenNote()].filter((node): node is HTMLElement => node !== null),
        ] }),
      );
      return;
    }
    const played = worldsByLastPlayed(worlds, state.played);
    const [lead, ...recent] = played;
    playPage.replaceChildren(
      builtinDemoSection(),
      ...(lead ? [section(null, [el("h2", { text: "이어서 플레이" })], [
        worldLead(lead, { ...playOptions(), side: { title: "최근 플레이", entries: recent.slice(0, SIDE_ROWS) } }),
      ])] : []),
      section(null, [el("h2", { text: "내 월드" }), el("p", { text: "이 컴퓨터에 있는 게임" })], [
        worldGrid(worlds, { ...playOptions(), firstIndex: lead ? Math.min(recent.length, SIDE_ROWS) + 1 : 0 }),
        ...[hiddenNote()].filter((node): node is HTMLElement => node !== null),
      ]),
    );
  };

  const renderWorlds = (): void => {
    renderMakingLead();
    renderPlayPage();
  };

  // ── 만들기 갈래: 컨셉 피드 ────────────────────────────────────────────
  const source = createConceptSource();
  const ensureAiConnected = async (label: string): Promise<boolean> => {
    // AI 연결 창은 편집기 UI 를 끌고 온다 — 만들기를 누를 때만 받는다(코드 분할, 첫 화면 번들을 키우지 않게).
    const { ensureAiConnectedForPreset } = await import("@/editor/ui/aiConnectGate");
    return ensureAiConnectedForPreset({ presetLabel: label });
  };
  let feed: ConceptFeed | null = null;
  const makeFeed = (): ConceptFeed => feed ??= createConceptFeed({
    mode: "launcher",
    source,
    lead: makingLead,
    onBlank: createBlank,
    onInterview: async (brief, title) => {
      if (!bridge) throw new Error("데스크톱 앱에서만 새 게임을 만들 수 있습니다.");
      if (state.busy) return false;
      state.busy = true;
      try {
        return await launcherBriefHandler(bridge, { ensureAiConnected, goEditor, storage: window.sessionStorage })(brief, title);
      } finally {
        state.busy = false;
      }
    },
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

  // ── 틀 ────────────────────────────────────────────────────────────────
  const shell = createLauncherShell({
    mode: state.mode,
    onMode: (mode) => setMode(mode),
    foot: [localePicker(), el("span", { class: "ln-version", text: APP_VERSION, attrs: { translate: "no" } })],
  });
  const playActions = [topButton("게임 파일 열기", START_SCREEN_TESTIDS.openGameFile, "file", openGameFile)];
  const makeActions = [
    topButton("폴더 열기", START_SCREEN_TESTIDS.openFolder, "folder", openFolder),
    topButton("팀에 참여", START_SCREEN_TESTIDS.joinTeam, "team", () => showJoin()),
  ];

  const showHome = (): void => {
    state.view = "home";
    host.dataset.view = "home";
    if (state.mode === "play") {
      shell.show({ search: worldSearch, actions: playActions }, playBody);
      return;
    }
    const concepts = makeFeed();
    shell.show({ search: concepts.searchBox, actions: makeActions }, concepts.element);
  };

  const setMode = (mode: LauncherMode): void => {
    if (state.busy) return;
    if (feed?.busy()) return;
    state.mode = mode;
    writeLauncherMode(localStore(), mode);
    shell.setMode(mode);
    setError("");
    renderWorlds();
    showHome();
  };

  // ── 팀에 참여 — 만들기 갈래 본문을 잠시 대신한다 ───────────────────────
  const joinPage = el("div", { class: "ln-page ln-join" });
  const joinBody = el("div", { class: "ln-scroll", children: [joinPage] });
  const renderJoinView = (): void => {
    const urlInput = el("input", {
      class: "ln-input",
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
    joinPage.replaceChildren(
      el("button", {
        class: "ln-link", attrs: { type: "button" }, dataset: { testid: START_SCREEN_TESTIDS.back },
        children: [startIcon("back", "ln-icon"), "만들기로 돌아가기"], on: { click: () => showHome() },
      }),
      el("h1", { text: "팀에 참여" }),
      el("label", { attrs: { for: "start-join-url" }, text: "호스트 주소 또는 초대 링크" }),
      el("div", { class: "ln-join-row", children: [
        urlInput,
        el("button", { class: "ln-btn ln-btn-primary", attrs: { type: "button" }, dataset: { testid: START_SCREEN_TESTIDS.joinSubmit }, text: "참여", on: { click: () => joinTeam(state.joinUrl) } }),
      ] }),
      el("p", { class: "ln-hint", attrs: { id: "start-join-hint" }, text: "호스트 컴퓨터에서 파일 → 팀 협업 시작을 누르면 주소가 나옵니다. 같은 네트워크에 있어야 합니다. 프로젝트는 호스트 컴퓨터에 저장됩니다." }),
      ...(state.teams.length > 0 ? [
        el("h2", { text: "최근 참여한 팀" }),
        el("div", { class: "ln-team-list", children: state.teams.map((team, index) => el("button", {
          class: "ln-team",
          attrs: { type: "button", "aria-label": t("{0} 에 다시 참여").replace("{0}", new URL(team.url).host) },
          dataset: { testid: START_SCREEN_TESTIDS.recentTeam + "-" + index },
          on: { click: () => joinTeam(team.url) },
          children: [startIcon("team", "ln-icon"), el("b", { text: new URL(team.url).host }), el("small", { text: formatRelativeTime(team.lastJoinedAt) })],
        })) }),
      ] : []),
    );
  };
  const showJoin = (): void => {
    if (state.busy) return;
    state.view = "join";
    host.dataset.view = "join";
    setError("");
    renderJoinView();
    shell.show({ search: null, actions: makeActions }, joinBody);
    joinPage.querySelector<HTMLInputElement>("#start-join-url")?.focus();
    if (bridge?.recentTeams) {
      void bridge.recentTeams().then((teams) => {
        state.teams = teams;
        if (state.view === "join" && !state.busy) renderJoinView();
      }).catch(() => {});
    }
  };

  /** 구운 그림을 상태에 넣고, 화면에 있는 그 카드의 그림 칸만 바꾼다(전체를 다시 그리면 포커스가 튄다). */
  const applyCover = (projectDir: string, cover: string): void => {
    state.entries = state.entries.map((entry) => entry.projectDir === projectDir ? { ...entry, cover, coverStale: false } : entry);
    for (const art of [...makingLead.querySelectorAll<HTMLElement>("[data-cover-for]"), ...playPage.querySelectorAll<HTMLElement>("[data-cover-for]")]) {
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
    // 굽는 모듈은 번들 칩셋 목록을 끌고 와 첫 화면 번들을 키운다 — 구울 항목이 있을 때만 받는다(코드 분할).
    const coverModule = await import("./startCover").catch((error: unknown) => {
      console.warn("[start] 카드 그림 모듈을 받지 못했습니다:", error);
      return null;
    });
    if (!coverModule) return;
    const { renderProjectCover } = coverModule;
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
    if (event.key === "Escape" && state.view === "join" && !state.busy) showHome();
  });

  host.replaceChildren(shell.element, errorBox);
  renderWorlds();
  showHome();

  if (!bridge) {
    state.loaded = true;
    renderWorlds();
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
      renderWorlds();
      void refreshCovers();
    });
}

const host = typeof document !== "undefined" ? document.getElementById("start-app") : null;
// 편집기와 같은 번역 계층을 먼저 켠다 — 한국어면 카탈로그도 옵서버도 없다.
if (host) { mountWindowControls(); void initI18n().finally(() => mountStartScreen(host, window.oprn?.start)); }
