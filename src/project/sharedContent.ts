import type { SharedContentLibrary } from "./sharedContentSchema";
import type { Project, TilesetDef } from './types';
import { SHARED_CONTENT_ENDPOINT, type SharedContentSnapshot } from './sharedContentSchema';
const bundledLibraries: Record<string, SharedContentLibrary> = {};
let snapshot: SharedContentSnapshot = {revision:'bundled',libraries:bundledLibraries};
export const sharedContentSnapshot = () => snapshot;
export function sharedContentTileset(id: string): TilesetDef | undefined {
  for(const lib of Object.values(snapshot.libraries)) if(Object.hasOwn(lib.tilesets,id)) return lib.tilesets[id];
}
/** Host-wide catalog read before the project is normalized. No project id is sent. */
export async function loadSharedContent(): Promise<void> {
  if(typeof window==='undefined') return;
  try {
    const r=await fetch(SHARED_CONTENT_ENDPOINT,{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!r.ok) { if(r.status===404) return; throw new Error(`HTTP ${r.status}`); }
    const value=await r.json() as SharedContentSnapshot;
    if(typeof value.revision!=='string'||!value.libraries||Object.values(value.libraries).some(l=>l.version!==1||!l.tilesets||!l.places||!Array.isArray(l.roots))) throw new Error('Invalid shared content');
    snapshot={...value,libraries:{...bundledLibraries,...value.libraries}};

  } catch(error) { console.warn('공용 SQLite 자료를 불러오지 못했습니다.',error); }
  finally {
    const {installSharedReviewedPlaces}=await import("./defaults/spatial/reviewedPlaceCatalog");
    installSharedReviewedPlaces(snapshot);
  }
}
/** Reserved shared IDs are projections. User copies use independent IDs and are never replaced. */
export function ensureSharedContent(project: Project): boolean {
  let changed=false;
  for(const lib of Object.values(snapshot.libraries)) {
    for(const[id,t]of Object.entries(lib.tilesets)) {
      if(!id.startsWith('shared_')) continue;
      if(JSON.stringify(project.tilesets[id])!==JSON.stringify(t)){project.tilesets[id]=structuredClone(t);changed=true;}
    }
    for(const[id,a]of Object.entries(lib.assets)) {
      if(!id.startsWith('shared_')) continue;
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
}
export function sharedPlaceSummaries() {
  return Object.values(snapshot.libraries).flatMap(lib => lib.roots.flatMap(id => {
    const place = lib.places[id];
    return place ? [{ id, name: place.name, kind: place.kind, tags: place.tags, tilesetId: place.exterior?.tilesetId ?? null }] : [];
  }));
}

export function sharedPlacePreview(id: string): string | undefined {
  for (const lib of Object.values(snapshot.libraries)) if (Object.hasOwn(lib.previews, id)) return lib.previews[id];
}
