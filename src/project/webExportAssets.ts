import { BUNDLED_IMAGE_ASSETS, TEX_DIALOGUE_FRAME, TEX_TILESET } from "@/assets/bundled";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { getResourceProfileSpec } from "@/project/resourceProfiles";
import type { ResourceKind } from "@/project/types";
import { requiredRuntimeAssetPaths } from "@/project/webExportRuntimeAssets";
import type { Project } from "@/project/types";
import type { WebExportAsset } from "@/project/webExportTypes";

const encoder = new TextEncoder();

export function collectWebExportAssets(project: Project): readonly WebExportAsset[] {
  const ids = collectProjectStrings(project);
  const usedUploadedIds = collectUsedUploadedAssetIds(project);
  const assets = new Map<string, WebExportAsset>();
  for (const path of requiredRuntimeAssetPaths(project)) {
    assets.set(path, { kind: "public", sourcePath: path, zipPath: path });
  }
  for (const asset of BUNDLED_IMAGE_ASSETS) {
    if (asset.textureKey === TEX_TILESET || asset.textureKey === TEX_DIALOGUE_FRAME || ids.has(asset.textureKey)) {
      assets.set(asset.path, {
        kind: "public",
        sourcePath: asset.path,
        zipPath: asset.path,
        resourceId: asset.textureKey,
      });
    }
  }
  for (const id of ids) {
    const bundled = BUNDLED_IMAGE_ASSETS.find((asset) => asset.textureKey === id);
    if (bundled) {
      assets.set(bundled.path, { kind: "public", sourcePath: bundled.path, zipPath: bundled.path, resourceId: id });
      continue;
    }
    const url = resolveAssetResourceUrl(id, { project });
    const path = localPublicPath(url);
    if (path) assets.set(path, { kind: "public", sourcePath: path, zipPath: path, resourceId: id });
  }
  for (const id of usedUploadedIds) {
    const asset = project.assets.uploaded[id];
    if (!asset) continue;
    const zipPath = `assets/uploaded/${safeFileName(asset.id)}.${uploadedAssetExtension(asset.dataUrl)}`;
    assets.set(zipPath, { kind: "uploaded", asset, zipPath });
  }
  return [...assets.values()].sort((left, right) => left.zipPath.localeCompare(right.zipPath));
}

export function collectUsedUploadedAssetIds(project: Project): Set<string> {
  const ids = collectProjectStrings(project);
  const uploaded = new Set<string>();
  for (const id of Object.keys(project.assets.uploaded)) {
    if (ids.has(id)) uploaded.add(id);
  }
  return uploaded;
}

export function estimateAssetBytes(asset: WebExportAsset): number {
  return asset.kind === "uploaded" ? dataUrlBytes(asset.asset.dataUrl).length : 0;
}

export function dataUrlBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return encoder.encode(dataUrl);
  const meta = dataUrl.slice(0, comma).toLowerCase();
  const body = dataUrl.slice(comma + 1);
  if (meta.endsWith(";base64")) return base64ToBytes(body);
  return encoder.encode(decodeURIComponent(body));
}

export function safeFileName(value: string): string {
  const safe = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, "-");
  return safe || "rpg-zzu";
}

// 바이너리 dataUrl 문자열 폭발·오탐 방지(기존).
const USAGE_WALK_SKIPPED_KEYS: readonly string[] = ["uploaded"];

// resourceProfiles 는 저작자가 고를 수 있는 리소스 **카탈로그** 다 — 「쓸 수 있는 것」 이지
// 「쓰는 것」 이 아니다. 그래서 오디오 행만 사용처 집계에서 뺀다.
//
// - 오디오: 빈 프로젝트에 100개 20.2MB 가 등록돼 있는데 실제 재생은 두 트랙뿐이다. 진짜 재생은
//   system.defaultBgmResourceId 처럼 별도 필드에 박혀 있어 그쪽에서 잡힌다.
// - 이미지: 그대로 센다. webExportFacesetFaces.test.ts 가 "등록만 하고 대사에 안 쓴 얼굴도
//   함께 나간다" 를 현재 계약으로 못 박아 뒀고, 그 이유("저작 중 고른 얼굴이 빠지는 사고를
//   막는다")가 타당하다. 전량이 0.37MB 라 이걸 뒤집어 벌 이득도 없다.
//
// 어느 쪽이든 카탈로그 행 자체는 project.json 에 그대로 남으므로 id→파일 해석은 계속 동작한다.
const USAGE_WALK_CATALOG_KEY = "resourceProfiles";

function collectProjectStrings(project: Project): Set<string> {
  const values = new Set<string>();
  collectStrings(project, values);
  return values;
}

function isAudioCatalogRow(row: unknown): boolean {
  if (typeof row !== "object" || row === null) return false;
  const kind = (row as { readonly kind?: unknown }).kind;
  // 모르는 kind 는 getResourceProfileSpec 이 이미지 스펙으로 떨어뜨린다 — 안전한 쪽 기본값.
  return typeof kind === "string" && getResourceProfileSpec(kind as ResourceKind).media === "audio";
}

function collectStrings(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (USAGE_WALK_SKIPPED_KEYS.includes(key)) continue;
    if (key === USAGE_WALK_CATALOG_KEY && Array.isArray(child)) {
      collectStrings(child.filter((row) => !isAudioCatalogRow(row)), out);
      continue;
    }
    collectStrings(child, out);
  }
}

function localPublicPath(url: string | null): string | null {
  if (!url?.startsWith("/")) return null;
  const path = url.slice(1);
  return path.includes("://") || path.includes("..") ? null : path;
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob !== "function") return encoder.encode(value);
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function uploadedAssetExtension(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  const media = dataUrl.slice(0, comma >= 0 ? comma : dataUrl.length).toLowerCase();
  if (media.includes("image/jpeg")) return "jpg";
  if (media.includes("image/webp")) return "webp";
  if (media.includes("image/gif")) return "gif";
  if (media.includes("audio/mpeg")) return "mp3";
  if (media.includes("audio/wav")) return "wav";
  if (media.includes("audio/ogg")) return "ogg";
  return "png";
}
