import catalog from '../../assets/beodeulFormsCatalog.json';
import references from '../../assets/beodeulFormsReferences.json';
import type {TilesetDef,StructureKitDef} from '../types';
import type {TilesetReferenceCategory} from '../tilesetReferences';
import {translateTiles} from '../objectStamp';

export const BEODEUL_FORMS_TEXTURE='tex_beodeul_forms';
// 2026-10-05: user rejected these four silhouettes. Keep their pixels for saved
// maps, but stop offering their stamps as examples or newly placeable kits.
const rejectedConcepts=new Set(['wing','inn','smithy','warehouse']);
const rejectedKitIds=new Set([...rejectedConcepts].flatMap(c=>[
 `bd-house-form-${c}`,`bd-form-shadow-${c}`,`bd-form-foundation-${c}`,
]));
function removeRejectedKits(ts:TilesetDef):boolean{
 const old=ts.structureKits??[];const next=old.filter(k=>!rejectedKitIds.has(k.id));
 if(next.length===old.length)return false;ts.structureKits=next;return true;
}
export function createBeodeulFormsTileset():TilesetDef{
 const available=catalog.buildings.filter(b=>!rejectedConcepts.has(b.concept));
 const structureKits:StructureKitDef[]=available.map(b=>({id:b.id,name:b.name,kind:'section',learnedFrom:'pack-preset',
  width:b.width,height:b.height,tileSize:16,rows:b.rows.map(r=>({tiles:r.map(()=>-1),upperTiles:[...r]})),parts:structuredClone(b.parts) as StructureKitDef['parts'],
  ai:{role:'building',repeatability:'fixed',layerHome:'upper',tags:['버들항','3/4 탑뷰',b.concept,'문 1개'],
   description:b.name+'. '+b.roofDescription+'. 원본 도트 조각을 1:1로 조립한 별도 구조. 집당 한 입구.',
   placementRules:'전체 width×height와 entrance 아래 접근칸을 예약한다. 동일 concept 연속 배치를 피하고 긴 집·좁은 집·꺾인 집을 섞는다. 해당 bd-form-shadow/foundation을 2층/4층에 함께 놓는다.'}}));
 for(const b of available)for(const [kind,rows] of [['shadow',b.shadowRows],['foundation',b.foundationRows]] as const){
  structureKits.push({id:`bd-form-${kind}-${b.concept}`,name:b.name+' · '+(kind==='shadow'?'바닥 그림자':'기초'),kind:'section',learnedFrom:'pack-preset',
   width:b.width+1,height:b.height+1,tileSize:16,rows:rows.map(r=>({tiles:r.map(()=>-1),upperTiles:[...r]})),
   ai:{role:'prop',repeatability:'fixed',layerHome:'perCell',tags:['버들항',kind],description:`${b.id}와 같은 원점에 ${kind==='shadow'?'2':'4'}층으로 놓는다. 모든 칸 통행 가능.`,placementRules:'건물과 같은 원점. 그림자 위에 건물, 건물 위에 기초 접점.'}});
 }
 return{id:'beodeul_forms',name:'버들항 · 긴 민가와 좁은 이층집',image:{type:'bundled',id:BEODEUL_FORMS_TEXTURE},kind:'custom',family:'oprn-atlas',tileSize:16,tilesPerRow:16,count:catalog.count,
  priority:[...catalog.priority] as TilesetDef['priority'],passability:structuredClone(catalog.passability),terrain:Array(catalog.count).fill(0),structureKits,referenceSourceTilesetId:'beodeul_city'};
}

export function ensureBeodeulFormsTileset(ts:TilesetDef):boolean{
 if(ts.id!=='beodeul_forms'||ts.image.id!==BEODEUL_FORMS_TEXTURE)return false;
 const fresh=createBeodeulFormsTileset();let changed=removeRejectedKits(ts);
 for(const key of ['count','priority','passability','terrain'] as const)if(JSON.stringify(ts[key])!==JSON.stringify(fresh[key])){(ts as any)[key]=fresh[key];changed=true;}
 const kits=ts.structureKits??=[];
 for(const k of fresh.structureKits!){const at=kits.findIndex(old=>old.id===k.id);if(at<0){kits.push(k);changed=true;}else if(JSON.stringify(kits[at])!==JSON.stringify(k)){kits[at]=k;changed=true;}}
 return changed;
}

/** Approved legacy forms only. New review candidates are not installed here. */
export function ensureBeodeulForms(ts:TilesetDef):boolean{
 if(ts.id!=='beodeul_city'||ts.image.id!=='tex_beodeul_city')return false;
 const source=createBeodeulFormsTileset(),graft=translateTiles(source,ts,source.structureKits!.flatMap(k=>k.rows.flatMap(r=>r.upperTiles)));
 let changed=removeRejectedKits(ts)||graft.slotsAdded>0;
 for(const [n,target] of graft.map){
  if(ts.priority[target]!==source.priority[n]){ts.priority[target]=source.priority[n]!;changed=true;}
  if(JSON.stringify(ts.passability[target])!==JSON.stringify(source.passability[n])){ts.passability[target]=structuredClone(source.passability[n]!);changed=true;}
 }
 const kits=ts.structureKits??=[];
 for(const sourceKit of source.structureKits!){const k=structuredClone(sourceKit);k.rows=k.rows.map(r=>({...r,upperTiles:r.upperTiles.map(n=>n<0?-1:graft.map.get(n)!)}));
  const at=kits.findIndex(old=>old.id===k.id);if(at<0){kits.push(k);changed=true;}else if(JSON.stringify(kits[at])!==JSON.stringify(k)){kits[at]=k;changed=true;}}
 const cats=ts.referenceDocuments??=[];
 for(const r of references as unknown as TilesetReferenceCategory[]){const at=cats.findIndex(c=>c.id===r.id);
  if(at<0){cats.push(structuredClone(r));changed=true;}else{const old=cats[at]!,next={...old,name:r.name,description:r.description,
   documents:[...old.documents.filter(d=>!d.id.startsWith('bd-form-')),...structuredClone(r.documents)],images:[...old.images.filter(i=>!i.id.startsWith('bd-form-')),...structuredClone(r.images)]};
   if(JSON.stringify(old)!==JSON.stringify(next)){cats[at]=next;changed=true;}}
 }
 return changed;
}
