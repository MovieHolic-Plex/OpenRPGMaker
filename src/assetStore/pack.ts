/**
 * 팩 만들기(프로젝트 → 매니페스트 + blob)와 넣기(매니페스트 + blob → 프로젝트), 크레딧.
 * 순수 함수다. 바이트 읽기·해시는 호출하는 쪽이 넘긴다(렌더러는 crypto.subtle, 서버는 node:crypto).
 */
import type { CharacterAppearanceRecord, CharsetLabelOverride, PassFlag, Project, TilesetDef, UploadedAsset } from "../project/types";
import {
  STORE_ASSET_KINDS,
  STORE_BLOB_MIMES,
  STORE_LIMITS,
  STORE_PACK_SCHEMA,
  blobPlaceholder,
  mapStrings,
  placeholderSha,
  storeImageHasSpec,
  storeImageSizeProblem,
  storeThirdPartyName,
  storeProjectId,
  tilesetUploadedAssetIds,
  validateManifest,
  type StoreAssetKind,
  type StoreAssetOrigin,
  type StoreBlobMime,
  type StoreItemKind,
  type StoreLicense,
  type StorePackAsset,
  type StorePackCharacter,
  type StorePackManifest,
  type StorePackObject,
} from "./format";
import { validateObjectSpec } from "../project/objectSpec";
import { base64ToBytes, bytesToBase64, dataUrlParts, pngSize, sniffMime } from "./sniff";
import { WORKSHOP_ASSET_PREFIX } from "../project/workshopTiles";

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

/** 이 자산을 AI 가 만들었으면 만든 경로, 아니면 null. 표식(generatedBy)이 생기기 전 공방 시트는 id 로 안다. */
export function aiMaker(asset: UploadedAsset): string | null {
  if (asset.generatedBy) return asset.generatedBy;
  if (asset.id.startsWith(WORKSHOP_ASSET_PREFIX)) return "workshop";
  if (asset.origin?.aiGenerated) return "store";
  return null;
}

/**
 * 팩에 실제로 들어갈 자산(타일셋 그림·이식 시트 포함) 중 AI 가 만든 것.
 * 하나라도 있으면 「AI 생성」을 끌 수 없다 — 조수 제안·스토어 창·buildPack 이 같은 판정을 쓴다.
 */
export function aiMadeAssets(project: Project, selection: PackSelection): { id: string; name: string; by: string }[] {
  return closeSelection(project, selection).assetIds.flatMap((id) => {
    const asset = project.assets.uploaded[id]!;
    const by = aiMaker(asset);
    return by ? [{ id, name: asset.name, by }] : [];
  });
}

export interface PackBlockedItem { readonly id: string; readonly kind: "asset" | "tileset"; readonly reason: string }

/** 팩이 끌고 들어오는 것 중 올릴 수 없는 것이 있을 때. 화면은 blocked 를 목록으로 보여 준다. */
export class StorePackBlockedError extends Error {
  constructor(readonly blocked: readonly PackBlockedItem[]) {
    super(`스토어에 올릴 수 없는 것이 팩에 딸려 들어갑니다: ${blocked.map((item) => `${item.id} — ${item.reason}`).join(" / ")}`);
    this.name = "StorePackBlockedError";
  }
}

/**
 * 직접 만든 것만 올린다: 스토어에서 받은 것(원작자·라이선스를 지키려고)·공용 자료집(`shared_`)·제3자 팩 이름은 막는다.
 * 막는 이유 문장, 괜찮으면 null. 올리기 화면 후보와 buildPack 이 같은 판정을 쓴다.
 */
export function storePublishBlockReason(id: string, name: string, origin: unknown): string | null {
  // 공방이 가져온 생성기 묶음(출처 store = local:<생성기>) — 생성기 자신의 검사·올리기(3/4 관문 포함)로 올린다.
  const originStore = (origin as { store?: unknown } | null | undefined)?.store;
  if (typeof originStore === "string" && originStore.startsWith("local:")) return "생성기에서 가져온 묶음은 그 생성기에서 검사를 거쳐 올려 주세요.";
  if (origin) return "스토어에서 받은 것은 다시 올릴 수 없습니다(원작자·라이선스는 그 상품에 남습니다).";
  // 공방 그림은 3/4 시점 관문 영수증이 아직 배선되지 않았다 — 번들·공용·스토어 출구는 예외 없이 막는다(AGENTS.md, object-gate).
  if (id.startsWith(WORKSHOP_ASSET_PREFIX)) return "공방에서 그린 그림은 3/4 시점 검사를 통과해야 공용에 올릴 수 있어요. 지금은 이 게임에서만 써요.";
  if (id.startsWith("shared_")) return "공용 자료집에서 온 것은 올릴 수 없습니다. 직접 만든 것만 올립니다.";
  const word = storeThirdPartyName(id) ?? storeThirdPartyName(name);
  return word ? `제3자 팩(PAW·Rasak·REFMAP·RPG Maker 계열 「${word}」)은 올릴 수 없습니다.` : null;
}

/**
 * 고른 것과 그 의존(타일셋 그림·이식 원본·참고문서 원본 타일셋·번들 이식 칩셋 이름) 전부에서 올릴 수 없는 것.
 * 고른 것만 보면 이식 원본이나 참고문서 원본으로 제3자·스토어 그림이 몰래 딸려 간다(2026-10-20 감사).
 */
export function packBlockedItems(project: Project, selection: PackSelection): PackBlockedItem[] {
  const closed = closeSelection(project, selection);
  const uploaded = project.assets.uploaded;
  const blocked: PackBlockedItem[] = [];
  for (const id of closed.tilesetIds) {
    const tileset = project.tilesets[id];
    if (!tileset) continue;
    const bundledNames = [
      ...(tileset.image.type === "bundled" ? [tileset.image.id] : []),
      ...(tileset.tileGrafts ?? []).map((graft) => graft.sourceChipset).filter((key) => !Object.hasOwn(uploaded, key)),
    ];
    const bundledWord = bundledNames.map((name) => storeThirdPartyName(name)).find((word) => word !== null);
    const reason = storePublishBlockReason(id, tileset.name, null)
      ?? (bundledWord ? `제3자 팩 칩셋(「${bundledWord}」)을 씁니다.` : null);
    if (reason) blocked.push({ id, kind: "tileset", reason });
  }
  for (const id of closed.assetIds) {
    const asset = uploaded[id];
    const reason = asset ? storePublishBlockReason(id, asset.name, asset.origin) : null;
    if (reason) blocked.push({ id, kind: "asset", reason });
  }
  return blocked;
}

/**
 * 프로젝트의 타일셋·에셋을 스토어 팩으로 묶는다. 매니페스트 안의 data URL 은 전부 blob 자리표시로 뺀다.
 * AI 가 만든 자산이 들어 있으면 meta.aiGenerated 가 false 여도 true 로 올린다.
 * previews 가 비면 첫 그림 에셋을 표지로 쓴다.
 */
export async function buildPack(project: Project, selection: PackSelection, meta: PackMeta, io: PackBuildIo, previews: readonly Uint8Array[] = []): Promise<BuiltPack> {
  const closed = closeSelection(project, selection);
  if (closed.missing.length > 0) throw new Error(`팩에 넣을 항목을 찾지 못했습니다: ${closed.missing.join(", ")}`);
  const blocked = packBlockedItems(project, selection);
  if (blocked.length > 0) throw new StorePackBlockedError(blocked);
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
  const objects = packObjects(tilesets);
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
    aiGenerated: meta.aiGenerated || closed.assetIds.some((id) => aiMaker(project.assets.uploaded[id]!) !== null),
    credits: meta.credits.trim(),
    content: { assets, tilesets, ...(characters.length > 0 ? { characters } : {}), ...(objects.length > 0 ? { objects } : {}) },
    previews: previewShas.slice(0, 6),
    blobs: [...blobs].map(([sha256, blob]) => ({ sha256, mime: blob.mime, bytes: blob.bytes.byteLength })),
  };
  return { manifest, blobs };
}

/**
 * 팩 타일셋들의 구조 킷 중 설명서(spec, ObjectSpec v1)가 있는 것 → content.objects. 정본은 킷의 spec 이고 이건 사본이다.
 * 설명서 검사를 통과한 것만 넣는다. 옛 공방 태그 킷은 불러올 때 설명서로 옮겨지므로(attachWorkshopTiles) 여기서 다시 짐작하지 않는다.
 */
export function packObjects(tilesets: Readonly<Record<string, TilesetDef>>): StorePackObject[] {
  const out: StorePackObject[] = [];
  for (const [key, tileset] of Object.entries(tilesets)) {
    for (const kit of tileset.structureKits ?? []) {
      if (!kit.spec || kit.spec.id !== kit.id || !validateObjectSpec(kit.spec).ok) continue;
      out.push({ tileset: key, kit: kit.id, spec: structuredClone(kit.spec) });
      if (out.length >= STORE_LIMITS.objects) return out;
    }
  }
  return out;
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
  /** 같은 blob 을 두 번 base64 인코딩하지 않도록 공유하는 캐시. */
  readonly restoredDataUrls?: Map<string, string>;
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
  const restoredCache = context.restoredDataUrls ?? new Map<string, string>();
  const restore = (text: string): string => {
    const sha = placeholderSha(text);
    if (!sha) return text;
    const hit = restoredCache.get(sha);
    if (hit !== undefined) return hit;
    const bytes = context.blob(sha);
    const mime = sniffMime(bytes);
    if (!mime) throw new Error(`blob ${sha.slice(0, 12)} 의 형식을 알 수 없습니다.`);
    const encoded = dataUrlOf(bytes, mime);
    restoredCache.set(sha, encoded);
    return encoded;
  };
  // 넣기 전에 그림 크기를 본다 — 서버 업로드 검사에만 기대면 사용자가 바꾼 스토어 주소나 서버 회귀에서 깨진 타일셋이 저장된다.
  for (const packAsset of Object.values(manifest.content.assets)) {
    const size = packAsset.mime === "image/png" && storeImageHasSpec(packAsset.kind) ? pngSize(context.blob(packAsset.blob)) : null;
    const problem = size ? storeImageSizeProblem(packAsset.kind, size.width, size.height) : null;
    if (problem) throw new Error(`${packAsset.name}: ${problem}`);
  }
  for (const tileset of Object.values(manifest.content.tilesets)) {
    const image = tileset.image.type === "uploaded" && Object.hasOwn(manifest.content.assets, tileset.image.id) ? manifest.content.assets[tileset.image.id] : undefined;
    const size = image?.mime === "image/png" ? pngSize(context.blob(image.blob)) : null;
    if (size && (tileset.tilesPerRow * tileset.tileSize > size.width || Math.ceil(tileset.count / tileset.tilesPerRow) * tileset.tileSize > size.height)) {
      throw new Error(`타일셋 ${tileset.name}: 칸 수(${tileset.count}칸, 한 줄 ${tileset.tilesPerRow}칸)가 그림 ${size.width}×${size.height} 보다 큽니다.`);
    }
  }
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
  // 캐릭터 칸의 짝 초상 → 캐릭터 외형(칩·얼굴·흉상·전신 + 표정 짝). 같은 상품을 다시 넣으면 그 외형을 새 그림으로 바꾼다.
  for (const c of manifest.content.characters ?? []) {
    const record = storeAppearanceRecord(slug, c, assetIdMap);
    if (!record) continue;
    const list = project.database.characterAppearances ?? [];
    const at = list.findIndex((entry) => entry.id === record.id);
    project.database.characterAppearances = at >= 0 ? list.map((old, i) => (i === at ? { ...record, name: old.name, description: old.description } : old)) : [...list, record];
  }
  for (const [id, source] of Object.entries(manifest.content.tilesets)) {
    const existingBundled = Object.hasOwn(project.tilesets, id) ? project.tilesets[id] : undefined;
    const bundledRefUrls = new Map<string, string>();
    if (existingBundled && existingBundled.image.type === "bundled" && existingBundled.referenceDocuments?.length) {
      for (const category of existingBundled.referenceDocuments) {
        for (const image of category.images) {
          if (image.dataUrl.startsWith("/") && !image.dataUrl.startsWith("data:")) {
            bundledRefUrls.set(`${category.id}\u0000${image.id}`, image.dataUrl);
          }
        }
      }
    }
    const preparedSource = bundledRefUrls.size > 0 && source.referenceDocuments?.length
      ? {
        ...source,
        referenceDocuments: source.referenceDocuments.map((category) => ({
          ...category,
          images: category.images.map((image) => {
            const sha = placeholderSha(image.dataUrl);
            const bundledUrl = sha ? bundledRefUrls.get(`${category.id}\u0000${image.id}`) : undefined;
            if (!sha || !bundledUrl) return image;
            const bytes = context.blob(sha);
            if (!sniffMime(bytes)) throw new Error(`blob ${sha.slice(0, 12)} 의 형식을 알 수 없습니다.`);
            return { ...image, dataUrl: bundledUrl };
          }),
        })),
      }
      : source;
    const tileset = mapStrings(preparedSource, restore) as TilesetDef;
    tileset.id = tilesetIdMap.get(id)!;
    if (tileset.image.type === "uploaded") tileset.image = { type: "uploaded", id: assetIdMap.get(tileset.image.id) ?? tileset.image.id };
    if (tileset.tileGrafts) tileset.tileGrafts = tileset.tileGrafts.map((graft) => ({ ...graft, sourceChipset: assetIdMap.get(graft.sourceChipset) ?? graft.sourceChipset }));
    if (tileset.referenceSourceTilesetId) tileset.referenceSourceTilesetId = tilesetIdMap.get(tileset.referenceSourceTilesetId) ?? tileset.referenceSourceTilesetId;
    // 기물 설명서: 킷에 spec 이 없고 팩 목록(content.objects)에만 있으면 킷에 붙인다(tile-gen 이 목록만 채운 팩).
    for (const object of manifest.content.objects ?? []) {
      if (object.tileset !== id) continue;
      const kit = tileset.structureKits?.find((k) => k.id === object.kit);
      if (kit && !kit.spec && validateObjectSpec(object.spec).ok) kit.spec = structuredClone(object.spec);
    }
    project.tilesets[tileset.id] = tileset;
  }
  return { assetIds: [...assetIdMap.values()], tilesetIds: [...tilesetIdMap.values()], replaced };
}

/** 스토어 캐릭터 칸이 만드는 외형 id. */
export const storeAppearanceId = (slug: string, asset: string, characterIndex: number): string => storeProjectId(slug, `appearance-${asset}-${characterIndex}`);

/** 짝 초상이 있는 캐릭터 칸 → 외형 레코드(없으면 null). 프로젝트 id 로 바꾼 에셋만 가리킨다. */
export function storeAppearanceRecord(slug: string, c: StorePackCharacter, assetIdMap: ReadonlyMap<string, string>): CharacterAppearanceRecord | null {
  const por = c.portraits;
  const charset = assetIdMap.get(c.asset);
  if (!por || !charset) return null;
  const mapOf = (raw: Partial<Record<string, string>> | undefined): Partial<Record<string, string>> | undefined => {
    const entries = Object.entries(raw ?? {}).flatMap(([name, id]) => (id && assetIdMap.has(id) ? [[name, assetIdMap.get(id)!] as const] : []));
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };
  const bust = mapOf(por.bust);
  const full = mapOf(por.full);
  const face = por.face ? assetIdMap.get(por.face) : undefined;
  if (!bust && !full && !face) return null;
  return {
    id: storeAppearanceId(slug, c.asset, c.characterIndex),
    name: c.label,
    description: c.appearance ?? "",
    charset: { resourceId: charset, characterIndex: c.characterIndex },
    ...(face ? { face: { resourceId: face } } : {}),
    ...(bust?.base ? { bust: { resourceId: bust.base } } : {}),
    ...(full?.base ? { full: { resourceId: full.base } } : {}),
    ...(bust || full ? { portraitExpressions: { ...(bust ? { bust } : {}), ...(full ? { full } : {}) } } : {}),
  };
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

export const STORE_BUNDLE_MAGIC = "OPK1" as const;
const BUNDLE_MAGIC_BYTES = [0x4f, 0x50, 0x4b, 0x31] as const;

export interface DecodedPackBundle {
  readonly manifest: StorePackManifest;
  readonly blobs: Map<string, Uint8Array>;
}

/**
 * 매니페스트와 blob 전체를 단일 바이너리 팩(`OPK1`, `.oprn-pack`) 한 덩어리로 묶는다.
 * 형식: `[4B "OPK1"][4B uint32BE manifestBytes.byteLength][manifest JSON UTF-8][manifest.blobs 순서대로 이어 붙인 원본 바이트]`.
 */
export function encodePackBundle(manifest: StorePackManifest, blob: (sha256: string) => Uint8Array): Uint8Array {
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  let blobsByteLength = 0;
  const parts: Uint8Array[] = [];
  for (const entry of manifest.blobs) {
    const bytes = blob(entry.sha256);
    if (bytes.byteLength !== entry.bytes) {
      throw new Error(`blob ${entry.sha256.slice(0, 12)} 길이가 매니페스트(${entry.bytes})와 다릅니다(${bytes.byteLength}).`);
    }
    parts.push(bytes);
    blobsByteLength += bytes.byteLength;
  }
  const out = new Uint8Array(8 + manifestBytes.byteLength + blobsByteLength);
  out.set(BUNDLE_MAGIC_BYTES, 0);
  new DataView(out.buffer, out.byteOffset, out.byteLength).setUint32(4, manifestBytes.byteLength, false);
  out.set(manifestBytes, 8);
  let offset = 8 + manifestBytes.byteLength;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/** 단일 바이너리 팩(`OPK1`)을 풀어 매니페스트와 각 blob 의 형식·길이를 검증한다. */
export function decodePackBundle(
  bundle: Uint8Array,
  verifySha256?: (bytes: Uint8Array) => string,
  decompressManifest?: (bytes: Uint8Array) => Uint8Array,
): DecodedPackBundle {
  if (bundle.byteLength < 8 || BUNDLE_MAGIC_BYTES.some((b, i) => bundle[i] !== b)) {
    throw new Error("올바른 OPRN 팩 번들(OPK1) 형식이 아닙니다.");
  }
  const manifestLength = new DataView(bundle.buffer, bundle.byteOffset, bundle.byteLength).getUint32(4, false);
  if (manifestLength === 0 || manifestLength > STORE_LIMITS.manifestBytes || 8 + manifestLength > bundle.byteLength) {
    throw new Error("팩 번들의 매니페스트 길이가 올바르지 않습니다.");
  }
  const rawManifestBytes = bundle.subarray(8, 8 + manifestLength);
  const isGzip = rawManifestBytes.byteLength >= 2 && rawManifestBytes[0] === 0x1f && rawManifestBytes[1] === 0x8b;
  const manifestBytes = isGzip && decompressManifest ? decompressManifest(rawManifestBytes) : rawManifestBytes;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    throw new Error("팩 번들의 매니페스트 JSON 을 읽지 못했습니다.");
  }
  const checked = validateManifest(parsed);
  if (!checked.ok) throw new Error(`팩 매니페스트가 올바르지 않습니다: ${checked.errors.join(", ")}`);
  const manifest = checked.value;
  let cursor = 8 + manifestLength;
  const blobs = new Map<string, Uint8Array>();
  for (const entry of manifest.blobs) {
    if (cursor + entry.bytes > bundle.byteLength) {
      throw new Error(`blob ${entry.sha256.slice(0, 12)} 바이트가 잘렸습니다.`);
    }
    const slice = bundle.subarray(cursor, cursor + entry.bytes);
    cursor += entry.bytes;
    if (sniffMime(slice) !== entry.mime) {
      throw new Error(`blob ${entry.sha256.slice(0, 12)} 의 실제 형식이 매니페스트(${entry.mime})와 다릅니다.`);
    }
    if (verifySha256 && verifySha256(slice) !== entry.sha256) {
      throw new Error(`blob ${entry.sha256.slice(0, 12)} 의 해시가 맞지 않습니다.`);
    }
    blobs.set(entry.sha256, slice);
  }
  if (cursor !== bundle.byteLength) {
    throw new Error("팩 번들 끝에 남는 바이트가 있습니다.");
  }
  return { manifest, blobs };
}
