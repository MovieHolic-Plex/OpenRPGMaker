import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { deserialize, serialize } from "@/project/io";
import { writeStoredZip } from "@/project/packageZip";
import {
  WEB_PLAYER_MANIFEST,
  WebExportContractError,
  discoverWebPlayerBundleFiles as discoverVerifiedWebPlayerBundleFiles,
  loadVerifiedPlayerDeployment,
  type FetchBytes,
  type WebExportContractErrorCode,
  type WebPlayerBundleFile,
} from "@/project/playerDeploymentManifest";
import type { Project } from "@/project/types";
import {
  collectUsedUploadedAssetIds,
  collectWebExportAssets,
  estimateAssetBytes,
  safeFileName,
} from "@/project/webExportAssets";
import type {
  PreparedWebExport,
  WebExportAsset,
  WebExportPackageResult,
  WebExportSummary,
} from "@/project/webExportTypes";
import { defaultFetchBytes, exactWebExportEntries } from "@/project/webExportZip";

export {
  WEB_PLAYER_MANIFEST,
  WebExportContractError,
  collectUsedUploadedAssetIds,
  collectWebExportAssets,
  type PreparedWebExport,
  type WebExportAsset,
  type WebExportContractErrorCode,
  type WebExportPackageResult,
  type WebExportSummary,
  type WebPlayerBundleFile,
};

export const WEB_PLAYER_BUNDLE_BASE = "/export-player/";

const encoder = new TextEncoder();

export function prepareWebExport(project: Project): PreparedWebExport {
  const baseProject = projectWithoutEventDrafts(project);
  const usedUploadedIds = collectUsedUploadedAssetIds(baseProject);
  const exportProject: Project = {
    ...structuredClone(baseProject),
    assets: {
      ...structuredClone(baseProject.assets),
      uploaded: Object.fromEntries(
        Object.entries(baseProject.assets.uploaded).filter(([id]) => usedUploadedIds.has(id)),
      ),
    },
  };
  delete exportProject.audioDescriptions;
  delete exportProject.monsterMetadata;
  const projectJson = serialize(exportProject);
  deserialize(projectJson);
  const assets = collectWebExportAssets(exportProject);
  const projectJsonBytes = encoder.encode(projectJson).length;
  const estimatedSizeBytes = projectJsonBytes
    + assets.reduce((total, asset) => total + estimateAssetBytes(asset), 0);
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
  return `${safeFileName(project.meta.title || "oprn-game")}-web.zip`;
}

export async function createWebPlayerExportPackage(
  project: Project,
  options: { readonly bundleBase?: string; readonly fetchBytes?: FetchBytes } = {},
): Promise<WebExportPackageResult> {
  const prepared = prepareWebExport(project);
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const bundleBase = options.bundleBase ?? WEB_PLAYER_BUNDLE_BASE;
  const deployment = await loadVerifiedPlayerDeployment({ bundleBase, adapters: { fetchBytes } });
  const entries = await exactWebExportEntries(prepared, deployment, fetchBytes);
  return {
    blob: writeStoredZip(entries),
    summary: {
      ...prepared.summary,
      playerBundleFileCount: deployment.bundleFiles.length,
      zipEntryCount: entries.length,
    },
  };
}

export function discoverWebPlayerBundleFiles(
  bundleBase = WEB_PLAYER_BUNDLE_BASE,
  fetchBytes: FetchBytes = defaultFetchBytes,
): Promise<readonly WebPlayerBundleFile[]> {
  return discoverVerifiedWebPlayerBundleFiles(bundleBase, fetchBytes);
}
