import type { Project, TilesetDef } from './types';
import { ensureSharedContent } from './sharedContent';
import { validateTilesetReferences } from './tilesetReferences';
import { sha256HexTextSync } from '@/util/sha256';
import { installSharedSpatialReferences, ensureSharedSpatialReferences, type SharedSpatialReferences } from './sharedSpatialReferences';
export const SHARED_TILE_REFERENCES_ENDPOINT = '/__oprn/shared-tile-references';
export interface SharedTileReferenceEntry {
  id: string; tileSize: number; tilesPerRow: number; count: number; assetId: string;
  imageSha256: string; dataUrlSha256: string;
  documents: NonNullable<TilesetDef['referenceDocuments']>;
  kits?: NonNullable<TilesetDef['structureKits']>;
}
export interface SharedTileReferenceSnapshot { revision: string; entries: SharedTileReferenceEntry[]; spatial?: SharedSpatialReferences }
let snapshot: SharedTileReferenceSnapshot = { revision: '', entries: [] };
/** Host-wide documents. No project ID, tile installation or map mutation. */
export async function loadSharedTileReferences(): Promise<void> {
  snapshot = { revision: '', entries: [] };
  installSharedSpatialReferences();
  if (typeof window === 'undefined') return;
  try {
    const response = await fetch(SHARED_TILE_REFERENCES_ENDPOINT, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.status === 404) return;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json() as SharedTileReferenceSnapshot;
    if (typeof value.revision !== 'string' || !Array.isArray(value.entries)) throw new Error('Invalid shared tile references');
    for (const entry of value.entries) {
      if (typeof entry.id !== 'string' || !entry.id.startsWith('shared_') || typeof entry.assetId !== 'string'
        || ![entry.tileSize, entry.tilesPerRow, entry.count].every(n => Number.isSafeInteger(n) && n > 0)
        || !/^[a-f0-9]{64}$/.test(entry.imageSha256) || !/^[a-f0-9]{64}$/.test(entry.dataUrlSha256)) throw new Error('Invalid shared tile identity');
      validateTilesetReferences(entry.documents);
    }
    snapshot = value;
    installSharedSpatialReferences(value.spatial);
  } catch (error) { console.warn('공용 타일 참고문서 갱신 실패 — 저장된 문서를 유지합니다.', error); }
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
export function applySharedTileReferenceEntries(project: Project, source = snapshot): boolean {
  let changed = false;
  for (const entry of source.entries) {
    const tile = project.tilesets[entry.id], asset = project.assets.uploaded[entry.assetId];
    if (!tile || !asset || tile.tileSize !== entry.tileSize || tile.tilesPerRow !== entry.tilesPerRow || tile.count !== entry.count
      || tile.image?.type !== 'uploaded' || tile.image.id !== entry.assetId) continue;
    const identityMatches = asset.dataUrl
      ? sha256HexTextSync(asset.dataUrl) === entry.dataUrlSha256
      : asset.ref?.sha256 === entry.imageSha256;
    if (!identityMatches) continue;
    if (entry.kits) {
      const ids = new Set(entry.kits.map(k => k.id));
      const kits = [...entry.kits, ...(tile.structureKits ?? []).filter(k => !ids.has(k.id))];
      if (JSON.stringify(kits) !== JSON.stringify(tile.structureKits)) { tile.structureKits = structuredClone(kits); changed = true; }
    }
    const ids = new Set(entry.documents.map(d => d.id));
    const documents = [...entry.documents, ...(tile.referenceDocuments ?? []).filter(d => !ids.has(d.id))];
    if (JSON.stringify(tile.referenceDocuments) === JSON.stringify(documents)) continue;
    tile.referenceDocuments = structuredClone(documents);
    changed = true;
  }
  return changed;
}
