import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import { battleAudioContext } from "@/player/battleSfx";

/**
 * 전투 샘플 SE 디코드 캐시.
 *
 * HTMLAudioElement 는 요소를 새로 만들 때마다 로드를 기다린 뒤에야 소리가 나므로,
 * 임팩트 비트에 맞춰 발화해도 그 로드 시간만큼 소리가 늦는다. fetch + decodeAudioData 로
 * 한 번 디코드한 버퍼를 자원 id 별로 캐시해 AudioBufferSourceNode 로 즉시 재생한다.
 *
 * 실패 계약: WebAudio 부재와 네트워크 실패는 캐시하지 않는다(다음 재생에서 재시도),
 * 디코딩 불가 포맷만 영구 실패(null)로 기록한다. `playBattleSample` 이 false 를 돌려주면
 * 호출부 요소 경로가 폴백으로 소리를 내므로 사건 1개 = 소리 1개 계약은 유지된다.
 */

const buffers = new Map<string, AudioBuffer | null>();
const pending = new Map<string, Promise<AudioBuffer | null>>();

function resolveSampleUrl(resourceId: string): string | null {
  return resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
}

/** 샘플을 백그라운드로 적재한다. 완료 여부와 무관하게 기다리지 않고 돌려준다. */
export function loadBattleSample(resourceId: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(resourceId);
  if (cached !== undefined) return Promise.resolve(cached);
  const inflight = pending.get(resourceId);
  if (inflight) return inflight;
  const context = battleAudioContext();
  const url = context ? resolveSampleUrl(resourceId) : null;
  if (!context || !url) return Promise.resolve(null);
  const task = (async (): Promise<AudioBuffer | null> => {
    let bytes: ArrayBuffer | null = null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      bytes = await response.arrayBuffer();
    } catch {
      return null; // 네트워크 실패 — 캐시 없이 다음 재생에서 재시도
    }
    try {
      const buffer = await context.decodeAudioData(bytes);
      buffers.set(resourceId, buffer);
      return buffer;
    } catch {
      buffers.set(resourceId, null); // 디코딩 불가 포맷 — 영구 폴백
      return null;
    }
  })().finally(() => {
    pending.delete(resourceId);
  });
  pending.set(resourceId, task);
  return task;
}

/** 전투에서 쓰 샘플들을 미리 디코드해 둔다. 블라인드 전환 동안 끝나는 양이다. */
export function preloadBattleSamples(resourceIds: readonly string[]): void {
  for (const resourceId of resourceIds) {
    if (!buffers.has(resourceId) && !pending.has(resourceId)) void loadBattleSample(resourceId);
  }
}

/** 캐시된 샘플을 즉시 재생한다. 준비 안 됐으면 false — 호출부가 요소 경로로 폴백한다. */
export function playBattleSample(resourceId: string, volume: number): boolean {
  const buffer = buffers.get(resourceId);
  if (!buffer) {
    if (buffers.get(resourceId) === undefined && !pending.has(resourceId)) {
      void loadBattleSample(resourceId); // 다음 재생부터 즉시 — 이번 재생은 폴백이 낸다
    }
    return false;
  }
  const context = battleAudioContext();
  if (!context) return false;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(context.destination);
  source.start();
  return true;
}
