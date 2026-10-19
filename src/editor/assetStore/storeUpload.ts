// src/editor/assetStore/storeUpload.ts
/** 에디터에서 올리기: 프로젝트의 타일셋·에셋을 골라 팩으로 묶는다. 서버 전송은 메인 프로세스가 한다. */
import { STORE_ASSET_KINDS, STORE_TILE_SIZE, packGrade, storeImageSizeProblem, type StoreAssetKind, type StoreGrade } from "@/assetStore/format";
import { buildPack, closeSelection, packBlockedItems, storePublishBlockReason, type BuiltPack, type PackMeta, type PackSelection } from "@/assetStore/pack";
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
/** 올리기 막는 이유(스토어에서 받은 것·공용 자료집·제3자 팩). 판정은 buildPack 과 같은 `storePublishBlockReason` 이다. */
export { storePublishBlockReason as uploadBlockReason };

/** 타일셋을 고르면 딸려 들어가는 것(그림·이식 원본·참고문서 원본) 중 처음 걸린 것의 이유. */
function closureBlockReason(project: Project, tilesetId: string): string | null {
  const first = packBlockedItems(project, { tilesetIds: [tilesetId], assetIds: [] })[0];
  if (!first) return null;
  return first.id === tilesetId ? first.reason : `딸려 들어가는 ${first.id}: ${first.reason}`;
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
      blocked: !asset ? "그림이 프로젝트에 없습니다." : closureBlockReason(project, tileset.id)
        ?? (tileset.tileSize !== STORE_TILE_SIZE ? `스토어는 ${STORE_TILE_SIZE}×${STORE_TILE_SIZE} 칸 타일셋만 받습니다(이 타일셋은 ${tileset.tileSize}px).` : sizeBlockReason(asset)),
    });
  }
  const tilesetImages = new Set(Object.values(project.tilesets).flatMap((t) => (t.image.type === "uploaded" ? [t.image.id] : [])));
  for (const asset of Object.values(project.assets.uploaded)) {
    if (tilesetImages.has(asset.id) || !UPLOADABLE.has(asset.kind)) continue;
    out.push({
      kind: "asset", id: asset.id, name: asset.name, detail: asset.kind, withReferences: false, fromStore: Boolean(asset.origin),
      blocked: storePublishBlockReason(asset.id, asset.name, asset.origin) ?? sizeBlockReason(asset),
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

const AI_MAKER_LABELS: Record<string, string> = {
  workshop: "공방", "image-generation": "그림 생성", "character-appearance": "캐릭터 외형 생성", "cutscene-art": "컷신 그림 생성",
  "original-music": "조수 작곡", "original-sound": "조수 효과음", "generated-buildings": "생성 건물", store: "스토어의 AI 생성품",
};

/** 「AI 생성」을 끌 수 없는 이유 한 줄. 스토어 창과 조수 올리기 카드가 같이 쓴다. */
export function aiMadeNote(list: readonly { name: string; by: string }[]): string {
  const shown = list.slice(0, 4).map((item) => `${item.name}(${AI_MAKER_LABELS[item.by] ?? item.by})`).join(", ");
  return `AI 가 만든 것이 들어 있어 「AI 생성」으로 올라가요: ${shown}${list.length > 4 ? ` 외 ${list.length - 4}개` : ""}`;
}

export async function buildUploadPack(project: Project, selection: PackSelection, meta: PackMeta): Promise<BuiltPack> {
  const previews = await previewBytes(project, selection);
  return buildPack(project, selection, meta, { readAsset: uploadedAssetBytes, sha256 }, previews);
}
