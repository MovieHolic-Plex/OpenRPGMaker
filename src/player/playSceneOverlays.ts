import type { PlaySceneContext } from "@/player/playSceneTypes";
import { dialogueHost } from "@/player/playSceneDom";
import { applySystemGraphic } from "@/player/systemGraphics";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";

// 종단 화면(게임오버/엔딩)의 단일 '타이틀로' 버튼에 커서 메뉴를 붙여 Z/Enter/Esc 로
// 확정되게 한다. 버튼이 눌리면(키/마우스) 1회성으로 detach 해 리스너 누수를 막는다.
function attachTerminalCursor(overlay: HTMLElement, button: HTMLButtonElement): void {
  const detach = attachCursorMenu(overlay, { items: [button], cancelEl: button });
  button.addEventListener("click", () => detach(), { once: true });
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

export function showGameOverScreen(scene: PlaySceneContext): void {
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
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.testid = "return-title";
  button.textContent = "타이틀로 돌아가기";
  button.addEventListener("click", () => scene.returnToTitle());
  overlay.append(title, button);
  host.append(overlay);
  attachTerminalCursor(overlay, button);
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
  attachTerminalCursor(overlay, button);
}

export function returnToTitle(scene: PlaySceneContext): void {
  const callback: unknown = scene.game.registry.get("returnToTitle");
  if (typeof callback === "function") {
    callback();
    return;
  }
  scene.showRuntimeOverlay("title-scene", "타이틀");
}
