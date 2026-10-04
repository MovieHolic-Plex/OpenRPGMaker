import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { isCinematicAdvanceKey, normalizeKey } from "@/player/keyBindings";
import { installPlayPointerBlocker } from "@/player/playInputBlocker";
import type { CinematicSequence, Project } from "@/project/types";
import { el } from "@/util/dom";
import { createCinematicAssets, type CinematicAssets } from "@/player/cinematicAssets";
import { createTitleEffectsCanvas, freezeTitleEffects, stopTitleEffects } from "@/player/titleEffects/renderer";

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
  readonly assets?: CinematicAssets;
  readonly onFrame?: (url: string) => void;
}): CinematicPlayback {
  const { host, project, sequence, signal } = options;
  if (signal.aborted || !sequence?.enabled || sequence.scenes.length === 0) {
    return { done: Promise.resolve(signal.aborted ? "aborted" : "completed"), teardown: () => undefined };
  }
  const root = el("div", { class: "cinematic-sequence", dataset: { testid: "cinematic-sequence" } });
  const assets = options.assets ?? createCinematicAssets();
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
  // 시퀀스 전체에 깔리는 배경음악. 장면마다 root.replaceChildren 이 도니 host 에 붙여 살려 둔다.
  let music: HTMLAudioElement | undefined;
  const stopMusic = (): void => {
    if (!music) return;
    music.pause();
    music.removeAttribute("src");
    music.load();
    music.remove();
    music = undefined;
  };
  let resolveDone: (result: CinematicCompletion) => void = () => undefined;
  const done = new Promise<CinematicCompletion>(resolve => { resolveDone = resolve; });
  const observer = new MutationObserver(() => {
    if (!root.isConnected || !host.contains(root)) finish("aborted");
  });
  const disposeShot = (shot: HTMLElement): void => {
    shot.remove(); // Chromium may paint a white lost-context placeholder if still visible.
    for (const canvas of shot.querySelectorAll<HTMLCanvasElement>('.cinematic-effects')) stopTitleEffects(canvas);
  };
  const finish = (result: CinematicCompletion): void => {
    if (settled) return;
    settled = true;
    cleanScene();
    if (!options.assets) assets.dispose();
    stopMusic();
    observer.disconnect();
    signal.removeEventListener("abort", abort);
    view.removeEventListener("keydown", onKeyDown, true);
    detachPointer();
    if (root.contains(host.ownerDocument.activeElement) && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
    root.remove();
    for (const canvas of root.querySelectorAll<HTMLCanvasElement>('.cinematic-effects')) stopTitleEffects(canvas);
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
    let narrationTimer: ReturnType<typeof setTimeout> | undefined;
    const animations: Animation[] = [];
    let effects: HTMLCanvasElement | undefined;
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
      clearTimeout(advanceTimer);
      clearTimeout(narrationTimer);
      // Freeze the visible composition while another cut is prepared; settle every owned animation.
      for (const layer of root.querySelectorAll<HTMLElement>('.cinematic-shot > img, .cinematic-shot > canvas')) {
        layer.style.transform = view.getComputedStyle(layer).transform;
        layer.style.animation = 'none';
      }
      animations.forEach(animation => animation.cancel());
      root.querySelectorAll<HTMLElement>('[data-previous-shot]').forEach(disposeShot);
      if (effects) freezeTitleEffects(effects);
    };
    // Keep the previous frame visible until the incoming picture is decoded.
    root.dataset.pendingSceneId = scene.id;
    const narration = el("div", { class: "cinematic-narration", text: scene.narration });
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
        ? "자동 재생이 차단되었습니다. R 키로 다시 재생할 수 있습니다."
        : "미디어를 재생할 수 없습니다.";
      if (state === "error") releaseMedia();
    };
    const beginLoading = (): void => {
      root.dataset.mediaState = "loading";
      canContinueVideo = true;
      status.textContent = "미디어 불러오는 중";
      clearTimeout(loadTimer);
      loadTimer = setTimeout(() => {
        if (root.dataset.mediaState === "loading" || root.dataset.mediaState === "waiting") fail("error");
      }, 10_000);
    };
    const play = (item: HTMLMediaElement): void => {
      // Browser media is an external boundary: rejection must become a usable UI state.
      void item.play().then(() => {
        if (!alive || !mediaActive || root.dataset.mediaState !== "loading") return;
        if (scene.kind === "video" && !(item instanceof HTMLVideoElement)) return;
        root.dataset.mediaState = scene.kind === "video" ? "playing" : "ready";
        canContinueVideo = false;
        clearTimeout(loadTimer);
        status.textContent = "";
      }, () => fail("blocked"));
    };
    retryMedia = () => {
      if (!alive) return;
      if (root.dataset.mediaState === "error") { cleanScene(); renderScene(); return; }
      if (root.dataset.mediaState !== "blocked") return;
      beginLoading();
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
    const ready = (visual?: HTMLElement): void => {
      if (!alive || settled) return;
      const previous = root.querySelector<HTMLElement>('.cinematic-shot');
      root.replaceChildren(...(visual ? [visual] : []), narration, status);
      root.dataset.sceneId = scene.id;
      root.dataset.sceneKind = scene.kind;
      delete root.dataset.pendingSceneId;
      root.dataset.mediaState = scene.kind === 'video' ? 'loading' : 'ready';
      root.style.setProperty('--cinematic-motion-ms', `${scene.durationMs || 8000}ms`);
      status.textContent = '';
      if (scene.kind === 'image' && visual) {
        const direction = scene.direction;
        const transition = reducedMotion ? undefined : direction?.transition;
        if (transition && transition.kind !== 'cut' && transition.durationMs > 0) {
          if (previous && transition.kind === 'dissolve') {
            previous.dataset.previousShot = 'true';
            visual.before(previous);
            const fade = previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: transition.durationMs, fill: 'forwards' });
            animations.push(fade);
            void fade.finished.then(() => disposeShot(previous), () => disposeShot(previous));
          }
          const frames = transition.kind === 'flash'
            ? [{ filter: 'brightness(2.3)', opacity: 0.6 }, { filter: 'brightness(1)', opacity: 1 }]
            : [{ opacity: 0 }, { opacity: 1 }];
          animations.push(visual.animate(frames, { duration: transition.durationMs, fill: 'both' }));
        }
        if (previous && !previous.isConnected) disposeShot(previous);
        if (direction?.camera && !reducedMotion) {
          const transform = ([x, y, zoom]: [number, number, number]): string => `scale(${zoom}) translate(${(0.5-x)*(zoom-1)/zoom*100}%, ${(0.5-y)*(zoom-1)/zoom*100}%)`;
          for (const layer of visual.children) if (layer instanceof HTMLElement) {
            animations.push(layer.animate([{ transform: transform(direction.camera.from) }, { transform: transform(direction.camera.to) }], { duration: scene.durationMs || 8000, easing: 'ease-in-out', fill: 'both' }));
          }
        }
        const delay = direction?.narrationDelayMs ?? 0;
        if (delay > 0) { narration.hidden = true; narrationTimer = setTimeout(() => { if (alive) narration.hidden = false; }, delay); }
        if (direction?.soundResourceId) { const audio = el('audio', {}); root.append(audio); addMedia(audio, direction.soundResourceId); }
      }
      if (scene.narrationAudioResourceId && mediaActive) {
        const audio = el('audio', {}); root.append(audio); addMedia(audio, scene.narrationAudioResourceId);
      }
      if (scene.durationMs > 0) advanceTimer = setTimeout(next, scene.durationMs);
      assets.warm(project, sequence, index + 1);
    };
    switch (scene.kind) {
      case "text": ready(); break;
      case "image": {
        const image = el("img", { class: "cinematic-image", attrs: { alt: "", draggable: "false" } });
        image.dataset.motion = reducedMotion || scene.direction?.camera ? "none" : scene.motion;
        const url = resolveAssetResourceUrl(scene.resourceId, { project });
        root.querySelector('.cinematic-status')?.remove();
        root.append(status);
        root.dataset.mediaState = 'loading';
        // A short wait stays silent. A prolonged wait has a usable retry/skip boundary.
        loadTimer = setTimeout(() => { if (alive) status.textContent = '장면을 준비하고 있습니다…'; }, 800);
        void (url ? assets.prepare(url) : Promise.reject(new Error('Missing image'))).then(async prepared => {
          image.src = prepared.url;
          await image.decode();
          if (!alive || settled) return;
          clearTimeout(loadTimer);
          const shot = el('div', { class: 'cinematic-shot', children: [image] });
          if (scene.direction?.effects?.length) {
            effects = createTitleEffectsCanvas({ imageUrl: prepared.url, effects: scene.direction.effects, fit: 'cover', rendering: 'smooth' });
            effects.classList.add('cinematic-effects');
            effects.dataset.motion = image.dataset.motion;
            shot.append(effects);
          }
          ready(shot);
          options.onFrame?.(prepared.url);
        }).catch(() => { if (alive && !settled) { fail('error'); status.textContent = '장면을 읽을 수 없습니다. R 키로 재시도하거나 Enter로 넘어가세요.'; } });
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
          clearTimeout(loadTimer);
          status.textContent = "";
        }, { signal: lifetime.signal });
        const waiting = (event: Event): void => {
          if (root.dataset.mediaState === "blocked") return;
          // Fetching can stall while buffered video is still playing normally.
          if (event.type === "stalled" && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
          root.dataset.mediaState = "waiting";
          canContinueVideo = true;
          status.textContent = "동영상 재생 대기 중";
        };
        video.addEventListener("waiting", waiting, { signal: lifetime.signal });
        video.addEventListener("stalled", waiting, { signal: lifetime.signal });
        ready(video);
        beginLoading();
        addMedia(video, scene.resourceId);
        break;
      }
    }
  };
  if (sequence.musicResourceId) {
    root.dataset.music = sequence.musicResourceId;
    const url = resolveAssetResourceUrl(sequence.musicResourceId, { project });
    if (url) {
      const audio = el("audio", { dataset: { testid: "cinematic-music" } });
      audio.loop = true;
      audio.src = url;
      host.append(audio);
      music = audio;
      // 자동재생 차단·재생 실패는 연출을 막지 않는다(장면 상태 기계와 분리).
      void audio.play().catch(() => undefined);
    }
  }
  host.append(root);
  view.addEventListener("keydown", onKeyDown, true);
  signal.addEventListener("abort", abort, { once: true });
  observer.observe(host.ownerDocument, { childList: true, subtree: true });
  root.focus({ preventScroll: true });
  renderScene();
  return { done, teardown: abort };
}
