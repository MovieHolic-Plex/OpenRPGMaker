import {
  BUNDLED_IMAGE_ASSETS,
  TEX_DIALOGUE_FRAME,
  TEX_TILESET,
} from "@/assets/bundled";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { deserialize, serialize } from "@/project/io";
import { writeStoredZip, type ZipEntry } from "@/project/packageZip";
import type { Project, UploadedAsset } from "@/project/types";

export const WEB_PLAYER_BUNDLE_BASE = "/export-player/";
export const WEB_PLAYER_MANIFEST = "player-manifest.json";

const encoder = new TextEncoder();

const RUNTIME_STATIC_PUBLIC_ASSETS = [
  "assets/fonts/Galmuri9.woff2",
  "assets/fonts/Galmuri11.woff2",
  "assets/fonts/Galmuri11-Bold.woff2",
  "assets/ui/windowskin-rm2003.png",
  "assets/dialogue-frame.png",
  "generated/battle-reference-forest.png",
  "assets/generated/rm2k3/battle-icon-sword.png",
  "assets/generated/rm2k3/battle-icon-fire.png",
  "assets/generated/rm2k3/battle-icon-shield.png",
  "assets/generated/rm2k3/battle-icon-cross.png",
  "assets/generated/rm2k3/battle-icon-bag.png",
  "assets/generated/rm2k3/battle-icon-boot.png",
  "assets/generated/rm2k3/battle-icon-exp.png",
  "assets/generated/rm2k3/battle-icon-gold.png",
  "assets/generated/rm2k3/battle-icon-shard.png",
  "assets/generated/rm2k3/battle-icon-world.png",
  "assets/generated/rm2k3/battle-icon-next.png",
] as const;

export type WebExportAsset =
  | {
      readonly kind: "public";
      readonly sourcePath: string;
      readonly zipPath: string;
      readonly resourceId?: string;
    }
  | {
      readonly kind: "uploaded";
      readonly asset: UploadedAsset;
      readonly zipPath: string;
    };

export interface WebExportSummary {
  readonly mapCount: number;
  readonly assetCount: number;
  readonly uploadedAssetCount: number;
  readonly publicAssetCount: number;
  readonly estimatedSizeBytes: number;
  readonly projectJsonBytes: number;
}

export interface PreparedWebExport {
  readonly project: Project;
  readonly projectJson: string;
  readonly assets: readonly WebExportAsset[];
  readonly summary: WebExportSummary;
}

export interface WebPlayerBundleFile {
  readonly sourcePath: string;
  readonly zipPath: string;
}

export interface WebExportPackageResult {
  readonly blob: Blob;
  readonly summary: WebExportSummary & {
    readonly playerBundleFileCount: number;
    readonly zipEntryCount: number;
  };
}

type FetchBytes = (path: string) => Promise<Uint8Array>;

export function prepareWebExport(project: Project): PreparedWebExport {
  const baseProject = projectWithoutEventDrafts(project);
  const usedUploadedIds = collectUsedUploadedAssetIds(baseProject);
  const exportProject: Project = {
    ...structuredClone(baseProject),
    assets: {
      ...structuredClone(baseProject.assets),
      uploaded: Object.fromEntries(
        Object.entries(baseProject.assets.uploaded).filter(([id]) => usedUploadedIds.has(id))
      ),
    },
  };
  const projectJson = serialize(exportProject);
  deserialize(projectJson);
  const assets = collectWebExportAssets(exportProject);
  const projectJsonBytes = encoder.encode(projectJson).length;
  const estimatedSizeBytes = projectJsonBytes + assets.reduce((total, asset) => total + estimateAssetBytes(asset), 0);
  return {
    project: exportProject,
    projectJson,
    assets,
    summary: {
      mapCount: Object.keys(exportProject.maps).length,
      assetCount: assets.length,
      uploadedAssetCount: assets.filter((asset) => asset.kind === "uploaded").length,
      publicAssetCount: assets.filter((asset) => asset.kind === "public").length,
      estimatedSizeBytes,
      projectJsonBytes,
    },
  };
}

export function webExportFileName(project: Project): string {
  return `${safeFileName(project.meta.title || "rpg-zzu-game")}-web.zip`;
}

export async function createWebPlayerExportPackage(
  project: Project,
  options: {
    readonly bundleBase?: string;
    readonly fetchBytes?: FetchBytes;
  } = {}
): Promise<WebExportPackageResult> {
  const prepared = prepareWebExport(project);
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const bundleBase = options.bundleBase ?? WEB_PLAYER_BUNDLE_BASE;
  const bundleFiles = await discoverWebPlayerBundleFiles(bundleBase, fetchBytes);
  const entries: ZipEntry[] = [
    textEntry("project.json", prepared.projectJson),
    ...await bundleEntries(bundleFiles, fetchBytes),
    ...await assetEntries(prepared.assets, fetchBytes),
  ];
  return {
    blob: writeStoredZip(entries),
    summary: {
      ...prepared.summary,
      playerBundleFileCount: bundleFiles.length,
      zipEntryCount: entries.length,
    },
  };
}

export async function discoverWebPlayerBundleFiles(
  bundleBase = WEB_PLAYER_BUNDLE_BASE,
  fetchBytes: FetchBytes = defaultFetchBytes
): Promise<readonly WebPlayerBundleFile[]> {
  const files = new Map<string, WebPlayerBundleFile>();
  addBundleFile(files, joinUrlPath(bundleBase, "player.html"), "player.html");

  try {
    const manifestBytes = await fetchBytes(joinUrlPath(bundleBase, WEB_PLAYER_MANIFEST));
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as Record<string, unknown>;
    for (const file of manifestOutputFiles(manifest)) {
      addBundleFile(files, joinUrlPath(bundleBase, file), file);
    }
  } catch {
    addBundleFile(files, joinUrlPath(bundleBase, "player.js"), "player.js");
  }

  return [...files.values()].sort((a, b) => a.zipPath.localeCompare(b.zipPath));
}

export function collectWebExportAssets(project: Project): readonly WebExportAsset[] {
  const ids = collectProjectStrings(project);
  const usedUploadedIds = collectUsedUploadedAssetIds(project);
  const assets = new Map<string, WebExportAsset>();
  for (const path of RUNTIME_STATIC_PUBLIC_ASSETS) {
    assets.set(path, { kind: "public", sourcePath: path, zipPath: path });
  }
  for (const asset of BUNDLED_IMAGE_ASSETS) {
    if (asset.textureKey === TEX_TILESET || asset.textureKey === TEX_DIALOGUE_FRAME || ids.has(asset.textureKey)) {
      assets.set(asset.path, { kind: "public", sourcePath: asset.path, zipPath: asset.path, resourceId: asset.textureKey });
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
  return [...assets.values()].sort((a, b) => a.zipPath.localeCompare(b.zipPath));
}

export function collectUsedUploadedAssetIds(project: Project): Set<string> {
  const ids = collectProjectStrings(project);
  const uploaded = new Set<string>();
  for (const id of Object.keys(project.assets.uploaded)) {
    if (ids.has(id)) uploaded.add(id);
  }
  return uploaded;
}

function manifestOutputFiles(manifest: Record<string, unknown>): string[] {
  const files = new Set<string>();
  const entries = Object.values(manifest).filter(isManifestEntry);
  const byKey = new Map(Object.entries(manifest));
  const visitedFiles = new Set<string>();
  const visit = (entry: ManifestEntry): void => {
    if (visitedFiles.has(entry.file)) return;
    visitedFiles.add(entry.file);
    files.add(entry.file);
    for (const css of entry.css ?? []) files.add(css);
    for (const asset of entry.assets ?? []) files.add(asset);
    for (const importKey of [...entry.imports ?? [], ...entry.dynamicImports ?? []]) {
      const child = byKey.get(importKey);
      if (isManifestEntry(child)) visit(child);
    }
  };
  for (const entry of entries) {
    if (entry.isEntry || entry.file === "player.js") visit(entry);
  }
  if (files.size === 0) files.add("player.js");
  return [...files];
}

type ManifestEntry = {
  readonly file: string;
  readonly isEntry?: boolean;
  readonly css?: readonly string[];
  readonly assets?: readonly string[];
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
};

function isManifestEntry(value: unknown): value is ManifestEntry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.file === "string";
}

function addBundleFile(files: Map<string, WebPlayerBundleFile>, sourcePath: string, zipPath: string): void {
  files.set(zipPath, { sourcePath, zipPath });
}

async function bundleEntries(files: readonly WebPlayerBundleFile[], fetchBytes: FetchBytes): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  for (const file of files) {
    entries.push({ name: file.zipPath, bytes: await fetchBytes(file.sourcePath) });
  }
  return entries;
}

async function assetEntries(assets: readonly WebExportAsset[], fetchBytes: FetchBytes): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  for (const asset of assets) {
    if (asset.kind === "uploaded") {
      entries.push({ name: asset.zipPath, bytes: dataUrlBytes(asset.asset.dataUrl) });
      continue;
    }
    entries.push({ name: asset.zipPath, bytes: await fetchBytes(`/${asset.sourcePath}`) });
  }
  return entries;
}

async function defaultFetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`파일을 읽을 수 없습니다: ${path} (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

function textEntry(name: string, text: string): ZipEntry {
  return { name, bytes: encoder.encode(text) };
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
    if (key === "uploaded") continue;
    collectStrings(child, out);
  }
}

function localPublicPath(url: string | null): string | null {
  if (!url?.startsWith("/")) return null;
  const path = url.slice(1);
  if (path.includes("://") || path.includes("..")) return null;
  return path;
}

function estimateAssetBytes(asset: WebExportAsset): number {
  if (asset.kind === "uploaded") return dataUrlBytes(asset.asset.dataUrl).length;
  return 0;
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return encoder.encode(dataUrl);
  const meta = dataUrl.slice(0, comma).toLowerCase();
  const body = dataUrl.slice(comma + 1);
  if (meta.endsWith(";base64")) return base64ToBytes(body);
  return encoder.encode(decodeURIComponent(body));
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  return encoder.encode(value);
}

function uploadedAssetExtension(dataUrl: string): string {
  const media = dataUrl.slice(0, dataUrl.indexOf(",") >= 0 ? dataUrl.indexOf(",") : dataUrl.length).toLowerCase();
  if (media.includes("image/jpeg")) return "jpg";
  if (media.includes("image/webp")) return "webp";
  if (media.includes("image/gif")) return "gif";
  if (media.includes("audio/mpeg")) return "mp3";
  if (media.includes("audio/wav")) return "wav";
  if (media.includes("audio/ogg")) return "ogg";
  return "png";
}

function joinUrlPath(base: string, path: string): string {
  return `${base.replace(/\/+$/u, "")}/${path.replace(/^\/+/u, "")}`;
}

function safeFileName(value: string): string {
  const safe = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, "-");
  return safe || "rpg-zzu";
}
