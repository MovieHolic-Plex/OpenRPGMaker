import { animateCinematicText } from '@/player/cinematicText';
import { resolveCinematicPresentation } from '@/project/cinematicPresentation';
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { isCinematicAdvanceKey, normalizeKey } from "@/player/keyBindings";
import { installPlayPointerBlocker } from "@/player/playInputBlocker";
import type { CinematicSequence, Project } from "@/project/types";
import { el } from "@/util/dom";
import { createCinematicAssets, type CinematicAssets } from "@/player/cinematicAssets";
import { createTitleEffectsCanvas, freezeTitleEffects, stopTitleEffects } from "@/player/titleEffects/renderer";
import { getPlayerPreferences } from './playerPreferences';
import { playOpeningAnimatic } from "./openingAnimaticRenderer";
import { isEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import { createEmeraldOpeningAtmosphere } from './emeraldOpeningAtmosphere';
import { createOpeningPortraitMotion, type PortraitMotionPlayback } from './openingPortraitMotion';

export type CinematicCompletion = "completed" | "skipped" | "aborted";
export type CinematicPlayback = {
  readonly done: Promise<CinematicCompletion>;
  readonly teardown: () => void;
  readonly releaseMusic: (fadeMs?: number) => void;
};

/** Preserve the visible multi-layer composition across the final map load. */
function flattenCinematicFrame(shot: HTMLElement): string | undefined {
  const canvas = document.createElement('canvas');
  const size = shot.getBoundingClientRect();
  if (!size.width || !size.height) return;
  // Paint in logical coordinates at the displayed resolution: no blank area or pixelated art.
  canvas.width = Math.round(size.width); canvas.height = Math.round(size.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(canvas.width / shot.clientWidth, canvas.height / shot.clientHeight);
  try {
    const images = [...shot.querySelectorAll<HTMLImageElement>('img')].sort((a, b) =>
      (parseInt(getComputedStyle(a).zIndex, 10) || 0) - (parseInt(getComputedStyle(b).zIndex, 10) || 0));
    for (const image of images) {
      const style = getComputedStyle(image);
      const width = parseFloat(style.width), height = parseFloat(style.height);
      const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
      const origin = style.transformOrigin.split(' ').map(parseFloat);
      ctx.save(); ctx.globalAlpha = Number(style.opacity);
      ctx.translate(parseFloat(style.left) || 0, parseFloat(style.top) || 0);
      ctx.translate(origin[0] || 0, origin[1] || 0); ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
      ctx.translate(-(origin[0] || 0), -(origin[1] || 0));
      if (image.classList.contains('cinematic-image')) {
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      } else ctx.drawImage(image, 0, 0, width, height);
      ctx.restore();
    }
    return canvas.toDataURL('image/png');
  } catch { return; } // Cross-origin art retains the normal last-image handoff.
}

/** DOM-only playback: no session, Phaser, editor store or global audio ownership. */
export function playCinematicSequence(options: {
  readonly host: HTMLElement;
  readonly project: Project;
  readonly sequence: CinematicSequence | undefined;
  readonly signal: AbortSignal;
  readonly assets?: CinematicAssets;
  readonly musicVolume?: () => number;
  readonly holdMusicOnComplete?: boolean;
  readonly musicHost?: HTMLElement;
  readonly onFrame?: (url: string, fadeMs?: number) => void;
  readonly dismissOnAnyInput?: boolean;
}): CinematicPlayback {
  const { host, project, sequence, signal } = options;
  if (signal.aborted || !sequence?.enabled || sequence.scenes.length === 0) {
    return { done: Promise.resolve(signal.aborted ? "aborted" : "completed"), teardown: () => undefined, releaseMusic: () => undefined };
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
  const book = project.meta.oprnOpeningBook;
  const isBook = book?.version===1 && sequence.scenes.every((s,i)=>s.id===book.sceneIds[i] && s.durationMs===0 && (s.kind==='image'||s.kind==='text')) && sequence.scenes.length===book.sceneIds.length;
  if(isBook){root.dataset.presentation='storybook';root.dataset.ink=book!.ink;root.setAttribute('aria-label','이야기 오프닝');}
  const isEmeraldIntro = isBook && isEmeraldMonsterStyle(project) && Boolean(book?.portraitResourceId);
  if (isEmeraldIntro) { root.dataset.monsterStyle = 'emerald'; root.setAttribute('aria-label','교수와 몬스터 소개'); }
  const atmosphere = isEmeraldIntro ? createEmeraldOpeningAtmosphere(host, project, reducedMotion) : undefined;
  let bookImage:HTMLImageElement|undefined;
  let bookImageId:string|undefined;
  let portraitMotion:PortraitMotionPlayback|undefined;
  let index = 0;
  let settled = false;
  let cleanScene = (): void => undefined;
  let retryMedia = (): void => undefined;
  let scrollNarration = (_key: string): boolean => false;
  let canContinueVideo = false;
  let revealText = (): boolean => false;
  let flattenFrame: (() => string) | undefined;
  // 시퀀스 전체에 깔리는 배경음악. 장면마다 root.replaceChildren 이 도니 host 에 붙여 살려 둔다.
  let music: HTMLAudioElement | undefined;
  let musicFadeTimer: ReturnType<typeof setInterval> | undefined;
  let releasingMusic = false;
  const stopMusic = (fadeMs = 0): void => {
    if (fadeMs > 0 && releasingMusic) return;
    clearInterval(musicFadeTimer);
    if (!music) return;
    if (fadeMs > 0 && !music.paused) {
      releasingMusic = true;
      const audio = music, volume = audio.volume, start = performance.now();
      musicFadeTimer = setInterval(() => {
        audio.volume = volume * Math.max(0, 1 - (performance.now() - start) / fadeMs);
        if (performance.now() - start >= fadeMs) stopMusic();
      }, 40);
      return;
    }
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
    if (result !== 'aborted' && flattenFrame) {
      const last = sequence.scenes[index] ?? sequence.scenes.at(-1)!;
      options.onFrame?.(flattenFrame(), last.presentation ? resolveCinematicPresentation(last.presentation).transition.exitMs : 500);
    }
    settled = true;
    cleanScene();
    if (!options.assets) assets.dispose();
    if (result !== 'completed' || !options.holdMusicOnComplete) stopMusic(result === 'completed' ? 600 : 0);
    atmosphere?.dispose();
    portraitMotion?.dispose();
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
  const abort = (): void => { stopMusic(); finish("aborted"); };
  const next = (): void => {
    if (index + 1 < sequence.scenes.length) atmosphere?.cue('page');
    cleanScene();
    index += 1;
    if (index === sequence.scenes.length) {
      const last = sequence.scenes[index - 1];
      if (last.kind !== 'image') {
        const presentation = last.presentation ? resolveCinematicPresentation(last.presentation) : undefined;
        options.onFrame?.(presentation?.backgroundColor ?? '#000000', presentation?.transition.exitMs ?? 500);
      }
      finish("completed");
    }
    else renderScene();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    // Capture before Phaser/document/title/menu handlers, including on the final press.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.isComposing) return;
    if (options.dismissOnAnyInput && !event.repeat) { finish("skipped"); return; }
    const key = normalizeKey(event.key);
    if (music?.dataset.playback === 'blocked') void music.play().then(() => { if (music) delete music.dataset.playback; }, () => undefined);
    if (scrollNarration(key) || event.repeat) return;
    if (key === "escape" && sequence.skippable) finish("skipped");
    else if (key === "r") retryMedia();
    else if (isCinematicAdvanceKey(key) && root.dataset.transitionState !== 'preparing' && (sequence.scenes[index].kind !== "video" || canContinueVideo)) { if (!revealText()) next(); }
  };
  const renderScene = (): void => {
    const scene = sequence.scenes[index];
    const lifetime = new AbortController();
    const media: HTMLMediaElement[] = [];
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let advanceTimer: ReturnType<typeof setTimeout> | undefined;
    const paintFrames: number[] = [];
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let textPlayback: ReturnType<typeof animateCinematicText> | undefined;
    let frame: HTMLElement | undefined;
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
      clearTimeout(exitTimer);
      paintFrames.forEach(id => view.cancelAnimationFrame(id));
      textPlayback?.stop();
      revealText = () => false;
      if (frame) {
        const computed = view.getComputedStyle(frame);
        frame.style.opacity = computed.opacity;
        frame.style.clipPath = computed.clipPath;
        frame.style.filter = computed.filter;
      }
      // Freeze the visible composition while another cut is prepared; settle every owned animation.
      for (const layer of root.querySelectorAll<HTMLElement>('.cinematic-shot > img, .cinematic-shot > canvas')) {
        const style = view.getComputedStyle(layer);
        layer.style.transform = style.transform;
        layer.style.opacity = style.opacity;
        if (layer.classList.contains('cinematic-layer')) { layer.style.left = style.left; layer.style.top = style.top; }
        layer.style.animation = 'none';
      }
      animations.forEach(animation => animation.cancel());
      root.querySelectorAll<HTMLElement>('[data-previous-frame]').forEach(disposeShot);
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
      item.volume = getPlayerPreferences().se;
      void assets.prepareAudio(url).then(prepared => {
        if (!alive || !mediaActive || signal.aborted) return;
        item.src = prepared;
        play(item);
      }, () => { if (alive && mediaActive) fail('error'); });
    };
    canContinueVideo = scene.kind === "video";
    const ready = (visual?: HTMLElement): void => {
      if (!alive || settled) return;
      flattenFrame = undefined;
      const previous = root.querySelector<HTMLElement>('.cinematic-frame:not([data-previous-frame])');
      frame = el('div', { class: 'cinematic-frame', children: [...(visual ? [visual] : []), narration] });
      const presentation = scene.presentation ? resolveCinematicPresentation(scene.presentation) : undefined;
      frame.dataset.presented = String(Boolean(presentation));
      // The storybook page owns its paper/background on the root.
      frame.style.backgroundColor = isBook ? 'transparent' : presentation?.backgroundColor ?? '#000';
      frame.style.setProperty('--cinematic-letterbox', `${presentation?.letterbox ?? 0}%`);
      if (presentation?.letterbox) frame.append(el('div', { class: 'cinematic-letterbox', attrs: { 'aria-hidden': 'true' } }));
      root.replaceChildren(frame, status);
      // Book overlays live on the root so they survive page changes.
      if (atmosphere) root.append(atmosphere.layer);
      if (portraitMotion) root.append(portraitMotion.element);
      if (isBook) frame.append(el('div',{class:'cinematic-book-hint',text:`${index+1} / ${sequence.scenes.length}   Enter 다음${sequence.skippable?' · Esc 건너뛰기':''}`}));
      root.dataset.page = String(index + 1);
      if (previous) {
        previous.dataset.previousFrame = 'true';
        const shot = previous.querySelector<HTMLElement>('.cinematic-shot');
        if (shot) shot.dataset.previousShot = 'true';
        frame.before(previous);
      }
      root.dataset.sceneId = scene.id;
      root.dataset.sceneKind = scene.kind;
      delete root.dataset.pendingSceneId;
      root.dataset.mediaState = scene.kind === 'video' ? 'loading' : 'ready';
      root.style.setProperty('--cinematic-motion-ms', `${scene.durationMs || 8000}ms`);
      // A fade reveals a shot; its hold time must not keep the whole picture dim.
      root.style.setProperty('--cinematic-fade-ms', `${Math.min(600, scene.durationMs || 600)}ms`);
      status.textContent = '';
      const startVisibleScene = (): void => {
        const visibleFrame = frame;
        if (!alive || settled || !visibleFrame) return;
        visibleFrame.style.opacity = '1';
        const legacy = scene.kind === 'image' ? scene.direction?.transition : undefined;
        const enter = reducedMotion ? 'cut' : presentation?.transition.enter ?? legacy?.kind ?? 'cut';
        const enterMs = Math.min(presentation?.transition.enterMs ?? legacy?.durationMs ?? 0, scene.durationMs > 0 ? scene.durationMs / 2 : 5000);
        if (previous && (enter !== 'dissolve' || enterMs <= 0)) disposeShot(previous);
        if (enter !== 'cut' && enterMs > 0) {
          if (previous && enter === 'dissolve') {
            previous.dataset.previousFrame = 'true';
            const oldShot = previous.querySelector<HTMLElement>('.cinematic-shot');
            if (oldShot) oldShot.dataset.previousShot = 'true';
            visibleFrame.before(previous);
            const fade = previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: enterMs, fill: 'forwards' });
            animations.push(fade);
            void fade.finished.then(() => disposeShot(previous), () => disposeShot(previous));
          }
          const frames = enter === 'wipe'
            ? [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }]
            : enter === 'iris'
              ? [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(80% at 50% 50%)' }]
              : enter === 'flash'
                ? [{ filter: 'brightness(2.3)', opacity: 0.6 }, { filter: 'brightness(1)', opacity: 1 }]
                : [{ opacity: 0 }, { opacity: 1 }];
          animations.push(visibleFrame.animate(frames, { duration: enterMs, fill: 'both', easing: 'ease-in-out' }));
        }
        if (previous && !previous.isConnected) disposeShot(previous);
        if (scene.presentation) {
          textPlayback = animateCinematicText({ element: narration, presentation: scene.presentation, durationMs: scene.durationMs, reducedMotion });
          revealText = textPlayback.reveal;
          const deferToGame = Boolean(options.onFrame && scene.kind === 'image' && index === sequence.scenes.length - 1);
          const exitMs = reducedMotion || deferToGame ? 0 : Math.min(presentation!.transition.exitMs, scene.durationMs / 3);
          if (scene.durationMs > 0 && exitMs > 0) exitTimer = setTimeout(() => {
            if (alive && frame) {
              root.dataset.transitionState = 'exiting';
              animations.push(visibleFrame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: exitMs, fill: 'forwards' }));
            }
          }, scene.durationMs - exitMs);
        }
        root.dataset.transitionState = 'playing';
        if (scene.kind === 'image' && visual) {
          const direction = scene.direction;
          if (direction?.camera && !reducedMotion) {
            const transform = ([x, y, zoom]: [number, number, number]): string => `scale(${zoom}) translate(${(0.5-x)*(zoom-1)/zoom*100}%, ${(0.5-y)*(zoom-1)/zoom*100}%)`;
            for (const layer of visual.children) if (layer instanceof HTMLElement && !layer.classList.contains('cinematic-layer')) {
              animations.push(layer.animate([{ transform: transform(direction.camera.from) }, { transform: transform(direction.camera.to) }], { duration: scene.durationMs || 8000, easing: 'ease-in-out', fill: 'both' }));
            }
          }
          const images = visual.querySelectorAll<HTMLElement>('.cinematic-layer');
          scene.direction?.layers?.forEach((layer, i) => {
            const item = images[i];
            const frames = layer.frames.map(f => ({ offset: f.at, left: `${f.x * 100}%`, top: `${f.y * 100}%`,
              opacity: f.opacity, transform: `translate(-50%, -50%) rotate(${f.rotation}deg) scale(${f.scale})` }));
            if (reducedMotion) {
              const f = layer.frames.reduce((a, b) => b.opacity > a.opacity ? b : a);
              item.style.left = `${f.x * 100}%`; item.style.top = `${f.y * 100}%`; item.style.opacity = String(f.opacity);
              item.style.transform = `translate(-50%, -50%) rotate(${f.rotation}deg) scale(${f.scale})`;
            } else animations.push(item.animate(frames, { duration: scene.durationMs || 8000, easing: layer.easing, fill: 'both' }));
          });
          const delay = scene.presentation ? 0 : direction?.narrationDelayMs ?? 0;
          if (delay > 0) { narration.hidden = true; narrationTimer = setTimeout(() => { if (alive) narration.hidden = false; }, delay); }
          if (direction?.soundResourceId) { const audio = el('audio', {}); root.append(audio); addMedia(audio, direction.soundResourceId); }
        }
        if (scene.narrationAudioResourceId && mediaActive) {
          const audio = el('audio', {}); root.append(audio); addMedia(audio, scene.narrationAudioResourceId);
        }
        if (scene.kind !== 'animatic' && scene.durationMs > 0) advanceTimer = setTimeout(next, scene.durationMs);
      };
      // Establish the new composition before its clock/letter animation consumes any time.
      // A software GPU or a heavy previous title can otherwise swallow a short prologue.
      if (scene.presentation && !reducedMotion) {
        frame.style.opacity = '0';
        narration.style.opacity = '0';
        root.dataset.transitionState = 'preparing';
        paintFrames.push(view.requestAnimationFrame(() => {
          paintFrames.push(view.requestAnimationFrame(startVisibleScene));
        }));
      } else startVisibleScene();

      assets.warm(project, sequence, index + 1);
    };
    switch (scene.kind) {
      case "text": ready(); break;
      case "image": {
        // Keep the same illustration node mounted while its dialogue pages change.
        const imageResourceId = isEmeraldIntro ? book!.portraitResourceId! : scene.resourceId;
        const keepImage = isBook && bookImageId === imageResourceId && bookImage !== undefined;
        const showcase = (): HTMLImageElement | undefined => {
          if (!isEmeraldIntro || scene.resourceId === imageResourceId) { delete root.dataset.showcase; return; }
          const creature = el('img', { class: 'cinematic-creature', attrs: { alt: '소개하는 몬스터', draggable: 'false' } });
          const creatureUrl = resolveAssetResourceUrl(scene.resourceId, { project });
          creature.addEventListener('error', () => { creature.remove(); fail('error'); }, { signal: lifetime.signal });
          if (creatureUrl) creature.src = creatureUrl; else fail('error');
          root.dataset.showcase = 'monster';
          return creature;
        };
        if (keepImage) {
          const creature = showcase();
          ready(el('div', { class: 'cinematic-shot', children: [bookImage!, ...(creature ? [creature] : [])] }));
          portraitMotion?.setScene(scene.id);
          break;
        }
        portraitMotion?.dispose(); portraitMotion = undefined; bookImage = undefined; bookImageId = undefined;
        const image = el("img", { class: "cinematic-image", attrs: { alt: "", draggable: "false" } });
        image.dataset.motion = reducedMotion || scene.direction?.camera ? "none" : scene.motion;
        const url = resolveAssetResourceUrl(imageResourceId, { project });
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
          const layers = scene.direction?.layers ?? [];
          const layerImages = await Promise.all(layers.map(async layer => {
            const source = resolveAssetResourceUrl(layer.resourceId, { project });
            if (!source) throw new Error('Missing layer');
            const decoded = await assets.prepare(source);
            const item = el('img', { class: 'cinematic-layer', attrs: { alt: '', draggable: 'false' } });
            item.src = decoded.url; await item.decode();
            item.dataset.depth = layer.depth;
            item.style.width = `${layer.width * 100}%`;
            return item;
          }));
          if (!alive || settled) return;
          if (scene.direction?.effects?.length) {
            effects = createTitleEffectsCanvas({ imageUrl: prepared.url, effects: scene.direction.effects, fit: 'cover', rendering: 'smooth' });
            effects.classList.add('cinematic-effects');
            effects.dataset.motion = image.dataset.motion;
            shot.append(effects);
          }
          shot.append(...layerImages);
          const creature = showcase();
          if (creature) shot.append(creature);
          if (isBook) { bookImage = image; bookImageId = imageResourceId; }
          ready(shot);
          if (isEmeraldIntro && book?.portraitMotion) {
            portraitMotion = createOpeningPortraitMotion({ root, image, project, motion: book.portraitMotion, sceneIds: book.sceneIds, sceneId: scene.id, reducedMotion });
          }
          flattenFrame = layers.length ? () => flattenCinematicFrame(shot) ?? prepared.url : undefined;
          options.onFrame?.(prepared.url, scene.presentation ? resolveCinematicPresentation(scene.presentation).transition.exitMs : 500);
        }).catch(() => { if (alive && !settled) { fail('error'); status.textContent = '장면을 읽을 수 없습니다. R 키로 재시도하거나 Enter로 넘어가세요.'; } });
        break;
      }
      case "animatic": {
        const canvas = el("canvas", { class: "cinematic-animatic", dataset: { testid: "opening-animatic-stage" } });
        canvas.setAttribute('aria-label', '레이어와 카메라로 구성한 오프닝');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000';
        ready(canvas); beginLoading();
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
      (options.musicHost ?? host).append(audio);
      music = audio;
      // 자동재생 차단·재생 실패는 연출을 막지 않는다(장면 상태 기계와 분리).
      void assets.prepareAudio(url).then(prepared => {
        if (settled || music !== audio) return;
        audio.src = prepared; audio.volume = 0;
        audio.dataset.prepared = 'true';
        void audio.play().then(() => {
          if (settled || music !== audio) return;
          const start = performance.now();
          musicFadeTimer = setInterval(() => {
            if (music !== audio) { clearInterval(musicFadeTimer); return; }
            audio.volume = Math.min(1, Math.max(0, options.musicVolume?.() ?? 0.7)) * Math.min(1, (performance.now() - start) / 600);
          }, 40);
        }, () => { audio.volume = Math.min(1, Math.max(0, options.musicVolume?.() ?? 0.7)); audio.dataset.playback = 'blocked'; });
      }, () => { if (!settled) audio.dataset.playback = 'error'; });
    }
  }
  host.append(root);
  view.addEventListener("keydown", onKeyDown, true);
  signal.addEventListener("abort", abort, { once: true });
  observer.observe(host.ownerDocument, { childList: true, subtree: true });
  root.focus({ preventScroll: true });
  renderScene();
  atmosphere?.cue('entry');
  return { done, teardown: abort, releaseMusic: stopMusic };
}
