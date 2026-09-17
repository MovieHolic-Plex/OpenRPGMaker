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
  if (existing.image.type !== 'bundled' || existing.image.id !== TIBO_INTERIOR_TEXTURE || existing.tileGrafts?.length || existing.count >= saved.count) return false;
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
