// src/editor/assetStore/storeUndo.ts
/**
 * 스토어 넣기를 정확히 되돌리기 · 프로젝트에서 빼기 · 옛 판본 찌꺼기 정리. 순수 함수(Project 만 만진다).
 *
 * 되돌리기는 넣기 직전 그 키들(에셋·타일셋 id, 그 그림의 캐릭터 이름표·리소스 목록 줄)의 모습을 들고 있다가 그대로 되돌린다.
 * 새 판본으로 바꾼 넣기면 옛 판본이 되살아난다. 넣은 뒤 맵·이벤트가 그것을 쓰기 시작했으면 지우지 않고 이유를 돌려준다.
 */
import { storeProjectId, type StorePackManifest } from "@/assetStore/format";
import { storeAppearanceId } from "@/assetStore/pack";
import type { CharacterAppearanceRecord, CharsetLabelOverride, Project, ResourceProfile, TilesetDef, UploadedAsset } from "@/project/types";

export interface StoreAddSnapshot {
  readonly assets: Readonly<Record<string, UploadedAsset | null>>;
  readonly tilesets: Readonly<Record<string, TilesetDef | null>>;
  readonly labels: readonly CharsetLabelOverride[];
  readonly profiles: readonly ResourceProfile[];
  /** 짝 초상이 만든 캐릭터 외형(넣기 전 모습, 없었으면 null). 옛 되돌리기 기록에는 없다. */
  readonly appearances?: Readonly<Record<string, CharacterAppearanceRecord | null>>;
}

/** 넣기가 건드릴 키 — 매니페스트만 보고 안다(넣기 전에 잡아야 하므로). */
export function storeAddKeys(manifest: StorePackManifest, slug: string): { assetIds: string[]; tilesetIds: string[]; appearanceIds: string[] } {
  return {
    assetIds: Object.keys(manifest.content.assets).map((id) => storeProjectId(slug, id)),
    tilesetIds: Object.keys(manifest.content.tilesets).map((id) => storeProjectId(slug, id)),
    appearanceIds: (manifest.content.characters ?? []).filter((c) => c.portraits).map((c) => storeAppearanceId(slug, c.asset, c.characterIndex)),
  };
}

const isStoreAppearance = (id: string, prefix: string): boolean => id.startsWith(`${prefix}appearance-`);

/** 프로젝트 자료에서 이 외형 레코드들을 뺀 사본(쓰는 곳 검색이 외형 자신을 「쓰는 곳」으로 세지 않게). */
function withoutAppearances(project: Project, ids: ReadonlySet<string>): Project {
  if (ids.size === 0 || !project.database?.characterAppearances?.some((record) => ids.has(record.id))) return project;
  return { ...project, database: { ...project.database, characterAppearances: project.database.characterAppearances.filter((record) => !ids.has(record.id)) } };
}

export function captureStoreAdd(project: Project, keys: { assetIds: readonly string[]; tilesetIds: readonly string[]; appearanceIds?: readonly string[] }): StoreAddSnapshot {
  const assetSet = new Set(keys.assetIds);
  const own = <T>(record: Record<string, T>, id: string): T | null => (Object.hasOwn(record, id) ? structuredClone(record[id]!) : null);
  return {
    assets: Object.fromEntries(keys.assetIds.map((id) => [id, own(project.assets.uploaded, id)])),
    tilesets: Object.fromEntries(keys.tilesetIds.map((id) => [id, own(project.tilesets, id)])),
    labels: structuredClone((project.charsetLabels ?? []).filter((label) => assetSet.has(label.textureKey))),
    profiles: structuredClone(project.resourceProfiles.filter((profile) => profile.assetId !== undefined && assetSet.has(profile.assetId))),
    appearances: Object.fromEntries((keys.appearanceIds ?? []).map((id) => [id, structuredClone(project.database?.characterAppearances?.find((record) => record.id === id) ?? null)])),
  };
}

/**
 * 프로젝트에서 이 id 들을 누가 쓰는지(맵의 타일셋, 이벤트·DB 의 그림·소리 id). 쓰는 곳 이름 몇 개.
 * 스토어가 붙인 id 는 `store_<slug>__<id>` 라 우연히 겹치지 않으므로 문자열 검색으로 충분하다.
 */
export function storeItemUsages(project: Project, ids: readonly string[], ignore: ReadonlySet<string> = new Set()): string[] {
  if (ids.length === 0) return [];
  const used: string[] = [];
  const idSet = new Set(ids);
  for (const map of Object.values(project.maps)) {
    if (idSet.has(map.tilesetId)) { used.push(map.name || map.id); continue; }
    const text = JSON.stringify(map);
    if (ids.some((id) => text.includes(`"${id}"`))) used.push(map.name || map.id);
  }
  // 맵 밖(DB·시스템·공용 이벤트·메타 등)은 자료 덩어리를 통째로 훑는다. 그림·타일셋 정의 자체와 맵(위에서 봄)은 뺀다.
  const skip: ReadonlySet<string> = new Set(["maps", "assets", "tilesets", "resourceProfiles", "charsetLabels"]);
  for (const [key, value] of Object.entries(project)) {
    if (skip.has(key) || value === undefined) continue;
    const text = JSON.stringify(value);
    if (ids.some((id) => text.includes(`"${id}"`))) used.push(key === "database" || key === "system" ? "데이터베이스·시스템" : key === "commonEvents" ? "공용 이벤트" : "프로젝트 설정");
  }
  // 다른 타일셋이 이식 원본·참고문서 원본으로 가리키면 그것도 쓰는 곳이다.
  for (const tileset of Object.values(project.tilesets)) {
    if (idSet.has(tileset.id) || ignore.has(tileset.id)) continue;
    const grafts = (tileset.tileGrafts ?? []).some((graft) => idSet.has(graft.sourceChipset));
    if (grafts || (tileset.referenceSourceTilesetId && idSet.has(tileset.referenceSourceTilesetId))) used.push(tileset.name || tileset.id);
  }
  return [...new Set(used)];
}

/** 넣기 직전 모습으로 되돌린다. 쓰는 곳이 있으면 아무것도 바꾸지 않고 그 이름들을 돌려준다. */
export function undoStoreAdd(project: Project, snapshot: StoreAddSnapshot): { ok: true } | { ok: false; usedBy: string[] } {
  const created = [
    ...Object.entries(snapshot.assets).filter(([, before]) => before === null).map(([id]) => id),
    ...Object.entries(snapshot.tilesets).filter(([, before]) => before === null).map(([id]) => id),
  ];
  const newAppearances = Object.entries(snapshot.appearances ?? {}).filter(([, before]) => before === null).map(([id]) => id);
  const usedBy = storeItemUsages(withoutAppearances(project, new Set(Object.keys(snapshot.appearances ?? {}))), [...created, ...newAppearances], new Set(Object.keys(snapshot.tilesets)));
  if (usedBy.length > 0) return { ok: false, usedBy };
  for (const [id, before] of Object.entries(snapshot.appearances ?? {})) {
    const rest = (project.database.characterAppearances ?? []).filter((record) => record.id !== id);
    project.database.characterAppearances = before ? [...rest, structuredClone(before)] : rest;
  }
  for (const [id, before] of Object.entries(snapshot.assets)) {
    if (before) project.assets.uploaded[id] = structuredClone(before);
    else delete project.assets.uploaded[id];
  }
  for (const [id, before] of Object.entries(snapshot.tilesets)) {
    if (before) project.tilesets[id] = structuredClone(before);
    else delete project.tilesets[id];
  }
  const keys = new Set(Object.keys(snapshot.assets));
  project.charsetLabels = [...(project.charsetLabels ?? []).filter((label) => !keys.has(label.textureKey)), ...structuredClone(snapshot.labels)];
  project.resourceProfiles = [...project.resourceProfiles.filter((profile) => profile.assetId === undefined || !keys.has(profile.assetId)), ...structuredClone(snapshot.profiles)];
  return { ok: true };
}

/** 이 상품이 프로젝트에 넣은 에셋·타일셋 id. */
export function storeItemKeys(project: Project, slug: string): { assetIds: string[]; tilesetIds: string[]; appearanceIds: string[] } {
  const assetIds = Object.values(project.assets.uploaded).filter((asset) => asset.origin?.itemSlug === slug).map((asset) => asset.id);
  const assets = new Set(assetIds);
  const prefix = storeProjectId(slug, "");
  const tilesetIds = Object.values(project.tilesets)
    .filter((tileset) => tileset.id.startsWith(prefix) || (tileset.image.type === "uploaded" && assets.has(tileset.image.id)))
    .map((tileset) => tileset.id);
  const appearanceIds = (project.database?.characterAppearances ?? []).filter((record) => isStoreAppearance(record.id, prefix)).map((record) => record.id);
  return { assetIds, tilesetIds, appearanceIds };
}

/** 프로젝트에서 이 상품을 뺀다(받아 둔 파일은 그대로). 쓰는 곳이 있으면 바꾸지 않는다. */
export function removeStoreItem(project: Project, slug: string): { ok: true; removed: number } | { ok: false; usedBy: string[] } {
  const keys = storeItemKeys(project, slug);
  return removeKeys(project, keys);
}

/** 새 판본에 없는 옛 판본 에셋(같은 상품 출처인데 지금 판본 매니페스트에 없는 것). */
export function staleStoreAssetIds(project: Project, slug: string, currentAssetIds: readonly string[]): string[] {
  const current = new Set(currentAssetIds);
  return storeItemKeys(project, slug).assetIds.filter((id) => !current.has(id));
}

export function removeStaleStoreAssets(project: Project, staleIds: readonly string[]): { ok: true; removed: number } | { ok: false; usedBy: string[] } {
  const stale = new Set(staleIds);
  const tilesetIds = Object.values(project.tilesets).filter((t) => t.image.type === "uploaded" && stale.has(t.image.id)).map((t) => t.id);
  return removeKeys(project, { assetIds: [...staleIds], tilesetIds });
}

function removeKeys(project: Project, keys: { assetIds: string[]; tilesetIds: string[]; appearanceIds?: string[] }): { ok: true; removed: number } | { ok: false; usedBy: string[] } {
  const appearances = new Set(keys.appearanceIds ?? []);
  const ids = [...keys.assetIds, ...keys.tilesetIds, ...appearances];
  const usedBy = storeItemUsages(withoutAppearances(project, appearances), ids, new Set(keys.tilesetIds));
  if (usedBy.length > 0) return { ok: false, usedBy };
  if (appearances.size > 0) project.database.characterAppearances = (project.database.characterAppearances ?? []).filter((record) => !appearances.has(record.id));
  const assets = new Set(keys.assetIds);
  for (const id of keys.assetIds) delete project.assets.uploaded[id];
  for (const id of keys.tilesetIds) delete project.tilesets[id];
  project.charsetLabels = (project.charsetLabels ?? []).filter((label) => !assets.has(label.textureKey));
  project.resourceProfiles = project.resourceProfiles.filter((profile) => profile.assetId === undefined || !assets.has(profile.assetId));
  return { ok: true, removed: ids.length };
}
