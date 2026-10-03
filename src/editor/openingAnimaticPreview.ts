import type { Project } from '@/project/types';
import { drawAnimaticFrame, loadAnimaticImages } from '@/player/openingAnimaticRenderer';
import { validateOpeningAnimatic } from '@/project/openingAnimatic';

/** Real rendered frames, not a separately drawn storyboard illustration. Silent and seekable. */
export async function renderOpeningAnimaticPreview(project: Project, data: unknown, signal = new AbortController().signal): Promise<string> {
  const request = data as { shotId?: unknown; atMs?: unknown }, scene = project.system.opening?.scenes.find(s => s.id === request.shotId);
  if (!scene || scene.kind !== 'animatic') throw Error('애니메틱 샷 없음.');
  validateOpeningAnimatic(scene.composition, scene.durationMs);
  const times = request.atMs as number[];
  if (!Array.isArray(times) || !times.length || times.length > 4 || times.some(t => !Number.isSafeInteger(t) || t < 0 || t > scene.durationMs)) throw Error('프레임 시간은 샷 안의1~4개 정수입니다.');
  const images = await loadAnimaticImages(project, scene.composition, signal), canvas = document.createElement('canvas'), frame = document.createElement('canvas');
  const columns = times.length === 1 ? 1 : 2, rows = Math.ceil(times.length / columns), tileWidth = 512 / columns;
  const tileHeight = Math.min(480 / rows, tileWidth * scene.composition.height / scene.composition.width);
  const scale = Math.min(tileWidth / scene.composition.width, tileHeight / scene.composition.height);
  frame.width = Math.max(1, Math.round(scene.composition.width * scale)); frame.height = Math.max(1, Math.round(scene.composition.height * scale));
  canvas.width = 512; canvas.height = Math.ceil(rows * (tileHeight + 16));
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#121820'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = '12px sans-serif';
  for (const [i, t] of times.entries()) { signal.throwIfAborted(); drawAnimaticFrame(frame, scene.composition, images, t); const x = i % columns * tileWidth, y = Math.floor(i / columns) * (tileHeight + 16); ctx.drawImage(frame, x + (tileWidth - frame.width) / 2, y + (tileHeight - frame.height) / 2); ctx.fillStyle = '#ffffff'; ctx.fillText(`${scene.id}  ${t}ms`, x + 4, y + tileHeight + 12); }
  return canvas.toDataURL('image/png');
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
