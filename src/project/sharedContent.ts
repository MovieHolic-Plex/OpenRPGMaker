import type { SharedContentLibrary } from "./sharedContentSchema";
import type { Project, TilesetDef } from './types';
import { sha256HexBytes } from '@/util/sha256';
import { jsonEqual } from '@/util/structuralJson';
import { SHARED_CONTENT_ENDPOINT, type SharedContentScope, type SharedContentSnapshot } from './sharedContentSchema';
import { readSharedContentCache, writeSharedContentCache } from './sharedContentCache';
const bundledLibraries: Record<string, SharedContentLibrary> = {};
let snapshot: SharedContentSnapshot = {revision:'bundled',libraries:bundledLibraries};
let defaultAssetHashes = new Map<string,string>();
let snapshotScope: SharedContentScope | null = null;
export const sharedContentSnapshot = () => snapshot;
/**
 * 설치된 공용 기본 자산 중 바이트 해시와 머리가 같은 것의 dataUrl. 같은 바이트의 base64 글은 하나뿐이므로
 * 머리까지 같으면 글도 같다. 팀 참여 창이 호스트에서 같은 그림을 다시 받지 않게 한다(persistence/electronRepository.ts).
 */
export function sharedDefaultAssetDataUrl(id: string, bytesSha256: string, head: string): string | undefined {
  if (defaultAssetHashes.get(id) !== bytesSha256) return undefined;
  for (const lib of Object.values(snapshot.libraries)) {
    const dataUrl = lib.projectDefaults ? lib.assets[id]?.dataUrl : undefined;
    if (dataUrl && dataUrl.startsWith(head + ",")) return dataUrl;
  }
  return undefined;
}
function base64Bytes(value: string): Uint8Array {
  const binary=atob(value), bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index+=1) bytes[index]=binary.charCodeAt(index);
  return bytes;
}
/** Browser and headless workers install the same host catalog. */
export async function installSharedContent(value: SharedContentSnapshot): Promise<void> {
  if(typeof value.revision!=='string'||!value.libraries||Object.values(value.libraries).some(l=>l.version!==1||!l.tilesets||!l.places||!Array.isArray(l.roots))) throw new Error('Invalid shared content');
  const next={...value,libraries:{...bundledLibraries,...value.libraries}};
  const hashes=new Map<string,string>();
  for(const lib of Object.values(next.libraries)) if(lib.projectDefaults) for(const asset of Object.values(lib.assets)) {
    if(asset.dataUrl?.startsWith('data:image/')) {
      // 글자마다 콜백을 부르는 Uint8Array.from(atob(), fn) 은 기본 자산 379장(16MB)에 약 1.2s 걸렸다(2026-09-26 실측).
      // fetch(dataURL) 은 더 빠르지만 Electron·팀 호스트 CSP connect-src 가 data: 를 막는다.
      hashes.set(asset.id,await sha256HexBytes(base64Bytes(asset.dataUrl.slice(asset.dataUrl.indexOf(',')+1))));
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
/**
 * Host-wide catalog read before normalization. Creation requires a successful host response; opening an existing project remains tolerant.
 * scope 'defaults' 는 모든 프로젝트에 설치되는 라이브러리만 받는다 — 부팅은 이것만 기다린다.
 * 실측(2026-09-26): 전체 카탈로그 395MB 를 부팅이 기다려 편집기 진입이 약 40초 걸렸다.
 */
export async function loadSharedContent(options: { required?: boolean; scope?: SharedContentScope } = {}): Promise<void> {
  if(typeof window==='undefined') return;
  try {
    const scope=options.scope ?? 'all';
    // 판본(ETag)을 기기 캐시와 비교한다. 같으면 호스트가 본문 없이 304 를 주고 캐시를 쓴다 — 예전 no-store 는
    // 공용 자료가 그대로여도 부팅마다 gzip 73MB 를 다시 받았다(2026-09-27 실측). HTTP 캐시는 본문이 커서 안 남는다.
    const cached=await readSharedContentCache(scope);
    const r=await fetch(`${SHARED_CONTENT_ENDPOINT}?scope=${scope}`,{cache:'no-store',headers:cached?{'if-none-match':cached.etag}:{},signal:AbortSignal.timeout(60000)});
    let value: SharedContentSnapshot;
    if(r.status===304 && cached) value=cached.value;
    else {
      if(!r.ok) { if(r.status===404 && !options.required) return; throw new Error(`HTTP ${r.status}`); }
      value=await r.json() as SharedContentSnapshot;
      const etag=r.headers.get('etag');
      if(etag) void writeSharedContentCache(scope, etag, value);
    }
    // 부팅 뒤 늦게 도착한 기본 범위 응답이 이미 설치된 전체 카탈로그를 덮지 않게 한다.
    if(scope==='defaults' && snapshotScope==='all') return;
    // 'rest' 는 기본 라이브러리를 뺄 나머지다 — 이미 설치된 같은 판본의 기본과 합쳐야 전체가 된다.
    // 판본이 다르면(그 사이 게시됨) 합칠 수 없으므로 전체를 다시 받는다.
    if(scope==='rest') {
      if(snapshotScope!=='defaults' || snapshot.revision!==value.revision) { await loadSharedContent({ ...options, scope:'all' }); return; }
      await installSharedContent({ revision:value.revision, libraries:{ ...snapshot.libraries, ...value.libraries } });
      snapshotScope='all';
      return;
    }
    await installSharedContent(value);
    snapshotScope=scope;
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
      if(!jsonEqual(project.tilesets[id],t)){project.tilesets[id]=structuredClone(t);changed=true;}
    }
    for(const[id,a]of Object.entries(lib.assets)) {
      if(!id.startsWith('shared_')) continue;
      const current=project.assets.uploaded[id];
      // A canonical store already separated these pixels into assets/. Do not
      // replace an identical ref with inline data on every load and trigger saves.
      if(current?.ref && current.ref.sha256===defaultAssetHashes.get(id)) continue;
      if(!jsonEqual(project.assets.uploaded[id],a)){project.assets.uploaded[id]=structuredClone(a);changed=true;}
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
