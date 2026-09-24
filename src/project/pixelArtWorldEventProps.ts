import catalog from '@/assets/pixelArtWorldEventProps.json';
import type { Command, TilesetDef } from './types';
export const PIXEL_ART_WORLD_EVENT_PROPS = catalog.packs;
export const PIXEL_ART_WORLD_EVENT_PROP_AUDIT = catalog.sources;
export type PixelArtWorldEventPropPack = typeof catalog.packs[number];
export type PixelArtWorldEventPropVariant = PixelArtWorldEventPropPack['variants'][number];
export function canAttachEventPropReferences(target: TilesetDef, pack: PixelArtWorldEventPropPack) {
  return pack.rights.runtimeImportAllowed && target.tileSize === 32 && !target.id.startsWith('shared_') && !target.referenceSourceTilesetId
    && (target.referenceDocuments?.length ?? 0) < 32 && !target.referenceDocuments?.some(c => c.id === pack.id);
}
export function eventPropCommands(frames: number[], eventId = ''): Command[] {
  return frames.length < 2 ? [] : frames.flatMap(pattern => [
    {kind:'setEventGraphicPattern' as const,eventId,pattern}, {kind:'wait' as const,ms:120},
  ]);
}
/** A diagnostic complete event arrangement. No map terrain, interaction or collision is inferred. */
export function eventPropAssembly(pack: PixelArtWorldEventPropPack, variant: PixelArtWorldEventPropVariant, assetId: string) {
  return {width:12,height:10,tileSize:32,lowerTiles:Array<number>(120).fill(-1),upperTiles:Array<number>(120).fill(-1),
    events:variant.parts.map((part,i)=>({id:`${variant.id}-part-${i}`,name:variant.name,x:5+part.x,y:7+part.y,
      pages:[{id:'page',name:variant.name,conditions:[],graphic:{sprite:{type:'uploaded' as const,id:assetId},pattern:part.frames[0],scale:1,scaleMode:'manual' as const},
        animationType:'fixedGraphic' as const,trigger:{kind:variant.kind==='loop'?'parallel' as const:'action' as const},priority:'same' as const,
        movement:{type:'fixed' as const,speed:3,frequency:3},commands:eventPropCommands(part.frames)}]})),
    anchor:{x:5,y:7},placement:pack.placement,limitation:'Diagnostic event arrangement only. Terrain/support, collision footprint, interaction and movement are authored separately.'};
}
export function validateEventPropAssembly(pack: PixelArtWorldEventPropPack, variant: PixelArtWorldEventPropVariant, actual: ReturnType<typeof eventPropAssembly>) {
  const errors:{code:string;x:number;y:number}[]=[];
  if(actual.width!==12||actual.height!==10||actual.lowerTiles.length!==120||actual.upperTiles.length!==120)errors.push({code:'DIMENSIONS',x:0,y:0});
  if(actual.events.length!==variant.parts.length)errors.push({code:'MISSING_PART',x:5,y:7});
  variant.parts.forEach((part,i)=>{
    const event=actual.events[i],frame=event?.pages[0]?.graphic.pattern;
    if(!event||event.x!==5+part.x||event.y!==7+part.y)errors.push({code:'PART_POSITION',x:5+part.x,y:7+part.y});
    if(typeof frame!=='number'||frame!==part.frames[0]||!pack.frames[frame]?.nonTransparentPixels)errors.push({code:'FRAME',x:5+part.x,y:7+part.y});
  });
  return errors;
}
