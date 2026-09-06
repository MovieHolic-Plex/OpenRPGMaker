import {
  playCinematicSequence,
  type CinematicPlayback,
} from "@/player/cinematicSequence";
import { store } from "@/project/store";
import type { CinematicSequence } from "@/project/cinematicSettings";
import { resolvePlayResolution } from "@/project/playResolution";
import { createPlaySurface, type PlaySurface } from "@/player/playSurface";

/**
 * The view owns the preview chrome/host and calls stop for its Stop and Close
 * buttons. Its actions lifetime signal must be passed here, and disposed
 * synchronously before Database hides, caches, evicts or closes the view.
 */
export function createDatabaseCinematicPreview(options: {
  readonly host: HTMLElement;
  readonly signal: AbortSignal;
  readonly isActive: () => boolean;
  readonly onPlayingChange: (playing: boolean) => void;
}) {
  const { host, signal } = options;
  const view = host.ownerDocument.defaultView ?? window;
  let playback: CinematicPlayback | undefined;
  let surface: PlaySurface | undefined;
  let run: AbortController | undefined;
  let disposed = false;
  let observer: MutationObserver | undefined;
  let unsubscribe: (() => void) | undefined;
  let returnFocus: Element | null = null;

  const stop = (): void => {
    if (!run) return;
    const previousRun = run;
    const previousPlayback = playback;
    run = undefined;
    playback = undefined;
    view.removeEventListener("keydown", onEscape, true);
    observer?.disconnect();
    observer = undefined;
    unsubscribe?.();
    unsubscribe = undefined;
    previousRun.abort();
    previousPlayback?.teardown();
    surface?.cleanup();
    surface?.viewport.remove();
    surface = undefined;
    options.onPlayingChange(false);
    if (returnFocus instanceof HTMLElement && returnFocus.isConnected && options.isActive()) {
      returnFocus.focus({ preventScroll: true });
      returnFocus.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
    returnFocus = null;
  };

  const onEscape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !run) return;
    // Installed on window BEFORE the player's window capture handler.
    // Database's document handler must never receive this same Escape.
    event.preventDefault();
    event.stopImmediatePropagation();
    stop();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    stop();
    signal.removeEventListener("abort", dispose);
  };

  const visible = (): boolean => {
    if (!host.isConnected || !options.isActive()) return false;
    for (let node: HTMLElement | null = host; node; node = node.parentElement) {
      if (node.hidden || node.getAttribute("aria-hidden") === "true"
        || node.style.display === "none" || node.style.visibility === "hidden") return false;
    }
    return true;
  };

  signal.addEventListener("abort", dispose, { once: true });
  if (signal.aborted) dispose();

  return {
    stop,
    dispose,
    get playing(): boolean {
      return run !== undefined;
    },

    start(sequence: CinematicSequence | undefined): boolean {
      stop();
      if (disposed || signal.aborted || !options.isActive() || !sequence?.scenes.length) return false;
      const currentRun = new AbortController();
      run = currentRun;
      returnFocus = host.ownerDocument.activeElement;
      // Preview may audition retained disabled content without enabling it in
      // the project. All other authored values, including skippable, are kept.
      const previewSequence = structuredClone({ ...sequence, enabled: true });
      const project = store.getCurrent();
      view.addEventListener("keydown", onEscape, true);
      unsubscribe = store.subscribe((next, change) => {
        if (next !== project || change.projectSwitch) stop();
      });
      observer = new MutationObserver(() => {
        if (!visible()) stop();
      });
      observer.observe(host.ownerDocument, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "aria-hidden", "style", "class"],
      });
      try {
        options.onPlayingChange(true);
        if (!visible()) {
          stop();
          return false;
        }
        surface = createPlaySurface(resolvePlayResolution(project.system), "fit");
        host.append(surface.viewport);
        surface.sync();
        playback = playCinematicSequence({
          host: surface.stage,
          project,
          sequence: previewSequence,
          signal: currentRun.signal,
        });
        void playback.done.then(() => {
          // Completion from an older run must not stop a newer preview.
          if (run === currentRun) stop();
        });
        return true;
      } catch (error) {
        stop();
        throw error;
      }
    },
  };
}

export type DatabaseCinematicPreview = ReturnType<typeof createDatabaseCinematicPreview>;
