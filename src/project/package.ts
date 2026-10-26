import { deserialize, serializePretty } from "@/project/io";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { uploadedAssetBytes } from "@/project/persistence/assetAccessors";
import { encodeDataUrlBytes } from "@/project/persistence/core/dataUrl";
import type { Project, UploadedAsset } from "@/project/types";
import {
  readStoredZipEntry,
  readStoredZipEntryNames,
  writeStoredZip,
  ZipFormatError,
  type ZipEntry,
} from "./packageZip";

import { LEGACY_RPGZZU_EXTENSION, LEGACY_RPGZZU_MIME, OPRN_EXTENSION, OPRN_MIME } from "./packageFormat";

export { LEGACY_RPGZZU_EXTENSION, LEGACY_RPGZZU_MIME, OPRN_EXTENSION, OPRN_MIME };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class ProjectPackageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProjectPackageError";
  }
}

export function projectPackageFileName(project: Project): string {
  return `${safeFileName(project.meta.title || "oprn-project")}${OPRN_EXTENSION}`;
}

/**
 * 데스크톱(Electron) 저장소는 업로드·스토어 에셋을 `assets/<sha256>.<ext>` 에 두고 문서에는 `ref` 만 남긴다.
 * `.oprn` 패키지나 단일 파일로 내보낼 때는 다른 폴더·웹에서도 열리도록 `ref` 바이트를 읽어 `dataUrl` 로 인라인한다.
 * 파일을 읽지 못하면 바이트 없이 성공으로 끝내지 않고, 소재 id 를 적어 실패한다.
 */
export async function projectWithInlineUploadedMedia(project: Project): Promise<Project> {
  const uploaded = project.assets.uploaded;
  if (!Object.values(uploaded).some((asset) => asset.ref !== undefined && !asset.dataUrl)) return project;
  const nextUploaded: Record<string, UploadedAsset> = {};
  for (const [id, asset] of Object.entries(uploaded)) {
    if (!asset.ref || asset.dataUrl) {
      nextUploaded[id] = asset;
      continue;
    }
    try {
      const bytes = await uploadedAssetBytes(asset);
      const inlined: UploadedAsset = { ...asset, dataUrl: encodeDataUrlBytes(bytes, asset.ref.mime) };
      delete inlined.ref;
      nextUploaded[id] = inlined;
    } catch (error) {
      // 못 읽은 ref 를 남기면 .oprn·실행형 HTML 이 성공으로 끝나고, 연 쪽에는 그 소재 바이트가 없다.
      throw new ProjectPackageError(
        `업로드한 소재를 읽지 못해 내보낼 수 없습니다: ${shownUploadedAssetId(id)}`,
        { cause: error },
      );
    }
  }
  return { ...project, assets: { ...project.assets, uploaded: nextUploaded } };
}

export function createProjectPackage(project: Project): Blob {
  return writeStoredZip(createProjectPackageEntries(projectWithoutEventDrafts(project)));
}

export async function readProjectPackage(file: Blob): Promise<Project> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const projectEntry = readPackageEntry(bytes, "project.json");
  if (!projectEntry) throw new ProjectPackageError("project.json entry is missing");
  const project = deserialize(decoder.decode(projectEntry));
  for (const asset of Object.values(project.assets.uploaded)) {
    if (asset.ref && !asset.dataUrl) {
      const assetBytes = readPackageEntry(bytes, `assets/${asset.ref.sha256}.${asset.ref.extension}`);
      if (assetBytes) {
        asset.dataUrl = encodeDataUrlBytes(assetBytes, asset.ref.mime);
        delete asset.ref;
      }
    }
  }
  return project;
}

export async function readProjectPackageEntryNames(file: Blob): Promise<readonly string[]> {
  try {
    return readStoredZipEntryNames(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof ZipFormatError) throw new ProjectPackageError(error.message);
    throw error;
  }
}

function createProjectPackageEntries(project: Project): readonly ZipEntry[] {
  const maps = Object.values(project.maps).sort((a, b) => a.id.localeCompare(b.id));
  return [
    textEntry("project.json", serializePretty(project)),
    jsonEntry("data/meta.json", project.meta),
    jsonEntry("data/database.json", project.database),
    jsonEntry("data/system.json", project.system),
    jsonEntry("data/switches.json", project.switches),
    jsonEntry("data/variables.json", project.variables),
    jsonEntry("data/common-events.json", project.commonEvents),
    jsonEntry("data/assets.json", project.assets),
    jsonEntry("data/resource-profiles.json", project.resourceProfiles),
    jsonEntry("maps/mapTree.json", project.mapTree),
    ...maps.map((map) => jsonEntry(`maps/${safeFileName(map.id)}.json`, map)),
  ];
}

/** 토스트에 보이는 소재 id. 읽기 오류는 프로젝트 폴더 경로를 담을 수 있어 `cause` 에만 둔다. */
function shownUploadedAssetId(id: string): string {
  const compact = id.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  const shown = compact.length > 120 ? `${compact.slice(0, 120)}…` : compact;
  return shown.length > 0 ? shown : "(이름 없음)";
}

function readPackageEntry(bytes: Uint8Array, name: string): Uint8Array | null {
  try {
    return readStoredZipEntry(bytes, name);
  } catch (error) {
    if (error instanceof ZipFormatError) throw new ProjectPackageError(error.message);
    throw error;
  }
}

function jsonEntry(name: string, value: unknown): ZipEntry {
  return textEntry(name, JSON.stringify(value, null, 2));
}

function textEntry(name: string, text: string): ZipEntry {
  return { name, bytes: encoder.encode(text) };
}

function safeFileName(value: string): string {
  const safe = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, "-");
  return safe || "oprn-project";
}
