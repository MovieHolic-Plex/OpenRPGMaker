import catalog from '@/assets/beodeulGroundCatalog.json';
import {createBeodeulGroundTileset,ensureBeodeulGroundReferences} from '@/project/defaults/beodeulGround';
import {translateTiles} from '@/project/objectStamp';
import {layerTileAt,setLayerTileAt,compactMapLayers} from '@/project/mapLayers';
import {computeReachableCells} from '@/project/lint/reachability';
import {SMALL_BEODEUL_HOUSES} from './beodeulSmallVillage';
import {ToolError,type ToolDefinition} from './types';
import type {Project} from '@/project/types';

type Recipe=(typeof catalog.recipes)[number]&{hamlet?:boolean;kind?:string;mask?:number;variant?:number;lighting?:boolean;anchor?:string};
const recipes=catalog.recipes as Recipe[];
/** Explicit lower-ground composition for the known small-village template; never a general map eraser. */
export function naturalizeBeodeulHamlet(project:Project,mapId:string){
 const m=project.maps[mapId],ts=m&&project.tilesets[m.tilesetId];
 if(!m||ts?.id!=='beodeul_city'||m.width<40||m.height<30)throw new ToolError('버들항 소규모 마을 맵이 필요합니다.');
 const kits=new Map(ts.structureKits?.map(k=>[k.id,k]));
 // The core keeps its positions when a church is appended to the east. Infer its offset from the first complete house.
 const cream=kits.get(SMALL_BEODEUL_HOUSES[0].kit);if(!cream)throw new ToolError('공용 작은 마을 건물 키트가 필요합니다.');
 const first=cream.rows.flatMap((r,y)=>r.upperTiles.map((n,x)=>({n,x,y}))).find(p=>p.n>=0)!;
 const matches=[];
 for(let i=0;i<m.width*m.height;i++)if(layerTileAt(m,3,i)===first.n){
  const x=i%m.width-first.x,y=Math.floor(i/m.width)-first.y;
  if(x>=0&&y>=0&&x+cream.width<=m.width&&y+cream.height<=m.height&&cream.rows.every((r,dy)=>r.upperTiles.every((n,dx)=>n<0||layerTileAt(m,3,(y+dy)*m.width+x+dx)===n)))matches.push({x,y});
 }
 if(matches.length!==1)throw new ToolError('작은 마을의 원본 집 원점을 하나로 확인할 수 없습니다.');
 const ox=matches[0]!.x-4,oy=matches[0]!.y-3;
 const houses=SMALL_BEODEUL_HOUSES.filter(h=>{const k=kits.get(h.kit);return k&&k.rows.every((r,dy)=>r.upperTiles.every((n,dx)=>n<0||layerTileAt(m,3,(h.y+oy+dy)*m.width+h.x+ox+dx)===n));});
 if(houses.length<3)throw new ToolError('지원하는 작은 마을 집 3채 이상의 전체 배열과 배치가 일치해야 합니다.');
 if(m.relief?.levels.some(n=>n>0))throw new ToolError('높이가 있는 마을은 이 평지 배치 도구로 바꾸지 않습니다.');
 const oldGrafts=new Map(ts.tileGrafts?.map(g=>[g.targetTile,g]));
 const recipeBySource=new Map(recipes.flatMap(r=>r.rows.flat().map(n=>[n,r] as const)));
 const own=(n:number)=>{const g=oldGrafts.get(n);return g?.sourceChipset==='tex_beodeul_ground'?recipeBySource.get(g.sourceTile):undefined;};
 if(Array.from({length:m.width*m.height},(_,i)=>own(layerTileAt(m,1,i))?.hamlet).some(Boolean))return{summary:'작은 마을의 길·마당 구성이 이미 적용되어 있습니다.',data:{mapId,alreadyApplied:true}};
 const common=project.tilesets.beodeul_ground??=createBeodeulGroundTileset();ensureBeodeulGroundReferences(common);
 const newRecipes=recipes.filter(r=>r.hamlet);const translated=translateTiles(common,ts,newRecipes.flatMap(r=>r.rows.flat()));
 const index=(x:number,y:number)=>(y+oy)*m.width+x+ox;
 const inside=(x:number,y:number)=>x+ox>=0&&y+oy>=0&&x+ox<m.width&&y+oy<m.height;
 const roadIds=new Set(ts.autotileGroups?.find(g=>g.id==='beodeul_road_autotile')?.memberTileIds);
 // Clear only the known paving, old low-opacity meadow and small movable ground decorations.
 // House foundations, roots, shadows and every existing house/tree/event remain.
 const clearedDecor:number[]=[];let removedRoadCells=0;
 for(let i=0;i<m.width*m.height;i++){
  const n=layerTileAt(m,1,i),r=own(n);if(roadIds.has(n)||r?.lighting&&'baseTile' in r){setLayerTileAt(m,1,i,737);removedRoadCells++;}
  const lower=own(layerTileAt(m,2,i));if(lower?.id.startsWith('bdg-light-meadow-')||lower?.id==='bdg-worn-soil')setLayerTileAt(m,2,i,-1);
  const upper=own(layerTileAt(m,4,i));if(upper&&/^bdg-(grass-\d|flowers-|stones|litter)/.test(upper.id)){clearedDecor.push(i);setLayerTileAt(m,4,i,-1);}
 }
 const soil=new Set<number>(),stone=new Set<number>(),meadow=new Set<number>();
 const put=(set:Set<number>,x:number,y:number)=>{if(inside(x,y))set.add(index(x,y));};
 const path=(set:Set<number>,points:number[][],wide=1)=>{
  for(let k=1;k<points.length;k++){
   const [ax,ay]=points[k-1]!,[bx,by]=points[k]!;const steps=Math.max(Math.abs(bx!-ax!),Math.abs(by!-ay!));let px=ax!,py=ay!;
   for(let t=0;t<=steps;t++){
    const x=Math.round(ax!+(bx!-ax!)*t/(steps||1)),y=Math.round(ay!+(by!-ay!)*t/(steps||1));
    for(let dy=0;dy<wide;dy++)for(let dx=0;dx<wide;dx++){put(set,x+dx,y+dy);if(x!==px&&y!==py)put(set,x+dx,py+dy);}
    px=x;py=y;
   }
  }
 };
 const oval=(set:Set<number>,cx:number,cy:number,rx:number,ry:number)=>{
  for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<1)put(set,x,y);
 };
 path(stone,[[0,14],[9,14],[11,12],[15,12],[18,15],[20,16],[27,16],[34,16],[39,17]],2);
 oval(stone,20,17,4,2.2);
 const approaches=[[[6,9],[6,11],[9,13],[10,14]],[[19,10],[19,12],[20,14],[20,16]],[[32,11],[32,13],[31,15],[30,16]],[[6,26],[11,27],[14,25],[14,20],[16,17]],[[30,26],[32,27],[34,26],[34,22],[34,19],[32,17]]];
 const yards=[[7,10,3.8,1.8],[21,11,3.8,1.7],[32,12,2.5,1.6],[8,27,4.5,1.35],[30.5,27,3.8,1.6]];
 for(const h of houses){const hi=SMALL_BEODEUL_HOUSES.indexOf(h);path(soil,approaches[hi]!);oval(soil,...yards[hi] as [number,number,number,number]);}
 const hasChurch=m.width>=54&&kits.get('bd-house-village-church')?.rows.every((r,dy)=>r.upperTiles.every((n,dx)=>n<0||layerTileAt(m,3,index(41+dx,3+dy))===n));
 if(hasChurch){path(stone,[[38,17],[42,17],[48,17]],2);oval(stone,47,17.5,6.1,2.4);}
 for(const zone of [[2,20,4,4],[29,2,5,2.6],[18,27,5,3],[46,25,6,3.5],[37,7,3.5,5]])oval(meadow,...zone as [number,number,number,number]);
 const paint=(set:Set<number>,kind:string)=>{
  for(const i of set){if(kind!=='stone'&&stone.has(i)||kind==='meadow'&&soil.has(i))continue;
   const x=i%m.width,y=Math.floor(i/m.width);let mask=0;
   for(const [dx,dy,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]]){const ni=(y+dy!)*m.width+x+dx!;if(x+dx!>=0&&x+dx!<m.width&&y+dy!>=0&&y+dy!<m.height&&set.has(ni))mask|=bit!;}
   // Preserve authored plaza stones and only paint the original lawn or the cleared paving.
   if(layerTileAt(m,1,i)!==737)continue;
   const r=newRecipes.find(r=>r.kind===kind&&r.mask===mask)!;setLayerTileAt(m,1,i,translated.map.get(r.rows[0]![0]!)!);
  }
 };
 paint(meadow,'meadow');paint(soil,'soil');paint(stone,'stone');
 // Dress the house thresholds with occasional small stones, keeping most earth visible.
 for(const hi of [0,2,3])if(houses.includes(SMALL_BEODEUL_HOUSES[hi]!)){
  const p=approaches[hi]!;for(let a=0;a<Math.min(2,p.length);a++){
   const [x,y]=p[a]!,i=index(x!,y!);if(!inside(x!,y!)||layerTileAt(m,1,i)===737||stone.has(i))continue;
   const r=newRecipes.find(r=>r.kind==='steps'&&r.variant===(hi+a)%4)!;setLayerTileAt(m,1,i,translated.map.get(r.rows[0]![0]!)!);
  }
 }
 const additions:Array<{kit:string;x:number;y:number}>=[];
 const stampKit=(id:string,x:number,y:number)=>{
  const k=kits.get(id);if(!k||!inside(x,y)||!inside(x+k.width-1,y+k.height-1))return;
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++)if(k.rows[dy]!.upperTiles[dx]!>=0){const i=index(x+dx,y+dy);if(layerTileAt(m,3,i)>=0||layerTileAt(m,4,i)>=0||stone.has(i)||soil.has(i)||m.events.some(e=>e.x===x+ox+dx&&e.y===y+oy+dy))return;}
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){const n=k.rows[dy]!.upperTiles[dx]!;if(n>=0)setLayerTileAt(m,3,index(x+dx,y+dy),n);}
  additions.push({kit:id,x:x+ox,y:y+oy});
 };
 // Group shrubs at the feet/outer edges of existing trees; leave the center open.
 for(const [id,x,y] of [['bd-tree-f4f319',0,22],['bd-tree-37f48b',3,22],['bd-tree-f4f319',14,28],['bd-tree-37f48b',19,28],['bd-tree-37f48b',39,8],['bd-tree-f4f319',41,26],['bd-tree-37f48b',48,26],['bd-tree-f4f319',51,27]] as const)stampKit(id,x,y);
 stampKit('bd-out-fence-run',2,12);stampKit('bd-out-fence-run',6,29);
 // Laundry belongs in the courtyard beside the two-story house. Move only the complete matching native rack.
 const rack=kits.get('bd-prop-laundry_rack');
 if(rack&&rack.rows.every((r,dy)=>r.upperTiles.every((n,dx)=>n<0||layerTileAt(m,3,index(24+dx,7+dy))===n))&&rack.rows.every((r,dy)=>r.upperTiles.every((n,dx)=>n<0||layerTileAt(m,3,index(22+dx,11+dy))<0&&layerTileAt(m,4,index(22+dx,11+dy))<0))){
  for(let dy=0;dy<rack.height;dy++)for(let dx=0;dx<rack.width;dx++){const n=rack.rows[dy]!.upperTiles[dx]!;if(n>=0){setLayerTileAt(m,3,index(24+dx,7+dy),-1);setLayerTileAt(m,3,index(22+dx,11+dy),n);}}
  additions.push({kit:'bd-prop-laundry_rack',x:22+ox,y:11+oy});
 }
 // A small vegetable bed beside the cream house, off the approach.
 const bed=newRecipes.find(r=>r.kind==='vegetable-bed')!;let bedCells=0;
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<3;dx++){const i=index(8+dx,11+dy);if(layerTileAt(m,2,i)<0&&layerTileAt(m,3,i)<0&&layerTileAt(m,4,i)<0){setLayerTileAt(m,2,i,translated.map.get(bed.rows[dy]![dx]!)!);bedCells++;}}
 // Put sparse ground clusters along vegetation edges rather than uniformly throughout the lawn.
 const decorationRecipes=recipes.filter(r=>/^bdg-(grass-\d|flowers-)/.test(r.id));
 const decorTiles=translateTiles(common,ts,decorationRecipes.flatMap(r=>r.rows.flat()));let clusterCells=0;
 for(const [j,[x,y]] of [[2,24],[4,22],[12,28],[20,27],[28,3],[33,3],[39,10],[42,27],[47,28],[50,26],[10,11],[25,12]].entries()){
  const r=decorationRecipes[j%5===0?3:j%3]!;
  for(let dx=0;dx<r.width;dx++){const i=index(x!+dx,y!);if(!inside(x!+dx,y!)||soil.has(i)||stone.has(i)||layerTileAt(m,3,i)>=0||layerTileAt(m,4,i)>=0)continue;setLayerTileAt(m,4,i,decorTiles.map.get(r.rows[0]![dx]!)!);clusterCells++;}
 }
 compactMapLayers(m);
 const fronts:Array<{kit:string;x:number;y:number}>=houses.map(h=>{const k=kits.get(h.kit)!,p=k.parts!.find(p=>p.kind==='entrance')!;return{kit:h.kit,x:h.x+ox+p.dx,y:h.y+oy+p.dy+p.h};});
 if(hasChurch)fronts.push({kit:'bd-house-village-church',x:48+ox,y:16+oy});
 const reachable=computeReachableCells(project,m,18+ox,17+oy);
 if(fronts.some(p=>!reachable.has(`${p.x},${p.y}`)))throw new ToolError('길·마당 보정 후 문 앞 도달성이 끊겼습니다.');
 return{summary:'원본 집을 유지하고 큰길·우물/교회 광장, 흙 샛길·집 앞 마당·텃밭·빨래 마당과 나무 곁 군락으로 작은 마을을 정리했습니다.',data:{mapId,removedRoadCells,soilCells:soil.size,stoneCells:stone.size,meadowCells:meadow.size,clearedDecor:clearedDecor.length,clusterCells,vegetableBedCells:bedCells,additions,fronts,housePositionsPreserved:true,doorsReachable:true}};
}
export const BEODEUL_HAMLET_TOOLS:readonly ToolDefinition[]=[{
 name:'naturalize_beodeul_hamlet',mode:'write',domains:['map','tile'],preservesAuthoredRaster:true,
 description:'공용 소규모 버들항 템플릿(집 3~5채)의 길/마당 구도를 보정한다. 전체 집 배열과 원점이 일치할 때만 실행. 기존 집·지붕·문·나무·이벤트를 보존하고 옛 돌 샛길을 흙길로 정리, 공용 큰길/광장·텃밭·빨래 마당·가장자리 식생 군락을 적용. 기존 길/풀 장식 변경을 요청했을 때 사용. 임의 마을/높이 지형에는 사용 불가. 먼저 beodeul-ground-dressing의 작은 마을 구도 문서/그림을 읽는다.',
 parameters:{type:'object',properties:{mapId:{type:'string'}},required:['mapId'],additionalProperties:false},run:(p,a)=>naturalizeBeodeulHamlet(p,String(a.mapId)),
}];
