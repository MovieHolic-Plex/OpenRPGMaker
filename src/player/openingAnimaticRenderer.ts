import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { sampleAnimaticTrack, animaticCueVolume, type OpeningAnimatic, type AnimaticLayer } from '@/project/openingAnimatic';
import type { Project } from '@/project/types';

export type AnimaticImages = Map<string, HTMLImageElement>;
export async function loadAnimaticImages(project: Project, a: OpeningAnimatic, signal: AbortSignal): Promise<AnimaticImages> {
  const ids = [...new Set(a.layers.flatMap(l => l.kind === 'image' ? [l.resourceId!] : []))];
  return new Map(await Promise.all(ids.map(async id => {
    signal.throwIfAborted(); const url = resolveAssetResourceUrl(id, { project }); if (!url) throw Error(`애니메틱 그림 없음: ${id}`);
    const image = new Image(); image.crossOrigin = 'anonymous';
    const abort = () => { image.removeAttribute('src'); }; signal.addEventListener('abort', abort, { once: true });
    try { image.src = url; await image.decode(); signal.throwIfAborted(); return [id, image] as const; }
    finally { signal.removeEventListener('abort', abort); }
  })));
}
const radians = (value: number) => value * Math.PI / 180;
const random = (seed: number, index: number) => { let v = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0; v ^= v >>> 16; v = Math.imul(v, 0x85ebca6b); v ^= v >>> 13; return (v >>> 0) / 4294967296; };
const modulo = (v: number, span: number) => (v % span + span) % span;
function drawText(ctx: CanvasRenderingContext2D, l: AnimaticLayer, t: number): void {
  const style = l.typography, size = style?.fontSize ?? 40, align = style?.align ?? 'left';
  ctx.font = `${style?.weight ?? 600} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'top';
  const reveal = style?.typewriterMs ? Math.min(1, Math.max(0, (t - (l.startMs ?? 0)) / style.typewriterMs)) : 1;
  const text = Array.from(l.text ?? ''), shown = text.slice(0, Math.ceil(text.length * reveal)).join('');
  const lines: string[] = [];
  for (const paragraph of shown.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      if (ctx.measureText(line + word).width > l.width && line) { lines.push(line.trimEnd()); line = ''; }
      for (const character of Array.from(word)) {
        if (ctx.measureText(line + character).width > l.width && line) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  const x = align === 'center' ? l.width / 2 : align === 'right' ? l.width : 0;
  for (const [i, line] of lines.entries()) { if ((i + 1) * size * 1.25 > l.height) break; ctx.fillText(line, x, i * size * 1.25); }
}
function drawParticles(ctx: CanvasRenderingContext2D, l: AnimaticLayer, t: number): void {
  const p = l.particles!, seconds = (t - (l.startMs ?? 0)) / 1000, speed = p.speed ?? (p.preset === 'rain' ? 500 : 35), size = p.size ?? 2;
  for (let i = 0; i < p.count; i++) {
    const a = random(p.seed, i * 3), b = random(p.seed, i * 3 + 1), c = random(p.seed, i * 3 + 2);
    const upward = p.preset === 'sparks' || p.preset === 'dust';
    const x = modulo(a * l.width + Math.sin(seconds * 0.8 + c * 9) * (p.preset === 'snow' ? 20 : 4), l.width);
    const y = p.preset === 'stars' ? b * l.height : modulo(b * l.height + seconds * speed * (0.5 + c) * (upward ? -1 : 1), l.height);
    ctx.globalAlpha *= 1; ctx.beginPath();
    if (p.preset === 'rain') { ctx.moveTo(x, y); ctx.lineTo(x - size * 2, y + size * 8); ctx.lineWidth = size; ctx.stroke(); }
    else { ctx.arc(x, y, size * (0.6 + c), 0, Math.PI * 2); ctx.fill(); }
  }
}
/** The same absolute-time draw function is used for playback, scrubbing and model previews. */
export function drawAnimaticFrame(canvas: HTMLCanvasElement, a: OpeningAnimatic, images: AnimaticImages, atMs: number, options: { reducedMotion?: boolean } = {}): void {
  const ctx = canvas.getContext('2d'); if (!ctx) throw Error('2D 무대를 만들 수 없습니다.');
  const t = Math.max(0, atMs), c = a.camera, reduced = options.reducedMotion === true;
  const cameraTime = reduced ? 0 : t;
  let cx = sampleAnimaticTrack(c?.keys?.x, cameraTime, c?.x ?? a.width / 2), cy = sampleAnimaticTrack(c?.keys?.y, cameraTime, c?.y ?? a.height / 2);
  const zoom = sampleAnimaticTrack(c?.keys?.zoom, cameraTime, c?.zoom ?? 1), rotation = sampleAnimaticTrack(c?.keys?.rotation, cameraTime, c?.rotation ?? 0);
  const shake = c?.shake;
  if (!reduced && shake && t >= shake.atMs && t < shake.atMs + shake.durationMs) {
    const s = (t - shake.atMs) / 1000, decay = 1 - (t - shake.atMs) / shake.durationMs, phase = random(shake.seed ?? 1, 0) * 8;
    cx += Math.sin(s * (shake.frequency ?? 14) * 6.28 + phase) * shake.amplitude * decay;
    cy += Math.cos(s * (shake.frequency ?? 14) * 4.6 + phase) * shake.amplitude * decay;
  }
  ctx.save(); try { ctx.setTransform(canvas.width / a.width, 0, 0, canvas.height / a.height, 0, 0); ctx.clearRect(0, 0, a.width, a.height);
  ctx.fillStyle = a.background ?? '#000000'; ctx.fillRect(0, 0, a.width, a.height);
  const transition = a.transition, reveal = reduced ? 1 : transition?.durationMs ? Math.min(1, t / transition.durationMs) : 1;
  ctx.save(); try {
  if (reveal < 1 && transition) {
    if (transition.kind === 'fade') ctx.globalAlpha = reveal;
    if (transition.kind === 'wipe-left' || transition.kind === 'wipe-right') { ctx.beginPath(); ctx.rect(transition.kind === 'wipe-left' ? a.width * (1 - reveal) : 0, 0, a.width * reveal, a.height); ctx.clip(); }
    if (transition.kind === 'iris') { ctx.beginPath(); ctx.arc(a.width / 2, a.height / 2, Math.hypot(a.width, a.height) / 2 * reveal, 0, Math.PI * 2); ctx.clip(); }
  }
  for (const l of a.layers) {
    if (t < (l.startMs ?? 0) || l.endMs !== undefined && t >= l.endMs) continue;
    const at = reduced ? l.startMs ?? 0 : t, sample = (property: keyof NonNullable<AnimaticLayer['keys']>, fallback: number) => sampleAnimaticTrack(l.keys?.[property], at, fallback);
    ctx.save(); try {
    if (l.space !== 'screen') { const p = l.parallax ?? 1; ctx.translate(a.width / 2, a.height / 2); ctx.rotate(-radians(rotation * p)); ctx.scale(zoom ** p, zoom ** p); ctx.translate(-(a.width / 2 + (cx - a.width / 2) * p), -(a.height / 2 + (cy - a.height / 2) * p)); }
    ctx.translate(sample('x', l.x), sample('y', l.y)); ctx.rotate(radians(sample('rotation', l.rotation ?? 0))); ctx.scale(sample('scaleX', l.scaleX ?? 1), sample('scaleY', l.scaleY ?? 1));
    ctx.translate(-l.width * (l.anchorX ?? 0), -l.height * (l.anchorY ?? 0));
    ctx.globalAlpha *= sampleAnimaticTrack(l.keys?.opacity, t, l.opacity ?? 1); ctx.globalCompositeOperation = l.blend ?? 'source-over'; ctx.fillStyle = l.color ?? '#ffffff'; ctx.strokeStyle = l.color ?? '#ffffff';
    if (l.kind === 'image') {
      ctx.imageSmoothingEnabled = l.sampling ? l.sampling === 'linear' : !l.sheet;
      const image = images.get(l.resourceId!); if (!image) throw Error('그림 로딩 누락: ' + l.resourceId);
      let crop = l.crop;
      if (l.sheet) {
        const sheet = l.sheet, elapsed = Math.max(0, at - (l.startMs ?? 0)), automatic = Math.floor(elapsed * sheet.fps / 1000);
        const frame = Math.floor(sample('frame', sheet.loop ? automatic % sheet.count : Math.min(sheet.count - 1, automatic)));
        crop = { x: frame % sheet.columns * sheet.frameWidth, y: Math.floor(frame / sheet.columns) * sheet.frameHeight, width: sheet.frameWidth, height: sheet.frameHeight };
      }
      if (crop) { if (crop.x + crop.width > image.naturalWidth || crop.y + crop.height > image.naturalHeight) throw Error(`그림 ${l.resourceId}의 crop/프레임이 원본 경계를 넘습니다.`); ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, l.width, l.height); }
      else ctx.drawImage(image, 0, 0, l.width, l.height);
    } else if (l.kind === 'text') drawText(ctx, l, t);
    else if (l.kind === 'particles') drawParticles(ctx, l, reduced ? 0 : t);
    else if (l.shape === 'ellipse') { ctx.beginPath(); ctx.ellipse(l.width / 2, l.height / 2, l.width / 2, l.height / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (l.shape === 'line') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(l.width, l.height); ctx.stroke(); }
    else ctx.fillRect(0, 0, l.width, l.height);
    } finally { ctx.restore(); }
  }
  } finally { ctx.restore(); }
  if (!reduced && transition?.kind === 'flash' && reveal < 1) { ctx.fillStyle = transition.color ?? '#ffffff'; ctx.globalAlpha = 1 - reveal; ctx.fillRect(0, 0, a.width, a.height); ctx.globalAlpha = 1; }
  if (a.letterbox) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, a.width, a.height * a.letterbox); ctx.fillRect(0, a.height * (1 - a.letterbox), a.width, a.height * a.letterbox); }
  } finally { ctx.restore(); }
}

export type AnimaticPlayback = { ready: Promise<void>; stop: () => void };
export function playOpeningAnimatic(options: { project: Project; canvas: HTMLCanvasElement; composition: OpeningAnimatic; durationMs: number; signal: AbortSignal; reducedMotion?: boolean; onReady: () => void; onError: (message: string) => void; onDone: () => void }): AnimaticPlayback {
  const { canvas, composition: a, signal } = options, view = canvas.ownerDocument.defaultView!;
  let frame = 0, stopped = false, started = 0;
  const cues = new Map<string, HTMLAudioElement>();
  const stop = () => { if (stopped) return; stopped = true; view.cancelAnimationFrame(frame); signal.removeEventListener('abort', stop); for (const audio of cues.values()) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio.remove(); } cues.clear(); };
  signal.addEventListener('abort', stop, { once: true });
  const ready = (async () => {
    try {
      const images = await loadAnimaticImages(options.project, a, signal); if (stopped || signal.aborted) return;
      canvas.width = a.width; canvas.height = a.height; drawAnimaticFrame(canvas, a, images, 0, options);
      started = view.performance.now(); options.onReady();
      const tick = (now: number) => {
        if (stopped || signal.aborted) return;
        const t = Math.min(options.durationMs, now - started); canvas.dataset.timeMs = String(Math.round(t));
        try { drawAnimaticFrame(canvas, a, images, t, options); }
        catch (error) { stop(); options.onError(String(error)); return; }
        for (const cue of a.audioCues ?? []) {
          let audio = cues.get(cue.id); const active = t >= cue.atMs && t < cue.atMs + cue.durationMs;
          if (active && !audio) {
            const url = resolveAssetResourceUrl(cue.resourceId, { project: options.project }); if (!url) { stop(); options.onError('오디오 큐 없음: ' + cue.resourceId); return; }
            audio = canvas.ownerDocument.createElement('audio'); audio.src = url; audio.loop = cue.loop ?? false; audio.dataset.testid = 'animatic-audio-cue'; audio.dataset.cueId = cue.id; audio.volume = animaticCueVolume(cue, t); canvas.parentElement?.append(audio); cues.set(cue.id, audio);
            audio.addEventListener('loadedmetadata', () => { if (!stopped && audio!.duration > 0 && Number.isFinite(audio!.duration)) { const offset = (cue.offsetMs ?? 0) / 1000 + Math.max(0, view.performance.now() - started - cue.atMs) / 1000; audio!.currentTime = audio!.loop ? offset % audio!.duration : Math.min(offset, audio!.duration); } }, { once: true, signal });
            audio.addEventListener('error', () => { if (!stopped) { stop(); options.onError('오디오 큐 로딩 실패: ' + cue.resourceId); } }, { once: true, signal });
            void audio.play().catch(() => { if (!stopped) { stop(); options.onError('오디오 큐 자동재생 차단: ' + cue.resourceId); } });
          }
          if (audio) { audio.volume = animaticCueVolume(cue, t); if (!active) audio.pause(); }
        }
        if (t >= options.durationMs) { stop(); options.onDone(); } else frame = view.requestAnimationFrame(tick);
      };
      frame = view.requestAnimationFrame(tick);
    } catch (error) { if (!signal.aborted && !stopped) { stop(); options.onError(error instanceof Error ? error.message : String(error)); } }
  })();
  return { ready, stop };
}
