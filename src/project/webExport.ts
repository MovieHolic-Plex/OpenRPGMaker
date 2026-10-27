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
import type { Project, TileAiMetadata } from "@/project/types";
import { bundledTilesetRefView, withBundledTilesetRefs } from "@/project/bundledTilesetRefs";
import type { SpatialLibrary } from "@/project/spatial/types";
import {
  collectRetiredExportReferences,
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

/**
 * 출하 게임이 읽는 칸 이름표 필드만 남긴다. 설명·출처·확신도·잠금 같은 편집기·조수용 글은 플레이어가 읽지 않는데
 * 칩셋 하나에 수 MB 다(시타마치 데모 play.json 22MB 중 jp_city tileMeta 8.7MB, 그중 description 3.4MB).
 * 런타임은 label·tags(필드 효과·깊이·탈것), role·passage·terrainTag·defaultLayer·layerBacking 을 읽는다.
 */
function playTileMeta(meta: TileAiMetadata): TileAiMetadata {
  if (!meta) return meta;
  const out: TileAiMetadata = { label: meta.label, description: "" };
  if (meta.tags?.length) out.tags = meta.tags;
  if (meta.role !== undefined) out.role = meta.role;
  if (meta.passage !== undefined) out.passage = meta.passage;
  if (meta.terrainTag !== undefined) out.terrainTag = meta.terrainTag;
  if (meta.defaultLayer !== undefined) out.defaultLayer = meta.defaultLayer;
  if (meta.layerBacking !== undefined) out.layerBacking = meta.layerBacking;
  return out;
}

/** Trim before cloning: a new project carries hundreds of unused assets and
 * editor reference documents. Copying those only to discard them can crash the
 * renderer. The final clone also isolates retained uploaded assets from edits. */
function exportProjection(project: Project): Project {
  const usedTilesets = new Set(Object.values(project.maps).map(map => map.tilesetId));
  // Grafted frames can depend on a tileset not used directly by any map.
  // Retain that source closure, including custom uploaded source textures.
  for (const id of usedTilesets) {
    for (const graft of project.tilesets[id]?.tileGrafts ?? []) {
      if (project.tilesets[graft.sourceChipset]) usedTilesets.add(graft.sourceChipset);
      for (const [sourceId, source] of Object.entries(project.tilesets))
        if (source.image.id === graft.sourceChipset) usedTilesets.add(sourceId);
    }
  }
  const projection: Project = {
    ...project,
    maps: Object.fromEntries(Object.entries(project.maps).map(([id, map]) =>
      [id, { ...map, events: committedEvents(map.events) }])),
    tilesets: Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => usedTilesets.has(id)).map(([id, tileset]) =>
      [id, { ...tileset, ...(tileset.structureKits ? {
        structureKits: tileset.structureKits.map(kit => ({ ...kit })),
      } : {}) }])),
  };
  delete projection.audioDescriptions;
  delete projection.monsterMetadata;
  for (const [id, tileset] of Object.entries(projection.tilesets)) {
    delete tileset.referenceDocuments;
    delete tileset.referenceSourceTilesetId;
    for (const kit of tileset.structureKits ?? []) delete kit.referenceDocuments;
    // 번들 정의와 같은 타일셋은 prepareWebExport 가 참조로 바꿔 싣지 않는다 — 설명을 줄이면 동치가 깨져 참조가 안 된다.
    // 줄이기는 통째로 실리는 타일셋(업로드·고친 번들·출판 판본)에만.
    const shipsAsRef = !project.meta.publication && bundledTilesetRefView(id, tileset) !== undefined;
    if (tileset.tileMeta && !shipsAsRef) tileset.tileMeta = tileset.tileMeta.map(playTileMeta);
  }
  if (project.spatialAuthoring) {
    projection.spatialAuthoring = { ...project.spatialAuthoring,
      library: withoutLibraryReferences(project.spatialAuthoring.library),
      occurrences: Object.fromEntries(Object.entries(project.spatialAuthoring.occurrences).map(([id, occurrence]) =>
        [id, { ...occurrence, snapshot: { ...occurrence.snapshot,
          library: withoutLibraryReferences(occurrence.snapshot.library),
        } }])) as typeof project.spatialAuthoring.occurrences,
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
  // 번들 정의와 같은 타일셋은 참조로 싣는다 — 플레이어 번들이 같은 정의를 이미 갖고 있다(bundledTilesetRefs.ts, S4).
  // 출판 판본(meta.publication)은 보관된 옛 런타임이 읽을 수 있으니 예전처럼 통째로 싣는다.
  // 플레이어가 읽는 자기완결 문서 — 번들 차이 저장(bundledTilesetDiff.ts)은 쓰지 않는다. 번들과 같은 것만 위의 참조로 싣는다.
  const projectJson = serialize(project.meta.publication ? exportProject : withBundledTilesetRefs(exportProject), { inlineBundledTilesets: true });
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
      skippedRetiredResources: collectRetiredExportReferences(exportProject),
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
