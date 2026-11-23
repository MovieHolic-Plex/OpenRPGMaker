// 데스크톱 패키지에서 뺀 큰 자산(공용 초상, 장소 내려받기 .oprn.json)을 처음 쓸 때 받는다.
// 빌드 단계(scripts/desktop-ondemand-assets.mjs)가 dist 에서 그 파일을 빼고 dist/ondemand-assets.json 에
// 경로마다 크기와 SHA-256, 받을 곳(공개 저장소의 그 빌드 커밋 public/)을 적는다.
// app:// 처리기가 없는 파일을 만나면 여기서 받아 해시를 확인하고 사용자 폴더에 둔다(bgmOnDemand.ts 와 같은 캐시).
// 렌더러는 언제나 같은 로컬 주소를 쓰므로 렌더러 코드는 바뀌지 않는다. 예제 데모가 쓰는 파일은 빼지 않는다.
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { ensureCachedTrack } from "./bgmOnDemand";

export const ONDEMAND_MANIFEST_FILE = "ondemand-assets.json";

export type OnDemandManifest = {
  readonly base: string;
  readonly files: Readonly<Record<string, readonly [number, string]>>;
};

export type OnDemandAsset = { readonly relative: string; readonly bytes: number; readonly sha256: string; readonly url: string };

const manifests = new Map<string, OnDemandManifest | null>();

/** 받을 곳이 https 이고 항목 모양이 맞을 때만 받아들인다. 아니면 null(지연 받기 없음). */
export function parseOnDemandManifest(value: unknown): OnDemandManifest | null {
  if (!value || typeof value !== "object") return null;
  const { base, files } = value as { base?: unknown; files?: unknown };
  if (typeof base !== "string" || !/^https:\/\/[^/]+\/.+\/$/u.test(base)) return null;
  if (!files || typeof files !== "object") return null;
  for (const entry of Object.values(files)) {
    if (!Array.isArray(entry) || !Number.isInteger(entry[0]) || typeof entry[1] !== "string" || !/^[0-9a-f]{64}$/u.test(entry[1])) return null;
  }
  return { base, files: files as OnDemandManifest["files"] };
}

function manifestFor(rendererDir: string): OnDemandManifest | null {
  if (manifests.has(rendererDir)) return manifests.get(rendererDir) ?? null;
  const file = join(rendererDir, ONDEMAND_MANIFEST_FILE);
  let manifest: OnDemandManifest | null = null;
  try {
    if (existsSync(file)) manifest = parseOnDemandManifest(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    manifest = null;
  }
  manifests.set(rendererDir, manifest);
  return manifest;
}

/** 패키지에서 뺀 파일이면 받을 정보. 아니면 undefined. relative 는 app:// 경로(앞 / 없음, 퍼센트 인코딩 가능). */
export function onDemandAssetFor(manifest: OnDemandManifest | null, relative: string): OnDemandAsset | undefined {
  if (!manifest) return undefined;
  let decoded: string;
  try { decoded = decodeURIComponent(relative); } catch { return undefined; }
  if (!Object.hasOwn(manifest.files, decoded)) return undefined;
  const [bytes, sha256] = manifest.files[decoded]!;
  const url = manifest.base + decoded.split("/").map(encodeURIComponent).join("/");
  return { relative: decoded, bytes, sha256, url };
}

/**
 * 렌더러 폴더에 없는 파일을 받아 캐시 경로를 돌려준다. 목록에 없거나, 못 받거나, 해시가 다르면 null(→ 404).
 * 캐시 파일 이름은 해시라서 경로 조작이 끼어들 수 없고, 같은 그림은 한 번만 받는다.
 */
export function ensureOnDemandAsset(rendererDir: string, relative: string, cacheDir: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const asset = onDemandAssetFor(manifestFor(rendererDir), relative);
  if (!asset) return Promise.resolve(null);
  const fileName = `${asset.sha256}${extname(asset.relative).toLowerCase()}`;
  return ensureCachedTrack({ fileName, bytes: asset.bytes, sha256: asset.sha256 }, cacheDir, fetchImpl, asset.url);
}
