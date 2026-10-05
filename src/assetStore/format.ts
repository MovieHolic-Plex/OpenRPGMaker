/**
 * 에셋 스토어 팩 형식 `oprn-store-pack/1` — 서버(store-server/)·Electron 메인·에디터가 같이 쓴다.
 * 이 파일은 편집기·브라우저 모듈을 import 하지 않는다(서버 번들에 들어간다). 타입만 project 에서 빌린다.
 * 설계: docs/superpowers/specs/2026-10-06-asset-store-design.md, 위키 openwiki/asset-store.md.
 */
import type { TilesetDef, UploadedAsset } from "../project/types";

export const STORE_PACK_SCHEMA = "oprn-store-pack/1" as const;
/** 매니페스트 안의 data URL 을 대신하는 blob 자리표시. 받을 때 data URL 로 되돌린다. */
export const STORE_BLOB_PREFIX = "oprn-blob:" as const;
export const STORE_SLUG_SEPARATOR = "__" as const;

export const STORE_LICENSES = ["CC0", "CC-BY-4.0", "CC-BY-SA-4.0", "OPRN-GAME"] as const;
export type StoreLicense = (typeof STORE_LICENSES)[number];
export const STORE_LICENSE_LABELS: Readonly<Record<StoreLicense, string>> = {
  "CC0": "CC0 — 조건 없이 자유 사용",
  "CC-BY-4.0": "CC BY 4.0 — 저작자 표기 후 자유 사용",
  "CC-BY-SA-4.0": "CC BY-SA 4.0 — 저작자 표기, 같은 조건으로 공유",
  "OPRN-GAME": "OPRN 게임 사용 — 게임 안에서는 자유, 원본 파일 재배포 금지",
};

export const STORE_ITEM_KINDS = ["tileset", "character", "face", "battler", "picture", "music", "sound", "pack"] as const;
export type StoreItemKind = (typeof STORE_ITEM_KINDS)[number];
export const STORE_KIND_LABELS: Readonly<Record<StoreItemKind, string>> = {
  tileset: "타일셋", character: "캐릭터", face: "얼굴", battler: "전투 그림",
  picture: "그림", music: "음악", sound: "효과음", pack: "묶음",
};

/** 등급: 참고문서가 있는 타일셋이 하나라도 있으면 pack(「조수 사용 가능」). 서버가 판정한다. */
export type StoreGrade = "single" | "pack";
export type StoreItemStatus = "pending" | "visible" | "hidden" | "removed";

export const STORE_BLOB_MIMES = ["image/png", "image/jpeg", "image/webp", "audio/ogg", "audio/mpeg", "audio/wav", "audio/mp4"] as const;
export type StoreBlobMime = (typeof STORE_BLOB_MIMES)[number];

export const STORE_LIMITS = {
  /** 매니페스트 JSON 바이트(자리표시로 바꾼 뒤). 칸 2만 개짜리 타일셋 정의(버들항 8.7MB)와 참고문서 MD 가 이 안에 든다. */
  manifestBytes: 24 * 1024 * 1024,
  blobBytes: 32 * 1024 * 1024,
  packBytes: 160 * 1024 * 1024,
  blobs: 512,
  assets: 256,
  tilesets: 32,
  previews: 6,
  title: 80,
  summary: 160,
  description: 8000,
  credits: 400,
  tags: 12,
  tagLength: 24,
} as const;

/** 에디터 UploadedAsset.kind 중 스토어로 오갈 수 있는 것. */
export const STORE_ASSET_KINDS = [
  "tileset", "sprite", "chipset", "charset", "faceset", "battle", "battleCharset", "battleWeapon",
  "backdrop", "monster", "picture", "title", "gameOver", "system", "system2", "music", "sound",
] as const;
export type StoreAssetKind = (typeof STORE_ASSET_KINDS)[number];

export interface StoreBlobRef { readonly sha256: string; readonly mime: StoreBlobMime; readonly bytes: number }

export interface StorePackAsset {
  id: string;
  name: string;
  kind: StoreAssetKind;
  blob: string;
  mime: StoreBlobMime;
  meta: UploadedAsset["meta"];
}

export interface StorePackContent {
  assets: Record<string, StorePackAsset>;
  tilesets: Record<string, TilesetDef>;
}

export interface StorePackManifest {
  schema: typeof STORE_PACK_SCHEMA;
  title: string;
  summary: string;
  description: string;
  tags: string[];
  kind: StoreItemKind;
  license: StoreLicense;
  aiGenerated: boolean;
  credits: string;
  content: StorePackContent;
  previews: string[];
  blobs: StoreBlobRef[];
}

/** 프로젝트에 넣은 스토어 에셋의 출처. UploadedAsset.origin 에 남고 크레딧이 여기서 만들어진다. */
export interface StoreAssetOrigin {
  store: string;
  itemSlug: string;
  version: number;
  title: string;
  author: string;
  license: StoreLicense;
  aiGenerated: boolean;
  credits: string;
  url: string;
}

/** 목록·상세 응답(서버 → 앱). */
export interface StoreItemSummary {
  slug: string;
  title: string;
  summary: string;
  kind: StoreItemKind;
  grade: StoreGrade;
  license: StoreLicense;
  aiGenerated: boolean;
  author: string;
  tags: string[];
  latestVersion: number;
  cover: string | null;
  downloads: number;
  updatedAt: string;
}
export interface StoreItemDetail extends StoreItemSummary {
  description: string;
  credits: string;
  previews: string[];
  status: StoreItemStatus;
  versions: { version: number; createdAt: string; manifestSha256: string; bytes: number }[];
  counts: { tilesets: number; assets: number; referenceDocuments: number };
}
export interface StoreCatalogPage { items: StoreItemSummary[]; total: number; page: number; pageSize: number }

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const SHA256 = /^[0-9a-f]{64}$/;
const ASSET_ID = /^[A-Za-z0-9_.:-]{1,120}$/;
export const STORE_SLUG = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export const isSha256 = (value: unknown): value is string => typeof value === "string" && SHA256.test(value);
export const blobPlaceholder = (sha256: string): string => `${STORE_BLOB_PREFIX}${sha256}`;
export function placeholderSha(value: string): string | null {
  if (!value.startsWith(STORE_BLOB_PREFIX)) return null;
  const sha = value.slice(STORE_BLOB_PREFIX.length);
  return isSha256(sha) ? sha : null;
}

/** 값 안의 모든 문자열을 훑어 blob 자리표시의 sha 를 모은다. */
export function collectPlaceholders(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    const sha = placeholderSha(value);
    if (sha) into.add(sha);
  } else if (Array.isArray(value)) {
    for (const item of value) collectPlaceholders(item, into);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectPlaceholders(item, into);
  }
  return into;
}

/** 값 안의 문자열을 바꿔 새 값을 만든다(원본은 그대로). */
export function mapStrings(value: unknown, fn: (text: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, fn)]));
  }
  return value;
}

const ROMAN_INITIAL = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const ROMAN_MEDIAL = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const ROMAN_FINAL = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

/** 한글 음절을 국어의 로마자 표기법(단순화: 음운 변화 없음)으로 옮긴다. 주소 조각용. */
export function romanizeHangul(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0)! - 0xac00;
    if (code < 0 || code > 11171) { out += char; continue; }
    out += ROMAN_INITIAL[Math.floor(code / 588)]! + ROMAN_MEDIAL[Math.floor((code % 588) / 28)]! + ROMAN_FINAL[code % 28]!;
  }
  return out;
}

/** 이름·제목에서 URL 조각을 만든다. 한글은 로마자로 옮기고, 남는 것이 없으면 item- 으로 시작한다. */
export function slugify(title: string, suffix: string): string {
  const base = romanizeHangul(title.normalize("NFC")).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  const tail = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "item";
  return base.length >= 3 ? `${base}-${tail}` : `item-${tail}`;
}

/** 프로젝트에 넣을 때의 id. 같은 상품의 다음 판본이 같은 id 를 덮어써 맵 참조가 유지된다. */
export const storeProjectId = (slug: string, originalId: string): string => `store_${slug.replace(/-/g, "_")}${STORE_SLUG_SEPARATOR}${originalId}`;

export function packGrade(content: StorePackContent): StoreGrade {
  return Object.values(content.tilesets).some((tileset) => (tileset.referenceDocuments ?? []).some((category) => category.documents.length > 0))
    ? "pack"
    : "single";
}

export function referenceDocumentCount(content: StorePackContent): number {
  return Object.values(content.tilesets).reduce((sum, tileset) => sum + (tileset.referenceDocuments ?? []).reduce((n, c) => n + c.documents.length, 0), 0);
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown, max: number, min = 0): value is string => typeof value === "string" && value.length >= min && value.length <= max;
const includes = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);

/** 타일셋이 가리키는 업로드 에셋 id(그림·이식 원본). 번들 칩셋 이름은 받는 쪽 편집기에도 있으므로 뺀다. */
export function tilesetUploadedAssetIds(tileset: TilesetDef, assetIds: ReadonlySet<string>): string[] {
  const ids = new Set<string>();
  if (tileset.image?.type === "uploaded") ids.add(tileset.image.id);
  for (const graft of tileset.tileGrafts ?? []) if (assetIds.has(graft.sourceChipset)) ids.add(graft.sourceChipset);
  return [...ids];
}

/**
 * 매니페스트 구조 검증. blob 바이트 검증(시그니처·해시)은 서버가 따로 한다.
 * 실패 문구는 사람이 읽는 한국어다 — 업로드 화면·에디터에 그대로 보인다.
 */
export function validateManifest(input: unknown): Validation<StorePackManifest> {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["매니페스트가 JSON 객체가 아닙니다."] };
  const m = input;
  if (m.schema !== STORE_PACK_SCHEMA) errors.push(`schema 는 ${STORE_PACK_SCHEMA} 이어야 합니다.`);
  if (!isString(m.title, STORE_LIMITS.title, 2)) errors.push(`제목은 2~${STORE_LIMITS.title}자여야 합니다.`);
  if (!isString(m.summary, STORE_LIMITS.summary)) errors.push(`한 줄 소개는 ${STORE_LIMITS.summary}자 이하여야 합니다.`);
  if (!isString(m.description, STORE_LIMITS.description)) errors.push(`설명은 ${STORE_LIMITS.description}자 이하여야 합니다.`);
  if (!isString(m.credits, STORE_LIMITS.credits)) errors.push(`크레딧 표기는 ${STORE_LIMITS.credits}자 이하여야 합니다.`);
  if (!Array.isArray(m.tags) || m.tags.length > STORE_LIMITS.tags || !m.tags.every((tag) => isString(tag, STORE_LIMITS.tagLength, 1))) {
    errors.push(`태그는 ${STORE_LIMITS.tags}개 이하, 각 ${STORE_LIMITS.tagLength}자 이하여야 합니다.`);
  }
  if (!includes(STORE_ITEM_KINDS, m.kind)) errors.push("종류가 올바르지 않습니다.");
  if (!includes(STORE_LICENSES, m.license)) errors.push("라이선스를 골라야 합니다.");
  if (typeof m.aiGenerated !== "boolean") errors.push("AI 생성 여부(aiGenerated)를 밝혀야 합니다.");

  const blobs = new Map<string, StoreBlobRef>();
  if (!Array.isArray(m.blobs) || m.blobs.length === 0 || m.blobs.length > STORE_LIMITS.blobs) {
    errors.push(`blob 목록은 1~${STORE_LIMITS.blobs}개여야 합니다.`);
  } else {
    let total = 0;
    for (const raw of m.blobs) {
      if (!isRecord(raw) || !isSha256(raw.sha256) || !includes(STORE_BLOB_MIMES, raw.mime) || !Number.isSafeInteger(raw.bytes) || (raw.bytes as number) <= 0 || (raw.bytes as number) > STORE_LIMITS.blobBytes) {
        errors.push("blob 항목은 sha256·허용 형식·32MB 이하 크기를 가져야 합니다.");
        continue;
      }
      if (blobs.has(raw.sha256)) errors.push(`같은 blob 이 두 번 적혔습니다: ${raw.sha256.slice(0, 12)}`);
      blobs.set(raw.sha256, { sha256: raw.sha256, mime: raw.mime, bytes: raw.bytes as number });
      total += raw.bytes as number;
    }
    if (total > STORE_LIMITS.packBytes) errors.push("팩 전체 크기가 160MB 를 넘습니다.");
  }

  const content = isRecord(m.content) ? m.content : null;
  if (!content || !isRecord(content.assets) || !isRecord(content.tilesets)) {
    errors.push("content.assets 와 content.tilesets 가 있어야 합니다.");
  } else {
    const assets = content.assets as Record<string, unknown>;
    const tilesets = content.tilesets as Record<string, unknown>;
    const assetIds = new Set(Object.keys(assets));
    if (assetIds.size === 0) errors.push("에셋이 하나도 없습니다.");
    if (assetIds.size > STORE_LIMITS.assets) errors.push(`에셋은 ${STORE_LIMITS.assets}개 이하여야 합니다.`);
    if (Object.keys(tilesets).length > STORE_LIMITS.tilesets) errors.push(`타일셋은 ${STORE_LIMITS.tilesets}개 이하여야 합니다.`);
    for (const [id, raw] of Object.entries(assets)) {
      if (!ASSET_ID.test(id) || !isRecord(raw) || raw.id !== id) { errors.push(`에셋 id 가 올바르지 않습니다: ${id.slice(0, 40)}`); continue; }
      if (!isString(raw.name, 120, 1)) errors.push(`에셋 ${id} 의 이름이 없습니다.`);
      if (!includes(STORE_ASSET_KINDS, raw.kind)) errors.push(`에셋 ${id} 의 종류가 올바르지 않습니다.`);
      if (!isSha256(raw.blob) || !blobs.has(raw.blob)) errors.push(`에셋 ${id} 의 blob 이 목록에 없습니다.`);
      else if (blobs.get(raw.blob)!.mime !== raw.mime) errors.push(`에셋 ${id} 의 형식이 blob 과 다릅니다.`);
      if (!isRecord(raw.meta)) errors.push(`에셋 ${id} 의 meta 가 없습니다.`);
    }
    for (const [id, raw] of Object.entries(tilesets)) {
      if (!ASSET_ID.test(id) || !isRecord(raw) || raw.id !== id) { errors.push(`타일셋 id 가 올바르지 않습니다: ${id.slice(0, 40)}`); continue; }
      const tileset = raw as unknown as TilesetDef;
      if (!isRecord(tileset.image) || (tileset.image.type !== "uploaded" && tileset.image.type !== "bundled") || typeof tileset.image.id !== "string") {
        errors.push(`타일셋 ${id} 의 그림 참조가 없습니다.`);
      } else if (tileset.image.type === "uploaded" && !assetIds.has(tileset.image.id)) {
        errors.push(`타일셋 ${id} 의 그림(${tileset.image.id})이 팩에 없습니다.`);
      }
      if (![16, 24, 32, 48].includes(tileset.tileSize) || !Number.isSafeInteger(tileset.count) || tileset.count <= 0 || !Number.isSafeInteger(tileset.tilesPerRow) || tileset.tilesPerRow <= 0) {
        errors.push(`타일셋 ${id} 의 칸 크기·칸 수가 올바르지 않습니다.`);
      }
      if (!Array.isArray(tileset.passability) || !Array.isArray(tileset.priority)) errors.push(`타일셋 ${id} 의 통행·층 정보가 없습니다.`);
      if (tileset.referenceSourceTilesetId !== undefined && !Object.hasOwn(tilesets, tileset.referenceSourceTilesetId)) {
        errors.push(`타일셋 ${id} 이 팩 밖의 참고문서(${tileset.referenceSourceTilesetId})를 가리킵니다.`);
      }
    }
    for (const sha of collectPlaceholders(content)) if (!blobs.has(sha)) errors.push(`자리표시 blob 이 목록에 없습니다: ${sha.slice(0, 12)}`);
    // 쓰지 않는 blob 은 받지 않는다 — 몰래 끼운 파일을 막는다.
    const used = new Set<string>([...Object.values(assets).map((a) => (a as StorePackAsset).blob), ...collectPlaceholders(content)]);
    if (Array.isArray(m.previews)) for (const p of m.previews) if (typeof p === "string") used.add(p);
    for (const sha of blobs.keys()) if (!used.has(sha)) errors.push(`쓰이지 않는 blob 이 있습니다: ${sha.slice(0, 12)}`);
  }

  // 그림이 든 팩은 표지가 있어야 한다. 음원만 든 팩은 표지 없이 올 수 있다(화면이 음표로 대신한다).
  const hasImage = Array.isArray(m.blobs) && m.blobs.some((b) => isRecord(b) && typeof b.mime === "string" && b.mime.startsWith("image/"));
  if (!Array.isArray(m.previews) || m.previews.length > STORE_LIMITS.previews || (hasImage && m.previews.length === 0)) {
    errors.push(`미리보기는 ${hasImage ? 1 : 0}~${STORE_LIMITS.previews}장이어야 합니다.`);
  } else {
    for (const sha of m.previews) {
      const blob = isSha256(sha) ? blobs.get(sha) : undefined;
      if (!blob || !blob.mime.startsWith("image/")) errors.push("미리보기는 팩 안의 그림 blob 이어야 합니다.");
    }
  }
  // 문자열 안에 data URL 이 남아 있으면 안 된다(전부 blob 으로 빼야 한다). 크기 제한을 우회하는 길이다.
  if (content && JSON.stringify(content).includes('"data:')) errors.push("매니페스트에 data: URL 이 남아 있습니다. blob 으로 빼야 합니다.");
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: m as unknown as StorePackManifest };
}
