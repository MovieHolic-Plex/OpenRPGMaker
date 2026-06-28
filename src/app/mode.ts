// app/mode.ts
// EDIT/PLAY 모드 상태 + Phaser 게임 인스턴스 + DOM 생명주기.
// 한 번에 하나의 모드만 활성. 전환 시 이전 Phaser 게임 파괴 + 새 씬 부팅.

import type Phaser from "phaser";
import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { store } from "@/project/store";
import { ensurePhaser } from "@/app/phaserRuntime";
import {
  markInitialEditRender,
  markModeSwitch,
  mountPerfMetrics,
} from "@/app/perfMetrics";
import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";

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
  window.addEventListener(MAP_EDIT_HISTORY_EVENT, onMapEditHistoryChange);

  await store.load();

  // 최초 편집 맵 = 시작 맵.
  const project = store.getCurrent();
  const { editorState } = await import("@/editor/editorState");
  editorState.set({ currentMapId: project.startMapId });

  await renderTopbar();
  await enterMode("edit");
  markInitialEditRender(startedAt);
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
    if (run !== modeRun) return;
    teardownPlayer();
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
      width: 320,
      height: 240,
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

function onMapEditHistoryChange(): void {
  void renderTopbar();
}
