import { getPlayerPreferences } from "@/player/playerPreferences";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { dialogueHost } from "@/player/playSceneDom";
import { stopAllAudio } from "@/player/audio";

const owners = new WeakMap<HTMLElement, () => void>();

/** Owns input, timers and teardown across blackout, credits and terminal choices. */
export function createTerminalScene(scene: PlaySceneContext, kind: "game-over" | "ending", label: string) {
  const host = dialogueHost(scene);
  if (!host) return;
  const terminal = createTerminalSurface(host, kind, label);
  scene.events.once("shutdown", terminal.cleanup);
  scene.events.once("destroy", terminal.cleanup);
  terminal.signal.addEventListener("abort", () => {
    scene.events.off("shutdown", terminal.cleanup);
    scene.events.off("destroy", terminal.cleanup);
  }, { once: true });
  scene.input_.releaseAllKeys();
  stopAllAudio();
  return terminal;
}

/** DOM-only presentation owner, also used by the editor's full game-over preview. */
export function createTerminalSurface(host: HTMLElement, kind: "game-over" | "ending", label: string, parentSignal?: AbortSignal) {
  owners.get(host)?.();
  const root = document.createElement("div");
  root.className = `cinematic-terminal terminal-scene ${kind}-screen`;
  root.dataset.testid = `${kind}-screen`;
  root.dataset.phase = "fade-out";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", label);
  root.tabIndex = -1;
  const controller = new AbortController();
  const { signal } = controller;
  const view = host.ownerDocument.defaultView ?? window;
  const reducedMotion = getPlayerPreferences().reduceMenuMotion || view.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  root.dataset.reducedMotion = String(reducedMotion);
  let onKey: ((event: KeyboardEvent) => void) | undefined;
  let interactive = false;
  let disposeMenu = (): void => undefined;
  const observer = new MutationObserver(() => { if (!root.isConnected || !host.contains(root)) cleanup(); });
  const cleanup = (): void => {
    if (signal.aborted) return;
    controller.abort();
    disposeMenu();
    observer.disconnect();
    parentSignal?.removeEventListener("abort", cleanup);
    root.remove();
    if (owners.get(host) === cleanup) owners.delete(host);
  };
  const wait = (ms: number): Promise<boolean> => new Promise(resolve => {
    if (signal.aborted) { resolve(false); return; }
    const abort = (): void => { clearTimeout(timer); resolve(false); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(true); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
  // Capture all keys until choices are actually available. A held death-trigger key
  // cannot skip the death, credits or retry on the next phase.
  view.addEventListener("keydown", event => {
    if (interactive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat && !event.isComposing) onKey?.(event);
  }, { capture: true, signal });
  owners.set(host, cleanup);
  parentSignal?.addEventListener("abort", cleanup, { once: true });
  host.append(root);
  root.focus({ preventScroll: true });
  observer.observe(host.ownerDocument, { childList: true, subtree: true });
  if (parentSignal?.aborted) cleanup();
  return {
    root, signal, reducedMotion, wait, cleanup,
    phase(name: string): void { root.dataset.phase = name; },
    keys(handler?: (event: KeyboardEvent) => void): void { onKey = handler; },
    menu(attach: () => () => void): void { interactive = true; onKey = undefined; disposeMenu = attach(); },
    lock(): void { interactive = false; onKey = undefined; disposeMenu(); },
  };
}
export type TerminalScene = ReturnType<typeof createTerminalSurface>;
