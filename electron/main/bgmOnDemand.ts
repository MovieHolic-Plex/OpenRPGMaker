// 데스크톱 앱의 카탈로그 BGM(281곡, 1.3GB)은 앱에 다 싣지 않는다. 앱에는 기본 곡과 예제 데모가 쓰는 곡만 들어 있고
// (bake:demos 가 dist/assets/cc0/audio/catalog 에 넣는다), 나머지는 처음 재생할 때 공개 CDN 에서 한 곡씩 받아
// SHA-256 을 확인하고 사용자 폴더에 둔다. 다음부터는 오프라인에서도 그 사본을 쓴다.
// 렌더러는 언제나 같은 로컬 주소(/assets/cc0/audio/catalog/<파일>)를 쓴다 — app:// 처리기가 여기로 넘긴다.
// 왜: 데스크톱에는 BGM 팩 설치 경로가 없어 폴른 스타가 27곡 중 3곡만 울렸다(2026-10-27).
import { createHash } from "node:crypto";
import { closeSync, constants, lstatSync, mkdirSync, openSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
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

function currentUid(): number | undefined {
  return typeof process.getuid === "function" ? process.getuid() : undefined;
}

/**
 * 캐시 디렉터리로 쓸 수 있는지. 심볼릭 링크는 디렉터리가 아니다.
 * Windows 의 mode 는 실제 ACL 이 아니라 쓰기 가능하면 그룹·기타 쓰기 비트가 켜진 합성값이라, POSIX 마스크를 씌우면 정상 캐시도 거절된다.
 */
export function cacheDirectoryAccepted(info: { isDirectory(): boolean; uid: number; mode: number }, platform: NodeJS.Platform, uid: number | undefined): boolean {
  if (!info.isDirectory()) return false;
  if (platform === "win32") return true;
  if (uid !== undefined && info.uid !== uid) return false;
  return (info.mode & 0o022) === 0;
}

/** 다른 계정이 만든 디렉터리·그룹에 쓰는 디렉터리·심볼릭 링크는 캐시로 쓰지 않는다. */
function ownedCacheDir(cacheDir: string): boolean {
  try {
    mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
    return cacheDirectoryAccepted(lstatSync(cacheDir), process.platform, currentUid());
  } catch {
    return false;
  }
}

function ownedRegularFile(file: string): boolean {
  try {
    const info = lstatSync(file);
    if (!info.isFile()) return false;
    const uid = currentUid();
    return uid === undefined || info.uid === uid;
  } catch {
    return false;
  }
}

/**
 * 곡을 사용자 캐시에 확보하고 경로를 돌려준다. 받지 못하거나 해시가 다르면 null(→ 404, 재생만 조용히 빠진다).
 * 같은 곡을 동시에 여러 번 요청해도 한 번만 받는다. 심볼릭 링크와 다른 계정의 캐시는 돌려주지 않는다.
 */
export function ensureCachedTrack(track: Track, cacheDir: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const target = join(cacheDir, track.fileName);
  if (!ownedCacheDir(cacheDir)) return Promise.resolve(null);
  if (ownedRegularFile(target)) return Promise.resolve(target);
  const pending = inflight.get(track.fileName);
  if (pending) return pending;
  const job = (async () => {
    try {
      const response = await fetchImpl(BGM_PUBLIC_CDN + encodeURIComponent(track.fileName));
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== track.bytes) return null;
      if (createHash("sha256").update(bytes).digest("hex") !== track.sha256) return null;
      if (!ownedCacheDir(cacheDir)) return null;
      try {
        const existing = lstatSync(target);
        if (existing.isSymbolicLink()) unlinkSync(target);
        else return ownedRegularFile(target) ? target : null;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") return null;
      }
      const partial = `${target}.${process.pid}.${Date.now()}.part`;
      const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0);
      let fd: number | undefined;
      let renamed = false;
      try {
        fd = openSync(partial, flags, 0o600);
        writeFileSync(fd, bytes);
        closeSync(fd);
        fd = undefined;
        renameSync(partial, target);
        renamed = true;
        return ownedRegularFile(target) ? target : null;
      } finally {
        if (fd !== undefined) {
          try { closeSync(fd); } catch { /* 이미 닫힌 서술자 */ }
        }
        if (!renamed) {
          try { unlinkSync(partial); } catch { /* 만들기 전에 실패한 임시 파일 */ }
        }
      }
    } catch {
      return null;
    } finally {
      inflight.delete(track.fileName);
    }
  })();
  inflight.set(track.fileName, job);
  return job;
}
