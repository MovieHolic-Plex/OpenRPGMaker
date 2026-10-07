import catalog from '@/assets/beodeulWarmTreesCatalog.json';
import type {TilesetDef,StructureKitDef,TileGroupMetadata} from '../types';
export const BEODEUL_WARM_TREES_TEXTURE='tex_beodeul_warm_trees';
export function createBeodeulWarmTreesTileset():TilesetDef{
 const priority=Array.from({length:catalog.count},()=>'lower' as 'lower'|'upper');
 const passability=Array.from({length:catalog.count},()=>({up:true,down:true,left:true,right:true}));
 for(const r of catalog.recipes)if(r.layer===3){
  for(const n of r.rows.flat())if(n>=0)priority[n]='upper';
  for(const [x,y] of r.blockingCells){const n=r.rows[y!]![x!]!;if(n>=0){priority[n]='lower';passability[n]={up:false,down:false,left:false,right:false};}}
 }
 return{id:catalog.id,name:'버들항 · 따뜻한 황록 나무·숲',image:{type:'bundled',id:catalog.texture},kind:'custom',family:'oprn-atlas',tileSize:16,tilesPerRow:8,count:catalog.count,
  priority,passability,terrain:Array(catalog.count).fill(0),referenceSourceTilesetId:'beodeul_city',
  tileGroups:catalog.recipes.map<TileGroupMetadata>(r=>({id:r.id,name:r.name,role:'prop',tileIds:r.rows.flat().filter(n=>n>=0),defaultLayer:r.layer===2?'lower':'upper',layerHome:r.layer===2?'lower':'upper',origin:'ai',description:r.layer===2?'본체와 같은 원점의 2층 바닥 그림자.':'확정 황록 나무 본체는 3층. 밑동 blockingCells만 막힘.',placementRules:'전체 본체와 -shadow를 같은 원점에 배치. 길 위 밑동·문 앞·물 금지.'})),
  structureKits:catalog.recipes.filter(r=>r.layer===3).map<StructureKitDef>(r=>({id:r.id,name:r.name,kind:'section',width:r.width,height:r.height,tileSize:16,learnedFrom:'pack-preset',
   rows:r.rows.map(row=>({tiles:row.map(()=>-1),upperTiles:row})),
   ai:{role:'prop',layerHome:'upper',repeatability:'fixed',tags:['버들항','따뜻한 황록','나무','숲'],description:'확정 색만 치환. 원래 윤곽·뿌리·겹침 보존.',placementRules:'전체 조각과 같은 원점의 -shadow를 함께 배치. beodeul_city 참고문서의 전체 배열과 layer 2/3을 읽는다. 문 앞·길·물 금지.'}}))};
}
