// start/startScreen.ts
// 데스크톱 앱 첫 화면(start-screen.html) — 「라이브러리 홈」(2026-10-20, 설계 http://mdc-server:18301/home-redesign-1.html A안).
//
// 2026-10-21: 레일 단추 하나 = 본문 칸 하나(홈 · 내 게임 · 기본 게임 · 새로 만들기, 위 막대의 팀에 참여).
//   같은 날 사람 팀 협업을 접었다(electron/shared/teamCollab.ts TEAM_COLLAB_ENABLED=false) — 「팀에 참여」 단추와 칸은 숨는다.
//   홈 = 할 수 있는 것만 — 이어서 만들기 배너 · 최근 게임 몇 개 · 지금 만들 수 있는 게임(컨셉 8개) · 기본 게임(작은 카드).
//   검색·분류·상세·골라서 만들기·빈 프로젝트는 「새로 만들기」, 전체 목록·숨김·게임 파일 열기는 「내 게임」 칸으로 옮겼다.
// 지금 칸의 주인은 state.section 하나(go/mount/leave/refresh). 칸마다 #해시 기록이 남아 마우스 뒤로 단추가 앞 칸으로 간다.
// 바닥에 AI 상태 줄과 「설정」(AI 엔진·모델, 언어)이 있다. 「플레이」는 그 폴더를 열고 편집기 문서를 플레이 모드로 부팅한다(START_PLAY_URL).
//
// 첫 화면은 가볍게 뜬다(agent/fast-start 와 같은 원칙): 게임 파일 읽기·카드 그림 굽기·설정 창은 누르거나 한가할 때만 받는다.
// 카드 그림은 첫 그림이 뜬 뒤 한가할 때 한 장씩 굽고, 호스트가 프로젝트 해시로 디스크에 남긴다(electron/main/recent.ts).

import "./startScreen.css";
// 창 단추의 지연 툴팁 모양. 편집기는 지도 스타일 층에서 싣지만 시작 화면에는 그 층이 없다 — 없으면 「닫기」가 맨글자로 레일 위에 남았다.
import "@/styles/map/delayed-tooltip.css";
import { mountWindowControls } from "./windowControls";
import { APP_VERSION } from "@/brand";
import type { RecentProjectEntry, RecentTeamEntry } from "../../electron/shared/start";
import type { OprnBridgeStart } from "@/project/persistence/electronRepository";
import { el } from "@/util/dom";
import { getLocale, initI18n, LOCALE_NATIVE_NAMES, t } from "@/i18n";
import { START_PLAY_URL, writeStartScreenIntent } from "./startIntent";
import { TEAM_COLLAB_ENABLED } from "../../electron/shared/teamCollab";
import { createConceptFeed, type ConceptFeed } from "./conceptFeed/conceptFeed";
import { launcherBriefHandler, launcherMakeHandler } from "./conceptFeed/launcherMake";
import { createConceptSource } from "@/concepts/source";
// 게임 파일 읽기·직렬화는 번들 타일셋(80MB)을 끌고 오므로 «게임 파일 열기» 를 누를 때만 받는다 — 첫 화면 번들에 넣지 않는다.
import { OPRN_GAME_FILE_ACCEPT } from "@/project/packageFormat";
import { createLauncherShell, topButton, type LauncherNav } from "./launcherShell";
import { recordPlayed } from "./playFeed/playFeed";
import { startIcon } from "./icons";
import { builtinGameEditUrl, builtinGamePlayUrl } from "./home/builtinGames";
import { aiNotice, builtinHomeShelf, builtinShelf, conceptShelf, continueHero, displayTitles, fillCover, firstRunHero, firstRunShelf, myGamesShelf, recentShelf, type HomeActions } from "./home/homeView";
import type { GameConcept } from "@/concepts/format";
import { loadEngineChoice, localAgentsEnabled } from "./settings/localAgents";
import type { AiStatusSummary, SettingsTab } from "./settings/settingsDialog";

export const START_SCREEN_TESTIDS = {
  root: "start-screen",
  openFolder: "start-open-folder",
  joinTeam: "start-join-team",
  back: "start-back",
  error: "start-error",
  joinInput: "start-join-input",
  joinSubmit: "start-join-submit",
  recentTeam: "start-recent-team",
} as const;

const BLANK_TITLE = "새 게임";
/** 카드 그림 굽기를 시작하기 전 기다림 — 첫 그림·프로젝트 코어 미리 읽기(fast-start, 1.5초)와 겹치지 않게. */
const COVER_IDLE_DELAY_MS = 2_500;

/** 지금 본문 칸. 레일 단추 넷 + 팀에 참여(@deprecated — 사람 팀 협업은 아직 지원하지 않는다, 2026-10-21. TEAM_COLLAB_ENABLED 가 꺼져 있으면 열리지 않는다). */
export type StartSection = Exclude<LauncherNav, "store"> | "join";

type State = {
  section: StartSection;
  /** 칸을 바꿀 때마다 1 오른다 — 늦게 온 비동기 결과가 지금 칸 것인지 가린다. */
  sectionSeq: number;
  entries: readonly RecentProjectEntry[];
  loaded: boolean;
  /** 홈의 「지금 만들 수 있는 게임」. null = 아직 안 옴. */
  lineup: readonly GameConcept[] | null;
  showHidden: boolean;
  busy: boolean;
  joinUrl: string;
  teams: readonly RecentTeamEntry[];
  aiReady: boolean;
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

/** 시작 화면이 그림을 다시 구울 항목 — 그림이 없거나(빈 맵 표식도 없다) 낡았고, 숨김(임시·사라진 폴더)이 아닌 것. */
export function entriesNeedingCover(entries: readonly RecentProjectEntry[]): readonly RecentProjectEntry[] {
  return entries.filter((entry) => !entry.hiddenReason && (entry.coverStale === true || (!entry.cover && entry.coverEmpty !== true)));
}

function localStore(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** 첫 화면을 다 그린 뒤 한가할 때. requestIdleCallback 이 없는 곳(사파리)은 시간만 기다린다. */
function whenIdle(delayMs: number, work: () => void): void {
  setTimeout(() => {
    const idle = (window as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(work, { timeout: 2_000 });
    else work();
  }, delayMs);
}

export function mountStartScreen(host: HTMLElement, bridge: OprnBridgeStart | undefined): void {
  const state: State = {
    section: "home",
    sectionSeq: 0,
    entries: [],
    loaded: false,
    lineup: null,
    showHidden: false,
    busy: false,
    joinUrl: "",
    teams: [],
    aiReady: loadEngineChoice() !== null,
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
  /** 열어 둔 폴더를 플레이 모드로 부팅한다. */
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
    refresh("entries");
    throw new Error("「" + entry.title + "」 폴더를 찾을 수 없습니다: " + entry.projectDir);
  };

  /**
   * 받은 게임 파일(.oprn)을 플레이한다. 플레이는 폴더 단위라 기본 위치에 그 게임의 폴더를 하나 만들어 풀고 연다 —
   * 그 뒤로는 「내 게임」에 남아 다시 플레이하거나 고쳐 볼 수 있다.
   */
  const openGameFile = (): void => {
    if (state.busy) return;
    const input = el("input", { attrs: { type: "file", accept: OPRN_GAME_FILE_ACCEPT } });
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      void run(async () => {
        if (!bridge) throw new Error("데스크톱 앱에서만 게임 파일을 열 수 있습니다.");
        const [{ readOprnGameFile }, { serialize }] = await Promise.all([import("@/player/oprnGameFile"), import("@/project/io")]);
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

  // @deprecated multi-user team collaboration is not supported yet (2026-10-21).
  // 참여하는 쪽도 앱이다. 주 프로세스가 호스트 페이지를 앱 창으로 열고, 첫 페이지가 뜨면 돌아온다.
  const joinTeam = (url: string): void => void run(async () => {
    if (!bridge?.joinTeam) throw new Error("데스크톱 앱에서만 팀에 참여할 수 있습니다.");
    const result = await bridge.joinTeam({ url });
    if (!result.ok) throw new Error(result.error);
    state.joinUrl = "";
    if (bridge.recentTeams) state.teams = await bridge.recentTeams();
    if (state.section === "join") renderJoinView();
  });

  // ── 설정 · AI 상태 줄 ─────────────────────────────────────────────────
  let settingsOpen = false;
  const applyAiStatus = (summary: AiStatusSummary): void => {
    shell.setAiStatus(summary);
    const ready = summary.tone === "ok";
    if (ready !== state.aiReady) { state.aiReady = ready; refresh("ai"); }
  };
  const openSettings = (tab: SettingsTab = "ai"): void => {
    if (settingsOpen) return;
    settingsOpen = true;
    // 설정 창은 누를 때만 받는다(첫 화면 번들을 키우지 않게).
    void import("./settings/settingsDialog").then(({ openSettingsDialog }) => {
      const dialog = openSettingsDialog({ tab, onEngineChange: (summary) => { if (summary.tone === "off") refreshAiStatus(); else applyAiStatus(summary); } });
      const observer = new MutationObserver(() => {
        if (document.querySelector("[data-testid='start-settings']")) return;
        settingsOpen = false;
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true });
      void dialog;
    }).catch((error: unknown) => {
      settingsOpen = false;
      setError(error instanceof Error ? error.message : String(error));
    });
  };
  /** 레일 AI 상태 줄 — 고른 엔진이 있으면 그 이름, 깃발이 켜져 있으면 한가할 때 한 번 찾아본다. */
  const refreshAiStatus = (): void => {
    void import("./settings/settingsDialog").then(async ({ summarizeAiStatus }) => {
      const choice = loadEngineChoice();
      if (!choice) {
        // 이 PC 의 AI 프로그램을 고르지 않았으면 조수는 편집기의 「AI 연결」(Google·ChatGPT 로그인·API 키)을 그대로 쓴다.
        // 그 연결이 살아 있으면 «AI 엔진이 아직 없어요» 라고 하지 않는다 — 로그인을 마쳐도 첫 화면이 계속 «없음» 이었다.
        const { getAiConnectionStatus, refreshAiConnectionStatus } = await import("@/editor/panels/aiConnectionStatus");
        await refreshAiConnectionStatus().catch(() => {});
        const status = getAiConnectionStatus();
        if (status.kind === "ready") { applyAiStatus({ tone: "ok", text: status.label }); return; }
      }
      if (!localAgentsEnabled()) { applyAiStatus(summarizeAiStatus(choice, null)); return; }
      const { createLocalAgentsApi } = await import("./settings/localAgents");
      const report = await createLocalAgentsApi().detect(false).catch(() => null);
      applyAiStatus(summarizeAiStatus(choice, report));
    }).catch(() => {});
  };

  // ── 칸(section) — 지금 보이는 본문의 주인은 이것 하나다 ─────────────────
  // 2026-10-21: 레일 단추가 한 긴 본문을 스크롤하던 판은 스크롤 위치가 레일 표시를 다시 정했고(누른 것과 표시가 어긋남),
  // 앞에서 연 컨셉 상세·검색어가 다른 단추를 눌러도 남았다. 이제 단추 하나 = 칸 하나이고, 칸을 바꿀 때마다
  // 떠나는 칸을 정리(leave)하고 새 칸을 상태에서 다시 그린다(render). 늦게 온 비동기 결과는 상태에만 넣고
  // 지금 칸이 그 데이터를 쓰면 그 칸만 다시 그린다 — 앞 칸의 요청이 새 칸을 덮지 않는다.
  const listed = (): readonly RecentProjectEntry[] => state.showHidden ? state.entries : partitionRecentEntries(state.entries).visible;
  const actions: HomeActions = {
    edit: (entry) => void run(async () => { await openRecentFolder(entry); goEditor(); }),
    play: (entry) => void run(async () => { await openRecentFolder(entry); goPlay(entry.projectDir); }),
    newGame: () => go("create"),
    openGameFile,
    builtinPlay: (id) => { if (!state.busy) window.location.href = builtinGamePlayUrl(id); },
    builtinEdit: (id) => { if (!state.busy) window.location.href = builtinGameEditUrl(id); },
    openSettings: () => openSettings("ai"),
  };
  const hiddenNote = (): HTMLElement | null => {
    const { temporary, missing } = partitionRecentEntries(state.entries);
    if (temporary + missing === 0) return null;
    return el("p", { class: "ln-note", children: [
      el("span", { text: hiddenEntriesNote(temporary, missing, state.showHidden) }), " ",
      el("button", {
        class: "ln-link", attrs: { type: "button", "aria-pressed": String(state.showHidden) },
        dataset: { testid: "start-hidden-toggle" },
        text: state.showHidden ? "다시 숨기기" : "보기",
        on: { click: () => { state.showHidden = !state.showHidden; refresh("entries"); } },
      }),
    ] });
  };

  // ── 새로 만들기(컨셉 피드) ─────────────────────────────────────────────
  const source = createConceptSource();
  const ensureAiConnected = async (label: string): Promise<boolean> => {
    // AI 연결 창은 편집기 UI 를 끌고 온다 — 만들기를 누를 때만 받는다(코드 분할, 첫 화면 번들을 키우지 않게).
    // 시작 화면에는 편집기 셸 CSS 가 없다 — AI 설정 창 스타일을 같이 받지 않으면 창이 위치 없이 문서 끝에 붙어
    // 첫 화면 뒤로 숨는다(「AI 연결하기」를 눌러도 아무것도 안 보였다).
    const [{ ensureAiConnectedForPreset }] = await Promise.all([import("@/editor/ui/aiConnectGate"), import("./aiModalStyles")]);
    try {
      return await ensureAiConnectedForPreset({ presetLabel: label });
    } finally {
      refreshAiStatus();
    }
  };
  /** 「새로 만들기」 칸 맨 위 — AI 엔진이 없을 때만 안내가 들어간다. */
  const createLead = el("div", { class: "hm-create-lead" });
  const renderCreateLead = (): void => { createLead.replaceChildren(...(state.aiReady ? [] : [aiNotice(actions)])); };
  const feed: ConceptFeed = createConceptFeed({
    mode: "launcher",
    source,
    lead: createLead,
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
  const localeButton = el("button", {
    class: "ln-foot-locale", attrs: { type: "button", translate: "no", "aria-label": "언어" }, dataset: { testid: "start-locale-open" },
    text: LOCALE_NATIVE_NAMES[getLocale()], on: { click: () => openSettings("general") },
  });
  const shell = createLauncherShell({
    onNav: (nav) => {
      // 스토어는 웹 스토어를 브라우저로 연다(프로젝트를 연 편집기 안에서 넣는다) — 지금 칸은 그대로 둔다.
      if (nav === "store") { window.open("https://store.openrpgmaker.com", "_blank", "noopener"); return; }
      go(nav);
    },
    onSettings: () => openSettings("ai"),
    foot: [el("span", { class: "ln-version", text: APP_VERSION, attrs: { translate: "no" } }), el("span", { class: "ln-foot-dot", text: "·", attrs: { "aria-hidden": "true" } }), localeButton],
  });
  const topActions = [
    topButton("폴더 열기", START_SCREEN_TESTIDS.openFolder, "folder", openFolder),
    // @deprecated multi-user team collaboration is not supported yet (2026-10-21). 스위치를 켜면 돌아온다.
    ...(TEAM_COLLAB_ENABLED ? [topButton("팀에 참여", START_SCREEN_TESTIDS.joinTeam, "team", () => go("join"))] : []),
  ];

  /** 칸마다 스크롤 상자 하나. 칸을 바꾸면 맨 위에서 시작한다. 같은 칸 안의 다시 그리기는 스크롤을 지킨다. */
  const page = (): { scroll: HTMLElement; inner: HTMLElement } => {
    const inner = el("div", { class: "ln-page" });
    return { scroll: el("div", { class: "ln-scroll", children: [inner] }), inner };
  };
  const homePage = page();
  const gamesPage = page();
  const builtinPage = page();
  const joinPage = page();
  joinPage.inner.classList.add("ln-join");

  const renderHomeSection = (): void => {
    const lead = !state.loaded
      ? el("div", { class: "hm-hero is-loading", attrs: { "aria-hidden": "true" } })
      : null;
    const worlds = listed();
    const titles = displayTitles(worlds, getLocale());
    const [first] = worlds;
    homePage.inner.replaceChildren(el("div", { class: "hm-home", children: [
      lead ?? (first ? continueHero(first, titles.get(first.projectDir) ?? first.title, makingMeta(first), actions) : firstRunHero(actions)),
      // 배너에 올린 게임은 빼고 그다음 몇 개 — 같은 게임을 두 번 보이지 않는다.
      ...(state.loaded && worlds.length > 1 ? [recentShelf({ entries: worlds.slice(1), total: worlds.length, titles, meta: makingMeta, actions, onMore: () => go("games") })] : []),
      conceptShelf({
        concepts: state.lineup,
        onOpen: (concept) => { if (go("create")) feed.openConcept(concept); },
        onMore: () => go("create"),
        thumb: (concept) => source.thumbUrl(concept, "card"),
      }),
      builtinHomeShelf(actions, () => go("builtin")),
    ] }));
  };
  const renderGamesSection = (): void => {
    if (!state.loaded) { gamesPage.inner.replaceChildren(el("p", { class: "ln-loading", text: "불러오는 중…" })); return; }
    const worlds = listed();
    gamesPage.inner.replaceChildren(worlds.length > 0
      ? myGamesShelf({ entries: worlds, titles: displayTitles(worlds, getLocale()), meta: makingMeta, showAll: true, onToggleAll: () => undefined, note: hiddenNote(), actions })
      : el("div", { children: [firstRunShelf(actions), ...(hiddenNote() ? [hiddenNote()!] : [])] }));
  };
  const renderBuiltinSection = (): void => { builtinPage.inner.replaceChildren(builtinShelf(actions)); };

  /** 칸을 상태에서 그려 틀에 꽂는다. */
  const mount = (section: StartSection): void => {
    host.dataset.view = section;
    shell.setActive(section === "join" ? null : section);
    if (section === "create") {
      renderCreateLead();
      shell.show({ search: feed.searchBox, actions: topActions }, feed.element);
      return;
    }
    if (section === "home") renderHomeSection();
    else if (section === "games") renderGamesSection();
    else if (section === "builtin") renderBuiltinSection();
    else renderJoinView();
    const target = section === "home" ? homePage : section === "games" ? gamesPage : section === "builtin" ? builtinPage : joinPage;
    shell.show({ search: null, actions: topActions }, target.scroll);
    target.scroll.scrollTop = 0;
  };
  /** 떠나는 칸의 잠깐 상태를 비운다 — 다음에 돌아오면 처음 화면이다. */
  const leave = (section: StartSection): void => {
    if (section === "create") feed.reset();
    if (section === "join") setError("");
  };
  /**
   * 칸 바꾸기. 만드는 중·여는 중이면 바꾸지 않는다(false). 같은 칸을 다시 누르면 그 칸을 처음 상태로 되돌린다
   * (새로 만들기 상세에서 「새로 만들기」를 다시 누르면 피드 맨 위).
   */
  function go(next: StartSection, how: { readonly history?: "push" | "none" } = {}): boolean {
    if (state.busy || feed.busy()) return false;
    // 팀 협업을 접어 둔 동안 #join 해시·옛 기록으로 들어와도 홈으로 보낸다.
    if (next === "join" && !TEAM_COLLAB_ENABLED) next = "home";
    leave(state.section);
    state.section = next;
    state.sectionSeq += 1;
    mount(next);
    if (how.history !== "none") {
      try { if (history.state?.section !== next) history.pushState({ section: next }, "", `#${next}`); } catch { /* file:// 등 */ }
    }
    if (next === "join") {
      joinPage.inner.querySelector<HTMLInputElement>("#start-join-url")?.focus();
      if (bridge?.recentTeams) {
        const mine = state.sectionSeq;
        void bridge.recentTeams().then((teams) => {
          state.teams = teams;
          // 늦게 온 목록 — 그동안 다른 칸으로 갔으면 상태에만 넣는다.
          if (mine === state.sectionSeq && !state.busy) renderJoinView();
        }).catch(() => {});
      }
    }
    return true;
  }
  /** 데이터가 바뀌었다 — 지금 칸이 그 데이터를 쓰면 그 칸만 다시 그린다(스크롤은 그대로). */
  function refresh(what: "entries" | "lineup" | "ai"): void {
    const section = state.section;
    if (what === "ai") { if (section === "create") renderCreateLead(); return; }
    if (section === "home") renderHomeSection();
    else if (section === "games" && what === "entries") renderGamesSection();
  }
  // 마우스 뒤로 단추·Alt+← — 칸 기록을 따라간다. 바꿀 수 없는 때(만드는 중)면 지금 칸을 다시 기록에 둔다.
  window.addEventListener("popstate", (event) => {
    const wanted = (event.state as { section?: StartSection } | null)?.section ?? sectionFromHash() ?? "home";
    if (wanted === state.section) return;
    if (!go(wanted, { history: "none" })) {
      try { history.pushState({ section: state.section }, "", `#${state.section}`); } catch { /* 무시 */ }
    }
  });

  // ── 팀에 참여 ─────────────────────────────────────────────────────────
  /** @deprecated multi-user team collaboration is not supported yet (2026-10-21). TEAM_COLLAB_ENABLED 가 꺼져 있으면 열리지 않는다. */
  function renderJoinView(): void {
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
    joinPage.inner.replaceChildren(
      el("button", {
        class: "ln-link", attrs: { type: "button" }, dataset: { testid: START_SCREEN_TESTIDS.back },
        children: [startIcon("back", "ln-icon"), "홈으로 돌아가기"], on: { click: () => go("home") },
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
  }

  /** 구운 그림을 상태에 넣고, 화면에 있는 그 게임의 그림 칸만 바꾼다(전체를 다시 그리면 포커스가 튄다). */
  const applyCover = (projectDir: string, cover: string | null): void => {
    state.entries = state.entries.map((entry) => entry.projectDir === projectDir ? { ...entry, cover, coverStale: false } : entry);
    const entry = state.entries.find((candidate) => candidate.projectDir === projectDir);
    for (const art of host.querySelectorAll<HTMLElement>("[data-cover-for]")) {
      if (art.dataset.coverFor === projectDir) fillCover(art, cover, entry?.title ?? "");
    }
    for (const bg of host.querySelectorAll<HTMLElement>("[data-cover-bg-for]")) {
      if (bg.dataset.coverBgFor === projectDir) bg.style.backgroundImage = cover ? `url("${cover}")` : "";
    }
  };

  /**
   * 그림이 없거나 낡은 게임의 대표 장면을 한 장씩 굽는다. 첫 화면이 다 뜬 뒤 한가할 때만 — 굽는 모듈(번들 칩셋 목록)과
   * 맵 그리기는 시작 경로에 두지 않는다. 결과는 호스트가 프로젝트 해시로 디스크에 남겨 다음 실행에는 굽지 않는다.
   */
  const refreshCovers = async (): Promise<void> => {
    const start = bridge;
    if (!start?.coverSource || !start.saveCover) return;
    const targets = entriesNeedingCover(state.entries);
    if (targets.length === 0) return;
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
        const result = await renderProjectCover(source);
        if (result.kind === "failed") continue;
        const dataUrl = result.kind === "cover" ? result.dataUrl : null;
        applyCover(entry.projectDir, dataUrl);
        await start.saveCover({ projectDir: entry.projectDir, dataUrl: dataUrl ?? "empty" });
      } catch (error) {
        console.warn("[start] 카드 그림을 굽지 못했습니다:", entry.projectDir, error);
      }
      // 한 장 굽고 한 번 쉰다 — 첫 화면 입력이 굽기에 막히지 않게.
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && state.section === "join" && !state.busy) go("home");
  });

  host.replaceChildren(shell.element, errorBox);
  const initial = sectionFromHash() ?? "home";
  state.section = initial;
  mount(initial);
  try { history.replaceState({ section: initial }, "", `#${initial}`); } catch { /* 무시 */ }
  whenIdle(600, refreshAiStatus);

  // 홈의 「지금 만들 수 있는 게임」 — 피드와 같은 출처의 첫 쪽(지금 칩셋으로 지을 수 있는 컨셉만 온다).
  void source.page({}, null).then((result) => { state.lineup = result.items; }, () => { state.lineup = []; }).finally(() => refresh("lineup"));

  if (!bridge) {
    state.loaded = true;
    refresh("entries");
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
      refresh("entries");
      // 데스크톱: 카드를 그렸다 — 메인이 숨겨 둔 창을 보이고 스플래시를 닫는다(electron/main/splash.ts).
      // requestAnimationFrame 은 쓰지 않는다: 숨은 창에서는 프레임이 돌지 않아 0.5s 넘게 늦었다.
      window.oprn?.startScreenReady?.();
      whenIdle(COVER_IDLE_DELAY_MS, () => void refreshCovers());
    });
}

const START_SECTIONS: readonly StartSection[] = ["home", "games", "builtin", "create", "join"];
function sectionFromHash(): StartSection | null {
  if (typeof location === "undefined") return null;
  const hash = location.hash.replace(/^#/, "");
  // 팀 협업을 접어 둔 동안 #join 은 칸으로 치지 않는다(첫 화면은 go() 를 거치지 않고 바로 mount 한다).
  if (hash === "join" && !TEAM_COLLAB_ENABLED) return null;
  return (START_SECTIONS as readonly string[]).includes(hash) ? hash as StartSection : null;
}

const host = typeof document !== "undefined" ? document.getElementById("start-app") : null;
// 편집기와 같은 번역 계층을 먼저 켠다 — 한국어면 카탈로그도 옵서버도 없다.
if (host) { mountWindowControls(); void initI18n().finally(() => mountStartScreen(host, window.oprn?.start)); }
