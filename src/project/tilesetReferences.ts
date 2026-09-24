import type { Project, TilesetDef } from "./types";

/** Authored, portable reference material. Image bytes travel with the project. */
export interface TilesetReferenceDocument { id: string; name: string; markdown: string }
export interface TilesetReferenceImage { id: string; name: string; caption: string; dataUrl: string }
export interface TilesetReferenceCategory {
  id: string;
  name: string;
  description: string;
  documents: TilesetReferenceDocument[];
  images: TilesetReferenceImage[];
}
export const REFERENCE_LIMITS = { categories: 32, documents: 64, images: 256, markdown: 120_000, imageBytes: 4_000_000 } as const;
export const REFERENCE_PAGE_SIZE = 6000;
export const REFERENCE_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/u;

export function referenceOwner(project: Project, tileset: TilesetDef): TilesetDef {
  const source = tileset.referenceSourceTilesetId;
  if (!source) return tileset;
  const owner = project.tilesets[source];
  if (!owner || owner.referenceSourceTilesetId || source === tileset.id) throw new Error("참고문서 원본 타일셋이 없거나 순환 참조입니다.");
  return owner;
}

/** Content identity, including image bytes; edits revoke previously delivered reading evidence. */
export function referenceRevision(category: TilesetReferenceCategory): string {
  const value = JSON.stringify(category);
  let a = 2166136261; let b = 5381;
  for (let i = 0; i < value.length; i++) { const c = value.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b, 33) ^ c; }
  return `${value.length}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

export function referenceManifest(category: TilesetReferenceCategory) {
  return { id: category.id, name: category.name, description: category.description, revision: referenceRevision(category),
    documents: category.documents.map(({ id, name, markdown }) => ({ id, name, characters: markdown.length })),
    images: category.images.map(({ id, name, caption }) => ({ id, name, caption })) };
}

/** Text tool listings never repeat inline pixels or full reference document bodies. */
export function referenceOwnerManifest<T extends object>(value: T) {
  const { referenceDocuments, preview, ...metadata } = value as T & { referenceDocuments?: TilesetReferenceCategory[]; preview?: string };
  return { ...metadata,
    ...(preview === undefined ? {} : preview.startsWith('data:image/') ? { previewImageAvailable: true } : { preview }),
    ...(referenceDocuments ? { referenceDocuments: referenceDocuments.map(referenceManifest) } : {}),
  };
}

export function validateTilesetReferences(value: unknown): asserts value is TilesetReferenceCategory[] {
  const fail = (message: string): never => { throw new Error(`타일 참고문서: ${message}`); };
  const list = (v: unknown, max: number): Record<string, unknown>[] => {
    if (!Array.isArray(v) || v.length > max || v.some(x => !x || typeof x !== "object" || Array.isArray(x))) fail("목록 형식/개수 오류");
    const result = v as Record<string, unknown>[];
    const ids = result.map(x => x.id);
    if (ids.some(id => typeof id !== "string" || id === "." || id === ".." || !/^[\w.-]{1,100}$/u.test(id)) || new Set(ids).size !== ids.length) fail("ID가 잘못되었거나 중복됩니다.");
    return result;
  };
  const string = (v: unknown, max: number): string => typeof v === "string" && v.length <= max ? v : fail("문자열 형식/길이 오류");
  for (const group of list(value, REFERENCE_LIMITS.categories)) {
    if (!string(group.name, 160).trim()) fail("용도 이름이 필요합니다.");
    string(group.description, 4000);
    for (const doc of list(group.documents, REFERENCE_LIMITS.documents)) {
      if (!string(doc.name, 200).trim()) fail("문서 이름이 필요합니다.");
      string(doc.markdown, REFERENCE_LIMITS.markdown);
    }
    for (const img of list(group.images, REFERENCE_LIMITS.images)) {
      if (!string(img.name, 200).trim()) fail("이미지 이름이 필요합니다.");
      string(img.caption, 4000);
      if (!REFERENCE_IMAGE_PATTERN.test(string(img.dataUrl, Math.ceil(REFERENCE_LIMITS.imageBytes * 4 / 3) + 64))) fail("PNG/JPEG/WebP 이미지 데이터가 필요합니다.");
    }
  }
}
