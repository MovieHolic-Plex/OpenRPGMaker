import { sha256HexBytes } from "../util/sha256";
import { parseRuntimeManifest, ReleaseError, type RuntimeManifest } from "./gameRelease";
import { parsePublication, PublicationError } from "./publication";
import { assertUniquePaths } from "./playerDeploymentPaths";
import { dataUrlBytes, invalidExportDependencyBytes } from "./webExportAssets";
import type { FetchBytes } from "./playerDeploymentTypes";
import type { PreparedWebExport } from "./webExportTypes";
import type { ZipEntry } from "./packageZip";

export const RUNTIME_ARCHIVE_BASE = "/runtime-archive/";

export async function installedRuntimeTarget(fetchBytes: FetchBytes): Promise<string> {
  const value: unknown = JSON.parse(new TextDecoder().decode(await fetchBytes(`${RUNTIME_ARCHIVE_BASE}default.json`)));
  if (!value || typeof value !== "object" || !("runtimeTarget" in value)
    || typeof value.runtimeTarget !== "string" || !/^[a-f0-9]{64}$/.test(value.runtimeTarget)) throw new PublicationError("runtime-unavailable");
  return value.runtimeTarget;
}

export async function loadPublicationRuntime(prepared: PreparedWebExport, fetchBytes: FetchBytes) {
  const publication = parsePublication(prepared.project.meta.publication);
  const base = `${RUNTIME_ARCHIVE_BASE}${publication.runtimeTarget}/`;
  const runtime = await parseRuntimeManifest(JSON.parse(new TextDecoder().decode(await fetchBytes(`${base}runtime.json`))));
  if (runtime.runtimeTarget !== publication.runtimeTarget) throw new PublicationError("runtime-unavailable");
  const read = async (path: string) => {
    const record = runtime.files.find(file => file.path === path);
    if (!record) throw new PublicationError("runtime-unavailable");
    const bytes = await fetchBytes(`${base}${path}`);
    if (bytes.length !== record.bytes || await sha256HexBytes(bytes) !== record.sha256) throw new ReleaseError("integrity");
    return bytes;
  };
  return { runtime, read, publication };
}

export async function publicationAssetEntries(prepared: PreparedWebExport, archive: {
  readonly runtime: RuntimeManifest;
  readonly read: (path: string) => Promise<Uint8Array>;
}): Promise<readonly ZipEntry[]> {
  // Current conditional pruning cannot prove an older engine's closure. Preserve
  // its full runtime inventory; the legacy current-engine export keeps pruning.
  const publicPaths = new Set([...archive.runtime.requiredAssets,
    ...prepared.assets.filter(asset => asset.kind === "public").map(asset => asset.zipPath)]);
  const entries = await Promise.all([...publicPaths].map(async name => ({ name, bytes: await archive.read(`public/${name}`) })));
  for (const asset of prepared.assets) {
    if (asset.kind === "uploaded") entries.push({ name: asset.zipPath, bytes: dataUrlBytes(asset.asset.dataUrl) });
  }
  assertUniquePaths(entries.map(entry => entry.name));
  if (entries.some(entry => invalidExportDependencyBytes(entry.bytes))) throw new ReleaseError("integrity");
  return entries;
}

export function assetDataUrl(entry: ZipEntry): string {
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const mime: Readonly<Record<string, string>> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4",
    webm: "video/webm", ogv: "video/ogg", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf" };
  return `data:${mime[ext] ?? "application/octet-stream"};base64,${encodeBase64(entry.bytes)}`;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
