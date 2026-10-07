import type {TilesetDef,StructureKitDef} from '../types';
import type {TilesetReferenceCategory} from '../tilesetReferences';
import {translateTiles} from '../objectStamp';

/**
 * 사람이 허용한 건물을 담는 공용 타일셋의 공통 틀(beodeul-building-review → install.py, profiles.json).
 * 건물 한 채 = 본체(3층) + 바닥 그림자(2층) + 기초(4층), 같은 원점. 벽 칸은 막고 처마·지붕 칸은 걸을 수 있다.
 * 새 타일셋은 이 틀에 카탈로그·참고문서·접두사만 넘긴다.
 */
export interface BuildingCatalog{count:number;priority:unknown[];passability:unknown[];buildings:{id:string;name:string;source:string;material?:string;width:number;height:number;rows:number[][];shadowRows:number[][];foundationRows:number[][];parts:unknown[]}[]}
export interface BuildingBundleConfig{
 tilesetId:string;texture:string;name:string;label:string;catalog:BuildingCatalog;references:unknown;
 hostTilesetId:string;hostTexture:string;ids:{house:string;shadow:string;foundation:string;docs:string};tags:string[];
}

export function defineBuildingBundle(cfg:BuildingBundleConfig){
 const {catalog,ids}=cfg;
 const prefixes=[ids.house,ids.shadow,ids.foundation];
 const isKit=(id:string)=>prefixes.some(p=>id.startsWith(p));
 const kidOf=(buildingId:string)=>buildingId.slice(ids.house.length);

 function createTileset():TilesetDef{
  const structureKits:StructureKitDef[]=catalog.buildings.map(b=>({id:b.id,name:b.name,kind:'section',learnedFrom:'pack-preset',
   width:b.width,height:b.height,tileSize:16,rows:b.rows.map(r=>({tiles:r.map(()=>-1),upperTiles:[...r]})),parts:structuredClone(b.parts) as StructureKitDef['parts'],
   ai:{role:'building',repeatability:'fixed',layerHome:'upper',tags:[...cfg.tags,'사람이 허용',b.material==='log'?'통나무':'목골·돌','문 1개'],
    description:`${b.name}. 사람이 검수 화면에서 허용한 그림(${b.source}). 집당 한 입구, 벽은 막히고 지붕 처마는 걸을 수 있다.`,
    placementRules:`전체 ${b.width}×${b.height}와 문 앞 접근칸(문 아래 한 칸)을 예약한다. 같은 키트를 연속으로 놓지 말고 크기·지붕을 섞는다. ${ids.shadow}${kidOf(b.id)}를 2층, 본체를 3층, ${ids.foundation}${kidOf(b.id)}를 4층에 같은 원점으로 함께 놓는다.`}}));
  for(const b of catalog.buildings)for(const [kind,rows] of [['shadow',b.shadowRows],['foundation',b.foundationRows]] as const){
   structureKits.push({id:`${kind==='shadow'?ids.shadow:ids.foundation}${kidOf(b.id)}`,name:`${b.name} · ${kind==='shadow'?'바닥 그림자':'기초'}`,kind:'section',learnedFrom:'pack-preset',
    width:b.width+1,height:b.height+1,tileSize:16,rows:rows.map(r=>({tiles:r.map(()=>-1),upperTiles:[...r]})),
    ai:{role:'prop',repeatability:'fixed',layerHome:'perCell',tags:[...cfg.tags,kind],description:`${b.id}와 같은 원점에 ${kind==='shadow'?'2':'4'}층으로 놓는다. 모든 칸 통행 가능.`,placementRules:'건물과 같은 원점. 벽 칸을 막지 않는다.'}});
  }
  return{id:cfg.tilesetId,name:cfg.name,image:{type:'bundled',id:cfg.texture},kind:'custom',family:'oprn-atlas',tileSize:16,tilesPerRow:16,count:catalog.count,
   priority:[...catalog.priority] as TilesetDef['priority'],passability:structuredClone(catalog.passability) as TilesetDef['passability'],terrain:Array(catalog.count).fill(0),structureKits,referenceSourceTilesetId:cfg.hostTilesetId};
 }

 function ensureTileset(ts:TilesetDef):boolean{
  if(ts.id!==cfg.tilesetId||ts.image.id!==cfg.texture)return false;
  const fresh=createTileset();let changed=false;
  for(const key of ['count','priority','passability','terrain'] as const)if(JSON.stringify(ts[key])!==JSON.stringify(fresh[key])){(ts as any)[key]=fresh[key];changed=true;}
  const kits=ts.structureKits??=[];
  for(const k of fresh.structureKits!){const at=kits.findIndex(old=>old.id===k.id);if(at<0){kits.push(k);changed=true;}else if(JSON.stringify(kits[at])!==JSON.stringify(k)){kits[at]=k;changed=true;}}
  // a building removed from the catalog must not linger as a placeable kit
  const keep=new Set(fresh.structureKits!.map(k=>k.id)),next=kits.filter(k=>!isKit(k.id)||keep.has(k.id));
  if(next.length!==kits.length){ts.structureKits=next;changed=true;}
  return changed;
 }

 /** 호스트 타일셋(예: beodeul_city)에 허용한 건물을 이식한다(translateTiles). 한 번 이식한 칸은 다시 추가하지 않는다. */
 function ensureHost(ts:TilesetDef):boolean{
  if(ts.id!==cfg.hostTilesetId||ts.image.id!==cfg.hostTexture)return false;
  const source=createTileset(),graft=translateTiles(source,ts,source.structureKits!.flatMap(k=>k.rows.flatMap(r=>r.upperTiles)));
  let changed=graft.slotsAdded>0;
  for(const [n,target] of graft.map){
   if(ts.priority[target]!==source.priority[n]){ts.priority[target]=source.priority[n]!;changed=true;}
   if(JSON.stringify(ts.passability[target])!==JSON.stringify(source.passability[n])){ts.passability[target]=structuredClone(source.passability[n]!);changed=true;}
  }
  const kits=ts.structureKits??=[];
  for(const sourceKit of source.structureKits!){const k=structuredClone(sourceKit);k.rows=k.rows.map(r=>({...r,upperTiles:r.upperTiles.map(n=>n<0?-1:graft.map.get(n)!)}));
   const at=kits.findIndex(old=>old.id===k.id);if(at<0){kits.push(k);changed=true;}else if(JSON.stringify(kits[at])!==JSON.stringify(k)){kits[at]=k;changed=true;}}
  const keep=new Set(source.structureKits!.map(k=>k.id)),next=kits.filter(k=>!isKit(k.id)||keep.has(k.id));
  if(next.length!==kits.length){ts.structureKits=next;changed=true;}
  const cats=ts.referenceDocuments??=[];
  for(const r of cfg.references as unknown as TilesetReferenceCategory[]){const at=cats.findIndex(c=>c.id===r.id);
   if(at<0){cats.push(structuredClone(r));changed=true;}else{const old=cats[at]!,next2={...old,name:r.name,description:r.description,
    documents:[...old.documents.filter(d=>!d.id.startsWith(ids.docs)),...structuredClone(r.documents)],images:[...old.images.filter(i=>!i.id.startsWith(ids.docs)),...structuredClone(r.images)]};
    if(JSON.stringify(old)!==JSON.stringify(next2)){cats[at]=next2;changed=true;}}
  }
  return changed;
 }

 /** 스토어 팩용: 호스트 없이 혼자 쓰이므로 참고문서를 타일셋이 직접 들고 간다. */
 function createStandalone():TilesetDef{
  const ts=createTileset();delete ts.referenceSourceTilesetId;
  ts.referenceDocuments=structuredClone(cfg.references) as TilesetDef['referenceDocuments'];
  return ts;
 }
 return{TEXTURE:cfg.texture,createTileset,createStandalone,ensureTileset,ensureHost};
}
