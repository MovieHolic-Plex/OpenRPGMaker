import { resolveCinematicPresentation, type CinematicPresentation } from '@/project/cinematicPresentation';

/** All timers and animations belong to one shot; no per-letter timers or HTML interpolation. */
export function animateCinematicText(options: {
  element: HTMLElement; presentation: CinematicPresentation; durationMs: number; reducedMotion: boolean;
}) {
  const { element, durationMs, reducedMotion } = options;
  const style = resolveCinematicPresentation(options.presentation).text;
  const view = element.ownerDocument.defaultView ?? window;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const animations: Animation[] = [];
  let alive = true;
  let revealing = false;
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  let entrance: Animation | undefined;
  const after = (ms: number, action: () => void): void => { timers.push(setTimeout(() => { if (alive) action(); }, ms)); };
  const total = durationMs || 8000;
  const exitMs = reducedMotion ? 0 : Math.min(style.exitMs, total / 4);
  const delay = reducedMotion ? 0 : Math.min(style.delayMs, total / 4);
  const revealMs = Math.min(style.revealMs, Math.max(0, total - delay - exitMs - 300));
  element.dataset.layout = style.layout === 'credits' && (reducedMotion || durationMs === 0) ? 'center' : style.layout;
  element.dataset.font = style.font;
  element.dataset.animation = reducedMotion ? 'none' : style.animation;
  element.style.fontSize = `${style.size}px`;
  element.style.color = style.color;
  const fullText = element.textContent ?? '';
  let started = false;
  const revealAll = (): boolean => {
    const wasWaiting = !started;
    if (wasWaiting && alive) start();
    if (!revealing) return wasWaiting;
    revealing = false;
    clearTimeout(revealTimer);
    entrance?.finish();
    element.style.opacity = '1';
    element.querySelectorAll<HTMLElement>('[data-letter]').forEach(letter => { letter.style.opacity = '1'; });
    element.dataset.textState = 'shown';
    return true;
  };
  const start = (): void => {
    if (!alive || started) return;
    started = true;
    element.style.opacity = '1';
    element.dataset.textState = 'shown';
    if (reducedMotion || style.animation === 'none' || (style.animation === 'scroll' && durationMs === 0) || !fullText) return;
    if (style.animation === 'typewriter' && revealMs > 0) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const letters = Array.from(segmenter.segment(fullText), entry => entry.segment);
      // Bound DOM growth for imported books/credits. Long text gets one whole-block fade.
      if (letters.length <= 1200) {
        element.setAttribute('aria-label', fullText);
        element.textContent = '';
        const spans = letters.map(letter => {
          const span = element.ownerDocument.createElement('span');
          span.dataset.letter = '';
          span.setAttribute('aria-hidden', 'true');
          span.textContent = letter;
          span.style.opacity = '0';
          element.append(span);
          return span;
        });
        revealing = true;
        element.dataset.textState = 'revealing';
        const started = performance.now();
        let shown = 0;
        const tick = (): void => {
          if (!alive || !revealing) return;
          const count = Math.min(spans.length, Math.floor((performance.now() - started) / revealMs * spans.length));
          while (shown < count) spans[shown++].style.opacity = '1';
          if (shown === spans.length) { revealing = false; element.dataset.textState = 'shown'; }
          else revealTimer = setTimeout(tick, 24);
        };
        tick();
        return;
      }
    }
    const frames: Keyframe[] = style.animation === 'rise'
      ? [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }]
      : style.animation === 'blur'
        ? [{ opacity: 0, filter: 'blur(8px)', transform: 'scale(1.03)' }, { opacity: 1, filter: 'blur(0)', transform: 'scale(1)' }]
        : style.animation === 'scroll'
          ? [{ transform: `translateY(${element.parentElement!.clientHeight}px)` }, { transform: `translateY(-${element.scrollHeight + 24}px)` }]
          : [{ opacity: 0 }, { opacity: 1 }];
    const ms = style.animation === 'scroll' ? Math.max(1, total - delay) : revealMs;
    if (ms > 0) {
      entrance = element.animate(frames, { duration: ms, easing: style.animation === 'scroll' ? 'linear' : 'ease-out', fill: 'both' });
      animations.push(entrance);
      if (style.animation !== 'scroll') {
        revealing = true;
        element.dataset.textState = 'revealing';
        void entrance.finished.then(() => { if (alive) { revealing = false; element.dataset.textState = 'shown'; } }, () => undefined);
      }
    }
  };
  if (delay > 0) {
    element.style.opacity = '0';
    element.dataset.textState = 'waiting';
    after(delay, start);
  } else start();
  if (durationMs > 0 && exitMs > 0) after(total - exitMs, () => {
    revealAll();
    element.dataset.textState = 'exiting';
    animations.push(element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: exitMs, fill: 'forwards' }));
  });
  return {
    reveal: revealAll,
    stop(): void {
      alive = false;
      timers.forEach(clearTimeout);
      clearTimeout(revealTimer);
      const computed = view.getComputedStyle(element);
      element.style.opacity = computed.opacity;
      element.style.transform = computed.transform;
      element.style.filter = computed.filter;
      animations.forEach(animation => animation.cancel());
    },
  };
}
