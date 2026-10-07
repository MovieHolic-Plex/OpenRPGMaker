import references from '@/assets/beodeulDoorReferences.json';
import type { TilesetDef } from '../types';
export const BEODEUL_DOOR_TEXTURE = 'tex_beodeul_door';
export const BEODEUL_DOOR_ID = 'beodeul_door';

/** Explicit states; opening a door must not become an unattended looping tile. */
export function createBeodeulDoorTileset(): TilesetDef {
  return {
    id: BEODEUL_DOOR_ID, name: '버들항 · 문 열림 손 도트 시안',
    image: {type:'bundled',id:BEODEUL_DOOR_TEXTURE},kind:'custom',family:'oprn-atlas',
    tileSize:16,tilesPerRow:8,count:16,
    passability:Array.from({length:16},()=>({up:false,down:false,left:false,right:false})),
    priority:Array.from({length:16},()=>'lower' as const),terrain:Array(16).fill(0),
    tileGroups:[{id:'bd-door-states',name:'문 닫힘→열림 8단계',role:'prop',defaultLayer:'upper',layerHome:'upper',
      tileIds:Array.from({length:16},(_,i)=>i),description:'1×2칸 문, 위 i/아래 i+8. 동작 시안.',
      placementRules:'같은 단계의 두 칸을 함께 교체한다. 그림과 출입 이벤트는 별개다.',origin:'ai'}],
    structureKits:Array.from({length:8},(_,i)=>({id:`bd-door-stage-${i}`,name:`문 단계 ${i}${i===0?' · 닫힘':i===7?' · 열림':''}`,
      kind:'section' as const,width:1,height:2,tileSize:16,
      rows:[{tiles:[-1],upperTiles:[i]},{tiles:[-1],upperTiles:[i+8]}],
      ai:{description:'버들항 살림집 16×32 문 동작 단계',placementRules:'위아래 칸을 같은 단계로. 문틀 원점 고정.',tags:['버들항','문','door'],role:'prop'}})),
    referenceDocuments:structuredClone(references),
  };
}

export function ensureBeodeulDoorReferences(tileset: TilesetDef): boolean {
  if(tileset.image.type!=='bundled'||tileset.image.id!==BEODEUL_DOOR_TEXTURE||tileset.referenceSourceTilesetId) return false;
  const next=[...(tileset.referenceDocuments??[])];
  let changed=false;
  for(const shipped of references) {
    const index=next.findIndex(e=>e.id===shipped.id);
    if(index<0) {next.push(structuredClone(shipped));changed=true;continue;}
    const current=next[index];
    const merged={...current,
      documents:[...current.documents.filter(d=>!shipped.documents.some(s=>s.id===d.id)),...shipped.documents],
      images:[...current.images.filter(d=>!shipped.images.some(s=>s.id===d.id)),...shipped.images]};
    if(JSON.stringify(current)!==JSON.stringify(merged)) {next[index]=structuredClone(merged);changed=true;}
  }
  if(changed) tileset.referenceDocuments=next;
  return changed;
}
