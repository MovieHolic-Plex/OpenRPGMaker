import { isTouchUiHost } from "@/player/touchTap";
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
import { animaticBandClearance, playOpeningAnimatic } from "./openingAnimaticRenderer";
import { isEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import { createEmeraldOpeningAtmosphere } from './emeraldOpeningAtmosphere';
import { bindIntegerArtScale } from './monsterArtScale';
import { EMERALD_PROFESSOR_BUST_RESOURCE_ID } from '@/project/emeraldProfessorArt';
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

let ditherCache: string[] | undefined;
/** 4×4 베이어 임계값 마스크 17장(0칸~16칸 불투명). 한 칸 = 마스크 1픽셀, 화면에서 3배로 늘려 쓴다. */
function ditherMasks(): string[] {
  if (ditherCache) return ditherCache;
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  ditherCache = Array.from({ length: 17 }, (_, level) => {
    const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 4;
    const ctx = canvas.getContext('2d')!; const data = ctx.createImageData(4, 4);
    for (let i = 0; i < 16; i += 1) { data.data[i * 4 + 3] = bayer[i]! < level ? 255 : 0; }
    ctx.putImageData(data, 0, 0); return canvas.toDataURL('image/png');
  });
  return ditherCache;
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
  // 반신상은 받침 타원 없이 대사창 뒤에서 솟는다(옛 64×64 칩 초상은 그대로 받침 위에 선다).
  if (isEmeraldIntro && book?.portraitResourceId === EMERALD_PROFESSOR_BUST_RESOURCE_ID) root.dataset.portraitArt = 'bust';
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
  let ditherRaf = 0;
  const disposeShot = (shot: HTMLElement): void => {
    shot.remove(); // Chromium may paint a white lost-context placeholder if still visible.
    for (const canvas of shot.querySelectorAll<HTMLCanvasElement>('.cinematic-effects')) stopTitleEffects(canvas);
  };
  const finish = (result: CinematicCompletion): void => {
    if (settled) return;
    cancelAnimationFrame(ditherRaf);
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
    const soundTimers: ReturnType<typeof setTimeout>[] = [];
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
      soundTimers.forEach(clearTimeout);
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
      // Touch has no Esc — the hint itself is the skip button (tap/click), so a phone can skip the same way.
      // play-ui owner: the sequence's pointer blocker (installPlayPointerBlocker) lets this one button through.
      if (!isBook && sequence.skippable && !root.querySelector('.cinematic-skip-hint')) {
        const skip = el('button', { class: 'cinematic-skip-hint', text: isTouchUiHost(root) ? 'B · 탭 건너뛰기' : 'Esc · 탭 건너뛰기', attrs: { type: 'button', 'aria-label': '건너뛰기', tabindex: '-1', 'data-play-input-owner': 'play-ui' }, dataset: { testid: 'cinematic-skip' } });
        skip.addEventListener('pointerup', (event) => { event.preventDefault(); event.stopPropagation(); finish('skipped'); }, { signal });
        root.append(skip);
      }
      if (isBook) frame.append(el('div',{class:'cinematic-book-hint',text:`${index+1} / ${sequence.scenes.length}   ${isTouchUiHost(root)?'A 다음':'Enter 다음'}${sequence.skippable?(isTouchUiHost(root)?' · B 건너뛰기':' · Esc 건너뛰기'):''}`}));
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
        if (previous && ((enter !== 'dissolve' && enter !== 'dither') || enterMs <= 0)) disposeShot(previous);
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
          if (enter === 'dither') {
            // 도트 감성 전환: 이전 컷 위로 새 컷이 4×4 베이어 패턴으로 칸마다 드러난다(마스크 17단계).
            if (previous) { previous.dataset.previousFrame = 'true'; const oldShot = previous.querySelector<HTMLElement>('.cinematic-shot'); if (oldShot) oldShot.dataset.previousShot = 'true'; visibleFrame.before(previous); }
            const masks = ditherMasks();
            const style = visibleFrame.style as CSSStyleDeclaration & { webkitMaskImage?: string };
            visibleFrame.style.setProperty('mask-size', '12px 12px'); visibleFrame.style.setProperty('-webkit-mask-size', '12px 12px');
            const t0 = performance.now(); let step = -1;
            const tick = (): void => {
              if (!alive || settled) return;
              const k = Math.min(16, Math.floor(((performance.now() - t0) / enterMs) * 17));
              if (k !== step) { step = k; const url = `url(${masks[k]})`; style.maskImage = url; style.webkitMaskImage = url; }
              if (k < 16) ditherRaf = requestAnimationFrame(tick);
              else { style.maskImage = 'none'; style.webkitMaskImage = 'none'; if (previous) disposeShot(previous); }
            };
            tick();
          } else animations.push(visibleFrame.animate(frames, { duration: enterMs, fill: 'both', easing: 'ease-in-out' }));
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
          for (const cue of direction?.sounds ?? []) soundTimers.push(setTimeout(() => {
            if (!alive || !mediaActive) return;
            const audio = el('audio', {}); root.append(audio); addMedia(audio, cue.resourceId);
            if (cue.volume !== undefined) audio.volume = Math.min(1, getPlayerPreferences().se * cue.volume);
          }, cue.atMs));
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
          bindIntegerArtScale(creature);
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
          // 오프닝 그림은 작은 격자(가로 ≤640)의 도트다 — 확대·카메라 이동에서도 칸이 번지지 않게 한다.
          const crisp = image.naturalWidth <= 640;
          if (crisp) image.style.imageRendering = 'pixelated';
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
            if (item.naturalWidth <= 640) item.style.imageRendering = 'pixelated';
            item.dataset.depth = layer.depth;
            item.style.width = `${layer.width * 100}%`;
            return item;
          }));
          if (!alive || settled) return;
          if (scene.direction?.effects?.length) {
            effects = createTitleEffectsCanvas({ imageUrl: prepared.url, effects: scene.direction.effects, fit: 'cover', rendering: crisp ? 'pixelated' : 'smooth' });
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
        // 샷에 자막 트랙(set_opening_caption)이 있으면 그 자막이 글을 맡는다 — 내레이션 상자까지 그리면 같은 줄이 두 번, 아래 것은 반쯤 가려 보였다
        // (2026-10-25 장난감 가게 G49). 화면 읽기용 글은 상자 안에 남기되 보이지 않게 한다.
        if (scene.composition.layers.some(layer => (layer as { caption?: unknown }).caption)) narration.classList.add('cinematic-narration--captioned');
        const canvas = el("canvas", { class: "cinematic-animatic", dataset: { testid: "opening-animatic-stage" } });
        // 컷에 자막 층(caption)이 있으면 그 글자가 캔버스 안에 이미 그려진다. 같은 글을 담은 DOM 내레이션까지 띄우면
        // 자막이 두 겹으로 보였다(시타마치 VQA before 02·03 「유령 글자」) — 내레이션은 화면에서 숨기고 캔버스 설명으로 옮긴다.
        const canvasCaptions = scene.composition.layers.some(layer => layer.kind === 'caption' && (layer.caption?.cues?.length ?? 0) > 0);
        if (canvasCaptions && scene.narration.trim()) { narration.hidden = true; narration.dataset.captionedOnCanvas = 'true'; }
        canvas.setAttribute('aria-label', canvasCaptions && scene.narration.trim() ? scene.narration : '레이어와 카메라로 구성한 오프닝');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000';
        ready(canvas); beginLoading();
        // 내레이션 띠가 캔버스 아래를 덮는 높이(구도 단위). 처음 잰 값을 장면 내내 쓴다(띠가 늦게 떠도 카메라가 튀지 않게 숨김을 잠깐 풀고 잰다).
        let narrationInset: number | undefined;
        const bottomInset = (): number => {
          if (narrationInset !== undefined) return narrationInset;
          if (canvasCaptions || !scene.narration.trim() || narration.classList.contains('cinematic-narration--captioned')) return (narrationInset = 0);
          const box = canvas.getBoundingClientRect();
          if (!canvas.isConnected || box.width <= 0 || box.height <= 0) return 0;
          const wasHidden = narration.hidden; narration.hidden = false;
          const band = narration.getBoundingClientRect();
          narration.hidden = wasHidden;
          if (band.height <= 0) return 0;
          const comp = scene.composition, scale = Math.min(box.width / comp.width, box.height / comp.height);
          const contentBottom = box.top + (box.height + comp.height * scale) / 2;
          const inset = Math.max(0, contentBottom - band.top) / scale;
          // 카메라를 올려도(배경이 끝나서) 인물 발이 띠 밑에 남고, 위쪽은 비어 있으면 띠를 화면 위로 옮긴다.
          const clearance = animaticBandClearance(comp, inset, scene.durationMs);
          if (clearance.residual > 2 && !clearance.topHit) { narration.classList.add('cinematic-narration--top'); return (narrationInset = 0); }
          return (narrationInset = inset);
        };
        playOpeningAnimatic({ project, canvas, composition: scene.composition, durationMs: scene.durationMs, signal: lifetime.signal, reducedMotion, bottomInset,
          onReady: () => { if (!alive || !mediaActive) return; clearTimeout(loadTimer); root.dataset.mediaState = 'ready'; status.textContent = ''; },
          onError: message => { if (!alive || !mediaActive) return; console.warn('[opening animatic]', message); fail('error'); status.textContent = '장면을 그리지 못했어요. Enter로 넘어가세요.'; }, onDone: () => { if (alive) next(); } });
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
