import catalog from '@/assets/beodeulArchitectureCatalog.json';
import type { Project, StructureKitDef, TilesetDef } from '../types';
import { translateTiles } from '../objectStamp';

export const BEODEUL_ARCHITECTURE_TEXTURE='tex_beodeul_architecture';
export function createBeodeulArchitectureTileset():TilesetDef {
  return {id:'beodeul_architecture',name:'버들항 · 원본 보존 민가·성당',image:{type:'bundled',id:BEODEUL_ARCHITECTURE_TEXTURE},
    kind:'custom',family:'oprn-atlas',tileSize:16,tilesPerRow:16,count:catalog.count,
    priority:[...catalog.priority] as TilesetDef['priority'],passability:structuredClone(catalog.passability),terrain:Array(catalog.count).fill(0),
    referenceSourceTilesetId:'beodeul_city',
    structureKits:catalog.buildings.map<StructureKitDef>(b=>({id:b.id,name:b.name,kind:'section',learnedFrom:'pack-preset',
      width:b.width,height:b.height,tileSize:16,parts:structuredClone(b.parts) as StructureKitDef['parts'],
      rows:b.rows.map(row=>({tiles:row.map(()=>-1),upperTiles:[...row]})),
      ai:{role:'building',repeatability:'fixed',layerHome:'upper',tags:['버들항','3/4 탑뷰',b.concept,b.windowStyle],
        description:`${b.name}. 원본 기와 픽셀·윤곽 보존, 돌집 박공 벽·창 정리, 측면은 필수 아님. 문 1개. 기초는 공용 접지 레시피로 보강.`,placementRules:'beodeul_city에 윗층 도장. 문 앞은 parts.entrance 바로 아래. 실내/이벤트는 별도.'}}))};
}

export function ensureBeodeulArchitectureTileset(tileset:TilesetDef):boolean {
  if(tileset.id!=='beodeul_architecture'||tileset.image.id!==BEODEUL_ARCHITECTURE_TEXTURE)return false;
  const fresh=createBeodeulArchitectureTileset();let changed=false;
  if(tileset.count!==fresh.count||JSON.stringify(tileset.priority)!==JSON.stringify(fresh.priority)||JSON.stringify(tileset.passability)!==JSON.stringify(fresh.passability)){
    tileset.count=fresh.count;tileset.priority=fresh.priority;tileset.passability=fresh.passability;tileset.terrain=Array(fresh.count).fill(0);changed=true;
  }
  const kits=tileset.structureKits??=[];
  for(const kit of fresh.structureKits!){
    const at=kits.findIndex(k=>k.id===kit.id);
    if(at<0){kits.push(kit);changed=true;}
    else if(JSON.stringify(kits[at])!==JSON.stringify(kit)){kits[at]=kit;changed=true;}
  }
  return changed;
}

/** Install translated source kits only when a tool requests them; existing native art stays unchanged. */
export function installBeodeulArchitecture(project:Project):void {
  const source=project.tilesets.beodeul_architecture??=createBeodeulArchitectureTileset();
  ensureBeodeulArchitectureTileset(source);
  const target=project.tilesets.beodeul_city;
  if(!target)throw new Error('버들항 타일셋이 없습니다.');
  const translated=translateTiles(source,target,source.structureKits!.flatMap(k=>k.rows.flatMap(r=>r.upperTiles ?? [])));
  for(const [sourceTile,targetTile] of translated.map){
    target.priority[targetTile]=source.priority[sourceTile]!;target.passability[targetTile]=structuredClone(source.passability[sourceTile]!);
  }
  const kits=target.structureKits??=[];
  for(const sourceKit of source.structureKits!){
    const kit=structuredClone(sourceKit);
    kit.rows=kit.rows.map(r=>({...r,upperTiles:(r.upperTiles ?? []).map(n=>n<0?-1:translated.map.get(n)!)}));
    const at=kits.findIndex(k=>k.id===kit.id);
    if(at<0)kits.push(kit);else kits[at]=kit;
  }
}
