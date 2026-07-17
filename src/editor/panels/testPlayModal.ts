import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene } from "@/player/battleDom";
import { mountPlayLoadingOverlay } from "@/player/playLoadingOverlay";
import { renderPlayer, teardownPlayer } from "@/player/player";
import { startSession, type PlaySession } from "@/project/session";
import { renderRuntimeDebugPanel } from "@/player/runtimeDebugPanel";
import { store } from "@/project/store";
import type { GameEvent, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { warmBundledPlayAssets } from "@/assets/bundledAssetWarmup";

let modalRoot: HTMLElement | null = null;
let removePlayWindowKeydown: (() => void) | null = null;

type TestPlayWindowMode = "fullscreen" | "windowed";

export async function openTestPlayModal(startOverride?: { mapId: string; x: number; y: number }): Promise<void> {
  const title = startOverride
    ? `여기서 테스트 - (${startOverride.mapId} ${startOverride.x},${startOverride.y})`
    : "테스트 플레이 - RPG 쯔꾸르";
  const body = openTestPlayShell(title);
  const loading = mountPlayLoadingOverlay(body, "saving");
  try {
    await store.flush();
    loading.setStage("preparing");
    // 타이틀/플레이 전에 번들 에셋을 브라우저 캐시에 데운다.
    void warmBundledPlayAssets(store.getCurrent());
    // Give the browser a paint before heavy player bootstrap.
    await yieldToBrowser();
    renderPlayer(body, { onExit: closeTestPlayModal, trackGlobalGame: false, startOverride });
  } catch (error) {
    console.error("[test-play] failed to open test play:", error);
    loading.setStage("error", "테스트 플레이를 열지 못했습니다");
    return;
  }
  // renderPlayer clears body children (including this overlay) when it mounts.
  // If title path ran, loading is already gone; if not, remove explicitly.
  if (loading.root.isConnected) loading.remove();
}

export async function openSelectedEventTestModal(mapId: MapId, eventId: string): Promise<boolean> {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  const event = map?.events.find((item) => item.id === eventId);
  if (!map || !event) return false;
  const title = `이벤트 테스트 - ${eventDisplayName(event)}`;
  const body = openTestPlayShell(title);
  const loading = mountPlayLoadingOverlay(body, "saving");
  try {
    await store.flush();
    loading.setStage("preparing");
    void warmBundledPlayAssets(store.getCurrent());
    await yieldToBrowser();
    const session = selectedEventTestSession(mapId, event);
    renderPlayer(body, {
      initialEventTestId: eventId,
      initialSession: session,
      onExit: closeTestPlayModal,
      trackGlobalGame: false,
    });
  } catch (error) {
    console.error("[test-play] failed to open selected-event test:", error);
    loading.setStage("error", "이벤트 테스트를 열지 못했습니다");
    return false;
  }
  if (loading.root.isConnected) loading.remove();
  return true;
}

export async function openTroopBattleTestModal(troopId: string): Promise<void> {
  const project = store.getCurrent();
  const troop = project.database.troops.find((record) => record.id === troopId);
  const body = openTestPlayShell(`전투 테스트 - ${troop?.name ?? troopId}`);
  const loading = mountPlayLoadingOverlay(body, "saving");
  try {
    await store.flush();
    loading.setStage("preparing");
    await yieldToBrowser();
    loading.remove();
    const runtime = createBattleRuntime({ project, troopId, canEscape: true, canLose: true });
    advanceBattleRuntime(runtime);
    mountBattleScene({
      host: body,
      runtime,
      onResult: () => undefined,
    });
  } catch (error) {
    console.error("[test-play] failed to open troop battle test:", error);
    loading.setStage("error", "전투 테스트를 열지 못했습니다");
  }
}
export function pickRandomTroopId(
  project: Project,
  random: () => number = Math.random
): string | undefined {
  const troops = project.database.troops.filter((troop) => {
    const members = troop.members?.length ?? 0;
    const enemies = troop.enemyIds?.length ?? 0;
    return members > 0 || enemies > 0;
  });
  if (troops.length === 0) {
    return project.system.initialTroopId ?? project.database.troops[0]?.id;
  }
  const index = Math.min(troops.length - 1, Math.max(0, Math.floor(random() * troops.length)));
  return troops[index]?.id;
}

/** Editor quick-test: open a battle against a random authored troop (no field walk). */
export async function openRandomTroopBattleTestModal(
  random: () => number = Math.random
): Promise<void> {
  const project = store.getCurrent();
  const troopId = pickRandomTroopId(project, random);
  if (!troopId) {
    const body = openTestPlayShell("전투 테스트");
    const loading = mountPlayLoadingOverlay(body, "error");
    loading.setStage("error", "적 그룹이 없습니다. 데이터베이스에서 트룹을 추가하세요.");
    return;
  }
  await openTroopBattleTestModal(troopId);
}

export function closeTestPlayModal(): void {
  if (!modalRoot) return;
  removePlayWindowKeydown?.();
  removePlayWindowKeydown = null;
  teardownPlayer();
  modalRoot.remove();
  modalRoot = null;
}

function openTestPlayShell(title: string): HTMLElement {
  closeTestPlayModal();
  const backdrop = el("div", {
    class: "test-play-modal-backdrop",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title,
    },
    dataset: { testid: "test-play-modal-backdrop" },
  });
  const windowNode = el("div", {
    class: "test-play-window",
    dataset: { testid: "test-play-window", windowMode: "windowed" },
  });
  const titlebar = el("div", { class: "test-play-titlebar" });
  const restoreButton = el("button", {
    class: "test-play-close window-control restore",
    text: "창",
    attrs: { title: "창 모드", "aria-label": "테스트 플레이 창 모드" },
    dataset: { testid: "test-play-window-restore" },
  }) as HTMLButtonElement;
  const maximizeButton = el("button", {
    class: "test-play-close window-control maximize",
    text: "전체",
    attrs: { title: "전체 화면", "aria-label": "테스트 플레이 전체 화면" },
    dataset: { testid: "test-play-window-maximize" },
  }) as HTMLButtonElement;
  titlebar.append(
    el("span", {
      class: "test-play-title",
      text: title,
      dataset: { testid: "test-play-window-title" },
    }),
    el("button", {
      class: "test-play-close",
      text: "편집으로",
      attrs: { title: "테스트 플레이 닫기" },
      dataset: { testid: "mode-edit" },
      on: { click: () => closeTestPlayModal() },
    }),
    restoreButton,
    maximizeButton,
    el("button", {
      class: "test-play-close icon",
      text: "x",
      attrs: { title: "닫기" },
      dataset: { testid: "test-play-window-close" },
      on: { click: () => closeTestPlayModal() },
    })
  );
  const body = el("div", {
    class: "test-play-modal-body",
    dataset: { testid: "test-play-window-body" },
  });

  windowNode.append(titlebar, body, renderRuntimeDebugPanel());
  backdrop.append(windowNode);
  document.body.append(backdrop);
  modalRoot = backdrop;
  restoreButton.addEventListener("click", () => setTestPlayWindowMode(windowNode, "windowed"));
  maximizeButton.addEventListener("click", () => setTestPlayWindowMode(windowNode, "fullscreen"));
  removePlayWindowKeydown = bindPlayWindowFullscreenHotkey(windowNode);
  return body;
}

function setTestPlayWindowMode(windowNode: HTMLElement, mode: TestPlayWindowMode): void {
  windowNode.dataset.windowMode = mode;
}

function bindPlayWindowFullscreenHotkey(windowNode: HTMLElement): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isPlayWindowFullscreenHotkey(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setTestPlayWindowMode(windowNode, nextTestPlayWindowMode(windowNode.dataset.windowMode));
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}

function isPlayWindowFullscreenHotkey(event: KeyboardEvent): boolean {
  return event.altKey && event.key === "Enter";
}

function nextTestPlayWindowMode(mode: string | undefined): TestPlayWindowMode {
  return mode === "fullscreen" ? "windowed" : "fullscreen";
}

function selectedEventTestSession(mapId: MapId, event: GameEvent): PlaySession {
  const project = store.getCurrent();
  const session = startSession(project);
  const map = project.maps[mapId];
  const fallbackY = Math.max(0, event.y - 1);
  session.currentMapId = mapId;
  session.x = Math.max(0, Math.min(map.width - 1, event.x));
  session.y = event.y + 1 < map.height ? event.y + 1 : fallbackY;
  return session;
}

function eventDisplayName(event: GameEvent): string {
  return event.pages?.[0]?.name || event.id;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
