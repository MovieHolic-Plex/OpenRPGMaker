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

export function showGameOverScreen(scene: PlaySceneContext, message?: string): void {
  const host = dialogueHost(scene);
  if (!host) return;
  host.querySelector("[data-testid='game-over-screen']")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "runtime-overlay game-over-panel";
  overlay.dataset.testid = "game-over-screen";
  applySystemGraphic(overlay);
  const title = document.createElement("div");
  title.className = "runtime-overlay-title";
  title.textContent = "게임 오버";
  overlay.append(title);
  if (message) {
    const body = document.createElement("div");
    body.className = "runtime-overlay-message";
    body.textContent = message;
    overlay.append(body);
  }
  const buttons: HTMLButtonElement[] = [];
  if (scene.hasCheckpoint()) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.dataset.testid = "checkpoint-retry";
    retry.textContent = "다시 시도";
    retry.addEventListener("click", () => {
      overlay.remove();
      scene.restoreCheckpoint();
    });
    buttons.push(retry);
  }
  const titleButton = document.createElement("button");
  titleButton.type = "button";
  titleButton.dataset.testid = "return-title";
  titleButton.textContent = "타이틀로";
  titleButton.addEventListener("click", () => scene.returnToTitle());
  buttons.push(titleButton);
  overlay.append(...buttons);
  host.append(overlay);
  attachTerminalCursor(overlay, buttons, titleButton);
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
