import type { Project } from "@/project/types";
import { getPlayerPreferences } from "@/player/playerPreferences";
import { playCinematicSequence } from "@/player/cinematicSequence";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import { gameOverOutcome, resolveGameOverSettings, type GameOverSettings, DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID } from "@/project/cinematicSettings";
import { createTerminalScene, type TerminalScene } from "@/player/terminalScene";
import type { EndingPresentation } from "@/project/cinematicSettings";
import { isCinematicAdvanceKey, normalizeKey } from "@/player/keyBindings";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { dialogueHost } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";

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

export function returnToTitle(scene: PlaySceneContext): void {
  const callback: unknown = scene.game.registry.get("returnToTitle");
  if (typeof callback === "function") {
    callback();
    return;
  }
  scene.showRuntimeOverlay("title-scene", "타이틀");
}

/** 엔딩 클리어를 호스트(플레이어)에 알린다. 저장은 호스트가 한다 — 인터프리터는 저장소를 모른다. */
export function reportEndingClear(scene: PlaySceneContext, clear: { readonly endingId: string } | undefined): void {
  if (!clear) return;
  const callback: unknown = scene.game.registry.get("recordEndingClear");
  if (typeof callback === "function") callback(clear.endingId, scene.session);
}

function textNode(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function addBackground(terminal: TerminalScene, resourceId: string | undefined, fallback?: HTMLElement, project = store.getCurrent()): void {
  if (!resourceId) return;
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) { if (fallback) fallback.hidden = false; return; }
  const image = document.createElement("img");
  image.className = "cinematic-background";
  image.alt = "";
  image.draggable = false;
  image.addEventListener("error", () => { image.remove(); if (fallback) fallback.hidden = false; }, { once: true, signal: terminal.signal });
  image.src = url;
  terminal.root.prepend(image);
}

function terminalButton(testId: string, label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "game-over-choice";
  button.dataset.testid = testId;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

/** Exit covers the stage before changing the underlying session/title. */
async function exitTerminal(terminal: TerminalScene, action: () => void): Promise<void> {
  terminal.lock();
  terminal.phase("exit");
  const music = terminal.root.querySelector<HTMLAudioElement>('audio[data-terminal-music]');
  if (music) {
    const volume = music.volume, started = performance.now();
    const fade = window.setInterval(() => { music.volume = Math.max(0, volume * (1 - (performance.now() - started) / 380)); }, 30);
    terminal.signal.addEventListener("abort", () => window.clearInterval(fade), { once: true });
  }
  if (!await terminal.wait(terminal.reducedMotion ? 0 : 380)) return;
  terminal.cleanup();
  action();
}

export function showGameOverScreen(scene: PlaySceneContext, message?: string, gameOverId?: string): void {
  const project = store.getCurrent();
  const settings = resolveGameOverSettings(project.system, gameOverId);
  const terminal = createTerminalScene(scene, "game-over", settings?.title || "게임 오버");
  if (!terminal) return;
  playGameOverPresentation(terminal, project, settings, {
    hasCheckpoint: () => scene.hasCheckpoint(),
    restoreCheckpoint: () => scene.restoreCheckpoint(),
    returnToTitle: () => scene.returnToTitle(),
    recoverFromDefeat: () => scene.recoverFromDefeat(settings),
  }, message);
}

export type GameOverPresentationActions = {
  hasCheckpoint(): boolean;
  restoreCheckpoint(): void;
  returnToTitle(): void;
  recoverFromDefeat(): boolean;
};

/** Pure presentation seam: editor previews use the exact player flow with simulated outcomes. */
export function playGameOverPresentation(terminal: TerminalScene, project: Project, settings: GameOverSettings | undefined, scene: GameOverPresentationActions, message?: string): void {
  const style = settings?.presentation ?? "classic";
  const outcome = gameOverOutcome(settings);
  const timing = settings?.timing;
  terminal.root.style.setProperty("--terminal-fade-ms", `${timing?.fadeOutMs ?? 900}ms`);
  terminal.root.dataset.presentation = style;
  const run = async (): Promise<void> => {
    if (!await terminal.wait(terminal.reducedMotion ? 0 : (timing?.fadeOutMs ?? 900))) return;
    terminal.phase("silence");
    if (!await terminal.wait(timing?.silenceMs ?? (style === "horror" ? 750 : 180))) return;
    if (settings?.sequence?.enabled && settings.sequence.scenes.length) {
      // The cinematic owns keys while active; the terminal resumes ownership on completion.
      terminal.menu(() => () => undefined);
      const result = await playCinematicSequence({ host: terminal.root, project, sequence: settings.sequence, signal: terminal.signal }).done;
      if (result === "aborted" || terminal.signal.aborted) return;
      terminal.lock();
    }
    playTerminalMusic(terminal, project, settings?.musicResourceId, "game-over-music");
    if (outcome === "recover" || outcome === "title") {
      terminal.phase("blackout-message");
      addBackground(terminal, settings?.backgroundResourceId, undefined, project);
      const body = textNode("div", "blackout-message", message ?? settings?.message ?? (outcome === "recover" ? "더는 싸울 수 없었다.\n눈앞이 캄캄해졌다…" : settings?.title ?? "이야기가 끝났습니다."));
      terminal.root.append(body);
      // Readable beat before automatic recovery; no GAME OVER or retry menu.
      if (!await terminal.wait(timing?.messageHoldMs ?? 2200)) return;
      terminal.phase("silence");
      body.remove();
      if (!await terminal.wait(500)) return;
      if (outcome === "title") { await exitTerminal(terminal, () => scene.returnToTitle()); return; }
      terminal.root.querySelector<HTMLAudioElement>("audio[data-terminal-music]")?.pause();
      if (scene.recoverFromDefeat()) {
        terminal.phase("wake");
        if (await terminal.wait(terminal.reducedMotion ? 0 : 800)) terminal.cleanup();
        return;
      }
      // Deleted/blocked recovery locations must not leave an unplayable black screen.
      renderDefeatMenu(terminal, scene, project, settings, "귀환할 장소를 찾을 수 없습니다.");
      return;
    }
    renderDefeatMenu(terminal, scene, project, settings, message);
  };
  void run();
}

function renderDefeatMenu(terminal: TerminalScene, scene: GameOverPresentationActions, project: Project, settings: GameOverSettings | undefined, message?: string): void {
  const style = settings?.presentation ?? "classic";
  terminal.phase("reveal");
  const overlay = textNode("div", "game-over-content", "");
  const title = textNode("h1", "runtime-overlay-title game-over-heading", settings?.title ?? (style === "horror" ? "돌아오지 못했다" : "게임 오버"));
  const backgroundId = settings?.backgroundResourceId ?? (style === "classic" ? DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID : undefined);
  title.hidden = backgroundId === DEFAULT_GAME_OVER_BACKGROUND_RESOURCE_ID && settings?.title === undefined;
  addBackground(terminal, backgroundId, title, project);
  overlay.append(title);
  const resolvedMessage = message ?? settings?.message;
  if (resolvedMessage) overlay.append(textNode("div", "runtime-overlay-message game-over-message", resolvedMessage));
  terminal.root.append(overlay);
  void terminal.wait(settings?.timing?.menuDelayMs ?? (style === "horror" ? 1500 : 650)).then(alive => {
    if (!alive) return;
    const actions = textNode("div", "game-over-actions", "");
    const buttons: HTMLButtonElement[] = [];
    if (scene.hasCheckpoint()) buttons.push(terminalButton("checkpoint-retry", settings?.retryLabel ?? "체크포인트에서 다시 시작", () => { void exitTerminal(terminal, () => scene.restoreCheckpoint()); }));
    const titleButton = terminalButton("return-title", settings?.titleLabel ?? "타이틀로 돌아가기", () => { void exitTerminal(terminal, () => scene.returnToTitle()); });
    buttons.push(titleButton);
    actions.append(...buttons);
    overlay.append(actions);
    const hint = textNode("div", "game-over-hint", "↑↓ 선택   ·   Z / Enter 결정");
    overlay.append(hint);
    const messageBody = overlay.querySelector<HTMLElement>(".game-over-message");
    if (messageBody && messageBody.scrollHeight > messageBody.clientHeight) {
      hint.textContent += "   ·   PgUp/PgDn 본문";
      window.addEventListener("keydown", event => {
        if (event.isComposing || !["PageUp", "PageDown"].includes(event.key)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        messageBody.scrollTop += (event.key === "PageUp" ? -1 : 1) * messageBody.clientHeight * 0.9;
      }, { capture: true, signal: terminal.signal });
    }
    terminal.phase("choices");
    terminal.menu(() => attachCursorMenu(overlay, { items: buttons, cancelEl: titleButton }));
  });
}

export function showEndingScreen(scene: PlaySceneContext, title: string, message: string, presentation?: EndingPresentation): void {
  const terminal = createTerminalScene(scene, "ending", title || "엔딩");
  if (!terminal) return;
  terminal.root.dataset.tone = presentation?.tone ?? "warm";
  const run = async (): Promise<void> => {
    if (!await terminal.wait(terminal.reducedMotion ? 0 : 900)) return;
    terminal.phase("silence");
    if (!await terminal.wait(600)) return;
    addBackground(terminal, presentation?.backgroundResourceId);
    playTerminalMusic(terminal, store.getCurrent(), presentation?.musicResourceId, "ending-music");
    const epilogue = textNode("div", "ending-epilogue", "");
    epilogue.append(textNode("div", "ending-kicker", presentation?.tone === "dark" ? "이야기의 끝" : "우리의 여정"));
    epilogue.append(textNode("h1", "ending-heading", title || "The End"));
    if (message) epilogue.append(textNode("div", "ending-message", message));
    terminal.root.append(epilogue);
    terminal.phase("epilogue");
    if (!await terminal.wait(1800)) return;
    const hint = textNode("div", "game-over-hint", "Z / Enter 계속");
    terminal.root.append(hint);
    terminal.keys(event => {
      const body = epilogue.querySelector<HTMLElement>(".ending-message");
      if (body && ["PageDown", "PageUp"].includes(event.key)) body.scrollTop += (event.key === "PageUp" ? -1 : 1) * body.clientHeight * .9;
      if (isCinematicAdvanceKey(normalizeKey(event.key))) { terminal.keys(); hint.remove(); void credits(); }
    });
  };
  const finish = (): void => {
    terminal.root.querySelector(".ending-epilogue")?.remove();
    terminal.root.querySelector(".ending-credits")?.remove();
    terminal.root.querySelector(".game-over-hint")?.remove();
    terminal.phase("final");
    const final = textNode("div", "ending-final game-over-content", "");
    final.append(textNode("div", "ending-final-title", "THE END"));
    final.append(textNode("div", "ending-final-caption", title));
    const actions = textNode("div", "game-over-actions", "");
    const button = terminalButton("return-title", "타이틀로 돌아가기", () => { void exitTerminal(terminal, () => scene.returnToTitle()); });
    actions.append(button); final.append(actions); terminal.root.append(final);
    terminal.menu(() => attachCursorMenu(final, { items: [button], cancelEl: button }));
  };
  const credits = async (): Promise<void> => {
    terminal.phase("credits-transition");
    if (!await terminal.wait(terminal.reducedMotion ? 0 : 500)) return;
    terminal.root.querySelector(".ending-epilogue")?.remove();
    const copy = presentation?.credits?.trim();
    if (!copy) { finish(); return; }
    terminal.phase("credits");
    const viewport = textNode("div", "ending-credits", "");
    const roll = textNode("div", "ending-credits-roll", copy);
    viewport.append(roll); terminal.root.append(viewport);
    const distance = viewport.clientHeight + roll.scrollHeight;
    const duration = Math.max(12000, distance / 12 * 1000);
    terminal.root.style.setProperty("--credits-duration", `${duration}ms`);
    terminal.root.style.setProperty("--credits-start", `${viewport.clientHeight}px`);
    terminal.root.style.setProperty("--credits-end", `${-roll.scrollHeight}px`);
    const hint = textNode("div", "game-over-hint", terminal.reducedMotion ? "PgUp/PgDn 읽기   ·   Z / Enter 마침" : "Z / Enter 크레딧 건너뛰기");
    terminal.root.append(hint);
    let finished = false;
    const finishOnce = (): void => { if (finished || terminal.signal.aborted) return; finished = true; terminal.keys(); finish(); };
    if (!terminal.reducedMotion) void terminal.wait(duration).then(alive => { if (alive) finishOnce(); });
    if (!await terminal.wait(800)) return;
    terminal.keys(event => {
      if (["PageDown", "PageUp"].includes(event.key) && terminal.reducedMotion) viewport.scrollTop += (event.key === "PageUp" ? -1 : 1) * viewport.clientHeight * .9;
      if (isCinematicAdvanceKey(normalizeKey(event.key))) finishOnce();
    });
  };
  void run();
}

function playTerminalMusic(terminal: TerminalScene, project: Project, resourceId: string | undefined, testId: string): void {
  if (!resourceId) return;
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return;
  const music = document.createElement("audio");
  music.dataset.testid = testId;
  music.dataset.terminalMusic = "true";
  music.src = url; music.loop = true; music.volume = getPlayerPreferences().bgm;
  terminal.root.append(music);
  terminal.signal.addEventListener("abort", () => { music.pause(); music.removeAttribute("src"); music.load(); music.remove(); }, { once: true });
  void music.play().catch(() => { /* Unavailable media must not prevent the terminal outcome. */ });
}
