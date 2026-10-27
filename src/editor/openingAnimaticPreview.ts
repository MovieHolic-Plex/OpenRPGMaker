import type { Project } from '@/project/types';
import { drawAnimaticFrame, loadAnimaticImages, type AnimaticImages } from '@/player/openingAnimaticRenderer';
import { validateOpeningAnimatic, type OpeningAnimatic } from '@/project/openingAnimatic';

export type AnimaticFrameMeasurement = {
  readonly atMs: number;
  readonly paletteColors: number;
  readonly captionBandContrast: number | null;
  readonly movingRatio: number;
};

const quantize = (v: number) => v >> 3;
/** 화면이 실제로 변했는지 보는 두 표본 사이의 간격 — 한 프레임 차이로는 정지 화면과 구분되지 않는다. */
const ANIMATIC_MOTION_WINDOW_MS = 260;
function framePixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data;
}
function effectiveLuminance(r: number, g: number, b: number): number {
  const channel = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * 실제로 그린 프레임에서 재는 값 — 저작값만 보는 openingAnimaticMeasure 가 못 보는 것을 맡는다.
 * 팔레트 수는 샷이 정말 한 팔레트로 내려갔는지, 자막 대비는 글자가 바 위에서 읽히는지,
 * movingRatio 는 「정지 그림 + 효과」가 아니라 실제로 화면이 살아 있는지의 화소 증거다.
 */
export function measureAnimaticFrames(composition: OpeningAnimatic, images: AnimaticImages, durationMs: number, times: readonly number[]): AnimaticFrameMeasurement[] {
  const canvas = document.createElement('canvas');
  canvas.width = composition.width; canvas.height = composition.height;
  const earlier = document.createElement('canvas');
  earlier.width = composition.width; earlier.height = composition.height;
  const bar = Math.round(composition.height * (composition.letterbox ?? 0));
  const pixelsAt = (target: HTMLCanvasElement, atMs: number): Uint8ClampedArray => {
    drawAnimaticFrame(target, composition, images, Math.max(0, atMs), { durationMs });
    return framePixels(target);
  };
  return times.map((atMs) => {
    const data = pixelsAt(canvas, atMs);
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4) if (data[i + 3]! > 0) colors.add((quantize(data[i]!) << 10) | (quantize(data[i + 1]!) << 5) | quantize(data[i + 2]!));
    const previous = pixelsAt(earlier, atMs - ANIMATIC_MOTION_WINDOW_MS);
    let changed = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] !== previous[i] || data[i + 1] !== previous[i + 1] || data[i + 2] !== previous[i + 2]) changed += 1;
    let captionBandContrast: number | null = null;
    if (bar > 4) {
      const luminances: number[] = [];
      for (let y = composition.height - bar; y < composition.height; y += 1) {
        for (let x = 0; x < composition.width; x += 1) {
          const i = (y * composition.width + x) * 4;
          luminances.push(effectiveLuminance(data[i]!, data[i + 1]!, data[i + 2]!));
        }
      }
      luminances.sort((a, b) => a - b);
      const median = luminances[Math.floor(luminances.length / 2)]!, ink = luminances[Math.floor(luminances.length * 0.97)]!;
      captionBandContrast = Number(((ink + 0.05) / (median + 0.05)).toFixed(2));
    }
    return { atMs, paletteColors: colors.size, captionBandContrast, movingRatio: Number((changed / (composition.width * composition.height)).toFixed(4)) };
  });
}

/** Real rendered frames, not a separately drawn storyboard illustration. Silent and seekable. */
export async function renderOpeningAnimaticPreview(project: Project, data: unknown, signal = new AbortController().signal): Promise<string> {
  return (await renderOpeningAnimaticPreviewDetailed(project, data, signal)).dataUrl;
}

export type AnimaticPreviewResult = { readonly dataUrl: string; readonly measurements: AnimaticFrameMeasurement[]; readonly shotId: string };

/** 미리보기 그림과 같은 프레임에서 잰 수치를 함께 돌려준다 — 조수의 완료 검토가 숫자로 판단하게. */
export async function renderOpeningAnimaticPreviewDetailed(project: Project, data: unknown, signal = new AbortController().signal): Promise<AnimaticPreviewResult> {
  const request = data as { shotId?: unknown; atMs?: unknown; bare?: unknown }, scene = project.system.opening?.scenes.find(s => s.id === request.shotId);
  if (!scene || scene.kind !== 'animatic') throw Error('애니메틱 샷 없음.');
  // bare: 화면 검수용 — 프레임 아래 「샷 id · ms」 글씨를 빼고 띠도 두지 않는다. 검수자가 그 글씨를 오프닝 화면의 글자로 읽고 세 판 내내 결함으로 짚었다(J96).
  const bare = request.bare === true, band = bare ? 0 : 16;
  validateOpeningAnimatic(scene.composition, scene.durationMs);
  const times = request.atMs as number[];
  if (!Array.isArray(times) || !times.length || times.length > 4 || times.some(t => !Number.isSafeInteger(t) || t < 0 || t > scene.durationMs)) throw Error('프레임 시간은 샷 안의1~4개 정수입니다.');
  const images = await loadAnimaticImages(project, scene.composition, signal), canvas = document.createElement('canvas'), frame = document.createElement('canvas');
  const columns = times.length === 1 ? 1 : 2, rows = Math.ceil(times.length / columns), tileWidth = 512 / columns;
  const tileHeight = Math.min(480 / rows, tileWidth * scene.composition.height / scene.composition.width);
  const scale = Math.min(tileWidth / scene.composition.width, tileHeight / scene.composition.height);
  frame.width = Math.max(1, Math.round(scene.composition.width * scale)); frame.height = Math.max(1, Math.round(scene.composition.height * scale));
  canvas.width = 512; canvas.height = Math.ceil(rows * (tileHeight + band));
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#121820'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = '12px sans-serif';
  for (const [i, t] of times.entries()) { signal.throwIfAborted(); drawAnimaticFrame(frame, scene.composition, images, t, { durationMs: scene.durationMs }); const x = i % columns * tileWidth, y = Math.floor(i / columns) * (tileHeight + band); ctx.drawImage(frame, x + (tileWidth - frame.width) / 2, y + (tileHeight - frame.height) / 2); if (!bare) { ctx.fillStyle = '#ffffff'; ctx.fillText(`${scene.id}  ${t}ms`, x + 4, y + tileHeight + 12); } }
  return { dataUrl: canvas.toDataURL('image/png'), measurements: measureAnimaticFrames(scene.composition, images, scene.durationMs, times), shotId: scene.id };
}

/** 화면에 그림을 보내지 않고 수치만 필요할 때(조수 완료 검토·QA 기록) 쓰는 입구. */
export async function measureOpeningAnimaticFrames(project: Project, data: unknown, signal = new AbortController().signal): Promise<AnimaticFrameMeasurement[]> {
  const request = data as { shotId?: unknown; atMs?: unknown }, scene = project.system.opening?.scenes.find(s => s.id === request.shotId);
  if (!scene || scene.kind !== 'animatic') throw Error('애니메틱 샷 없음.');
  const times = Array.isArray(request.atMs) ? request.atMs as number[] : [];
  if (!times.length || times.length > 4) throw Error('측정할 시간은 1~4개입니다.');
  const images = await loadAnimaticImages(project, scene.composition, signal);
  return measureAnimaticFrames(scene.composition, images, scene.durationMs, times);
}

/** Only bundled, researched frames may be loaded; model supplied arbitrary URLs are forbidden. */
export async function renderOpeningReferencePreview(data: unknown, signal = new AbortController().signal): Promise<string> {
  const references = (await import('@/assets/openingReferences.json')).default as { id: string; referenceFrames?: { publicPath: string; timeSeconds: number }[] }[];
  const id = (data as { id?: unknown }).id, row = references.find(r => r.id === id), frames = row?.referenceFrames?.slice(0, 4);
  if (!frames?.length) throw Error('확인한 참고 프레임 없음.');
  const images = await Promise.all(frames.map(f => new Promise<HTMLImageElement>((resolve, reject) => {
    if (!f.publicPath.startsWith('/assets/opening-study/')) return reject(Error('번들 참고 경로 오류.'));
    const image = new Image(), stop = () => { image.src = ''; reject(signal.reason ?? Error('aborted')); };
    image.onload = () => { signal.removeEventListener('abort', stop); resolve(image); }; image.onerror = () => { signal.removeEventListener('abort', stop); reject(Error('참고 프레임 로드 실패.')); };
    signal.addEventListener('abort', stop, { once: true }); if (signal.aborted) stop(); else image.src = f.publicPath;
  })));
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.ceil(images.length / 2) * 160;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#101820'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = '12px sans-serif';
  for (const [i, image] of images.entries()) { const x = i % 2 * 256, y = Math.floor(i / 2) * 160, scale = Math.min(256 / image.naturalWidth, 140 / image.naturalHeight), w = image.naturalWidth * scale, h = image.naturalHeight * scale; ctx.drawImage(image, x + (256 - w) / 2, y + (140 - h) / 2, w, h); ctx.fillStyle = '#fff'; ctx.fillText(`${String(id)} ${frames[i].timeSeconds}s`, x + 4, y + 155); }
  return canvas.toDataURL('image/png');
}
