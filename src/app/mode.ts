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
import { recordAiActivity, recordAiUiActionBatch } from "@/ai/activityLog";
import { installAiUiEventCapture, setAiUiEventSink } from "@/ai/uiEventLog";
import { PRODUCT_BRAND } from "@/brand";
import { ensurePhaser } from "@/app/phaserRuntime";
import { editorPlayBootDiagnosticSink } from "@/app/editorPlayBootDiagnostics";
import { syncProjectFontTheme } from "@/app/fontTheme";
import { createPlayGame, type PlayGameBootOptions } from "@/player/createPlayGame";
import { configureEditorGameAccessor } from "@/editor/panels/editorGameSuspension";
import { importWithRetry } from "@/util/dynamicImport";
import {
  markInitialEditRender,
  markModeSwitch,
  mountPerfMetrics,
} from "@/app/perfMetrics";
import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import { editorState } from "@/editor/editorState";
import { hasDeepLinkedProject, presentEditorWelcome, setEditorWelcomeDismissed, shouldPresentEditorWelcome } from "@/editor/editorWelcome";
import { isForcedWelcomeRehearsal } from "@/editor/automationBootContext";
import { hasElectronBridge, openFolderHeldByMainProcess, type ElectronRepository } from "@/project/persistence/electronRepository";
import { projectRepository } from "@/project/persistence/repository";

export type Mode = "edit" | "play";

interface AppElements {
  root: HTMLElement;
  topbar: HTMLElement;
  main: HTMLElement;
}

let currentMode: Mode = "edit";
let game: Phaser.Game | null = null;
// startEditGame/startPlayGame 은 await 뒤에 game 을 쓴다. 그 구간에 destroyGame 이나
// 다음 스타터가 끼어들면(콜드 부트 중 모드 토글) 만들어진 게임을 그대로 adopt 해 추적을 잃는다 —
// 고아 EditScene 의 KeyboardManager 가 window keydown 을 계속 받아 Ctrl+Z 가 한 번에
// 두 단계를 되돌렸다. 세대 카운터로 마지막 시작만 살아남게 한다.
let gameGeneration = 0;
let elements: AppElements | null = null;
let modeMounted = false;
let modeRun = 0;
let topbarRefreshQueued = false;
// 2026-08-18 UX 리뷰 P0-1: store.load()가 주소창에 ?project=를 스스로 써 넣으므로
// "사용자가 정말 공유 링크로 들어왔는가"는 로드 전에 캡처해야 한다(환영 화면 억제 버그).
let deepLinkedProjectAtBoot = false;
// 첫 방문 게이트가 공용 데모를 열었는가 — false 면 빈 프로젝트 발급으로 폴백하는 근거.
// 웰컴 억제·안내 토스트는 세션 상태(store.isSharedDemoSession)가 판단하므로
// ?project= 데모 딥링크도 같은 경로를 탄다.

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
    // AI 표면의 프론트 액션 수집. 수집기는 순수하게 모으고, «어디로 보낼지» 는 여기서 정한다
    // (setAiActivityRecorder 와 같은 배선 규약). 위임 리스너 1개라 앞으로 추가되는 버튼도 들어온다.
    setAiUiEventSink((events) => {
      void recordAiUiActionBatch(events).catch(() => undefined);
    });
    installAiUiEventCapture();
    deepLinkedProjectAtBoot = hasDeepLinkedProject();
    // Electron 에서는 시작 화면이 고른 폴더가 주 프로세스 세션에만 있다. 편집기 문서는 별개
    // 문서라 모듈 상태가 안 넘어오므로 여기서 다시 붙는다 — 안 붙으면 store.load() 가 대상을
    // 못 찾아 DB 연결 설정 화면으로 떨어진다(로컬 폴더 정본인데도).
    await attachElectronFolderAtBoot();
    // P6: 온라인 저장이 없다 — 첫 방문에 열 원격 데모 행도, 발급할 행도 없다. 항상 기존 로드 경로다.
    await store.load();
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

  // 자자가 골람 글꼴(system.fonts)을 리생 지점에서 단 한 번 물린다 — 에디터와 런타임이
  // 같은 document 를 공유하므로 루트 변수 하나로 둘 다 덮인다.
  syncProjectFontTheme(store.getCurrent());
  store.subscribe(syncProjectFontTheme);

  // 최초 편집 맵 = 시작 맵.
  await finishEditorBoot(startedAt);
}

/**
 * 시작 화면이 열어 둔 폴더에 편집기 세션을 다시 붙인다. Electron 이 아니거나 열린 폴더가
 * 없으면 null — 그때는 기존 로드 경로(데모/원격)가 그대로 탄다.
 *
 * 왜 필요한가: 시작 화면은 별도 문서(app://oprn/start-screen.html)라 사용자가 고른 폴더가
 * 렌더러 모듈 상태로 넘어오지 않는다. 이 한 줄이 없으면 로컬 정본을 열어 뒀는데도 store.load()
 * 가 대상을 못 찾아 「온라인 저장 설정이 필요합니다」 화면을 띄운다(실측).
 */
async function attachElectronFolderAtBoot(): Promise<string | null> {
  if (!hasElectronBridge()) return null;
  const projectDir = await openFolderHeldByMainProcess();
  if (projectDir === null) return null;
  const repository = projectRepository();
  if (!("open" in repository)) return null;
  await (repository as ElectronRepository).open(projectDir);
  return projectDir;
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
  // 공용 데모가 열려 있으면(첫 방문 게이트 또는 ?project= 데모 딥링크) 「어떤 게임을
  // 만들까요」 브리핑 대신 데모 안내 토스트가 첫 인상을 맡는다. ?forceWelcome=1 리허설만 예외.
  const sharedDemoOpen = store.isSharedDemoSession();
  const demoHoldsFirstScreen = sharedDemoOpen && !isForcedWelcomeRehearsal();

  // Cold-boot briefing only. Re-entry while edit/play shell is live must not overlay.
  if (modeMounted) {
    clearPendingAiBootIntent();
  } else {
    clearWelcomeIntentBootFlags();
    showBriefing = !store.getCurrent().gameDesignBrief && !demoHoldsFirstScreen && shouldPresentEditorWelcome({
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

  if (sharedDemoOpen && !showBriefing) {
    const { presentSharedDemoIntro } = await import("@/editor/sharedDemoIntro");
    presentSharedDemoIntro();
  }

  if (showBriefing && elements) {
    const { applyWelcomeGenreSystemPresetPlan } = await import("@/editor/welcomeGenreSystemPresetAction");
    // 브리핑이 "만들 수 있다" 고 약속하기 전에 실제로 가능한지 본다. 미설정 상태에서 보내면
    // 채팅 패널이 "의도 읽는 중…" 에서 조용히 멈춘다(2026-09-22 실측 30초+, 실패 토스트 없음).
    const [{ loadAiConfig }, { isAiConfigReady }, { getAiConnectionStatus }] = await Promise.all([
      import("@/ai/llmClient"),
      import("@/editor/panels/aiChatPanelHelpers"),
      import("@/editor/panels/aiConnectionStatus"),
    ]);
    const aiReady = (): boolean => {
      try {
        // config 모양만 보면 chatgpt 모드가 **언제나 true** 다(assistantEndpoint.ts 주석 참고).
        // 실제 연결은 동반 서비스 캐시가 판정한다 — 그걸 함께 넘겨야 죽은 게이트가 되지 않는다.
        const config = loadAiConfig();
        return isAiConfigReady(config, getAiConnectionStatus(config));
      } catch {
        // 판정을 못 하면 막지 않는다 — 설정이 멀쩡한 사용자를 잘못 가로막는 게 더 나쁘다.
        return true;
      }
    };
    const result = await presentEditorWelcome(elements.root, {
      applySystemPreset: (plan, brief) => applyWelcomeGenreSystemPresetPlan(plan, undefined, brief),
      canGenerate: aiReady,
      openAiSettings: () => {
        void import("@/editor/panels/aiSettingsModal")
          .then(({ openAiSettingsModal }) => { openAiSettingsModal(); })
          .catch(() => undefined);
      },
    });
    if (result.dismiss) setEditorWelcomeDismissed(true);
    if (result.systemPresetPlan) {
      clearWelcomeIntentBootFlags();
    } else if (result.prompt) {
      // 장르 칩의 결정적 부분(system.* 토글)은 AI 보다 먼저 적용한다 — 모델이 토글 툴을 부르지
      // 않아도 장르 엔진은 켜져 있어야 한다(2026-08-30 실측: 포스터 클릭 경로에서
      // applyGenrePreset 이 한 번도 호출되지 않았다).
      if (result.source === "chip" && result.presetId) {
        const { applyWelcomeGenrePresetToOpenProject } = await import("@/editor/welcomeGenrePresetApply");
        applyWelcomeGenrePresetToOpenProject(result.presetId);
      }
      setPendingWelcomePipeline({
        prompt: result.prompt,
        autoSend: result.autoSend,
        source: result.source === "chip" ? "chip" : "free-text",
      });
      // AI 없이 인터뷰를 끝내면 기획 프롬프트가 조수 입력창에 담기기만 한다. 설명이 없으면 빈 맵과
      // 낯선 지시문만 남아 「아무 일도 안 일어났다」로 보인다 — 메뉴의 새 프로젝트 경로와 같은 안내를 준다.
      if (!result.autoSend) {
        const { toast } = await import("@/util/toast");
        toast("게임 기획을 저장하고 조수 입력창에 담았습니다. AI 연결 후 보낼 수 있습니다.", "info");
      }
    } else {
      clearWelcomeIntentBootFlags();
    }
  }

  if (store.getCurrent().gameDesignBrief?.generationPending) {
    const { prepareProjectInterviewStartup } = await import("@/editor/projectInterviewStartup");
    await prepareProjectInterviewStartup();
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
  if (hasElectronBridge()) {
    void import("@/editor/projectFolderActions").then(async ({ openProjectFolder }) => {
      if (await openProjectFolder()) window.location.reload();
    });
    return;
  }
  // 웹 preview(mdc-server:9888)에는 폴더 브리지가 없다. 조용히 return 하면
  // 「작업 선택하기」가 죽은 버튼이 된다. 빈 로컬 세션으로 편집기를 연다.
  const url = new URL(window.location.href);
  if (!url.searchParams.has("blankProject")) url.searchParams.set("blankProject", "1");
  window.location.assign(url.toString());
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
    void import("@/project/defaults/defaultProject").then(async ({ createSampleAdventureProject }) => {
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
    void import("@/editor/projectFolderActions").then(async ({ openProjectFolder }) => {
      if (await openProjectFolder()) window.location.reload();
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
    // Editor play mode is an authoring surface, not the shipped export player: QA
    // instrumentation stays on so debug hooks/state mirrors remain available here.
    renderPlayer(elements.main, {
      qaInstrumentation: true,
      diagnosticSink: editorPlayBootDiagnosticSink,
    });
  }
  modeMounted = true;

  // 탑바 갱신(모드 배지/버튼).
  await renderTopbar();
  markModeSwitch(startedAt);
}

// ── Phaser 게임 팩토리 (외부에서 모드별로 호출) ──
// roundPixels: 픽셀 아트 흐림 방지. pixelArt 모드로 부드러운 보간 끔.
export async function startEditGame(parent: HTMLElement): Promise<Phaser.Game> {
  const generation = ++gameGeneration;
  const PhaserRuntime = await ensurePhaser();
  const { EditScene } = await importWithRetry(() => import("@/editor/EditScene"));
  const next = new PhaserRuntime.Game({
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
  if (generation !== gameGeneration) {
    // 생성 도중 destroyGame/새 시작이 스쳤다 — 입양하면 추적 밖 게임이 영구히 키를 먹는다.
    next.destroy(true);
    return next;
  }
  game?.destroy(true);
  game = next;
  return next;
}

export type StartPlayGameOptions = PlayGameBootOptions & {
  readonly trackGlobalGame?: boolean;
};

export async function startPlayGame(
  parent: HTMLElement,
  initialSession?: PlaySession,
  options: StartPlayGameOptions = {}
): Promise<Phaser.Game> {
  const tracked = options.trackGlobalGame !== false;
  const generation = tracked ? ++gameGeneration : 0;
  const nextGame = await createPlayGame(parent, initialSession, options);
  if (!tracked) return nextGame;
  if (generation !== gameGeneration) {
    // startEditGame 과 같은 함정: 부트 도중 슬롯이 비었으면 이 게임은 고아가 된다.
    nextGame.destroy(true);
    return nextGame;
  }
  game?.destroy(true);
  game = nextGame;
  return nextGame;
}

export function getGame(): Phaser.Game | null {
  return game;
}

// 테스트 플레이 창이 뒤의 편집기 게임을 잠재울 수 있게 접근자를 준다(editorGameSuspension 주석).
configureEditorGameAccessor(() => game);

export function destroyGame(): void {
  ++gameGeneration;
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
