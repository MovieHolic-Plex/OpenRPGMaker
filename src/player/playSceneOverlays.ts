import { playCinematicSequence } from "@/player/cinematicSequence";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import { DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID } from "@/project/cinematicSettings";
import { stopAllAudio } from "@/player/audio";
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
  const prior = host.querySelector(`[data-testid='${testId}']`) as (HTMLElement & { __oprnDisposeCursor?: () => void }) | null;
  prior?.__oprnDisposeCursor?.();
  if (prior) prior.__oprnDisposeCursor = undefined;
  prior?.remove();
  const overlay = document.createElement("div");
  overlay.className = "runtime-overlay";
  overlay.dataset.testid = testId;
  overlay.textContent = text;
  host.append(overlay);
}

export function clearRuntimeOverlay(scene: PlaySceneContext, testId: string): void {
  const host = dialogueHost(scene);
  const overlay = host?.querySelector(`[data-testid='${testId}']`) as (HTMLElement & { __oprnDisposeCursor?: () => void }) | null | undefined;
  if (!overlay) return;
  // Date-error (and any overlay) may own a cursor-menu disposer; release before detach.
  overlay.__oprnDisposeCursor?.();
  overlay.__oprnDisposeCursor = undefined;
  overlay.remove();
}

const gameOverCleanup = new WeakMap<HTMLElement, () => void>();

export function showGameOverScreen(scene: PlaySceneContext, message?: string): void {
  const host = dialogueHost(scene);
  if (!host) return;
  gameOverCleanup.get(host)?.();
  const project = store.getCurrent();
  const settings = project.system.gameOver;
  const root = document.createElement("div");
  root.className = "cinematic-terminal game-over-screen";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", settings?.title || "게임 오버");
  // Retain the existing modal boundary for movement, time, minimap and shell input.
  root.dataset.testid = "game-over-screen";
  host.append(root);
  scene.input_.releaseAllKeys();
  // The checkpoint retains its own audio snapshot; applySession resumes it on retry.
  // Stop field music before a cinematic can start its independently owned soundtrack.
  stopAllAudio();
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
    const backgroundId = settings?.backgroundResourceId || DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID;
    const backgroundUrl = resolveAssetResourceUrl(backgroundId, { project });
    const title = document.createElement("h1");
    title.className = "runtime-overlay-title game-over-heading";
    title.textContent = settings?.title ?? "게임 오버";
    // The bundled image already contains GAME OVER. Do not print a second title over it.
    title.hidden = backgroundId === DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID && settings?.title === undefined;
    if (backgroundUrl) {
      const background = document.createElement("img");
      background.className = "cinematic-background";
      background.alt = "";
      background.draggable = false;
      background.src = backgroundUrl;
      background.addEventListener("error", () => { background.remove(); title.hidden = false; }, { once: true });
      root.append(background);
    } else title.hidden = false;
    const overlay = document.createElement("div");
    overlay.className = "game-over-content";
    overlay.append(title);
    const resolvedMessage = message ?? settings?.message;
    if (resolvedMessage) {
      const body = document.createElement("div");
      body.className = "runtime-overlay-message game-over-message";
      body.textContent = resolvedMessage;
      overlay.append(body);
    }
    const buttons: HTMLButtonElement[] = [];
    const actions = document.createElement("div");
    actions.className = "game-over-actions";
    if (scene.hasCheckpoint()) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "game-over-choice";
      retry.dataset.testid = "checkpoint-retry";
      retry.textContent = settings?.retryLabel ?? "체크포인트에서 다시 시작";
      retry.addEventListener("click", () => { cleanup(); scene.restoreCheckpoint(); });
      buttons.push(retry);
    }
    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "game-over-choice";
    titleButton.dataset.testid = "return-title";
    titleButton.textContent = settings?.titleLabel ?? "타이틀로 돌아가기";
    titleButton.addEventListener("click", () => { cleanup(); scene.returnToTitle(); });
    buttons.push(titleButton);
    actions.append(...buttons);
    overlay.append(actions);
    const hint = document.createElement("div");
    hint.className = "game-over-hint";
    hint.textContent = "↑↓ 선택 · Z/Enter 결정 · Esc 타이틀";
    const messageBody = overlay.querySelector<HTMLElement>(".game-over-message");
    if (messageBody) {
      // Keep arrows for the menu; long authored prose has an independent keyboard scroll.
      hint.textContent += " · PgUp/PgDn 본문";
      host.ownerDocument.defaultView?.addEventListener("keydown", event => {
        if (event.isComposing || (event.key !== "PageUp" && event.key !== "PageDown")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        messageBody.scrollTop += (event.key === "PageUp" ? -1 : 1) * messageBody.clientHeight * 0.9;
      }, { capture: true, signal: controller.signal });
    }
    overlay.append(hint);
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
