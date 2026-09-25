import type { SharedContentLibrary } from "./sharedContentSchema";
import type { Project, TilesetDef } from './types';
import { sha256HexBytes } from '@/util/sha256';
import { SHARED_CONTENT_ENDPOINT, type SharedContentSnapshot } from './sharedContentSchema';
const bundledLibraries: Record<string, SharedContentLibrary> = {};
let snapshot: SharedContentSnapshot = {revision:'bundled',libraries:bundledLibraries};
let defaultAssetHashes = new Map<string,string>();
export const sharedContentSnapshot = () => snapshot;
/** Browser and headless workers install the same host catalog. */
export async function installSharedContent(value: SharedContentSnapshot): Promise<void> {
  if(typeof value.revision!=='string'||!value.libraries||Object.values(value.libraries).some(l=>l.version!==1||!l.tilesets||!l.places||!Array.isArray(l.roots))) throw new Error('Invalid shared content');
  const next={...value,libraries:{...bundledLibraries,...value.libraries}};
  const hashes=new Map<string,string>();
  for(const lib of Object.values(next.libraries)) if(lib.projectDefaults) for(const asset of Object.values(lib.assets)) {
    if(asset.dataUrl?.startsWith('data:image/')) {
      const bytes=Uint8Array.from(atob(asset.dataUrl.slice(asset.dataUrl.indexOf(',')+1)),c=>c.charCodeAt(0));
      hashes.set(asset.id,await sha256HexBytes(bytes));
    }
  }
  snapshot=next; defaultAssetHashes=hashes;
  const {installSharedReviewedPlaces}=await import('./defaults/spatial/reviewedPlaceCatalog');
  installSharedReviewedPlaces(snapshot);
}
export function sharedContentTileset(id: string): TilesetDef | undefined {
  for(const lib of Object.values(snapshot.libraries)) if(Object.hasOwn(lib.tilesets,id)) return lib.tilesets[id];
  return undefined;
}
/** Host-wide catalog read before normalization. Creation requires a successful host response; opening an existing project remains tolerant. */
export async function loadSharedContent(options: { required?: boolean } = {}): Promise<void> {
  if(typeof window==='undefined') return;
  try {
    const r=await fetch(SHARED_CONTENT_ENDPOINT,{cache:'no-store',signal:AbortSignal.timeout(60000)});
    if(!r.ok) { if(r.status===404 && !options.required) return; throw new Error(`HTTP ${r.status}`); }
    const value=await r.json() as SharedContentSnapshot;
    await installSharedContent(value);

  } catch(error) {
    if(options.required) throw new Error('공용 자료를 불러오지 못해 새 프로젝트 생성을 중단했습니다. 다시 시도해 주세요.', { cause: error });
    console.warn('공용 SQLite 자료를 불러오지 못했습니다.',error);
  }
}
/** Reserved shared IDs are projections. User copies use independent IDs and are never replaced. */
export function ensureSharedContent(project: Project): boolean {
  let changed=false;
  for(const lib of Object.values(snapshot.libraries)) {
    if(!lib.projectDefaults) continue;
    for(const[id,t]of Object.entries(lib.tilesets)) {
      if(!id.startsWith('shared_')) continue;
      if(JSON.stringify(project.tilesets[id])!==JSON.stringify(t)){project.tilesets[id]=structuredClone(t);changed=true;}
    }
    for(const[id,a]of Object.entries(lib.assets)) {
      if(!id.startsWith('shared_')) continue;
      const current=project.assets.uploaded[id];
      // A canonical store already separated these pixels into assets/. Do not
      // replace an identical ref with inline data on every load and trigger saves.
      if(current?.ref && current.ref.sha256===defaultAssetHashes.get(id)) continue;
      if(JSON.stringify(project.assets.uploaded[id])!==JSON.stringify(a)){project.assets.uploaded[id]=structuredClone(a);changed=true;}
    }
  }
  return changed;
}

export function sharedRegionReferences() {
  return Object.values(snapshot.libraries).flatMap(lib => Object.values(lib.regions ?? {}));
}
export function sharedRegionSnapshot(id: string) {
  for (const lib of Object.values(snapshot.libraries)) {
    if (!Object.hasOwn(lib.regions ?? {}, id)) continue;
    const map = lib.maps[id];
    const tileset = map && lib.tilesets[map.tilesetId];
    if (map && tileset) return { map, tileset };
  }
  return undefined;
}
export function sharedPlaceSummaries() {
  return Object.values(snapshot.libraries).flatMap(lib => lib.roots.flatMap(id => {
    const place = lib.places[id];
    return place ? [{ id, name: place.name, kind: place.kind, tags: place.tags, tilesetId: place.exterior?.tilesetId ?? null }] : [];
  }));
}

export function sharedPlacePreview(id: string): string | undefined {
  for (const lib of Object.values(snapshot.libraries)) if (Object.hasOwn(lib.previews, id)) return lib.previews[id];
  return undefined;
}
