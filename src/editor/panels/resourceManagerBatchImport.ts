// 커스텀 에셋 일괄(배치) 검증·임포트 및 이름 충돌 정책(rename / overwrite / skip).
//
// 상업 게임 제작에서 수십~수백 개의 아트·OST·보이스 파일을 한 번에 등록하거나,
// Aseprite/DAW 등 외부 툴에서 수정한 파일을 기존 에셋 ID를 유지한 채 덮어쓰기(overwrite)할 때 쓴다.
// 파일 읽기·이미지 디코딩·ID 생성을 주입 가능하게 설계해 DOM 없이도 순수 테스트가 가능하다.

import { getResourceProfileSpec, validateResourceDimensions } from "@/project/resourceProfiles";
import { store } from "@/project/store";
import type { Project, ResourceKind, UploadedAsset } from "@/project/types";
import { genId } from "@/util/id";
import {
  decideImageDataUrl,
  decideImageImport,
  formatImageImportDimensionError,
  prepareImportedImageDataUrl,
} from "./resourceManagerImageImport";
import { mediaImportRuleFor } from "./resourceManagerMediaImport";
import { resourceKindFromUpload } from "./resourceManagerUtils";

export type BatchImportConflictPolicy = "rename" | "overwrite" | "skip";

/** Browser `File` or lightweight test stub compatible with batch validation & import. */
export interface BatchImportFileLike {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export interface PreparedImagePayload {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

export interface BatchImportImportedItem {
  readonly fileName: string;
  readonly assetId: string;
  readonly assetName: string;
  readonly renamedFrom?: string;
}

export interface BatchImportOverwrittenItem {
  readonly fileName: string;
  readonly assetId: string;
  readonly assetName: string;
}

export interface BatchImportSkippedItem {
  readonly fileName: string;
  readonly assetName: string;
  readonly existingAssetId: string;
  readonly reason: string;
}

export type BatchImportFailureReason = "size" | "format" | "dimensions" | "read" | "data" | "unknown";

export interface BatchImportFailedItem {
  readonly fileName: string;
  readonly reason: BatchImportFailureReason;
  readonly message: string;
}

export interface BatchImportReport {
  readonly kind: ResourceKind;
  readonly conflictPolicy: BatchImportConflictPolicy;
  readonly total: number;
  readonly imported: readonly BatchImportImportedItem[];
  readonly overwritten: readonly BatchImportOverwrittenItem[];
  readonly skipped: readonly BatchImportSkippedItem[];
  readonly failed: readonly BatchImportFailedItem[];
}

export interface BatchImportOptions {
  readonly kind: ResourceKind;
  readonly conflictPolicy?: BatchImportConflictPolicy;
  /** Optional chipset tile size override (e.g. 16 / 32 / 48). */
  readonly tileSizeOverride?: number;
  /** Skip image dimension checks when importing custom free-size art. */
  readonly skipDimensionValidation?: boolean;
  /** Custom file -> dataUrl reader (defaults to browser FileReader). */
  readonly readAsDataUrl?: (file: BatchImportFileLike) => Promise<string>;
  /** Custom image decoder/normalizer (defaults to prepareImportedImageDataUrl). */
  readonly prepareImage?: (rawDataUrl: string, normalizeToPng: boolean) => Promise<PreparedImagePayload>;
  /** Custom ID generator for newly imported assets. */
  readonly generateId?: (prefix: string) => string;
  /** Optional storage adapter (e.g. content-addressed upload) that finalizes the UploadedAsset before commit. */
  readonly finalizeAsset?: (asset: UploadedAsset) => Promise<UploadedAsset>;
}

export function stripFileExtension(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/u, "").trim();
  return base || fileName.trim() || "asset";
}

function normalizeAssetNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function findConflictingAsset(
  project: Project,
  kind: ResourceKind,
  baseName: string,
): UploadedAsset | undefined {
  const targetKey = normalizeAssetNameKey(baseName);
  for (const asset of Object.values(project.assets.uploaded)) {
    if (resourceKindFromUpload(asset.kind) !== kind) continue;
    if (normalizeAssetNameKey(asset.name) === targetKey) {
      return asset;
    }
  }
  return undefined;
}

export function resolveUniqueAssetName(
  baseName: string,
  existingNameKeys: ReadonlySet<string>,
): string {
  if (!existingNameKeys.has(normalizeAssetNameKey(baseName))) {
    return baseName;
  }
  let suffix = 2;
  while (existingNameKeys.has(normalizeAssetNameKey(`${baseName} (${suffix})`))) {
    suffix += 1;
  }
  return `${baseName} (${suffix})`;
}

function defaultReadAsDataUrl(file: BatchImportFileLike): Promise<string> {
  if (typeof FileReader === "undefined" || !(file instanceof Blob)) {
    return Promise.reject(new Error("파일을 읽을 수 없습니다. 브라우저 File 또는 readAsDataUrl 핸들러가 필요합니다."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function toFileArray(files: FileList | readonly BatchImportFileLike[]): BatchImportFileLike[] {
  if (Array.isArray(files)) return [...files];
  return Array.from(files as FileList);
}

function upsertResourceProfile(
  project: Project,
  profile: Project["resourceProfiles"][number],
): void {
  const existingIndex = project.resourceProfiles.findIndex(
    (entry) => entry.assetId !== undefined && entry.assetId === profile.assetId,
  );
  if (existingIndex >= 0) {
    const current = project.resourceProfiles[existingIndex]!;
    project.resourceProfiles[existingIndex] = {
      ...current,
      ...profile,
    };
  } else {
    project.resourceProfiles.push(profile);
  }
}

/**
 * Validates and imports a batch of image/audio/video files into `project` according to `conflictPolicy`.
 *
 * - `"rename"`: keeps existing assets intact and registers colliding files under `<name> (2)`, `<name> (3)`, ...
 * - `"overwrite"`: updates bytes and metadata in place while **preserving the existing `UploadedAsset.id`**,
 *   so all map/event/tileset/database references remain intact without broken links.
 * - `"skip"`: leaves colliding assets untouched and records them in `report.skipped`.
 */
export async function applyBatchImportToProject(
  project: Project,
  files: FileList | readonly BatchImportFileLike[],
  options: BatchImportOptions,
): Promise<BatchImportReport> {
  const fileList = toFileArray(files);
  const conflictPolicy: BatchImportConflictPolicy = options.conflictPolicy ?? "rename";
  const readAsDataUrl = options.readAsDataUrl ?? defaultReadAsDataUrl;
  const prepareImage = options.prepareImage ?? prepareImportedImageDataUrl;
  const generateId = options.generateId ?? genId;
  const mediaRule = mediaImportRuleFor(options.kind);

  const imported: BatchImportImportedItem[] = [];
  const overwritten: BatchImportOverwrittenItem[] = [];
  const skipped: BatchImportSkippedItem[] = [];
  const failed: BatchImportFailedItem[] = [];

  // Track active names for this kind so intra-batch collisions follow the exact same conflict policy.
  const usedNameKeys = new Set<string>();
  for (const asset of Object.values(project.assets.uploaded)) {
    if (resourceKindFromUpload(asset.kind) === options.kind) {
      usedNameKeys.add(normalizeAssetNameKey(asset.name));
    }
  }

  for (const file of fileList) {
    const baseName = stripFileExtension(file.name);
    const existing = findConflictingAsset(project, options.kind, baseName);

    if (existing && conflictPolicy === "skip") {
      skipped.push({
        fileName: file.name,
        assetName: baseName,
        existingAssetId: existing.id,
        reason: "이미 같은 이름의 리소스가 존재합니다.",
      });
      continue;
    }

    if (mediaRule !== null) {
      if (file.size > mediaRule.maxBytes) {
        failed.push({
          fileName: file.name,
          reason: "size",
          message: `파일이 너무 큽니다 (${Math.round(mediaRule.maxBytes / 1024 / 1024)}MB 초과).`,
        });
        continue;
      }
      if (!mediaRule.filePattern.test(file.name)) {
        failed.push({
          fileName: file.name,
          reason: "format",
          message: mediaRule.fileError,
        });
        continue;
      }

      let dataUrl: string;
      try {
        dataUrl = await readAsDataUrl(file);
      } catch (error) {
        failed.push({
          fileName: file.name,
          reason: "read",
          message: error instanceof Error ? error.message : "파일을 읽지 못했습니다.",
        });
        continue;
      }

      if (!dataUrl.startsWith(mediaRule.dataUrlPrefix)) {
        failed.push({
          fileName: file.name,
          reason: "data",
          message: mediaRule.dataError,
        });
        continue;
      }

      if (existing && conflictPolicy === "overwrite") {
        // Preserve existing UploadedAsset.id so all project references remain intact.
        const { ref: _staleRef, ...withoutStaleRef } = existing;
        const candidate: UploadedAsset = {
          ...withoutStaleRef,
          id: existing.id,
          name: existing.name,
          kind: existing.kind,
          dataUrl,
          meta: { ...existing.meta },
        };
        const finalized = options.finalizeAsset ? await options.finalizeAsset(candidate) : candidate;
        project.assets.uploaded[existing.id] = finalized;
        upsertResourceProfile(project, {
          kind: options.kind,
          name: finalized.name,
          assetId: existing.id,
        });
        overwritten.push({
          fileName: file.name,
          assetId: existing.id,
          assetName: finalized.name,
        });
        continue;
      }

      const finalName = resolveUniqueAssetName(baseName, usedNameKeys);
      const id = generateId(mediaRule.idPrefix);
      const candidate: UploadedAsset = {
        id,
        name: finalName,
        kind: mediaRule.kind,
        dataUrl,
        meta: {},
      };
      const finalized = options.finalizeAsset ? await options.finalizeAsset(candidate) : candidate;
      project.assets.uploaded[id] = finalized;
      upsertResourceProfile(project, {
        kind: mediaRule.kind,
        name: finalName,
        assetId: id,
      });
      usedNameKeys.add(normalizeAssetNameKey(finalName));
      imported.push({
        fileName: file.name,
        assetId: id,
        assetName: finalName,
        ...(finalName !== baseName ? { renamedFrom: baseName } : {}),
      });
      continue;
    }

    // Image resource import path
    const decision = decideImageImport({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!decision.ok) {
      failed.push({
        fileName: file.name,
        reason: decision.reason,
        message: decision.message,
      });
      continue;
    }

    let rawDataUrl: string;
    try {
      rawDataUrl = await readAsDataUrl(file);
    } catch (error) {
      failed.push({
        fileName: file.name,
        reason: "read",
        message: error instanceof Error ? error.message : "파일을 읽지 못했습니다.",
      });
      continue;
    }

    const urlDecision = decideImageDataUrl(rawDataUrl, {
      format: decision.format,
      normalizeToPng: decision.normalizeToPng,
    });
    if (!urlDecision.ok) {
      failed.push({
        fileName: file.name,
        reason: urlDecision.reason,
        message: urlDecision.message,
      });
      continue;
    }

    let prepared: PreparedImagePayload;
    try {
      prepared = await prepareImage(rawDataUrl, decision.normalizeToPng || urlDecision.normalizeToPng);
    } catch (error) {
      failed.push({
        fileName: file.name,
        reason: "data",
        message: error instanceof Error ? error.message : "이미지를 읽을 수 없습니다.",
      });
      continue;
    }

    const { dataUrl, width, height } = prepared;
    const baseSpec = getResourceProfileSpec(options.kind);
    const tileSizeOverride =
      options.kind === "chipset" &&
      options.tileSizeOverride !== undefined &&
      options.tileSizeOverride > 0 &&
      width % options.tileSizeOverride === 0 &&
      height % options.tileSizeOverride === 0
        ? options.tileSizeOverride
        : undefined;

    let tileCount: number | undefined;
    if (tileSizeOverride !== undefined) {
      tileCount = (width / tileSizeOverride) * (height / tileSizeOverride);
    } else if (!options.skipDimensionValidation) {
      const dimResult = validateResourceDimensions(options.kind, width, height);
      if (!dimResult.ok) {
        failed.push({
          fileName: file.name,
          reason: "dimensions",
          message: formatImageImportDimensionError(dimResult.message, width, height),
        });
        continue;
      }
      tileCount = dimResult.tileCount;
    }

    const spec =
      tileSizeOverride !== undefined
        ? { ...baseSpec, tileWidth: tileSizeOverride, tileHeight: tileSizeOverride }
        : baseSpec;

    const imageMeta: UploadedAsset["meta"] = {
      ...(spec.tileWidth !== undefined ? { tileSize: spec.tileWidth, frameWidth: spec.tileWidth } : {}),
      ...(spec.tileHeight !== undefined ? { frameHeight: spec.tileHeight } : {}),
      ...(tileCount !== undefined ? { frames: tileCount } : {}),
      width,
      height,
    };

    if (existing && conflictPolicy === "overwrite") {
      // Preserve existing UploadedAsset.id and custom metadata (e.g. transparentColor, walkFrameMs).
      const { ref: _staleRef, ...withoutStaleRef } = existing;
      const candidate: UploadedAsset = {
        ...withoutStaleRef,
        id: existing.id,
        name: existing.name,
        kind: existing.kind,
        dataUrl,
        meta: {
          ...existing.meta,
          ...imageMeta,
        },
      };
      const finalized = options.finalizeAsset ? await options.finalizeAsset(candidate) : candidate;
      project.assets.uploaded[existing.id] = finalized;
      upsertResourceProfile(project, {
        kind: options.kind,
        name: finalized.name,
        tileWidth: spec.tileWidth,
        tileHeight: spec.tileHeight,
        imageWidth: width,
        imageHeight: height,
        assetId: existing.id,
      });
      overwritten.push({
        fileName: file.name,
        assetId: existing.id,
        assetName: finalized.name,
      });
      continue;
    }

    const finalName = resolveUniqueAssetName(baseName, usedNameKeys);
    const id = generateId(`${options.kind}_img`);
    const candidate: UploadedAsset = {
      id,
      name: finalName,
      kind: options.kind,
      dataUrl,
      meta: imageMeta,
    };
    const finalized = options.finalizeAsset ? await options.finalizeAsset(candidate) : candidate;
    project.assets.uploaded[id] = finalized;
    upsertResourceProfile(project, {
      kind: options.kind,
      name: finalName,
      tileWidth: spec.tileWidth,
      tileHeight: spec.tileHeight,
      imageWidth: width,
      imageHeight: height,
      assetId: id,
    });
    usedNameKeys.add(normalizeAssetNameKey(finalName));
    imported.push({
      fileName: file.name,
      assetId: id,
      assetName: finalName,
      ...(finalName !== baseName ? { renamedFrom: baseName } : {}),
    });
  }

  return {
    kind: options.kind,
    conflictPolicy,
    total: fileList.length,
    imported,
    overwritten,
    skipped,
    failed,
  };
}

/**
 * Convenience helper that stages batch import against the current editor store project
 * and commits all accepted changes in a single atomic `store.update`.
 */
export async function importResourceBatch(
  files: FileList | readonly BatchImportFileLike[],
  options: BatchImportOptions,
): Promise<BatchImportReport> {
  const working = structuredClone(store.getCurrent());
  const report = await applyBatchImportToProject(working, files, options);
  if (report.imported.length > 0 || report.overwritten.length > 0) {
    store.update(
      (project) => {
        project.assets.uploaded = working.assets.uploaded;
        project.resourceProfiles = working.resourceProfiles;
      },
      { scope: "assets", origin: "human", label: `에셋 일괄 가져오기 (${options.kind})` },
    );
  }
  return report;
}
