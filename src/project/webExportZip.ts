import { contractFailure, WebExportContractError } from "@/project/playerDeploymentErrors";
import { pathCollisionKey } from "@/project/playerDeploymentManifest";
import type { FetchBytes, VerifiedPlayerDeployment } from "@/project/playerDeploymentManifest";
import type { ZipEntry } from "@/project/packageZip";
import { uploadedAssetBytes } from "@/project/persistence/assetAccessors";
import { exportAssetSourceUrl, invalidExportDependencyBytes } from "@/project/webExportAssets";
import { prunedRuntimeAssetPaths } from "@/project/webExportRuntimeAssets";
import type { PreparedWebExport, WebExportAsset } from "@/project/webExportTypes";

const encoder = new TextEncoder();

export async function exactWebExportEntries(
  prepared: PreparedWebExport,
  deployment: VerifiedPlayerDeployment,
  fetchBytes: FetchBytes,
): Promise<readonly ZipEntry[]> {
  const entries = new Map<string, ZipEntry>();
  const collisionIndex = new Map<string, string>();
  addExactEntry({ entries, collisionIndex, entry: textEntry("project.json", prepared.projectJson) });
  // 웹 플레이어의 «불러오는 중» 화면(player/bootLoader.ts)이 project.json 보다 먼저 읽는 작은 안내: 이름·표지·데이터 크기.
  addExactEntry({ entries, collisionIndex, entry: textEntry("loading.json", JSON.stringify(loadingInfo(prepared))) });
  for (const file of deployment.bundleFiles) {
    addExactEntry({ entries, collisionIndex, entry: { name: file.zipPath, bytes: file.bytes } });
  }
  // SDK 매니페스트는 전량 검증하되(위조 탐지 유지), 이 프로젝트가 안 쓰는 기능의 아트는 싣지
  // 않는다. 빼는 판단은 webExportRuntimeAssets 의 조건부 그룹 **한 곳** 에만 있고, 여기서는
  // 그 목록만 따른다 — 매니페스트에 있는데 그 목록에 없는 것은 무조건 싣는다(안전한 쪽 기본값).
  const prunedPaths = prunedRuntimeAssetPaths(prepared.project);
  for (const asset of deployment.runtimeAssets) {
    if (prunedPaths.has(asset.zipPath)) continue;
    addExactEntry({ entries, collisionIndex, entry: { name: asset.zipPath, bytes: asset.bytes } });
  }
  const missingAssets = prepared.assets.filter((asset) => (
    reserveMissingAssetPath(asset.zipPath, entries, collisionIndex)
  ));
  for (const entry of await assetEntries(missingAssets, fetchBytes)) {
    addExactEntry({ entries, collisionIndex, entry });
  }
  return Object.freeze([...entries.values()].sort((left, right) => left.name.localeCompare(right.name)));
}

/** 표지는 타이틀 배경 그림(판본에 실리는 경로). 없으면 이름과 크기만. */
export function loadingInfo(prepared: PreparedWebExport): { readonly title: string; readonly cover?: string; readonly projectBytes: number } {
  const system = prepared.project.system;
  const coverIds = [system.titleScreen?.backgroundResourceId, system.titleResourceId].filter((id): id is string => typeof id === "string" && id.length > 0);
  const cover = coverIds.map((id) => prepared.assets.find((asset) => (asset.kind === "public" ? asset.resourceId : asset.asset.id) === id && /\.(png|jpe?g|webp|gif)$/i.test(asset.zipPath))?.zipPath).find(Boolean);
  return {
    title: prepared.project.meta.title || "",
    ...(cover ? { cover } : {}),
    projectBytes: encoder.encode(prepared.projectJson).byteLength,
  };
}

export async function defaultFetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Web export dependency request failed");
  return new Uint8Array(await response.arrayBuffer());
}

function reserveMissingAssetPath(
  filePath: string,
  entries: ReadonlyMap<string, ZipEntry>,
  collisionIndex: Map<string, string>,
): boolean {
  const key = pathCollisionKey(filePath);
  const previous = collisionIndex.get(key);
  if (previous === filePath && entries.has(filePath)) return false;
  if (previous !== undefined) contractFailure("zip-path-collision", [previous, filePath]);
  collisionIndex.set(key, filePath);
  return true;
}

function addExactEntry(options: {
  readonly entries: Map<string, ZipEntry>;
  readonly collisionIndex: Map<string, string>;
  readonly entry: ZipEntry;
}): void {
  const key = pathCollisionKey(options.entry.name);
  const previous = options.collisionIndex.get(key);
  if (previous !== undefined && previous !== options.entry.name) {
    contractFailure("zip-path-collision", [previous, options.entry.name]);
  }
  if (options.entries.has(options.entry.name)) contractFailure("manifest-incomplete");
  options.collisionIndex.set(key, options.entry.name);
  options.entries.set(options.entry.name, options.entry);
}

async function assetEntries(assets: readonly WebExportAsset[], fetchBytes: FetchBytes): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  for (const asset of assets) {
    if (asset.kind === "uploaded") {
      entries.push({ name: asset.zipPath, bytes: await uploadedAssetBytes(asset.asset) });
      continue;
    }
    try {
      const bytes = await fetchBytes(exportAssetSourceUrl(asset.sourcePath));
      if (invalidExportDependencyBytes(bytes)) contractFailure("runtime-asset-unavailable", asset.zipPath);
      entries.push({ name: asset.zipPath, bytes });
    } catch (error) {
      if (error instanceof WebExportContractError) throw error;
      contractFailure("runtime-asset-unavailable", asset.zipPath);
    }
  }
  return entries;
}

function textEntry(name: string, text: string): ZipEntry {
  return { name, bytes: encoder.encode(text) };
}
