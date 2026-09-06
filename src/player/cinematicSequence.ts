import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { isCinematicAdvanceKey, normalizeKey } from "@/player/keyBindings";
import { installPlayPointerBlocker } from "@/player/playInputBlocker";
import type { CinematicSequence, Project } from "@/project/types";
import { el } from "@/util/dom";

export type CinematicCompletion = "completed" | "skipped" | "aborted";
export type CinematicPlayback = {
  readonly done: Promise<CinematicCompletion>;
  readonly teardown: () => void;
};

/** DOM-only playback: no session, Phaser, editor store or global audio ownership. */
export function playCinematicSequence(options: {
  readonly host: HTMLElement;
  readonly project: Project;
  readonly sequence: CinematicSequence | undefined;
  readonly signal: AbortSignal;
}): CinematicPlayback {
  const { host, project, sequence, signal } = options;
  if (signal.aborted || !sequence?.enabled || sequence.scenes.length === 0) {
    return { done: Promise.resolve(signal.aborted ? "aborted" : "completed"), teardown: () => undefined };
  }
  const root = el("div", { class: "cinematic-sequence", dataset: { testid: "cinematic-sequence" } });
  root.tabIndex = -1;
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "시네마틱");
  const previousFocus = host.ownerDocument.activeElement;
  const view = host.ownerDocument.defaultView ?? window;
  const reducedMotion = view.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const detachPointer = installPlayPointerBlocker(root);
  let index = 0;
  let settled = false;
  let cleanScene = (): void => undefined;
  let retryMedia = (): void => undefined;
  let scrollNarration = (_key: string): boolean => false;
  let canContinueVideo = false;
  let resolveDone: (result: CinematicCompletion) => void = () => undefined;
  const done = new Promise<CinematicCompletion>(resolve => { resolveDone = resolve; });
  const observer = new MutationObserver(() => {
    if (!root.isConnected || !host.contains(root)) finish("aborted");
  });
  const finish = (result: CinematicCompletion): void => {
    if (settled) return;
    settled = true;
    cleanScene();
    observer.disconnect();
    signal.removeEventListener("abort", abort);
    view.removeEventListener("keydown", onKeyDown, true);
    detachPointer();
    if (root.contains(host.ownerDocument.activeElement) && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
    root.remove();
    resolveDone(result);
  };
  const abort = (): void => finish("aborted");
  const next = (): void => {
    cleanScene();
    index += 1;
    if (index === sequence.scenes.length) finish("completed");
    else renderScene();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    // Capture before Phaser/document/title/menu handlers, including on the final press.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.isComposing) return;
    const key = normalizeKey(event.key);
    if (scrollNarration(key) || event.repeat) return;
    if (key === "escape" && sequence.skippable) finish("skipped");
    else if (key === "r") retryMedia();
    else if (isCinematicAdvanceKey(key) && (sequence.scenes[index].kind !== "video" || canContinueVideo)) next();
  };
  const renderScene = (): void => {
    const scene = sequence.scenes[index];
    const lifetime = new AbortController();
    const media: HTMLMediaElement[] = [];
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let advanceTimer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    let mediaActive = true;
    const releaseMedia = (): void => {
      if (!mediaActive) return;
      mediaActive = false;
      lifetime.abort();
      clearTimeout(loadTimer);
      for (const item of media) {
        item.pause();
        item.removeAttribute("src");
        item.load();
      }
    };
    cleanScene = () => {
      alive = false;
      releaseMedia();
      resizeObserver.disconnect();
      clearTimeout(advanceTimer);
    };
    root.replaceChildren();
    root.dataset.sceneId = scene.id;
    root.dataset.sceneKind = scene.kind;
    root.dataset.mediaState = "ready";
    root.style.setProperty("--cinematic-motion-ms", `${scene.durationMs || 8000}ms`);
    const narration = el("div", { class: "cinematic-narration", text: scene.narration });
    const hint = el("div", { class: "cinematic-hint", text: (scene.kind === "video" ? "동영상 재생" : "Z/Enter/Space 계속") + (sequence.skippable ? " · Esc 건너뛰기" : "") });
    const scrollHint = el("span", { text: " · ↑↓/PgUp/PgDn 스크롤", dataset: { testid: "cinematic-scroll-hint" } });
    scrollHint.hidden = true;
    hint.append(scrollHint);
    const updateScrollHint = (): void => {
      scrollHint.hidden = narration.scrollHeight <= narration.clientHeight;
    };
    const resizeObserver = new ResizeObserver(updateScrollHint);
    scrollNarration = key => {
      // Stage-logical pixels; synchronous assignment lets the browser clamp at both ends.
      switch (key) {
        case "arrowup": narration.scrollTop -= 24; break;
        case "arrowdown": narration.scrollTop += 24; break;
        case "pageup": narration.scrollTop -= narration.clientHeight * 0.9; break;
        case "pagedown": narration.scrollTop += narration.clientHeight * 0.9; break;
        case "home": narration.scrollTop = 0; break;
        case "end": narration.scrollTop = narration.scrollHeight; break;
        default: return false;
      }
      return true;
    };
    const status = el("div", { class: "cinematic-status", dataset: { testid: "cinematic-status" } });
    status.setAttribute("role", "status");
    const fail = (state: "blocked" | "error"): void => {
      if (!alive || !mediaActive) return;
      root.dataset.mediaState = state;
      canContinueVideo = true;
      status.textContent = state === "blocked"
        ? "자동 재생이 차단되었습니다. R 재생 재시도 · Z/Enter/Space 계속"
        : "미디어를 재생할 수 없습니다. Z/Enter/Space 계속";
      if (state === "error") releaseMedia();
    };
    const play = (item: HTMLMediaElement): void => {
      // Browser media is an external boundary: rejection must become a usable UI state.
      void item.play().then(() => {
        if (!alive || !mediaActive || root.dataset.mediaState !== "loading") return;
        if (scene.kind === "video" && !(item instanceof HTMLVideoElement)) return;
        root.dataset.mediaState = scene.kind === "video" ? "playing" : "ready";
        canContinueVideo = false;
        status.textContent = "";
      }, () => fail("blocked"));
    };
    retryMedia = () => {
      if (!alive || root.dataset.mediaState !== "blocked") return;
      status.textContent = "";
      root.dataset.mediaState = "loading";
      for (const item of media) play(item);
    };
    const addMedia = (item: HTMLMediaElement, resourceId: string): void => {
      const url = resolveAssetResourceUrl(resourceId, { project });
      media.push(item);
      item.addEventListener("error", () => fail("error"), { signal: lifetime.signal });
      if (!url) { fail("error"); return; }
      item.src = url;
      play(item);
    };
    canContinueVideo = scene.kind === "video";
    switch (scene.kind) {
      case "text": break;
      case "image": {
        const image = el("img", { class: "cinematic-image", attrs: { alt: "", draggable: "false" } });
        image.dataset.motion = reducedMotion ? "none" : scene.motion;
        const url = resolveAssetResourceUrl(scene.resourceId, { project });
        image.addEventListener("error", () => { image.remove(); fail("error"); }, { signal: lifetime.signal });
        if (url) image.src = url;
        else fail("error");
        root.append(image);
        break;
      }
      case "video": {
        const video = el("video", { class: "cinematic-video" });
        video.playsInline = true;
        video.addEventListener("ended", next, { signal: lifetime.signal });
        video.addEventListener("playing", () => {
          if (root.dataset.mediaState === "blocked") return;
          root.dataset.mediaState = "playing";
          canContinueVideo = false;
          status.textContent = "";
        }, { signal: lifetime.signal });
        root.dataset.mediaState = "loading";
        status.textContent = "동영상 불러오는 중 · Z/Enter/Space 계속";
        root.append(video);
        addMedia(video, scene.resourceId);
        if (mediaActive) loadTimer = setTimeout(() => {
          if (root.dataset.mediaState === "loading") fail("error");
        }, 10_000);
        break;
      }
    }
    root.append(narration, status, hint);
    updateScrollHint();
    resizeObserver.observe(narration);
    if (scene.narrationAudioResourceId && mediaActive) {
      const audio = el("audio", {});
      root.append(audio);
      addMedia(audio, scene.narrationAudioResourceId);
    }
    if (scene.durationMs > 0) advanceTimer = setTimeout(next, scene.durationMs);
  };
  host.append(root);
  view.addEventListener("keydown", onKeyDown, true);
  signal.addEventListener("abort", abort, { once: true });
  observer.observe(host.ownerDocument, { childList: true, subtree: true });
  root.focus({ preventScroll: true });
  renderScene();
  return { done, teardown: abort };
}
