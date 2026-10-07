// src/editor/assetStore/storeUpload.ts
/** 에디터에서 올리기: 프로젝트의 타일셋·에셋을 골라 팩으로 묶는다. 서버 전송은 메인 프로세스가 한다. */
import { STORE_ASSET_KINDS, STORE_TILE_SIZE, packGrade, storeImageSizeProblem, type StoreAssetKind, type StoreGrade } from "@/assetStore/format";
import { buildPack, closeSelection, type BuiltPack, type PackMeta, type PackSelection } from "@/assetStore/pack";
import { base64ToBytes, dataUrlParts } from "@/assetStore/sniff";
import { uploadedAssetBytes } from "@/project/persistence/assetAccessors";
import type { Project, TilesetDef, UploadedAsset } from "@/project/types";

export interface UploadCandidate {
  readonly kind: "tileset" | "asset";
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  /** 참고문서가 있어 「조수 사용 가능」이 되는 타일셋. */
  readonly withReferences: boolean;
  /** 다른 사람이 만든 것을 다시 올리지 않도록, 스토어에서 받은 것은 고를 수 없다. */
  readonly fromStore: boolean;
  readonly blocked: string | null;
}

const UPLOADABLE: ReadonlySet<string> = new Set(STORE_ASSET_KINDS);
/** 남이 만든 유료·제3자 팩 계열(2026-10-06 결정: Rasak·REFMAP·MV 팩·PAW 제외). 이름·id 로 막는 안전장치일 뿐, 권리 확인은 올리는 사람 몫이다. */
const THIRD_PARTY = /\b(paw|rasak|refmap|rtp)\b|rpg ?maker|_mv_|\bmv\b|\bmz\b/i;

/** 직접 만든 것만 올린다: 공용 자료집(`shared_`)·제3자 팩 이름은 막는다. 막는 이유 문장, 괜찮으면 null. */
export function uploadBlockReason(id: string, name: string, origin: unknown): string | null {
  if (origin) return "스토어에서 받은 것은 다시 올릴 수 없습니다.";
  if (id.startsWith("shared_")) return "공용 자료집에서 온 것은 올릴 수 없습니다. 직접 만든 것만 올립니다.";
  if (THIRD_PARTY.test(`${id} ${name}`.replace(/_/g, " ")) || THIRD_PARTY.test(id)) return "제3자 팩(PAW·Rasak·REFMAP·RPG Maker 계열)은 올릴 수 없습니다.";
  return null;
}
/** 스토어 그림 규격(16×16 칸, 캐릭터 288×256 등)에 안 맞으면 이유. 크기를 모르는 에셋은 서버가 다시 본다. */
function sizeBlockReason(asset: UploadedAsset): string | null {
  const { width, height } = asset.meta;
  if (typeof width !== "number" || typeof height !== "number") return null;
  return storeImageSizeProblem(asset.kind as StoreAssetKind, width, height);
}
const referenceCount = (tileset: TilesetDef): number => (tileset.referenceDocuments ?? []).reduce((n, c) => n + c.documents.length, 0);

/** 올릴 수 있는 후보. 번들 그림을 쓰는 타일셋(직접 올린 그림이 아님)과 스토어에서 받은 것은 막는다. */
export function uploadCandidates(project: Project): UploadCandidate[] {
  const out: UploadCandidate[] = [];
  for (const tileset of Object.values(project.tilesets)) {
    if (tileset.image.type !== "uploaded") continue;
    const asset = project.assets.uploaded[tileset.image.id];
    const refs = referenceCount(tileset);
    const fromStore = Boolean(asset?.origin);
    out.push({
      kind: "tileset", id: tileset.id, name: tileset.name,
      detail: `${tileset.tileSize}px · ${tileset.count}칸${refs > 0 ? ` · 참고문서 ${refs}` : ""}`,
      withReferences: refs > 0, fromStore,
      blocked: !asset ? "그림이 프로젝트에 없습니다." : uploadBlockReason(tileset.id, tileset.name, asset.origin) ?? uploadBlockReason(asset.id, asset.name, null)
        ?? (tileset.tileSize !== STORE_TILE_SIZE ? `스토어는 ${STORE_TILE_SIZE}×${STORE_TILE_SIZE} 칸 타일셋만 받습니다(이 타일셋은 ${tileset.tileSize}px).` : sizeBlockReason(asset)),
    });
  }
  const tilesetImages = new Set(Object.values(project.tilesets).flatMap((t) => (t.image.type === "uploaded" ? [t.image.id] : [])));
  for (const asset of Object.values(project.assets.uploaded)) {
    if (tilesetImages.has(asset.id) || !UPLOADABLE.has(asset.kind)) continue;
    out.push({
      kind: "asset", id: asset.id, name: asset.name, detail: asset.kind, withReferences: false, fromStore: Boolean(asset.origin),
      blocked: uploadBlockReason(asset.id, asset.name, asset.origin) ?? sizeBlockReason(asset),
    });
  }
  return out.sort((a, b) => Number(Boolean(a.blocked)) - Number(Boolean(b.blocked)) || Number(b.withReferences) - Number(a.withReferences) || a.name.localeCompare(b.name, "ko"));
}

export function previewGrade(project: Project, selection: PackSelection): StoreGrade {
  const closed = closeSelection(project, selection);
  const tilesets = Object.fromEntries(closed.tilesetIds.map((id) => [id, project.tilesets[id]!]));
  return packGrade({ assets: {}, tilesets });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 미리보기: 타일셋 그림 → 참고문서 그림(정상·오류 예시) 순으로 최대 6장. */
async function previewBytes(project: Project, selection: PackSelection): Promise<Uint8Array[]> {
  const closed = closeSelection(project, selection);
  const out: Uint8Array[] = [];
  for (const id of closed.tilesetIds) {
    const tileset = project.tilesets[id]!;
    const asset = tileset.image.type === "uploaded" ? project.assets.uploaded[tileset.image.id] : undefined;
    if (asset) out.push(await uploadedAssetBytes(asset));
    for (const category of tileset.referenceDocuments ?? []) {
      for (const image of category.images) {
        const parts = dataUrlParts(image.dataUrl);
        if (parts && parts.mime.startsWith("image/") && out.length < 6) out.push(base64ToBytes(parts.base64));
      }
    }
  }
  return out.slice(0, 6);
}

export async function buildUploadPack(project: Project, selection: PackSelection, meta: PackMeta): Promise<BuiltPack> {
  const previews = await previewBytes(project, selection);
  return buildPack(project, selection, meta, { readAsset: uploadedAssetBytes, sha256 }, previews);
}
