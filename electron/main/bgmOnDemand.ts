// 데스크톱 앱의 카탈로그 BGM(281곡, 1.3GB)은 앱에 다 싣지 않는다. 앱에는 기본 곡과 예제 데모가 쓰는 곡만 들어 있고
// (bake:demos 가 dist/assets/cc0/audio/catalog 에 넣는다), 나머지는 처음 재생할 때 공개 CDN 에서 한 곡씩 받아
// SHA-256 을 확인하고 사용자 폴더에 둔다. 다음부터는 오프라인에서도 그 사본을 쓴다.
// 렌더러는 언제나 같은 로컬 주소(/assets/cc0/audio/catalog/<파일>)를 쓴다 — app:// 처리기가 여기로 넘긴다.
// 왜: 데스크톱에는 BGM 팩 설치 경로가 없어 폴른 스타가 27곡 중 3곡만 울렸다(2026-10-27).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "../../assets/bgm-release-v1.json";

export const BGM_CATALOG_PATH_PREFIX = "assets/cc0/audio/catalog/";
/** scripts/lib/bgm-release.mjs RELEASE.cdn 과 같은 곳(공개, 곡마다 한 파일). */
export const BGM_PUBLIC_CDN = "https://cheapcdn.sgp1.cdn.digitaloceanspaces.com/rpg-zzu/bgm/v1/";

type Track = { readonly fileName: string; readonly bytes: number; readonly sha256: string };
const TRACKS: ReadonlyMap<string, Track> = new Map((manifest.tracks as Track[]).map((t) => [t.fileName, t]));
const inflight = new Map<string, Promise<string | null>>();

/** 카탈로그 곡 파일 이름이면 그 곡 정보. 아니면 undefined. */
export function catalogTrackForPath(relative: string): Track | undefined {
  if (!relative.startsWith(BGM_CATALOG_PATH_PREFIX)) return undefined;
  return TRACKS.get(decodeURIComponent(relative.slice(BGM_CATALOG_PATH_PREFIX.length)));
}

/**
 * 곡을 사용자 캐시에 확보하고 경로를 돌려준다. 받지 못하거나 해시가 다르면 null(→ 404, 재생만 조용히 빠진다).
 * 같은 곡을 동시에 여러 번 요청해도 한 번만 받는다.
 */
export function ensureCachedTrack(track: Track, cacheDir: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const target = join(cacheDir, track.fileName);
  if (existsSync(target)) return Promise.resolve(target);
  const pending = inflight.get(track.fileName);
  if (pending) return pending;
  const job = (async () => {
    try {
      const response = await fetchImpl(BGM_PUBLIC_CDN + encodeURIComponent(track.fileName));
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== track.bytes) return null;
      if (createHash("sha256").update(bytes).digest("hex") !== track.sha256) return null;
      mkdirSync(cacheDir, { recursive: true });
      const partial = `${target}.${process.pid}.part`;
      writeFileSync(partial, bytes);
      renameSync(partial, target);
      return target;
    } catch {
      return null;
    } finally {
      inflight.delete(track.fileName);
    }
  })();
  inflight.set(track.fileName, job);
  return job;
}
