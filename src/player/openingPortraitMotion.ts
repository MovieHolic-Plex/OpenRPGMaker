import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { safeOpeningPortraitMotion } from '@/project/openingPortraitMotion';
import type { Project } from '@/project/types';

let controllerSerial = 0;
export type PortraitMotionPlayback = {
  readonly element: HTMLCanvasElement;
  readonly ready: Promise<boolean>;
  setScene: (sceneId: string) => void;
  dispose: () => void;
};

/** One portrait, one active-time clock. Never owns keys, page timing, or audio. */
export function createOpeningPortraitMotion(options: {
  root: HTMLElement; image: HTMLImageElement; project: Project; motion: unknown;
  sceneIds: readonly string[]; sceneId: string; reducedMotion?: boolean;
}): PortraitMotionPlayback | undefined {
  const { root, image, project } = options;
  const motion = safeOpeningPortraitMotion(options.motion, options.sceneIds);
  if (!motion) { root.dataset.portraitMotion = 'fallback'; return undefined; }
  const document = root.ownerDocument, view = document.defaultView;
  const url = resolveAssetResourceUrl(motion.resourceId, { project });
  if (!view || !url) { root.dataset.portraitMotion = 'fallback'; return undefined; }
  const canvas = document.createElement('canvas');
  canvas.className = 'cinematic-image cinematic-portrait-motion';
  canvas.width = motion.frameWidth; canvas.height = motion.frameHeight;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.testid = 'opening-portrait-motion';
  canvas.dataset.controller = String(++controllerSerial);
  canvas.dataset.resource = motion.resourceId;
  canvas.dataset.frameCount = String(motion.frameCount);
  // Pose pixels stay on their authored anchor; legacy whole-image bob is disabled.
  canvas.style.animation = 'none'; canvas.style.translate = '0 0';
  const ctx = canvas.getContext('2d');
  if (!ctx) { root.dataset.portraitMotion = 'fallback'; return undefined; }
  ctx.imageSmoothingEnabled = false;
  const source = document.createElement('img');
  const query = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = options.reducedMotion === true || query?.matches === true;
  let elapsed = 0, lastTime: number | undefined, raf = 0, loaded = false, stopped = false;
  let sceneId = options.sceneId, lastFrame = -1, lastScene = '';
  const originalVisibility = image.style.visibility;
  root.dataset.portraitMotion = 'loading';
  canvas.style.visibility = 'hidden';
  root.append(canvas);
  const draw = (): void => {
    const order = motion.sceneFrames && Object.prototype.hasOwnProperty.call(motion.sceneFrames, sceneId) ? motion.sceneFrames[sceneId] : motion.frames;
    const phase = reduced ? 0 : Math.floor(elapsed * motion.fps / 1000) % order.length;
    const frame = reduced ? 0 : order[phase];
    if (frame !== lastFrame || sceneId !== lastScene) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, frame * motion.frameWidth, 0, motion.frameWidth, motion.frameHeight, 0, 0, canvas.width, canvas.height);
      canvas.dataset.frame = String(frame);
      canvas.dataset.phase = String(phase);
      canvas.dataset.clockMs = String(Math.round(elapsed));
      canvas.dataset.scene = sceneId;
      lastFrame = frame; lastScene = sceneId;
    }
    canvas.dataset.paused = reduced ? 'reduced-motion' : document.hidden ? 'hidden' : 'false';
  };
  const cancel = (): void => { if (raf) view.cancelAnimationFrame(raf); raf = 0; lastTime = undefined; };
  const tick = (now: number): void => {
    raf = 0;
    if (stopped || !loaded || reduced || document.hidden) { lastTime = undefined; return; }
    if (lastTime !== undefined) elapsed += Math.max(0, now - lastTime);
    lastTime = now;
    draw(); raf = view.requestAnimationFrame(tick);
  };
  const syncPause = (): void => {
    cancel();
    if (!loaded || stopped) return;
    draw();
    if (!reduced && !document.hidden) raf = view.requestAnimationFrame(tick);
  };
  const changedMotion = (event: MediaQueryListEvent): void => { reduced = event.matches; syncPause(); };
  const restore = (): void => {
    image.style.visibility = originalVisibility;
    root.dataset.portraitMotion = 'fallback';
    canvas.remove();
  };
  const dispose = (): void => {
    if (stopped) return;
    stopped = true; cancel();
    document.removeEventListener('visibilitychange', syncPause);
    query?.removeEventListener('change', changedMotion);
    source.removeAttribute('src');
    image.style.visibility = originalVisibility;
    canvas.remove();
    delete root.dataset.portraitMotion;
  };
  document.addEventListener('visibilitychange', syncPause);
  query?.addEventListener('change', changedMotion);
  const ready = (async (): Promise<boolean> => {
    try {
      source.src = url; await source.decode();
      if (stopped) return false;
      if (source.naturalWidth !== motion.frameWidth * motion.frameCount || source.naturalHeight !== motion.frameHeight) throw Error('Portrait motion strip dimensions do not match authored frames');
      loaded = true; draw();
      image.style.visibility = 'hidden'; canvas.style.visibility = '';
      root.dataset.portraitMotion = 'ready'; syncPause();
      return true;
    } catch {
      if (!stopped) { cancel(); restore(); source.removeAttribute('src'); document.removeEventListener('visibilitychange', syncPause); query?.removeEventListener('change', changedMotion); }
      return false;
    }
  })();
  return { element: canvas, ready, setScene: id => { sceneId = id; if (loaded && !stopped) draw(); }, dispose };
}
