// app/mode.ts
// EDIT/PLAY 모드 상태 + Phaser 게임 인스턴스 + DOM 생명주기.
// 한 번에 하나의 모드만 활성. 전환 시 이전 Phaser 게임 파괴 + 새 씬 부팅.

import type Phaser from "phaser";
import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { DbConnectionRequiredError, store } from "@/project/store";
import { ensurePhaser } from "@/app/phaserRuntime";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import {
  markInitialEditRender,
  markModeSwitch,
  mountPerfMetrics,
} from "@/app/perfMetrics";
import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import { editorState } from "@/editor/editorState";

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

  // 최초 편집 맵 = 시작 맵.
  await finishEditorBoot(startedAt);
}

async function finishEditorBoot(startedAt: number): Promise<void> {
  const project = store.getCurrent();
  editorState.set({ currentMapId: project.startMapId });

  await renderTopbar();
  await enterMode("edit");
  const { openLoginModalIfNeeded } = await import("@/editor/teamWorkflowUi");
  openLoginModalIfNeeded(() => void renderTopbar());
  markInitialEditRender(startedAt);
}

function renderDbRequiredScreen(error: unknown): void {
  if (!elements) return;
  elements.topbar.textContent = "AI RPG MAKER";
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
  heroImg.src = "/assets/generated/title/ai-rpg-maker-boot-hero.jpg";
  heroImg.alt = "AI RPG Maker";
  heroImg.decoding = "async";
  // 생성 히어로 로드 실패 시 기존 타이틀 아트로 폴백
  heroImg.addEventListener("error", () => {
    if (heroImg.dataset.fallback === "1") return;
    heroImg.dataset.fallback = "1";
    heroImg.src = "/assets/generated/title/bright-rpg-maker-title-v2.png";
  });
  hero.append(heroImg);

  const copy = document.createElement("div");
  copy.className = "db-required-copy";
  const kicker = document.createElement("p");
  kicker.className = "db-required-kicker";
  kicker.textContent = "AI RPG MAKER";
  const title = document.createElement("h1");
  title.textContent = "세계를 설계하고, 바로 플레이하세요";
  const body = document.createElement("p");
  body.textContent =
    error instanceof Error
      ? error.message
      : "프로젝트를 열려면 Supabase DB 연결과 프로젝트 선택이 필요합니다. .env.local 의 VITE_SUPABASE_* 값이 있으면 연결 폼에 자동으로 채워집니다.";
  const chips = document.createElement("ul");
  chips.className = "db-required-chips";
  for (const label of ["맵·이벤트 편집", "AI 어시스턴트", "팀 프로젝트 DB"]) {
    const li = document.createElement("li");
    li.textContent = label;
    chips.append(li);
  }
  const action = document.createElement("button");
  action.type = "button";
  action.className = "btn primary";
  action.dataset.testid = "db-required-open-settings";
  action.textContent = "DB 연결 열기";
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

// 프로젝트 로드 실패(데이터 무결성 오류) 화면.
// 기존 저장본을 덮어쓰지 않는 메모리 폴백을 1차 CTA로 제공하고, 오류 원문은 접어 둔다.
function renderLoadFailureScreen(error: unknown): void {
  if (!elements) return;
  elements.topbar.textContent = "RPG ZZU - 프로젝트 로드 실패";
  while (elements.main.firstChild) {
    elements.main.removeChild(elements.main.firstChild);
  }
  const panel = document.createElement("section");
  panel.className = "db-required-panel project-load-error-panel";
  panel.dataset.testid = "project-load-error-panel";

  const title = document.createElement("h1");
  title.textContent = "저장된 프로젝트를 바로 열 수 없습니다";
  const body = document.createElement("p");
  body.textContent = "기존 저장본은 그대로 두고 예제나 새 프로젝트로 임시 시작할 수 있습니다.";
  const detail = document.createElement("details");
  detail.className = "project-load-error-details";
  detail.dataset.testid = "project-load-error-details";
  const detailSummary = document.createElement("summary");
  detailSummary.textContent = "자세히 보기";
  const detailMessage = document.createElement("p");
  detailMessage.className = "project-load-error-message";
  detailMessage.dataset.testid = "project-load-error-message";
  detailMessage.textContent = error instanceof Error ? error.message : String(error);
  detail.append(detailSummary, detailMessage);

  const actions = document.createElement("div");
  actions.className = "project-load-error-actions";

  const sample = document.createElement("button");
  sample.type = "button";
  sample.className = "btn primary";
  sample.dataset.testid = "load-error-start-sample";
  sample.textContent = "예제 프로젝트로 시작";
  sample.title = "깨진 프로젝트를 덮어쓰지 않고 예제를 메모리로 엽니다.";
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
  blank.textContent = "새 프로젝트로 시작";
  blank.title = "깨진 프로젝트를 덮어쓰지 않고 빈 프로젝트를 메모리로 엽니다.";
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
  retry.textContent = "원격에서 다시 로드";
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
    discard.textContent = "로컬 사본 폐기 후 새로 시작";
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
  openDb.textContent = "DB 연결 설정 열기";
  openDb.addEventListener("click", () => {
    void import("@/editor/panels/dbConnectionSettings").then(({ openDbConnectionSettings }) => {
      openDbConnectionSettings(() => {
        if (store.isLoaded()) void finishEditorBoot(performance.now());
      }, { autoLoadProjects: true });
    });
  });
  actions.append(openDb);

  panel.append(title, body, actions, detail);
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
    renderPlayer(elements.main);
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
    backgroundColor: "#0f1115",
    roundPixels: true,
    antialias: false,
    pixelArt: true,
    scale: {
      mode: PhaserRuntime.Scale.NONE,
      width: 800,
      height: 600,
      parent,
    },
    scene: [EditScene],
  });
  return game;
}

export type StartPlayGameOptions = {
  readonly trackGlobalGame?: boolean;
  readonly initialEventTestId?: string;
};

export async function startPlayGame(
  parent: HTMLElement,
  initialSession?: PlaySession,
  options: StartPlayGameOptions = {}
): Promise<Phaser.Game> {
  const PhaserRuntime = await ensurePhaser();
  const { PlayScene } = await import("@/player/PlayScene");
  const nextGame = new PhaserRuntime.Game({
    type: PhaserRuntime.AUTO,
    parent,
    backgroundColor: "#000",
    roundPixels: true,
    antialias: false,
    pixelArt: true,
    scale: {
      mode: PhaserRuntime.Scale.NONE,
      width: PLAY_RESOLUTION.width,
      height: PLAY_RESOLUTION.height,
      parent,
    },
    scene: [PlayScene],
  });
  if (options.trackGlobalGame !== false) {
    game = nextGame;
  }
  if (initialSession) {
    nextGame.registry.set("initialSession", initialSession);
  }
  if (options.initialEventTestId) {
    nextGame.registry.set("initialEventTestId", options.initialEventTestId);
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

// 모드 전환 토글.
export function toggleMode(): void {
  void enterMode(currentMode === "edit" ? "play" : "edit");
}

async function renderTopbar(): Promise<void> {
  if (!elements) return;
  const { renderTopbar: render } = await import("@/editor/panels/menu");
  render(elements.topbar);
}

// basic/expert 전환 시 탑바(클래식 툴바·메뉴 밀도)를 다시 그린다.
void import("@/editor/editorUiMode").then(({ subscribeEditorUiMode }) => {
  subscribeEditorUiMode(() => {
    void renderTopbar();
  });
});

function onMapEditHistoryChange(): void {
  void renderTopbar();
}
