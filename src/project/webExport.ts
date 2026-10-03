import { committedEvents } from "@/project/eventDrafts";
import { createGameRelease, verifyGameRelease } from "./gameRelease";
import { loadPublicationRuntime, publicationAssetEntries } from "./publicationExport";
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
import type { SpatialLibrary } from "@/project/spatial/types";
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

function withoutLibraryReferences(library: SpatialLibrary): SpatialLibrary {
  return Object.fromEntries(Object.entries(library).map(([kind, collection]) => [kind,
    Object.fromEntries(Object.entries(collection).map(([id, design]) => {
      const copy = { ...design };
      Reflect.deleteProperty(copy, "referenceDocuments");
      return [id, copy];
    })),
  ])) as unknown as SpatialLibrary;
}

/** Trim before cloning: a new project carries hundreds of unused assets and
 * editor reference documents. Copying those only to discard them can crash the
 * renderer. The final clone also isolates retained uploaded assets from edits. */
function exportProjection(project: Project): Project {
  const projection: Project = {
    ...project,
    maps: Object.fromEntries(Object.entries(project.maps).map(([id, map]) =>
      [id, { ...map, events: committedEvents(map.events) }])),
    tilesets: Object.fromEntries(Object.entries(project.tilesets).map(([id, tileset]) =>
      [id, { ...tileset, ...(tileset.structureKits ? {
        structureKits: tileset.structureKits.map(kit => ({ ...kit })),
      } : {}) }])),
  };
  delete projection.audioDescriptions;
  delete projection.monsterMetadata;
  for (const tileset of Object.values(projection.tilesets)) {
    delete tileset.referenceDocuments;
    delete tileset.referenceSourceTilesetId;
    for (const kit of tileset.structureKits ?? []) delete kit.referenceDocuments;
  }
  if (project.spatialAuthoring) {
    projection.spatialAuthoring = { ...project.spatialAuthoring,
      library: withoutLibraryReferences(project.spatialAuthoring.library),
      occurrences: Object.fromEntries(Object.entries(project.spatialAuthoring.occurrences).map(([id, occurrence]) =>
        [id, { ...occurrence, snapshot: { ...occurrence.snapshot,
          library: withoutLibraryReferences(occurrence.snapshot.library),
        } }])),
    };
  }
  const usedUploadedIds = collectUsedUploadedAssetIds(projection);
  projection.assets = { ...project.assets, uploaded: Object.fromEntries(
    Object.entries(project.assets.uploaded).filter(([id]) => usedUploadedIds.has(id)),
  ) };
  return structuredClone(projection);
}

export function prepareWebExport(project: Project): PreparedWebExport {
  const exportProject = exportProjection(project);
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
  if (project.meta.publication) {
    const archive = await loadPublicationRuntime(prepared, fetchBytes);
    const bundles = await Promise.all(archive.runtime.files.filter(file => file.path.startsWith("web/")).map(async file => ({
      name: file.path.slice(4), bytes: await archive.read(file.path),
    })));
    const entries = [{ name: "project.json", bytes: encoder.encode(prepared.projectJson) }, ...bundles,
      ...await publicationAssetEntries(prepared, archive)];
    const release = await createGameRelease({ publication: archive.publication, entries });
    await verifyGameRelease(new Uint8Array(await release.blob.arrayBuffer()), archive.runtime, archive.collectDependencies);
    return { blob: release.blob, summary: { ...prepared.summary, playerBundleFileCount: bundles.length, zipEntryCount: entries.length + 1 } };
  }
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
