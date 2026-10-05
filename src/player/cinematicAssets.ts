import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import type { CinematicSequence, Project } from '@/project/types';

type PreparedImage = { url: string; width: number; height: number };
export type CinematicAssets = {
  prepare: (url: string) => Promise<PreparedImage>;
  prepareAudio: (url: string) => Promise<string>;
  warm: (project: Project, sequence: CinematicSequence | undefined, index?: number) => void;
  dispose: () => void;
};

/** Shell-owned, bounded prefetch. Reusable blob URLs prevent a second no-cache request at the cut. */
export function createCinematicAssets(): CinematicAssets {
  const lifetime = new AbortController();
  const entries = new Map<string, { promise: Promise<PreparedImage>; blobUrl?: string; ready?: boolean }>();
  const audioEntries = new Map<string, { promise: Promise<string>; blobUrl?: string }>();
  const prepareAudio = (url: string): Promise<string> => {
    if (lifetime.signal.aborted) return Promise.reject(new DOMException('Closed', 'AbortError'));
    const cached = audioEntries.get(url);
    if (cached) return cached.promise;
    const entry: { promise: Promise<string>; blobUrl?: string } = { promise: Promise.resolve(url) };
    entry.promise = (async () => {
      if (/^(data:|blob:)/u.test(url)) return url;
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(20_000)]);
      const response = await fetch(url, { signal, priority: 'low' } as RequestInit);
      if (!response.ok) throw new Error(`음악을 준비할 수 없습니다 (${response.status}).`);
      const blob = await response.blob(); signal.throwIfAborted();
      entry.blobUrl = URL.createObjectURL(blob);
      return entry.blobUrl;
    })().catch(error => { audioEntries.delete(url); throw error; });
    audioEntries.set(url, entry);
    return entry.promise;
  };
  let active = 0;
  const queue: Array<() => void> = [];
  const drain = (): void => {
    while (active < 2 && queue.length) queue.shift()!();
  };
  const prepare = (url: string): Promise<PreparedImage> => {
    if (lifetime.signal.aborted) return Promise.reject(new DOMException('Closed', 'AbortError'));
    const cached = entries.get(url);
    if (cached) { entries.delete(url); entries.set(url, cached); return cached.promise; }
    const entry: { promise: Promise<PreparedImage>; blobUrl?: string; ready?: boolean } = { promise: Promise.resolve({ url, width: 0, height: 0 }) };
    entry.promise = new Promise<PreparedImage>((resolve, reject) => {
      queue.push(() => {
        active += 1;
        const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(10_000)]);
        void (async () => {
          signal.throwIfAborted();
          let source = url;
          if (!/^(data:|blob:)/u.test(url)) {
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`그림을 준비할 수 없습니다 (${response.status}).`);
            const blob = await response.blob();
            signal.throwIfAborted();
            entry.blobUrl = URL.createObjectURL(blob);
            source = entry.blobUrl;
          }
          const image = new Image();
          image.decoding = 'async';
          await new Promise<void>((loaded, failed) => {
            const abort = (): void => { image.src = ''; failed(signal.reason); };
            signal.addEventListener('abort', abort, { once: true });
            image.onload = () => { signal.removeEventListener('abort', abort); loaded(); };
            image.onerror = () => { signal.removeEventListener('abort', abort); failed(new Error('그림을 읽을 수 없습니다.')); };
            image.src = source;
          });
          await image.decode();
          signal.throwIfAborted();
          return { url: source, width: image.naturalWidth, height: image.naturalHeight };
        })().then(image => { entry.ready = true; resolve(image); }, error => {
          if (entries.get(url) === entry) entries.delete(url);
          if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl);
          reject(error);
        }).finally(() => {
          active -= 1;
          for (const [key, oldest] of entries) {
            if (entries.size <= 8) break;
            if (oldest === entry || !oldest.ready) continue;
            entries.delete(key);
            if (oldest.blobUrl) URL.revokeObjectURL(oldest.blobUrl);
          }
          drain();
        });
      });
    });
    entries.set(url, entry);
    drain();
    return entry.promise;
  };
  return {
    prepare,
    prepareAudio,
    warm(project, sequence, index = 0) {
      if (!sequence?.enabled || lifetime.signal.aborted) return;
      if (sequence.musicResourceId) {
        const url = resolveAssetResourceUrl(sequence.musicResourceId, { project });
        if (url) void prepareAudio(url).catch(() => undefined);
      }
      for (const scene of sequence.scenes.slice(index, index + 2)) {
        if (scene.kind !== 'image') continue;
        for (const id of [scene.resourceId, ...(scene.direction?.layers?.map(layer => layer.resourceId) ?? [])]) {
          const url = resolveAssetResourceUrl(id, { project });
          if (url) void prepare(url).catch(() => undefined);
        }
      }
    },
    dispose() {
      lifetime.abort();
      // Drain queued jobs so every promise settles through the same aborted boundary.
      drain();
      for (const entry of entries.values()) if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl);
      entries.clear();
      for (const entry of audioEntries.values()) if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl);
      audioEntries.clear();
    },
  };
}
