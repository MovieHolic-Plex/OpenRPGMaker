import { playCinematicSequence } from "@/player/cinematicSequence";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { dialogueHost } from "@/player/playSceneDom";
import { applySystemGraphic } from "@/player/systemGraphics";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";

// 종단 화면(게임오버/엔딩)의 버튼에 커서 메뉴를 붙여 Z/Enter/Esc 로 확정되게 한다.
// 버튼이 눌리면(키/마우스) 1회성으로 detach 해 리스너 누수를 막는다.
function attachTerminalCursor(overlay: HTMLElement, buttons: readonly HTMLButtonElement[], cancelEl: HTMLButtonElement): void {
  const detach = attachCursorMenu(overlay, { items: buttons, cancelEl });
  for (const button of buttons) button.addEventListener("click", () => detach(), { once: true });
}

export function showRuntimeOverlay(
  scene: PlaySceneContext,
  testId: string,
  text: string
): void {
  const host = dialogueHost(scene);
  if (!host) return;
  host.querySelector(`[data-testid='${testId}']`)?.remove();
  const overlay = document.createElement("div");
  overlay.className = "runtime-overlay";
  overlay.dataset.testid = testId;
  overlay.textContent = text;
  host.append(overlay);
}

export function clearRuntimeOverlay(scene: PlaySceneContext, testId: string): void {
  dialogueHost(scene)?.querySelector(`[data-testid='${testId}']`)?.remove();
}

const gameOverCleanup = new WeakMap<HTMLElement, () => void>();

export function showGameOverScreen(scene: PlaySceneContext, message?: string): void {
  const host = dialogueHost(scene);
  if (!host) return;
  gameOverCleanup.get(host)?.();
  const project = store.getCurrent();
  const settings = project.system.gameOver;
  const root = document.createElement("div");
  root.className = "cinematic-terminal";
  // Retain the existing modal boundary for movement, time, minimap and shell input.
  root.dataset.testid = "game-over-screen";
  host.append(root);
  scene.input_.releaseAllKeys();
  const controller = new AbortController();
  let detachCursor = (): void => undefined;
  const observer = new MutationObserver(() => {
    if (!root.isConnected || !host.contains(root)) cleanup();
  });
  const cleanup = (): void => {
    controller.abort();
    detachCursor();
    observer.disconnect();
    scene.events.off("shutdown", cleanup);
    scene.events.off("destroy", cleanup);
    root.remove();
    gameOverCleanup.delete(host);
  };
  gameOverCleanup.set(host, cleanup);
  scene.events.once("shutdown", cleanup);
  scene.events.once("destroy", cleanup);
  observer.observe(host.ownerDocument, { childList: true, subtree: true });
  const renderTerminal = (): void => {
    const backgroundUrl = resolveAssetResourceUrl(settings?.backgroundResourceId, { project });
    if (backgroundUrl) {
      const background = document.createElement("img");
      background.className = "cinematic-background";
      background.alt = "";
      background.draggable = false;
      background.src = backgroundUrl;
      background.addEventListener("error", () => background.remove(), { once: true });
      root.append(background);
    }
    const overlay = document.createElement("div");
    overlay.className = "runtime-overlay game-over-panel";
    applySystemGraphic(overlay);
    const title = document.createElement("div");
    title.className = "runtime-overlay-title";
    title.textContent = settings?.title ?? "게임 오버";
    overlay.append(title);
    const resolvedMessage = message ?? settings?.message;
    if (resolvedMessage) {
      const body = document.createElement("div");
      body.className = "runtime-overlay-message";
      body.textContent = resolvedMessage;
      overlay.append(body);
    }
    const buttons: HTMLButtonElement[] = [];
    if (scene.hasCheckpoint()) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.dataset.testid = "checkpoint-retry";
      retry.textContent = settings?.retryLabel ?? "다시 시도";
      retry.addEventListener("click", () => { cleanup(); scene.restoreCheckpoint(); });
      buttons.push(retry);
    }
    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.dataset.testid = "return-title";
    titleButton.textContent = settings?.titleLabel ?? "타이틀로";
    titleButton.addEventListener("click", () => { cleanup(); scene.returnToTitle(); });
    buttons.push(titleButton);
    overlay.append(...buttons);
    root.append(overlay);
    detachCursor = attachCursorMenu(overlay, { items: buttons, cancelEl: titleButton });
  };
  if (settings?.sequence?.enabled && settings.sequence.scenes.length > 0) {
    const playback = playCinematicSequence({ host: root, project, sequence: settings.sequence, signal: controller.signal });
    void playback.done.then(result => {
      if (result !== "aborted" && !controller.signal.aborted) renderTerminal();
    });
  } else renderTerminal();
}

// 엔딩: 게임 오버와 같은 모달 패널로 표시한다. 제목/본문 + 타이틀 복귀 버튼.
// (텍스트만 있는 오버레이는 뒤쪽 맵 입력이 살아 있어 엔딩 뒤에서 이벤트가 재실행되는 문제가 있었다.)
export function showEndingScreen(scene: PlaySceneContext, title: string, message: string): void {
  const host = dialogueHost(scene);
  if (!host) return;
  host.querySelector("[data-testid='ending-screen']")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "runtime-overlay game-over-panel";
  overlay.dataset.testid = "ending-screen";
  applySystemGraphic(overlay);
  const heading = document.createElement("div");
  heading.className = "runtime-overlay-title";
  heading.textContent = title || "엔딩";
  overlay.append(heading);
  if (message) {
    const body = document.createElement("div");
    body.className = "runtime-overlay-message";
    body.textContent = message;
    overlay.append(body);
  }
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.testid = "return-title";
  button.textContent = "타이틀로 돌아가기";
  button.addEventListener("click", () => scene.returnToTitle());
  overlay.append(button);
  host.append(overlay);
  attachTerminalCursor(overlay, [button], button);
}

export function returnToTitle(scene: PlaySceneContext): void {
  const callback: unknown = scene.game.registry.get("returnToTitle");
  if (typeof callback === "function") {
    callback();
    return;
  }
  scene.showRuntimeOverlay("title-scene", "타이틀");
}
