import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import type { Project } from '@/project/types';

const prepared = new Map<string, { owner: object; url: string }>();
/** A resolved blob avoids a second HTTP request at the first key press or map handoff. */
export function preparedRuntimeAudioUrl(url: string): string { return prepared.get(url)?.url ?? url; }

export function createRuntimeAudioWarmup() {
  const owner = {}, controller = new AbortController(), jobs = new Map<string, Promise<void>>();
  const blobs: string[] = [];
  return {
    warm(project: Project, ids: readonly (string | undefined)[]): void {
      for (const id of ids) {
        if (!id || jobs.size >= 16 || controller.signal.aborted) continue;
        const url = resolveAssetResourceUrl(id, { project });
        if (!url || url.startsWith('data:') || jobs.has(url)) continue;
        jobs.set(url, (async () => {
          const response = await fetch(url, { signal: controller.signal, priority: 'low' } as RequestInit);
          if (!response.ok) return;
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          const local = URL.createObjectURL(blob); blobs.push(local);
          prepared.set(url, { owner, url: local });
        })().catch(() => undefined)); // Actual playback retains its normal retry/error path.
      }
    },
    dispose(): void {
      controller.abort();
      for (const [url, entry] of prepared) if (entry.owner === owner) prepared.delete(url);
      for (const blob of blobs) URL.revokeObjectURL(blob);
      blobs.length = 0;
    },
  };
}
