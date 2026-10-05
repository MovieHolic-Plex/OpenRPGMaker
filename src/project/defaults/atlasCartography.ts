import sheet from '@/assets/atlasCartographySheet.json';
import references from '@/assets/atlasCartographyReferences.json';
import type { Project,TilesetDef } from '../types';
import type { TilesetReferenceCategory } from '../tilesetReferences';

export const ATLAS_CARTOGRAPHY_ID = 'atlas_cartography';
export const ATLAS_CARTOGRAPHY_TEXTURE = 'tex_atlas_cartography';
export const ATLAS_CARTOGRAPHY_ICONS = sheet.icons;
export function ensureAtlasCartographyTerrain(project:Project):void {
  project.tilesets.atlas_cartography??=createAtlasCartographyTileset();
  const terrains=project.database.terrains??=[];
  let ladder=terrains.findIndex(t=>t.id==='atlas_room_ladder');
  if(ladder<0){ladder=terrains.length;terrains.push({id:'atlas_room_ladder',name:'방 사다리',damage:0,encounterRatePercent:100,characterDisplay:'normal',vehiclePassage:{boat:false,ship:false,airshipLand:false},climbable:true});}
  project.tilesets.atlas_cartography.terrain[50]=ladder+1;
}
export function createAtlasCartographyTileset(): TilesetDef {
  const blocked=(id:number)=>id>=8&&id<40||[40,41,43,45,49,55,56,57].includes(id);
  return {id:ATLAS_CARTOGRAPHY_ID,name:'지도 지형 · 새 손 도트 32px',kind:'custom',family:'worldmap-kit',
    image:{type:'bundled',id:ATLAS_CARTOGRAPHY_TEXTURE},tileSize:32,tilesPerRow:8,count:sheet.count,
    passability:sheet.labels.map((_,id)=>({up:!blocked(id),down:!blocked(id),left:!blocked(id),right:!blocked(id)})),
    priority:sheet.labels.map((_,id)=>id>=64?'upper':'lower'),terrain:sheet.labels.map((_,id)=>id>=8&&id<24?1:0),
    tileMeta:sheet.labels.map((label,id)=>({label,description:id>=64?'사람 승인 원본 아이콘. 전체 키트로 배치한다.':'새 코드 도트 지형. 사방 연결은 지형 생성기가 계산한다.',
      passage:id>=64?'star':blocked(id)?'solid':'passable',defaultLayer:id>=64?'upper':'lower',source:'bundled-default'})),
    structureKits:sheet.icons.map((icon,i)=>({id:'atlas-icon-'+i,kind:'section',name:icon.name,tileSize:32,width:icon.width,height:icon.height,
      rows:icon.rows.map(row=>({tiles:row.map(()=>-1),upperTiles:row})),learnedFrom:'db-authored'})),
    referenceDocuments:structuredClone(references) as TilesetReferenceCategory[]};
}
export function ensureAtlasCartographyReferences(t:TilesetDef):boolean {
  if(t.image.type!=='bundled'||t.image.id!==ATLAS_CARTOGRAPHY_TEXTURE)return false;
  t.referenceDocuments??=[];let changed=false;
  for(const category of references)if(!t.referenceDocuments.some(c=>c.id===category.id)){t.referenceDocuments.push(structuredClone(category));changed=true;}
  return changed;
}
