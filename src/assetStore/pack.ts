/**
 * 팩 만들기(프로젝트 → 매니페스트 + blob)와 넣기(매니페스트 + blob → 프로젝트), 크레딧.
 * 순수 함수다. 바이트 읽기·해시는 호출하는 쪽이 넘긴다(렌더러는 crypto.subtle, 서버는 node:crypto).
 */
import type { CharsetLabelOverride, PassFlag, Project, TilesetDef, UploadedAsset } from "../project/types";
import {
  STORE_ASSET_KINDS,
  STORE_BLOB_MIMES,
  STORE_PACK_SCHEMA,
  blobPlaceholder,
  mapStrings,
  placeholderSha,
  storeProjectId,
  tilesetUploadedAssetIds,
  type StoreAssetKind,
  type StoreAssetOrigin,
  type StoreBlobMime,
  type StoreItemKind,
  type StoreLicense,
  type StorePackAsset,
  type StorePackCharacter,
  type StorePackManifest,
} from "./format";
import { base64ToBytes, bytesToBase64, dataUrlParts, sniffMime } from "./sniff";

export interface PackBlob { readonly bytes: Uint8Array; readonly mime: StoreBlobMime }
export interface BuiltPack { readonly manifest: StorePackManifest; readonly blobs: ReadonlyMap<string, PackBlob> }

export interface PackMeta {
  title: string;
  summary: string;
  description: string;
  tags: string[];
  kind: StoreItemKind;
  license: StoreLicense;
  aiGenerated: boolean;
  credits: string;
}

export interface PackSelection { readonly tilesetIds: readonly string[]; readonly assetIds: readonly string[] }

export interface PackBuildIo {
  /** 업로드 에셋의 바이트. dataUrl 이면 풀고, 내용 주소(ref)면 저장소에서 읽는다. */
  readAsset(asset: UploadedAsset): Promise<Uint8Array>;
  sha256(bytes: Uint8Array): Promise<string>;
}

const isStoreAssetKind = (kind: string): kind is StoreAssetKind => (STORE_ASSET_KINDS as readonly string[]).includes(kind);
const isStoreMime = (mime: string): mime is StoreBlobMime => (STORE_BLOB_MIMES as readonly string[]).includes(mime);

/** 고른 타일셋과 그 의존(그림·이식 원본·공유 참고문서 원본)을 닫는다. */
export function closeSelection(project: Project, selection: PackSelection): { tilesetIds: string[]; assetIds: string[]; missing: string[] } {
  const tilesetIds = new Set<string>();
  const missing: string[] = [];
  const queue = [...selection.tilesetIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (tilesetIds.has(id)) continue;
    const tileset = project.tilesets[id];
    if (!tileset) { missing.push(`타일셋 ${id}`); continue; }
    tilesetIds.add(id);
    if (tileset.referenceSourceTilesetId) queue.push(tileset.referenceSourceTilesetId);
  }
  const uploaded = new Set(Object.keys(project.assets.uploaded));
  const assetIds = new Set<string>(selection.assetIds);
  for (const id of tilesetIds) for (const assetId of tilesetUploadedAssetIds(project.tilesets[id]!, uploaded)) assetIds.add(assetId);
  for (const id of assetIds) if (!uploaded.has(id)) missing.push(`에셋 ${id}`);
  return { tilesetIds: [...tilesetIds], assetIds: [...assetIds].filter((id) => uploaded.has(id)), missing };
}

/**
 * 프로젝트의 타일셋·에셋을 스토어 팩으로 묶는다. 매니페스트 안의 data URL 은 전부 blob 자리표시로 뺀다.
 * previews 가 비면 첫 그림 에셋을 표지로 쓴다.
 */
export async function buildPack(project: Project, selection: PackSelection, meta: PackMeta, io: PackBuildIo, previews: readonly Uint8Array[] = []): Promise<BuiltPack> {
  const closed = closeSelection(project, selection);
  if (closed.missing.length > 0) throw new Error(`팩에 넣을 항목을 찾지 못했습니다: ${closed.missing.join(", ")}`);
  const blobs = new Map<string, PackBlob>();
  const addBlob = async (bytes: Uint8Array, label: string): Promise<{ sha: string; mime: StoreBlobMime }> => {
    const mime = sniffMime(bytes);
    if (!mime) throw new Error(`${label}: 스토어가 받지 않는 파일 형식입니다(PNG·JPEG·WebP·OGG·MP3·WAV·M4A 만).`);
    const sha = await io.sha256(bytes);
    if (!blobs.has(sha)) blobs.set(sha, { bytes, mime });
    return { sha, mime };
  };
  const assets: Record<string, StorePackAsset> = {};
  for (const id of closed.assetIds) {
    const asset = project.assets.uploaded[id]!;
    if (!isStoreAssetKind(asset.kind)) throw new Error(`${asset.name}: ${asset.kind} 종류는 스토어에 올릴 수 없습니다.`);
    const { sha, mime } = await addBlob(await io.readAsset(asset), asset.name);
    assets[id] = { id, name: asset.name, kind: asset.kind, blob: sha, mime, meta: { ...asset.meta } };
  }
  const tilesets: Record<string, TilesetDef> = {};
  for (const id of closed.tilesetIds) {
    const tileset = structuredClone(project.tilesets[id]!);
    // 참고문서 그림 등 매니페스트 안의 data URL 을 blob 으로 뺀다.
    const pending: Promise<void>[] = [];
    const replacements = new Map<string, string>();
    mapStrings(tileset, (text) => {
      const parts = text.startsWith("data:") ? dataUrlParts(text) : null;
      if (parts && !replacements.has(text)) {
        replacements.set(text, "");
        pending.push(addBlob(base64ToBytes(parts.base64), `${tileset.name} 참고 그림`).then(({ sha }) => { replacements.set(text, blobPlaceholder(sha)); }));
      }
      return text;
    });
    await Promise.all(pending);
    tilesets[id] = mapStrings(tileset, (text) => replacements.get(text) ?? text) as TilesetDef;
  }
  const characters = packCharacters(project, assets);
  const previewShas: string[] = [];
  for (const bytes of previews) previewShas.push((await addBlob(bytes, "미리보기")).sha);
  if (previewShas.length === 0) {
    const cover = Object.values(assets).find((asset) => asset.mime.startsWith("image/"));
    if (cover) previewShas.push(cover.blob);
  }
  const manifest: StorePackManifest = {
    schema: STORE_PACK_SCHEMA,
    title: meta.title.trim(),
    summary: meta.summary.trim(),
    description: meta.description.trim(),
    tags: meta.tags.map((tag) => tag.trim()).filter(Boolean),
    kind: meta.kind,
    license: meta.license,
    aiGenerated: meta.aiGenerated,
    credits: meta.credits.trim(),
    content: { assets, tilesets, ...(characters.length > 0 ? { characters } : {}) },
    previews: previewShas.slice(0, 6),
    blobs: [...blobs].map(([sha256, blob]) => ({ sha256, mime: blob.mime, bytes: blob.bytes.byteLength })),
  };
  return { manifest, blobs };
}

/** 팩에 넣는 캐릭터 시트의 칸 설명(프로젝트 charsetLabels 중 그 시트 것). */
export function packCharacters(project: Project, assets: Readonly<Record<string, StorePackAsset>>): StorePackCharacter[] {
  const out: StorePackCharacter[] = [];
  for (const entry of project.charsetLabels ?? []) {
    const asset = assets[entry.textureKey];
    const label = entry.label.trim();
    if (!asset || asset.kind !== "charset" || !label || entry.characterIndex < 0 || entry.characterIndex > 7) continue;
    out.push({
      asset: entry.textureKey,
      characterIndex: entry.characterIndex,
      label,
      ...(entry.tags?.length ? { tags: [...entry.tags] } : {}),
      ...(entry.gender ? { gender: entry.gender } : {}),
      ...(entry.age ? { age: entry.age } : {}),
      ...(entry.appearance ? { appearance: entry.appearance } : {}),
    });
  }
  return out;
}

/** 낱장 그림 하나로 만드는 기본 타일셋(에디터 「타일셋 추가」와 같은 모양: 전부 통행·아래층). */
export function basicTilesetFor(assetId: string, name: string, width: number, height: number, tileSize: number): TilesetDef {
  const tilesPerRow = Math.max(1, Math.floor(width / tileSize));
  const count = Math.max(1, tilesPerRow * Math.floor(height / tileSize));
  const passability: PassFlag[] = Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true }));
  return {
    id: `ts_${assetId}`,
    name,
    kind: "custom",
    image: { type: "uploaded", id: assetId },
    tileSize,
    tilesPerRow,
    count,
    passability,
    priority: Array.from({ length: count }, () => "lower" as const),
    terrain: Array.from({ length: count }, () => 0),
  };
}

export interface ApplyContext {
  readonly slug: string;
  readonly version: number;
  readonly author: string;
  readonly storeUrl: string;
  readonly itemUrl: string;
  /** blob sha → 바이트. 메인 프로세스가 해시를 확인한 것만 들어온다. */
  readonly blob: (sha256: string) => Uint8Array;
  /**
   * 프로젝트 저장소가 이미 받아 둔 에셋(내용 주소). 있으면 dataUrl 대신 ref 로 넣는다 — 데스크톱 저장소는
   * 그림을 assets/ 에 따로 두므로 문서에 바이트를 싣지 않는다(uploadedAssetForImport 와 같은 규칙).
   */
  readonly storedRefs?: ReadonlyMap<string, NonNullable<UploadedAsset["ref"]>>;
}

export interface ApplyResult {
  readonly assetIds: string[];
  readonly tilesetIds: string[];
  /** 이미 넣은 판본을 새 판본으로 바꿨으면 true. */
  readonly replaced: boolean;
}

const dataUrlOf = (bytes: Uint8Array, mime: string): string => `data:${mime};base64,${bytesToBase64(bytes)}`;

/**
 * 팩을 프로젝트에 넣는다. id 는 storeProjectId 로 바꾸고, 자리표시는 data URL 로 되돌리고, 에셋마다 출처를 남긴다.
 * 같은 상품의 이전 판본이 있으면 같은 id 를 덮어쓴다(맵 참조 유지). 이전 판본에만 있던 항목은 지우지 않는다.
 */
export function applyPackToProject(project: Project, manifest: StorePackManifest, context: ApplyContext): ApplyResult {
  const { slug } = context;
  const assetIdMap = new Map(Object.keys(manifest.content.assets).map((id) => [id, storeProjectId(slug, id)]));
  const tilesetIdMap = new Map(Object.keys(manifest.content.tilesets).map((id) => [id, storeProjectId(slug, id)]));
  const replaced = [...assetIdMap.values()].some((id) => Object.hasOwn(project.assets.uploaded, id))
    || [...tilesetIdMap.values()].some((id) => Object.hasOwn(project.tilesets, id));
  const origin: StoreAssetOrigin = {
    store: context.storeUrl,
    itemSlug: slug,
    version: context.version,
    title: manifest.title,
    author: context.author,
    license: manifest.license,
    aiGenerated: manifest.aiGenerated,
    credits: manifest.credits,
    url: context.itemUrl,
  };
  const restore = (text: string): string => {
    const sha = placeholderSha(text);
    if (!sha) return text;
    const bytes = context.blob(sha);
    const mime = sniffMime(bytes);
    if (!mime) throw new Error(`blob ${sha.slice(0, 12)} 의 형식을 알 수 없습니다.`);
    return dataUrlOf(bytes, mime);
  };
  for (const [id, packAsset] of Object.entries(manifest.content.assets)) {
    const bytes = context.blob(packAsset.blob);
    const mime = sniffMime(bytes);
    if (!mime || !isStoreMime(mime) || mime !== packAsset.mime) throw new Error(`${packAsset.name}: 받은 파일 형식이 팩 설명과 다릅니다.`);
    const newId = assetIdMap.get(id)!;
    const ref = context.storedRefs?.get(newId);
    project.assets.uploaded[newId] = {
      id: newId,
      name: packAsset.name,
      kind: packAsset.kind,
      ...(ref ? { ref } : { dataUrl: dataUrlOf(bytes, mime) }),
      meta: { ...packAsset.meta },
      origin: { ...origin },
    };
  }
  // 캐릭터 칸 설명 → charsetLabels(업로드 시트). 저자가 그 칸에 붙인 이름은 덮지 않는다.
  for (const c of manifest.content.characters ?? []) {
    const textureKey = assetIdMap.get(c.asset);
    if (!textureKey) continue;
    const labels = project.charsetLabels ?? [];
    const at = labels.findIndex((entry) => entry.textureKey === textureKey && entry.characterIndex === c.characterIndex);
    if (at >= 0 && labels[at]!.origin === "user") continue;
    const entry: CharsetLabelOverride = {
      textureKey, characterIndex: c.characterIndex, label: c.label, origin: "ai", spriteType: "uploaded",
      ...(c.tags ? { tags: [...c.tags] } : {}), ...(c.gender ? { gender: c.gender } : {}), ...(c.age ? { age: c.age } : {}),
      ...(c.appearance ? { appearance: c.appearance } : {}),
    };
    project.charsetLabels = at >= 0 ? labels.map((old, i) => (i === at ? entry : old)) : [...labels, entry];
  }
  for (const [id, source] of Object.entries(manifest.content.tilesets)) {
    const tileset = mapStrings(source, restore) as TilesetDef;
    tileset.id = tilesetIdMap.get(id)!;
    if (tileset.image.type === "uploaded") tileset.image = { type: "uploaded", id: assetIdMap.get(tileset.image.id) ?? tileset.image.id };
    if (tileset.tileGrafts) tileset.tileGrafts = tileset.tileGrafts.map((graft) => ({ ...graft, sourceChipset: assetIdMap.get(graft.sourceChipset) ?? graft.sourceChipset }));
    if (tileset.referenceSourceTilesetId) tileset.referenceSourceTilesetId = tilesetIdMap.get(tileset.referenceSourceTilesetId) ?? tileset.referenceSourceTilesetId;
    project.tilesets[tileset.id] = tileset;
  }
  return { assetIds: [...assetIdMap.values()], tilesetIds: [...tilesetIdMap.values()], replaced };
}

/** 팩 에셋이 프로젝트에서 받을 id(넣기 전에 저장소에 미리 넣을 때 쓴다). */
export function packAssetTargets(manifest: StorePackManifest, slug: string): { id: string; asset: StorePackAsset }[] {
  return Object.entries(manifest.content.assets).map(([id, asset]) => ({ id: storeProjectId(slug, id), asset }));
}

export interface ProjectStoreItem {
  readonly slug: string;
  readonly version: number;
  readonly title: string;
  readonly origin: StoreAssetOrigin;
  readonly assetIds: string[];
  readonly tilesetIds: string[];
}

/** 프로젝트에 들어 있는 스토어 상품(에셋 출처로 판정). */
export function storeItemsInProject(project: Project): ProjectStoreItem[] {
  const items = new Map<string, { origin: StoreAssetOrigin; assetIds: string[] }>();
  for (const asset of Object.values(project.assets.uploaded)) {
    const origin = asset.origin;
    if (!origin) continue;
    const entry = items.get(origin.itemSlug);
    if (!entry) items.set(origin.itemSlug, { origin, assetIds: [asset.id] });
    else {
      entry.assetIds.push(asset.id);
      if (origin.version > entry.origin.version) entry.origin = origin;
    }
  }
  return [...items.values()].map(({ origin, assetIds }) => {
    const ids = new Set(assetIds);
    const tilesetIds = Object.values(project.tilesets).filter((t) => t.image.type === "uploaded" && ids.has(t.image.id)).map((t) => t.id);
    return { slug: origin.itemSlug, version: origin.version, title: origin.title, origin, assetIds, tilesetIds };
  }).sort((a, b) => a.title.localeCompare(b.title, "ko"));
}

/** 게임 크레딧 문장. 상품마다 한 줄. 아무것도 없으면 빈 문자열. */
export function storeCredits(project: Project): string {
  const lines = storeItemsInProject(project).map(({ origin }) => {
    const parts = [`「${origin.title}」 — ${origin.author}`, origin.license];
    if (origin.aiGenerated) parts.push("AI 생성 포함");
    const head = parts.join(" · ");
    return origin.credits ? `${head}\n  ${origin.credits}` : head;
  });
  return lines.length > 0 ? `OPRN 에셋 스토어\n${lines.join("\n")}\n` : "";
}
