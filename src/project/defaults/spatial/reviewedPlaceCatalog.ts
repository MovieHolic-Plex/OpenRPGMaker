import type { SharedContentSnapshot } from "../../sharedContentSchema";
import data from './reviewedPlaces/catalog.json';
import { RIVER_VILLAGE_PLACE, RIVER_VILLAGE_PLACE_TILESET } from './riverVillagePlace';
import type { Project, GameMap, TilesetDef } from '@/project/types';
import type { PlaceDesign, SpatialId } from '@/project/spatial/types';

// Authored, reviewed rasters; no remote project lookup is needed to browse or copy.
const existing = data as unknown as { roots: string[]; places: Record<string, PlaceDesign>; tilesets: Record<string, TilesetDef>; assets: Project['assets']['uploaded'] };
const catalog: typeof existing = { ...existing, roots: [RIVER_VILLAGE_PLACE.id, ...existing.roots],
  places: { ...existing.places, [RIVER_VILLAGE_PLACE.id]: RIVER_VILLAGE_PLACE },
  tilesets: { ...existing.tilesets, [RIVER_VILLAGE_PLACE_TILESET.id]: RIVER_VILLAGE_PLACE_TILESET } };
export const REVIEWED_PLACES = catalog.roots.map(id => ({ id, name: catalog.places[id]!.name, kind: catalog.places[id]!.kind }));
/** Replace the host catalog projection without touching project-owned copies. */
const sharedIds = new Set<string>();
const sharedPreviews: Record<string,string> = {};
// 공용 라이브러리가 층 원본 맵(lib.maps, 장소와 같은 id)을 함께 실으면 가져오기는 그것을 쓴다. 래스터 킷은 2층을 1층에·4층을 3층에
// 덮어 굳힌 그림이라 칸 통행이 바뀐다(2026-09-28: REFMAP 정글 수풀·A3 벽이 1층으로 내려와 걸리던 길이 막히고 막힌 벽이 뚫렸다).
const sharedMaps: Record<string, GameMap> = {};
export const reviewedPlacePreviewUrl = (id:string) => sharedPreviews[id] ?? `/assets/reviewed-places/${id}.png`;
export const reviewedPlaceReferences = (id: string) => catalog.places[id]?.referenceDocuments;
/** One place design (bundled or host-installed), including floor children that are not gallery roots. */
export const reviewedPlaceDesign = (id: string): PlaceDesign | undefined => catalog.places[id];
/** Shipped with the app — its preview PNG is public/assets/reviewed-places/<id>.png. */
export const isBundledReviewedPlace = (id: string): boolean => Object.hasOwn(existing.places, id);
export function installSharedReviewedPlaces(snapshot: SharedContentSnapshot): void {
  for(const id of sharedIds) { delete catalog.places[id]; const index=catalog.roots.indexOf(id); if(index>=0)catalog.roots.splice(index,1); }
  sharedIds.clear();
  for(const id of Object.keys(sharedPreviews))delete sharedPreviews[id];
  for(const id of Object.keys(sharedMaps))delete sharedMaps[id];
  for(const lib of Object.values(snapshot.libraries)) {
    for(const[id,place]of Object.entries(lib.places)) {
      if(!id.startsWith('shared_')) continue;
      catalog.places[id]=structuredClone(place); sharedIds.add(id);
    }
    // 카탈로그는 읽기 전용 투영이다 — 프로젝트로 옮기는 쪽(copyReviewedPlace·regionReferenceImport)이 따로 복제한다.
    // 설치된 공용 스냅숏의 객체를 그대로 가리킨다. 실측(2026-09-28, 팀 참여 창 부팅): 타일셋·그림 dataUrl 약 100MB 를
    // 여기서 통째로 복제해 1s 가까이 멈췄다.
    Object.assign(catalog.tilesets,lib.tilesets);
    Object.assign(catalog.assets,lib.assets);
    Object.assign(sharedPreviews,lib.previews);
    for(const[id,map]of Object.entries(lib.maps ?? {})) if(sharedIds.has(id)) sharedMaps[id]=map as GameMap;
    for(const id of lib.roots) if(sharedIds.has(id)&&!catalog.roots.includes(id))catalog.roots.push(id);
  }
  REVIEWED_PLACES.splice(0,REVIEWED_PLACES.length,...catalog.roots.map(id=>({id,name:catalog.places[id]!.name,kind:catalog.places[id]!.kind})));
}
/** 층 원본을 합친 그림이 래스터 킷과 칸마다 같을 때만 원본을 쓴다 — 보이는 그림은 그대로, 층만 되살린다. */
function layeredMatchesKit(map: GameMap, kit: { width: number; height: number; rows: readonly { tiles: readonly number[]; upperTiles?: readonly number[] }[] }): boolean {
  if (map.width !== kit.width || map.height !== kit.height) return false;
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x, row = kit.rows[y]!;
    const lower = (map.lowerOverlayTiles?.[i] ?? -1) >= 0 ? map.lowerOverlayTiles![i]! : map.lowerTiles[i];
    const upper = (map.upperOverlayTiles?.[i] ?? -1) >= 0 ? map.upperOverlayTiles![i]! : map.upperTiles[i];
    if (lower !== row.tiles[x] || upper !== (row.upperTiles?.[x] ?? -1)) return false;
  }
  return true;
}
export function reviewedPlaceMaps(id: string): { map: GameMap; tileset: TilesetDef; level: number }[] {
  const result: ReturnType<typeof reviewedPlaceMaps> = [];
  function visit(key: string, level: number) {
    const place = catalog.places[key];
    if (!place) throw new Error(`Unknown reviewed place: ${key}`);
    const layered = sharedMaps[key];
    const kitOf = place.exterior && catalog.tilesets[place.exterior.tilesetId]?.structureKits?.find(k => k.id === place.exterior!.kitId);
    if (place.exterior && layered && kitOf && layered.tilesetId === place.exterior.tilesetId && layeredMatchesKit(layered, kitOf)) {
      result.push({ level, tileset: catalog.tilesets[layered.tilesetId]!, map: { ...structuredClone(layered), id: key, name: place.name, events: [] } });
    } else if (place.exterior) {
      const tileset = catalog.tilesets[place.exterior.tilesetId]!;
      const kit = tileset.structureKits!.find(k => k.id === place.exterior!.kitId);
      if (!kit || kit.kind !== 'section') throw new Error(`Missing reviewed raster: ${key}`);
      result.push({ level, tileset, map: { id: key, name: place.name, width: kit.width, height: kit.height, tileSize: kit.tileSize ?? tileset.tileSize ?? 16, tilesetId: tileset.id,
        lowerTiles: kit.rows.flatMap(r => [...r.tiles]), upperTiles: kit.rows.flatMap(r => [...(r.upperTiles ?? new Array(kit.width).fill(-1))]), events: [] } });
    }
    for (const child of place.children) visit(child.source.id, level + child.level);
  }
  visit(id, 0); return result;
}
export function reviewedPlaceAssets(): Project['assets']['uploaded'] { return catalog.assets; }

export const BUNDLED_PLACE_NAMESPACE = "bundled";

export function bundledReviewedPlaceId(id: string): SpatialId {
  return `${BUNDLED_PLACE_NAMESPACE}:${id}` as SpatialId;
}

/** Install one shipped place design under a stable id. A second call keeps the existing preset. */
export function installBundledReviewedPlace(project: Project, id: string): { project: Project; id: SpatialId } {
  const installed = bundledReviewedPlaceId(id);
  if (project.spatialAuthoring?.library.places[installed]) return { project, id: installed };
  const copied = copyReviewedPlace(project, id, BUNDLED_PLACE_NAMESPACE);
  const places = copied.project.spatialAuthoring!.library.places as Record<string, PlaceDesign>;
  const place = places[copied.id]!;
  places[copied.id] = { ...place, provenance: { origin: "builtin", sourceId: id } };
  return { project: copied.project, id: copied.id };
}

/** Copy only the selected closure. Fresh namespace prevents overwriting user designs/assets. */
export function copyReviewedPlace(project: Project, id: string, namespace: string): { project: Project; id: SpatialId } {
  if (!project.spatialAuthoring) throw new Error('Activate spatial authoring before copying a place');
  if (!catalog.roots.includes(id)) throw new Error(`Unknown reviewed place: ${id}`);
  const p = structuredClone(project), library = p.spatialAuthoring!.library;
  const key = (value: string) => `${namespace}:${value}` as SpatialId;
  const copied = new Set<string>();
  const visitingTilesets = new Set<string>();
  function visit(source: string) {
    if (copied.has(source)) return; copied.add(source);
    const original = catalog.places[source]!;
    const place = structuredClone(original);
    if (Object.hasOwn(library.places, key(source))) throw new Error('Reviewed place copy id collision');
    for (const child of place.children) visit(child.source.id);
    let exterior = place.exterior;
    if (exterior) {
      const tilesetId = key(exterior.tilesetId);
      const copyTileset = (originalId: string) => {
        const copiedId=key(originalId);
        if(Object.hasOwn(project.tilesets,copiedId)) throw new Error('Reviewed tileset copy id collision');
        if(Object.hasOwn(p.tilesets,copiedId)) return;
        if(visitingTilesets.has(originalId)) throw new Error('Reviewed tileset reference cycle');
        visitingTilesets.add(originalId);
        const t=structuredClone(catalog.tilesets[originalId]!);
        if(!t) throw new Error('Missing reviewed tileset');
        if(t.referenceSourceTilesetId) { copyTileset(t.referenceSourceTilesetId); t.referenceSourceTilesetId=key(t.referenceSourceTilesetId); }
        if(t.image.type==='uploaded') {
          const asset=catalog.assets[t.image.id]; if(!asset)throw new Error('Missing reviewed atlas');
          const assetId=key(t.image.id);
          if(Object.hasOwn(project.assets.uploaded,assetId)) throw new Error('Reviewed asset copy id collision');
          if(!p.assets.uploaded[assetId])p.assets.uploaded[assetId]={...structuredClone(asset),id:assetId};
          t.image={type:'uploaded',id:assetId};
        }
        p.tilesets[copiedId]={...t,id:copiedId};
        visitingTilesets.delete(originalId);
      };
      if(Object.hasOwn(project.tilesets,tilesetId))throw new Error('Reviewed tileset copy id collision');
      copyTileset(exterior.tilesetId);
      exterior = { ...exterior, tilesetId };
    }
    (library.places as Record<string, PlaceDesign>)[key(source)] = { ...place, id: key(source), revision: 1, provenance: { origin: 'user' },
      children: place.children.map(c => ({ ...c, source: { kind: 'place', id: key(c.source.id) } })), ...(exterior ? { exterior } : {}) };
  }
  visit(id); return { project: p, id: key(id) };
}

/** Lightweight metadata for library classification; does not rasterize maps. */
export function reviewedPlaceClassificationSource(id: string) {
 const place = catalog.places[id]; return place ? { tags: place.tags, tilesetId: place.exterior?.tilesetId } : undefined;
}
