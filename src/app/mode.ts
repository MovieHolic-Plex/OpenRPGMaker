// app/mode.ts
// EDIT/PLAY 모드 상태 + Phaser 게임 인스턴스 + DOM 생명주기.
// 한 번에 하나의 모드만 활성. 전환 시 이전 Phaser 게임 파괴 + 새 씬 부팅.

import type Phaser from "phaser";
import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { DbConnectionRequiredError, setDevProjectFactory, store } from "@/project/store";
import { createDevShowcaseProjectForLocation } from "@/editor/devShowcaseProjects";
import { setAiConfigProvider } from "@/project/editorIdentity";
import { setAiActivityRecorder } from "@/project/tileMetadataDb";
import { loadAiConfig } from "@/ai/llmClient";
import { recordAiActivity } from "@/ai/activityLog";
import { PRODUCT_BRAND } from "@/brand";
import { ensurePhaser } from "@/app/phaserRuntime";
import { editorPlayBootDiagnosticSink } from "@/app/editorPlayBootDiagnostics";
import { createPlayGame, type PlayGameBootOptions } from "@/player/createPlayGame";
import {
  markInitialEditRender,
  markModeSwitch,
  mountPerfMetrics,
} from "@/app/perfMetrics";
import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import { editorState } from "@/editor/editorState";
import { hasDeepLinkedProject, isAutomationBootContext, presentEditorWelcome, setEditorWelcomeDismissed, shouldPresentEditorWelcome } from "@/editor/editorWelcome";
import { hasStoredSupabaseProjectSelection, supabaseProjectConfig } from "@/project/supabaseProjectConfig";

export type Mode = "edit" | "play";

interface AppElements {
  root: HTMLElement;
  topbar: HTMLElement;
  main: HTMLElement;
}

let currentMode: Mode = "edit";
let game: Phaser.Game | null = null;
let elements: AppElements | null = null;
let modeMounted = false;
let modeRun = 0;
let topbarRefreshQueued = false;
// 2026-08-18 UX 리뷰 P0-1: store.load()가 주소창에 ?project=를 스스로 써 넣으므로
// "사용자가 정말 공유 링크로 들어왔는가"는 로드 전에 캡처해야 한다(환영 화면 억제 버그).
let deepLinkedProjectAtBoot = false;

// 현재 모드 조회.
export function getMode(): Mode {
  return currentMode;
}

// 부트스트랩: 최초 한 번 DOM 골격 생성 + store 로드 + 에디터 렌더.
export async function bootApp(root: HTMLElement): Promise<void> {
  const startedAt = performance.now();
  const topbar = document.createElement("div");
  topbar.className = "topbar";
  const main = document.createElement("div");
  main.className = "main";
  root.append(topbar, main);
  elements = { root, topbar, main };
  mountPerfMetrics(root);
  // Node 환경(테스트)에서는 window가 없으므로 가드 — 브라우저 전용 리스너.
  if (typeof window !== "undefined") {
    window.addEventListener(MAP_EDIT_HISTORY_EVENT, onMapEditHistoryChange);
  }
  // 탑바(레이어/도구 버튼 등)는 editorState를 표시하지만 명시적 핸들러에서만 다시 그려져
  // 팔레트발 자동 레이어 전환 시 상태바와 어긋났다(지우개 버그의 절반). 상태 변경마다
  // 마이크로태스크로 합쳐 갱신한다.
  // 테스트에서 editorState가 부분 목킹될 수 있으므로 함수 존재를 가드.
  if (typeof editorState.subscribe === "function") {
    editorState.subscribe(() => {
      if (topbarRefreshQueued) return;
      topbarRefreshQueued = true;
      queueMicrotask(() => {
        topbarRefreshQueued = false;
        void renderTopbar();
      });
    });
  }

  try {
    setDevProjectFactory(createDevShowcaseProjectForLocation);
    setAiConfigProvider(loadAiConfig);
    setAiActivityRecorder(recordAiActivity as (input: unknown) => Promise<unknown>);
    deepLinkedProjectAtBoot = hasDeepLinkedProject();
    // 첫 방문 게이트(2026-08-18 UX 리뷰 P0-1): URL에 ?project= 없고, 이 기기에 저장된
    // 선택한 작업도 없는 진짜 첫 방문은 배포 기본(공유) 프로젝트 행을 편집 대상으로 열지
    // 않는다 — 새 project id를 발급받은 빈 프로젝트로 시작한다. 연결 자격 증명은 배포가
    // 소유하고 브라우저에는 선택한 project id만 기억한다. 자동화/데모 부팅은 제외.
    const mintFirstVisitProject =
      typeof window !== "undefined"
      && !deepLinkedProjectAtBoot
      && !isAutomationBootContext()
      && createDevShowcaseProjectForLocation() === null
      && supabaseProjectConfig() !== null
      && !hasStoredSupabaseProjectSelection();
    if (mintFirstVisitProject) {
      const { createBlankProject } = await import("@/project/defaults");
      try {
        await store.loadNewRemoteProject(createBlankProject(), { title: "새 프로젝트" });
      } catch (mintError) {
        // 발급 실패가 부팅을 벨려서는 안 된다 — 기존 로드 경로로 폴백.
        console.error("[app] first-visit project mint failed; falling back to load:", mintError);
        await store.load();
      }
    } else {
      await store.load();
    }
  } catch (error) {
    // 오진 방지(도그푸딩 결함 ②): DB 연결이 정말 필요한 경우와, 연결은 되지만 저장된
    // 프로젝트 데이터가 무결성 검증에 실패한 경우(벽돌)를 구분해 다른 화면을 보여준다.
    if (error instanceof DbConnectionRequiredError) {
      renderDbRequiredScreen(error);
    } else {
      renderLoadFailureScreen(error);
      console.error("[app] Project load failed before editor boot:", error);
    }
    return;
  }

  // 전투 모델(rm2k3/gen1)을 body[data-battle-model] 로 동기화 — CSS·UI 게이팅 진입점.
  // 로드 직후 1회 반영하고 이후 store 변경(전투 모델 전환 포함)마다 갱신한다.
  syncBattleModelAttribute(store.getCurrent());
  store.subscribe(syncBattleModelAttribute);

  // 최초 편집 맵 = 시작 맵.
  await finishEditorBoot(startedAt);
}

async function finishEditorBoot(startedAt: number): Promise<void> {
  const {
    clearPendingAiBootIntent,
    clearWelcomeIntentBootFlags,
    applyPendingAiBootIntent,
    peekPendingAiBootIntent,
    markWelcomeIntentAppliedThisBoot,
    setPendingWelcomePipeline,
    wasWelcomeIntentAppliedThisBoot,
  } = await import("@/editor/aiBootIntent");

  let showBriefing = false;

  // Cold-boot briefing only. Re-entry while edit/play shell is live must not overlay.
  if (modeMounted) {
    clearPendingAiBootIntent();
  } else {
    clearWelcomeIntentBootFlags();
    showBriefing = shouldPresentEditorWelcome({
      modeShellMounted: false,
      deepLinkedProject: deepLinkedProjectAtBoot,
    });
    // Suppress brush/standard coach while the briefing owns the first visit.
    if (showBriefing) markWelcomeIntentAppliedThisBoot();
  }

  // 맵 URL 동기화: URL의 ?map= 파라미터로 맵 복원 + 뒤로가기/앞으로가기 설치
  const { restoreMapFromUrl, installMapUrlSync } = await import("@/editor/mapUrlSync");
  installMapUrlSync();
  const restoredFromUrl = restoreMapFromUrl();
  if (!restoredFromUrl) {
    const { focusProjectStartMap } = await import("@/editor/mapSelection");
    focusProjectStartMap();
  }

  await renderTopbar();
  await enterMode("edit");

  if (showBriefing && elements) {
    const { applyWelcomeGenreSystemPresetPlan } = await import("@/editor/welcomeGenreSystemPresetAction");
    const result = await presentEditorWelcome(elements.root, {
      applySystemPreset: (plan) => applyWelcomeGenreSystemPresetPlan(plan),
    });
    if (result.dismiss) setEditorWelcomeDismissed(true);
    if (result.systemPresetPlan) {
      clearWelcomeIntentBootFlags();
      const { maybeStartBasicCoachMarks, maybeStartStandardWelcomeCard } = await import("@/editor/coachMarks");
      maybeStartBasicCoachMarks();
      maybeStartStandardWelcomeCard();
    } else if (result.prompt) {
      setPendingWelcomePipeline({
        prompt: result.prompt,
        autoSend: result.autoSend,
        replaceWithBlank: false,
        presetId: result.presetId,
        source: result.source === "chip" ? "chip" : "free-text",
      });
    } else {
      clearWelcomeIntentBootFlags();
      const { maybeStartBasicCoachMarks, maybeStartStandardWelcomeCard } = await import("@/editor/coachMarks");
      maybeStartBasicCoachMarks();
      maybeStartStandardWelcomeCard();
    }
  }

  const hadWelcomeIntent =
    wasWelcomeIntentAppliedThisBoot()
    || peekPendingAiBootIntent() !== null;
  if (hadWelcomeIntent) {
    const { ensureGuestIdentityForAiSurface } = await import("@/editor/teamWorkflowUi");
    ensureGuestIdentityForAiSurface(() => void renderTopbar());
    applyPendingAiBootIntent();
  } else {
    const { openLoginModalIfNeeded } = await import("@/editor/teamWorkflowUi");
    openLoginModalIfNeeded(() => void renderTopbar());
  }
  markInitialEditRender(startedAt);
}

/** Shared edit/play shell mount flag — cold-boot welcome gate uses this (not edit-only). */
export function isModeShellMounted(): boolean {
  return modeMounted;
}

function renderDbRequiredScreen(_error: unknown): void {
  if (!elements) return;
  elements.topbar.textContent = PRODUCT_BRAND;
  while (elements.main.firstChild) {
    elements.main.removeChild(elements.main.firstChild);
  }
  const panel = document.createElement("section");
  panel.className = "db-required-panel db-required-hero";
  panel.dataset.testid = "db-required-panel";

  const hero = document.createElement("div");
  hero.className = "db-required-hero-art";
  hero.dataset.testid = "db-required-hero";
  const heroImg = document.createElement("img");
  heroImg.className = "db-required-hero-image";
  heroImg.src = "/assets/generated/title/oprn-boot-hero.jpg";
  heroImg.alt = PRODUCT_BRAND;
  heroImg.decoding = "async";
  // 생성 히어로 로드 실패 시 기존 타이틀 아트로 폴백
  heroImg.addEventListener("error", () => {
    if (heroImg.dataset.fallback === "1") return;
    heroImg.dataset.fallback = "1";
    heroImg.src = "/assets/generated/title/oprn-title-bright-v2.png";
  });
  hero.append(heroImg);

  const copy = document.createElement("div");
  copy.className = "db-required-copy";
  const kicker = document.createElement("p");
  kicker.className = "db-required-kicker";
  kicker.textContent = PRODUCT_BRAND;
  const title = document.createElement("h1");
  title.textContent = "세계를 설계하고, 바로 플레이하세요";
  const body = document.createElement("p");
  body.textContent = "저장된 작업을 선택하면 편집기가 열립니다. 온라인 저장과 연결은 자동으로 처리됩니다.";
  const chips = document.createElement("ul");
  chips.className = "db-required-chips";
  for (const label of ["맵·이벤트 편집", "AI 어시스턴트", "자동 저장"]) {
    const li = document.createElement("li");
    li.textContent = label;
    chips.append(li);
  }
  const action = document.createElement("button");
  action.type = "button";
  action.className = "btn primary";
  action.dataset.testid = "db-required-open-settings";
  action.textContent = "작업 선택하기";
  action.addEventListener("click", () => openRequiredDbSettings());
  copy.append(kicker, title, body, chips, action);

  panel.append(hero, copy);
  elements.main.append(panel);
  openRequiredDbSettings();
}

function openRequiredDbSettings(): void {
  void import("@/editor/panels/dbConnectionSettings").then(({ openDbConnectionSettings }) => {
    openDbConnectionSettings(() => {
      if (store.isLoaded()) {
        void finishEditorBoot(performance.now());
      }
    }, { autoLoadProjects: true, required: true });
  });
}

// 프로젝트 로드 실패(데이터 무결성 오류) 화면 — 빈 패널 대신 db-required-hero 레이아웃을 쓴다.
// 사용자가 지적한 "허접한 첫 장면"(https://127.0.0.1:9888 의 텅 빈 패널)을 히어로로 승격.
function renderLoadFailureScreen(_error: unknown): void {
  if (!elements) return;
  elements.topbar.textContent = `${PRODUCT_BRAND} - 작업을 불러올 수 없음`;
  while (elements.main.firstChild) {
    elements.main.removeChild(elements.main.firstChild);
  }
  const panel = document.createElement("section");
  panel.className = "db-required-panel db-required-hero project-load-error-panel";
  panel.dataset.testid = "project-load-error-panel";

  const hero = document.createElement("div");
  hero.className = "db-required-hero-art";
  hero.dataset.testid = "db-required-hero";
  const heroImg = document.createElement("img");
  heroImg.className = "db-required-hero-image";
  heroImg.src = "/assets/generated/title/oprn-boot-hero.jpg";
  heroImg.alt = PRODUCT_BRAND;
  heroImg.decoding = "async";
  heroImg.addEventListener("error", () => {
    if (heroImg.dataset.fallback === "1") return;
    heroImg.dataset.fallback = "1";
    heroImg.src = "/assets/generated/title/oprn-title-bright-v2.png";
  });
  hero.append(heroImg);

  const copy = document.createElement("div");
  copy.className = "db-required-copy";
  const kicker = document.createElement("p");
  kicker.className = "db-required-kicker";
  kicker.textContent = PRODUCT_BRAND;
  const title = document.createElement("h1");
  title.textContent = "저장된 작업을 바로 열 수 없습니다";
  const body = document.createElement("p");
  body.textContent = "기존 저장본은 그대로 두고 예제 작업이나 새 작업으로 임시 시작할 수 있습니다.";
  const detail = document.createElement("details");
  detail.className = "project-load-error-details";
  detail.dataset.testid = "project-load-error-details";
  const detailSummary = document.createElement("summary");
  detailSummary.textContent = "해결 방법";
  const detailMessage = document.createElement("p");
  detailMessage.className = "project-load-error-message";
  detailMessage.dataset.testid = "project-load-error-message";
  detailMessage.textContent = "저장본을 다시 불러오거나 임시 작업으로 시작하세요. 기존 온라인 저장본은 바뀌지 않습니다.";
  detail.append(detailSummary, detailMessage);

  const chips = document.createElement("ul");
  chips.className = "db-required-chips";
  for (const label of ["예제 프로젝트", "새 프로젝트", "온라인 저장"]) {
    const li = document.createElement("li");
    li.textContent = label;
    chips.append(li);
  }

  const actions = document.createElement("div");
  actions.className = "project-load-error-actions";

  const sample = document.createElement("button");
  sample.type = "button";
  sample.className = "btn primary";
  sample.dataset.testid = "load-error-start-sample";
  sample.textContent = "예제 작업으로 시작";
  sample.title = "기존 저장본을 바꾸지 않고 예제를 엽니다.";
  sample.addEventListener("click", () => {
    void import("@/project/defaults").then(async ({ createSampleAdventureProject }) => {
      await store.loadFallbackProject(createSampleAdventureProject());
      await finishEditorBoot(performance.now());
    });
  });
  actions.append(sample);

  const blank = document.createElement("button");
  blank.type = "button";
  blank.className = "btn";
  blank.dataset.testid = "load-error-start-blank";
  blank.textContent = "새 작업으로 시작";
  blank.title = "기존 저장본을 바꾸지 않고 빈 작업을 엽니다.";
  blank.addEventListener("click", () => {
    void import("@/project/defaults").then(async ({ createBlankProject }) => {
      await store.loadFallbackProject(createBlankProject());
      await finishEditorBoot(performance.now());
    });
  });
  actions.append(blank);

  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "btn";
  retry.dataset.testid = "load-error-retry";
  retry.textContent = "저장본 다시 불러오기";
  retry.addEventListener("click", () => {
    retry.disabled = true;
    void store.load()
      .then(() => finishEditorBoot(performance.now()))
      .catch((cause: unknown) => {
        retry.disabled = false;
        if (cause instanceof DbConnectionRequiredError) renderDbRequiredScreen(cause);
        else renderLoadFailureScreen(cause);
      });
  });
  actions.append(retry);

  void import("@/project/devProjectPersistence").then(({ hasDevProjectOverride, discardDevProjectOverride }) => {
    if (!hasDevProjectOverride()) return;
    const discard = document.createElement("button");
    discard.type = "button";
    discard.className = "btn";
    discard.dataset.testid = "load-error-discard-local";
    discard.textContent = "이 기기의 임시 사본을 지우고 새로 시작";
    discard.addEventListener("click", () => {
      discardDevProjectOverride();
      window.location.reload();
    });
    actions.append(discard);
  });

  const openDb = document.createElement("button");
  openDb.type = "button";
  openDb.className = "btn";
  openDb.dataset.testid = "load-error-open-db";
  openDb.textContent = "저장된 작업 선택";
  openDb.addEventListener("click", () => {
    void import("@/editor/panels/dbConnectionSettings").then(({ openDbConnectionSettings }) => {
      openDbConnectionSettings(() => {
        if (store.isLoaded()) void finishEditorBoot(performance.now());
      }, { autoLoadProjects: true });
    });
  });
  actions.append(openDb);

  copy.append(kicker, title, body, chips, actions, detail);
  panel.append(hero, copy);
  elements.main.append(panel);
}

// 모드 진입. 이전 모드 정리 후 새 모드 부팅.
export async function enterMode(mode: Mode): Promise<void> {
  const run = ++modeRun;
  if (mode === currentMode && modeMounted && elements?.main.firstChild) return;

  const startedAt = performance.now();
  // 이전 모드 teardown(게임 destroy + 구독 해제).
  if (modeMounted && currentMode === "edit") {
    const { teardownEditor } = await import("@/editor/panels/editor");
    if (run !== modeRun) return;
    teardownEditor();
  } else if (modeMounted) {
    const { teardownPlayer } = await import("@/player/player");
    const { stopAllAudio } = await import("@/player/audio");
    if (run !== modeRun) return;
    teardownPlayer();
    // 에디터 복귀 시 재생 중인 BGM/SE 를 확실히 정지(씬 teardown 누락 대비).
    stopAllAudio();
  }
  modeMounted = false;

  currentMode = mode;
  if (!elements) return;

  // 메인 영역 초기화.
  while (elements.main.firstChild) {
    elements.main.removeChild(elements.main.firstChild);
  }

  if (mode === "edit") {
    const { renderEditor } = await import("@/editor/panels/editor");
    if (run !== modeRun) return;
    renderEditor(elements.main);
  } else {
    const { renderPlayer } = await import("@/player/player");
    if (run !== modeRun) return;
    renderPlayer(elements.main, { diagnosticSink: editorPlayBootDiagnosticSink });
  }
  modeMounted = true;

  // 탑바 갱신(모드 배지/버튼).
  await renderTopbar();
  markModeSwitch(startedAt);
}

// ── Phaser 게임 팩토리 (외부에서 모드별로 호출) ──
// roundPixels: 픽셀 아트 흐림 방지. pixelArt 모드로 부드러운 보간 끔.
export async function startEditGame(parent: HTMLElement): Promise<Phaser.Game> {
  const PhaserRuntime = await ensurePhaser();
  const { EditScene } = await import("@/editor/EditScene");
  game = new PhaserRuntime.Game({
    type: PhaserRuntime.AUTO,
    parent,
    backgroundColor: "#E7E0D0",
    roundPixels: true,
    antialias: false,
    pixelArt: true,
    scale: {
      // RESIZE: 부모(.phaser-container / scroll-shell) 크기에 맞춰 버퍼를 키운다.
      // NONE + 초기 800×600만 쓰면 레이아웃 전에 fit이 실패하면 작은 캔버스가 남는다.
      mode: PhaserRuntime.Scale.RESIZE,
      width: 800,
      height: 600,
      parent,
      autoCenter: PhaserRuntime.Scale.NO_CENTER,
    },
    scene: [EditScene],
  });
  return game;
}

export type StartPlayGameOptions = PlayGameBootOptions & {
  readonly trackGlobalGame?: boolean;
};

export async function startPlayGame(
  parent: HTMLElement,
  initialSession?: PlaySession,
  options: StartPlayGameOptions = {}
): Promise<Phaser.Game> {
  const nextGame = await createPlayGame(parent, initialSession, options);
  if (options.trackGlobalGame !== false) {
    game = nextGame;
  }
  return nextGame;
}

export function getGame(): Phaser.Game | null {
  return game;
}

export function destroyGame(): void {
  if (game) {
    game.destroy(true);
    game = null;
  }
}

// 현재 프로젝트(편의 접근).
export function currentProject(): Project {
  return store.getCurrent();
}

// 전투 모델(rm2k3/gen1)을 body 의 data-battle-model 속성으로 노출한다.
// CSS·UI 컴포넌트가 Gen1 전용 동작을 게이트할 때 이 속성을 읽는다.
// rm2k3(기본/생략) 또는 gen1. Node 테스트 환경(document 미존재)에서는 no-op.
export function syncBattleModelAttribute(project: Project): void {
  if (typeof document === "undefined") return;
  const value = project.system.battleModel ?? "rm2k3";
  document.body.setAttribute("data-battle-model", value);
}

// 모드 전환 토글.
export function toggleMode(): void {
  void enterMode(currentMode === "edit" ? "play" : "edit");
}

async function renderTopbar(): Promise<void> {
  if (!elements) return;
  const { renderTopbar: render } = await import("@/editor/panels/menu");
  render(elements.topbar);
}

void import("@/editor/editorUiMode").then(({ subscribeEditorUiMode }) => {
  subscribeEditorUiMode(() => {
    void renderTopbar();
  });
});

// 워크스페이스 구성 변화도 탑바를 다시 그린다 — 프리셋 세그먼트의 선택 표시(aria-pressed)와
// 패널 메뉴의 체크 상태가 여기서 나온다. 밀도가 안 바뀌는 전환(맵 그리기 → 이벤트 연출)은
// editorUiMode 구독자를 깨우지 않으므로 이 구독이 없으면 선택 표시가 옛 값에 멈춘다.
void import("@/editor/workspace/workspaceStore").then(({ subscribeWorkspace }) => {
  subscribeWorkspace(() => {
    void renderTopbar();
  });
});

function onMapEditHistoryChange(): void {
  void renderTopbar();
}
