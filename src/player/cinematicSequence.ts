import { playOpeningAnimatic } from "./openingAnimaticRenderer";
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
  readonly dismissOnAnyInput?: boolean;
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
  const book = project.meta.oprnOpeningBook;
  const isBook = book?.version===1 && sequence.scenes.every((s,i)=>s.id===book.sceneIds[i] && s.durationMs===0 && (s.kind==='image'||s.kind==='text')) && sequence.scenes.length===book.sceneIds.length;
  if(isBook){root.dataset.presentation='storybook';root.dataset.ink=book!.ink;root.setAttribute('aria-label','이야기 오프닝');}
  let bookImage:HTMLImageElement|undefined;
  let bookImageId:string|undefined;
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
  const finish = (result: CinematicCompletion): void => {
    if (settled) return;
    settled = true;
    cleanScene();
    stopMusic();
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
    if (options.dismissOnAnyInput && !event.repeat) { finish("skipped"); return; }
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
      clearTimeout(advanceTimer);
    };
    // Keep the same illustration node mounted while its dialogue pages change.
    const keepImage=isBook&&scene.kind==='image'&&bookImageId===scene.resourceId&&bookImage?.parentElement===root;
    if(keepImage){for(const child of Array.from(root.children))if(child!==bookImage)child.remove();}
    else {root.replaceChildren();bookImage=undefined;bookImageId=undefined;}
    root.dataset.page=String(index+1);
    root.dataset.sceneId = scene.id;
    root.dataset.sceneKind = scene.kind;
    root.dataset.mediaState = "ready";
    root.style.setProperty("--cinematic-motion-ms", `${scene.durationMs || 8000}ms`);
    // A fade reveals a shot; its hold time must not keep the whole picture dim.
    root.style.setProperty("--cinematic-fade-ms", `${Math.min(600, scene.durationMs || 600)}ms`);
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
      if (!alive || root.dataset.mediaState !== "blocked") return;
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
    switch (scene.kind) {
      case "text": break;
      case "image": {
        const image = keepImage ? bookImage! : el("img", { class: "cinematic-image", attrs: { alt: "", draggable: "false" } });
        image.dataset.motion = reducedMotion ? "none" : scene.motion;
        const url = resolveAssetResourceUrl(scene.resourceId, { project });
        image.addEventListener("error", () => { image.remove(); fail("error"); }, { signal: lifetime.signal });
        if (url && !keepImage) image.src = url;
        else if(!url) fail("error");
        if(!keepImage)root.append(image);
        if(isBook){bookImage=image;bookImageId=scene.resourceId;}
        break;
      }
      case "animatic": {
        const canvas = el("canvas", { class: "cinematic-animatic", dataset: { testid: "opening-animatic-stage" } });
        canvas.setAttribute('aria-label', '레이어와 카메라로 구성한 오프닝');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000';
        root.append(canvas); beginLoading();
        playOpeningAnimatic({ project, canvas, composition: scene.composition, durationMs: scene.durationMs, signal: lifetime.signal, reducedMotion,
          onReady: () => { if (!alive || !mediaActive) return; clearTimeout(loadTimer); root.dataset.mediaState = 'ready'; status.textContent = ''; },
          onError: message => { if (!alive || !mediaActive) return; fail('error'); status.textContent = message; }, onDone: () => { if (alive) next(); } });
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
        beginLoading();
        root.append(video);
        addMedia(video, scene.resourceId);
        break;
      }
    }
    root.append(narration, status);
    if(isBook)root.append(el('div',{class:'cinematic-book-hint',text:`${index+1} / ${sequence.scenes.length}   Enter 다음${sequence.skippable?' · Esc 건너뛰기':''}`}));
    if (scene.narrationAudioResourceId && mediaActive) {
      const audio = el("audio", {});
      root.append(audio);
      addMedia(audio, scene.narrationAudioResourceId);
    }
    if (scene.kind !== "animatic" && scene.durationMs > 0) advanceTimer = setTimeout(next, scene.durationMs);
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
