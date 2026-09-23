import saved from '@/assets/tiboRecoveredTileset.json';
import type { TilesetDef } from '../types';
import type { InteriorObjectDef } from './interiorObjectCatalog';
export const TIBO_INTERIOR_ID = 'tibo_interior_expanded';
export const TIBO_INTERIOR_TEXTURE = 'tex_tibo_interior_expanded';
export const TIBO_INTERIOR_COUNT = saved.count;
export function createTiboInteriorTileset(): TilesetDef {
  return JSON.parse(JSON.stringify(saved)) as TilesetDef;
}
export function extendTiboInteriorDefaults(existing: TilesetDef): boolean {
  if (existing.image.type !== 'bundled' || existing.image.id !== TIBO_INTERIOR_TEXTURE || existing.tileGrafts?.length) return false;
  const removed = new Set(["tibo-library-021", "tibo-library-022", "tibo-library-023", "tibo-library-027", "tibo-library-028", "tibo-library-077", "tibo-library-085", "tibo-library-096", "tibo-library-100", "tibo-library-108", "tibo-library-125", "tibo-library-186", "tibo-library-200", "tibo-library-202", "tibo-library-240", "tibo-medieval-canopy-bed", "tibo-medieval-stone-fireplace", "tibo-medieval-scribe-desk", "tibo-medieval-bread-oven", "tibo-medieval-grain-mill", "tibo-medieval-wine-press", "tibo-medieval-market-stall", "tibo-medieval-handcart", "tibo-medieval-banquet-table", "tibo-fantasy-bellows", "tibo-fantasy-altar", "tibo-fantasy-pew", "tibo-fantasy-grain-sacks", "tibo-fantasy-water-tub"]);
  const removedTiles = new Set((existing.structureKits ?? []).filter(k => removed.has(k.id)).flatMap(k => k.rows.flatMap(r => [...r.tiles, ...(r.upperTiles ?? [])])).filter(t => t >= 0));
  const before = existing.structureKits?.length ?? 0;
  existing.structureKits = (existing.structureKits ?? []).filter(k => !removed.has(k.id));
  const curated = before !== existing.structureKits.length;
  if (curated) {
    for (const tile of removedTiles) {
      if (saved.tileMeta[tile]) (existing.tileMeta ??= [])[tile] = structuredClone(saved.tileMeta[tile]) as NonNullable<TilesetDef['tileMeta']>[number];
      if (saved.passability[tile]) existing.passability[tile] = structuredClone(saved.passability[tile]);
    }
    existing.tileGroups = existing.tileGroups?.map(group => ({ ...group, tileIds: group.tileIds.filter(tile => !removedTiles.has(tile)) })).filter(group => group.tileIds.length > 0);
  }
  if (existing.count >= saved.count) return curated;
  const current = createTiboInteriorTileset();
  for (let t=existing.count;t<current.count;t++) {
    existing.passability[t]={...current.passability[t]};existing.priority[t]=current.priority[t];existing.terrain[t]=current.terrain[t];
    (existing.tileMeta ??= [])[t]={...current.tileMeta![t]};
  }
  for (const kit of current.structureKits ?? []) if (!(existing.structureKits ??= []).some(k=>k.id===kit.id)) existing.structureKits.push(kit);
  existing.count=current.count;return true;
}
export function tiboInteriorObjectById(id: string): InteriorObjectDef | undefined {
  const kit = saved.structureKits.find(k=>k.id===id);
  if (!kit) return undefined;
  return {id,label:kit.name,description:kit.name,role:null,width:kit.width,height:kit.height,layer:'upper',themes:['study','bedroom','kitchen','storage','tavern'],snap:'floor',cells:kit.rows.flatMap((r,dy)=>r.upperTiles.map((tile,dx)=>({dx,dy,tile,layer:'upper' as const})))};
}
