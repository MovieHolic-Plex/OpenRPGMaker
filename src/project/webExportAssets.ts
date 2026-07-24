import { BUNDLED_IMAGE_ASSETS, TEX_DIALOGUE_FRAME, TEX_TILESET } from "@/assets/bundled";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { PLAYER_RUNTIME_ASSET_PATHS } from "@/project/playerDeploymentManifest";
import type { Project } from "@/project/types";
import type { WebExportAsset } from "@/project/webExportTypes";

const encoder = new TextEncoder();

export function collectWebExportAssets(project: Project): readonly WebExportAsset[] {
  const ids = collectProjectStrings(project);
  const usedUploadedIds = collectUsedUploadedAssetIds(project);
  const assets = new Map<string, WebExportAsset>();
  for (const path of PLAYER_RUNTIME_ASSET_PATHS) {
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

function collectProjectStrings(project: Project): Set<string> {
  const values = new Set<string>();
  collectStrings(project, values);
  return values;
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
    if (key !== "uploaded") collectStrings(child, out);
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
