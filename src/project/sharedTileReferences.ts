import type { Project, TilesetDef } from './types';
import { ensureSharedContent, sharedContentSnapshot, whenSharedLibrariesInstalled } from './sharedContent';
import { validateTilesetReferences } from './tilesetReferences';
import { sha256HexTextSync } from '@/util/sha256';
import { installSharedSpatialReferences, ensureSharedSpatialReferences, type SharedSpatialReferences } from './sharedSpatialReferences';
import { readSharedContentCache, writeSharedContentCache } from './sharedContentCache';
export const SHARED_TILE_REFERENCES_ENDPOINT = '/__oprn/shared-tile-references';
/**
 * 편집기 응답의 라이브러리 표식. 공용 카탈로그에 같은 객체로 들어 있는 타일셋·그림은 `{ "$library": <라이브러리 id> }` 로,
 * 항목의 참고문서·구조 킷은 `library` 로만 보낸다(scripts/lib/sharedTileReferencesSqlite.ts `libraryRefs`).
 */
export const SHARED_LIBRARY_REF = '$library';
/** 항목이 보강하는 구조 킷 — 카탈로그 타일셋의 공용 킷(호스트와 편집기가 같은 거름을 쓴다). */
export function sharedTileReferenceKits(tile: Pick<TilesetDef, 'structureKits'>): NonNullable<TilesetDef['structureKits']> | undefined {
  return tile.structureKits?.filter(k => k.id.startsWith('shared_'));
}
export interface SharedTileReferenceEntry {
  id: string; tileSize: number; tilesPerRow: number; count: number; assetId: string;
  imageSha256: string; dataUrlSha256: string;
  documents: NonNullable<TilesetDef['referenceDocuments']>;
  kits?: NonNullable<TilesetDef['structureKits']>;
}
export interface SharedTileReferenceSnapshot { revision: string; entries: SharedTileReferenceEntry[]; spatial?: SharedSpatialReferences }
type WireEntry = Omit<SharedTileReferenceEntry, 'documents'> & { documents?: SharedTileReferenceEntry['documents']; library?: string };
type WireSnapshot = { revision: string; entries: WireEntry[]; spatial?: SharedSpatialReferences };

function libraryRef(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as Record<string, unknown>)[SHARED_LIBRARY_REF];
  return typeof id === 'string' && Object.keys(value).length === 1 ? id : undefined;
}
function wireLibraries(value: WireSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const entry of value.entries) if (typeof entry.library === 'string') ids.add(entry.library);
  for (const record of [value.spatial?.tilesets, value.spatial?.assets]) for (const item of Object.values(record ?? {})) { const id = libraryRef(item); if (id) ids.add(id); }
  return ids;
}
/**
 * 표식을 설치된 공용 카탈로그의 객체로 채운다. 카탈로그 객체를 그대로 가리킨다 — 둘 다 읽기 전용이고, 프로젝트로 옮기는
 * 쪽이 복제한다(applySharedTileReferenceEntries·ensureSharedSpatialReferences). 없는 라이브러리·항목이면 던진다.
 */
function resolveLibraryRefs(value: WireSnapshot): SharedTileReferenceSnapshot {
  const libraries = sharedContentSnapshot().libraries;
  const library = (id: string) => { const lib = libraries[id]; if (!lib) throw new Error(`공용 라이브러리 ${id} 가 설치되지 않았습니다`); return lib; };
  const entries = value.entries.map((entry): SharedTileReferenceEntry => {
    if (entry.documents !== undefined || typeof entry.library !== 'string') return entry as SharedTileReferenceEntry;
    const { library: id, ...identity } = entry;
    const tile = library(id).tilesets[entry.id];
    if (!tile?.referenceDocuments) throw new Error(`공용 타일셋 ${entry.id} 가 라이브러리 ${id} 에 없습니다`);
    const kits = sharedTileReferenceKits(tile);
    return { ...identity, documents: tile.referenceDocuments, ...(kits ? { kits } : {}) };
  });
  const spatial = value.spatial && {
    ...value.spatial,
    tilesets: Object.fromEntries(Object.entries(value.spatial.tilesets).map(([id, tile]) => {
      const lib = libraryRef(tile);
      const resolved = lib ? library(lib).tilesets[id] : tile;
      if (!resolved) throw new Error(`공용 타일셋 ${id} 가 라이브러리 ${lib} 에 없습니다`);
      return [id, resolved];
    })),
    assets: Object.fromEntries(Object.entries(value.spatial.assets).map(([id, asset]) => {
      const lib = libraryRef(asset);
      const resolved = lib ? library(lib).assets[id] : asset;
      if (!resolved) throw new Error(`공용 그림 ${id} 가 라이브러리 ${lib} 에 없습니다`);
      return [id, resolved];
    })),
  };
  return { revision: value.revision, entries, ...(spatial ? { spatial } : {}) };
}
let snapshot: SharedTileReferenceSnapshot = { revision: '', entries: [] };
/**
 * Host-wide documents. No project ID, tile installation or map mutation.
 * 설치하면 true — 이미 열린 프로젝트에는 main.ts 가 store.applySharedReferenceRefresh() 로 늦게 반영한다.
 * 부팅은 이 응답을 기다리지 않으므로 시간 제한을 두지 않는다. 실측(2026-09-26): 응답 183MB,
 * 호스트 첫 직렬화 24.8s 라 예전 10s abort 는 매 부팅 실패를 보장했다. 실패는 경고만 남긴다.
 *
 * 응답은 카탈로그에 있는 것을 라이브러리 표식으로만 보낸다(SHARED_LIBRARY_REF). 표식이 가리키는 라이브러리가 아직
 * 설치되지 않았으면(부팅은 기본 범위만 기다린다) 나머지 범위를 받은 뒤 채운다 — 같은 요청을 main.ts 와 나눠 쓴다.
 */
export async function loadSharedTileReferences(): Promise<boolean> {
  snapshot = { revision: '', entries: [] };
  installSharedSpatialReferences();
  if (typeof window === 'undefined') return false;
  try {
    // 판본(ETag)이 기기 캐시와 같으면 호스트가 본문 없이 304 를 준다(sharedContent.ts 와 같은 계약).
    const cached = await readSharedContentCache<WireSnapshot>('tile-references');
    const response = await fetch(SHARED_TILE_REFERENCES_ENDPOINT, { cache: 'no-store', headers: cached ? { 'if-none-match': cached.etag } : {} });
    if (response.status === 404) return false;
    let wire: WireSnapshot;
    if (response.status === 304 && cached) wire = cached.value;
    else {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      wire = await response.json() as WireSnapshot;
      const etag = response.headers.get('etag');
      if (etag) void writeSharedContentCache('tile-references', etag, wire);
    }
    if (typeof wire.revision !== 'string' || !Array.isArray(wire.entries)) throw new Error('Invalid shared tile references');
    // 표식이 가리키는 라이브러리는 부팅의 기본 범위나 편집기가 뜬 뒤 받는 나머지 범위(main.ts)에 있다. 설치를 기다린다 —
    // 여기서 따로 받으면 같은 카탈로그를 두 번 받는다.
    const needed = wireLibraries(wire);
    if (!await whenSharedLibrariesInstalled(needed, 180_000)) throw new Error('공용 카탈로그가 설치되지 않아 참고문서를 채우지 못했습니다');
    const value = resolveLibraryRefs(wire);
    for (const entry of value.entries) {
      if (typeof entry.id !== 'string' || !entry.id.startsWith('shared_') || typeof entry.assetId !== 'string'
        || ![entry.tileSize, entry.tilesPerRow, entry.count].every(n => Number.isSafeInteger(n) && n > 0)
        || !/^[a-f0-9]{64}$/.test(entry.imageSha256) || !/^[a-f0-9]{64}$/.test(entry.dataUrlSha256)) throw new Error('Invalid shared tile identity');
      validateTilesetReferences(entry.documents);
    }
    snapshot = value;
    installSharedSpatialReferences(value.spatial);
    return true;
  } catch (error) { console.warn('공용 타일 참고문서 갱신 실패 — 저장된 문서를 유지합니다.', error); return false; }
}
export function ensureSharedTileReferences(project: Project, source = snapshot): boolean {
  let changed = ensureSharedContent(project);
  changed = ensureSharedSpatialReferences(project) || changed;
  return applySharedTileReferenceEntries(project, source) || changed;
}
/** 이 참고문서가 보강할 타일셋이 프로젝트에 하나라도 있는가(타일셋·업로드 자산 id 만 본다). */
export function sharedTileReferencesTouch(project: Project, source = snapshot): boolean {
  return source.entries.some(entry => project.tilesets[entry.id] && project.assets.uploaded[entry.assetId]);
}
/**
 * 부팅 뒤 도착한 참고문서를 보강한다. 부팅 정규화가 이미 돌린 공용 자료 설치는 다시 하지 않는다 —
 * 실측(2026-09-26) 다시 하면 프로젝트 복제와 합쳐 부팅 직후 1.65s 를 더 썼다.
 */
export function applySharedTileReferenceEntries(project: Project, source = snapshot, options: { readonly dryRun?: boolean } = {}): boolean {
  let changed = false;
  // 같은 자산 dataUrl 을 여러 항목이 볼 수 있다 — 글 해시는 한 번만(HTTP 참여 창은 JS SHA 라 26MB 에 약 0.8s).
  const dataUrlSha = new Map<string, string>();
  for (const entry of source.entries) {
    const tile = project.tilesets[entry.id], asset = project.assets.uploaded[entry.assetId];
    if (!tile || !asset || tile.tileSize !== entry.tileSize || tile.tilesPerRow !== entry.tilesPerRow || tile.count !== entry.count
      || tile.image?.type !== 'uploaded' || tile.image.id !== entry.assetId) continue;
    let identityMatches: boolean;
    if (asset.dataUrl) {
      let sha = dataUrlSha.get(asset.dataUrl);
      if (sha === undefined) { sha = sha256HexTextSync(asset.dataUrl); dataUrlSha.set(asset.dataUrl, sha); }
      identityMatches = sha === entry.dataUrlSha256;
    } else identityMatches = asset.ref?.sha256 === entry.imageSha256;
    if (!identityMatches) continue;
    if (entry.kits) {
      const ids = new Set(entry.kits.map(k => k.id));
      const kits = [...entry.kits, ...(tile.structureKits ?? []).filter(k => !ids.has(k.id))];
      if (JSON.stringify(kits) !== JSON.stringify(tile.structureKits)) {
        if (options.dryRun) return true;
        tile.structureKits = structuredClone(kits); changed = true;
      }
    }
    const ids = new Set(entry.documents.map(d => d.id));
    const documents = [...entry.documents, ...(tile.referenceDocuments ?? []).filter(d => !ids.has(d.id))];
    if (JSON.stringify(tile.referenceDocuments) === JSON.stringify(documents)) continue;
    if (options.dryRun) return true;
    tile.referenceDocuments = structuredClone(documents);
    changed = true;
  }
  return changed;
}
