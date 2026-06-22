import type { PlaySceneContext } from "@/player/playSceneTypes";
import { dialogueHost } from "@/player/playSceneDom";
import { applySystemGraphic } from "@/player/systemGraphics";

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
}

export function returnToTitle(scene: PlaySceneContext): void {
  const callback: unknown = scene.game.registry.get("returnToTitle");
  if (typeof callback === "function") {
    callback();
    return;
  }
  scene.showRuntimeOverlay("title-scene", "타이틀");
}
