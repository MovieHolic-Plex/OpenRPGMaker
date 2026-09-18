import data from './reviewedPlaces/catalog.json';
import type { Project, GameMap, TilesetDef } from '@/project/types';
import type { PlaceDesign, SpatialId } from '@/project/spatial/types';

// Authored, reviewed rasters; no remote project lookup is needed to browse or copy.
const catalog = data as unknown as { roots: string[]; places: Record<string, PlaceDesign>; tilesets: Record<string, TilesetDef>; assets: Project['assets']['uploaded'] };
export const REVIEWED_PLACES = catalog.roots.map(id => ({ id, name: catalog.places[id]!.name, kind: catalog.places[id]!.kind }));
export function reviewedPlaceMaps(id: string): { map: GameMap; tileset: TilesetDef; level: number }[] {
  const result: ReturnType<typeof reviewedPlaceMaps> = [];
  function visit(key: string, level: number) {
    const place = catalog.places[key];
    if (!place) throw new Error(`Unknown reviewed place: ${key}`);
    if (place.exterior) {
      const tileset = catalog.tilesets[place.exterior.tilesetId]!;
      const kit = tileset.structureKits!.find(k => k.id === place.exterior!.kitId);
      if (!kit || kit.kind !== 'section') throw new Error(`Missing reviewed raster: ${key}`);
      result.push({ level, tileset, map: { id: key, name: place.name, width: kit.width, height: kit.height, tileSize: 16, tilesetId: tileset.id,
        lowerTiles: kit.rows.flatMap(r => [...r.tiles]), upperTiles: kit.rows.flatMap(r => [...(r.upperTiles ?? new Array(kit.width).fill(-1))]), events: [] } });
    }
    for (const child of place.children) visit(child.source.id, level + child.level);
  }
  visit(id, 0); return result;
}
export function reviewedPlaceAssets(): Project['assets']['uploaded'] { return catalog.assets; }

/** Copy only the selected closure. Fresh namespace prevents overwriting user designs/assets. */
export function copyReviewedPlace(project: Project, id: string, namespace: string): { project: Project; id: SpatialId } {
  if (!project.spatialAuthoring) throw new Error('Activate spatial authoring before copying a place');
  if (!catalog.roots.includes(id)) throw new Error(`Unknown reviewed place: ${id}`);
  const p = structuredClone(project), library = p.spatialAuthoring!.library;
  const key = (value: string) => `${namespace}:${value}` as SpatialId;
  const copied = new Set<string>();
  function visit(source: string) {
    if (copied.has(source)) return; copied.add(source);
    const original = catalog.places[source]!;
    const place = structuredClone(original);
    if (Object.hasOwn(library.places, key(source))) throw new Error('Reviewed place copy id collision');
    for (const child of place.children) visit(child.source.id);
    let exterior = place.exterior;
    if (exterior) {
      const tilesetId = key(exterior.tilesetId);
      if (!Object.hasOwn(p.tilesets, tilesetId)) {
        const t = structuredClone(catalog.tilesets[exterior.tilesetId]!);
        if (Object.hasOwn(project.tilesets, tilesetId)) throw new Error('Reviewed tileset copy id collision');
        if (t.image.type === 'uploaded') {
          const asset = catalog.assets[t.image.id]!;
          const assetId = key(t.image.id);
          if (Object.hasOwn(project.assets.uploaded, assetId)) throw new Error('Reviewed asset copy id collision');
          p.assets.uploaded[assetId] = { ...structuredClone(asset), id: assetId };
          t.image = { type: 'uploaded', id: assetId };
        }
        p.tilesets[tilesetId] = { ...t, id: tilesetId };
      }
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
