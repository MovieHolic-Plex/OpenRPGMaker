import {beodeulFacilityPlans,facilityPropId} from '../../assets/beodeulFacilitiesPlans';
import references from '../../assets/beodeulFacilitiesReferences.json';
import {createBeodeulArchitectureTileset} from './beodeulArchitecture';
import {translateTiles} from '../objectStamp';
import type {StructureKitDef,TilesetDef} from '../types';
import type {TilesetReferenceCategory} from '../tilesetReferences';

export function beodeulFacilityReferences():TilesetReferenceCategory[]{
 return structuredClone(references) as unknown as TilesetReferenceCategory[];
}

/** Compose complete approved buildings and outdoor workspaces; no bitmap edits. */
export function ensureBeodeulFacilityKits(ts:TilesetDef):boolean{
 if(ts.id!=='beodeul_city'||ts.image.id!=='tex_beodeul_city')return false;
 const source=createBeodeulArchitectureTileset(),native=new Map(ts.structureKits?.map(k=>[k.id,k]));
 const repaired=new Map(source.structureKits!.map(k=>[k.id,k]));
 const needed=source.structureKits!.flatMap(k=>k.rows.flatMap(r=>r.upperTiles ?? []));
 const translated=translateTiles(source,ts,needed);let changed=translated.slotsAdded>0;
 const kits=ts.structureKits??=[];
 for(const [id,name,body,group,a,b] of beodeulFacilityPlans){
  const sourceBody=repaired.get('bd-house-'+body),base=sourceBody??native.get('bd-house-'+body);
  if(!base)throw new Error('Missing facility building: '+body);
  const props=[a,b].map(key=>{const kit=native.get(facilityPropId(key));if(!kit)throw new Error('Missing facility prop: '+key);return kit;});
  const width=base.width+5,secondY=Math.max(base.height,props[0]!.height+3),height=Math.max(base.height+3,secondY+props[1]!.height+1);
  const rows=Array.from({length:height},()=>({tiles:Array(width).fill(-1),upperTiles:Array(width).fill(-1)}));
  function put(k:StructureKitDef,x:number,y:number,remap=false){
   for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){
    for(const field of ['tiles','upperTiles'] as const){const n=k.rows[dy]?.[field]?.[dx];if(n==null||n<0)continue;
     const dest=rows[y+dy]?.[field];if(!dest)continue;
     if(dest[x+dx]>=0)throw new Error('Facility overlap: '+id);
     dest[x+dx]=remap?translated.map.get(n)!:n;
    }
   }
  }
  put(base,1,1,!!sourceBody);put(props[0]!,base.width+2,2);put(props[1]!,base.width+2,secondY);
  const parts=structuredClone(base.parts??[]).map(part=>({...part,dx:part.dx+1,dy:part.dy+1}));
  const entrances=parts.filter(part=>part.kind==='entrance');
  if(entrances.length!==1)throw new Error('Facility must have one entrance: '+id);
  const front=entrances[0]!;
  for(let y=front.dy+front.h;y<height;y++){
   const n=(rows[y]!.upperTiles ?? [])[front.dx],pass=ts.passability[n];
   if(n>=0&&ts.priority[n]!=='upper'&&pass&&(!pass.up||!pass.down||!pass.left||!pass.right))throw new Error('Facility approach blocked: '+id);
  }
  const kit:StructureKitDef={id:'bd-facility-'+id,name:'버들항 '+name+' · 건물과 작업 마당',kind:'section',learnedFrom:'pack-preset',tileSize:16,width,height,rows,parts,
   ai:{role:'building',repeatability:'fixed',layerHome:'perCell',themes:[group],tags:['버들항',name,group,'문 1개'],
    description:name+'. 완전한 원본 건물과 용도별 소품을 함께 조립한다. 기와·윤곽·도트·벽 재질을 유지한다. 외장 도안이며 시설 기능과 NPC는 별도 저작한다.',
    placementRules:'평지에 전체 영역을 예약한다. 건물 기초·흙마당을 먼저 깔고 위층을 찍는다. entrance 바로 아래부터 남쪽 끝까지 길을 잇는다. 강 위에 건물 금지. 나루터는 실제 잔교를 별도로 연결한다.'}};
  const at=kits.findIndex(k=>k.id===kit.id);
  if(at<0){kits.push(kit);changed=true;}else if(JSON.stringify(kits[at])!==JSON.stringify(kit)){kits[at]=kit;changed=true;}
 }
 const cats=ts.referenceDocuments??=[];
 for(const shipped of beodeulFacilityReferences()){
  const at=cats.findIndex(c=>c.id===shipped.id);
  if(at<0){cats.push(shipped);changed=true;}
  else {const old=cats[at]!,next={...old,name:shipped.name,description:shipped.description,
   documents:[...old.documents.filter(d=>!d.id.startsWith('bd-facility-')),...shipped.documents],
   images:[...old.images.filter(i=>!i.id.startsWith('bd-facility-')),...shipped.images]};
   if(JSON.stringify(old)!==JSON.stringify(next)){cats[at]=next;changed=true;}
  }
 }
 return changed;
}
