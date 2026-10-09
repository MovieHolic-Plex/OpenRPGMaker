import architecture from '@/assets/beodeulArchitectureCatalog.json';
import catalog from '@/assets/beodeulGroundCatalog.json';
import { createBeodeulGroundTileset, ensureBeodeulGroundReferences } from '@/project/defaults/beodeulGround';
import { translateTiles } from '@/project/objectStamp';
import { layerTileAt, setLayerTileAt } from '@/project/mapLayers';
import type { Project, StructureKitDef } from '@/project/types';
import { ToolError, type ToolDefinition } from './types';

type LightingRecipe=(typeof catalog.recipes)[number]&{lighting?:boolean;anchor?:string;dx?:number;dy?:number;baseTile?:number;variant?:number};
const recipes=catalog.recipes as LightingRecipe[];
type Anchor={kit:StructureKitDef;x:number;y:number};

/** Ground-only daylight. Each original building pixel, object position and entrance stays intact. */
export function harmonizeBeodeulDaylight(project:Project,mapId:string,options:{shadows?:boolean;roads?:boolean;meadow?:boolean}={}){
  const map=project.maps[mapId],target=map&&project.tilesets[map.tilesetId];
  if(!map||target?.image.id!=='tex_beodeul_city'||target.tileSize!==16)throw new ToolError('버들항 16px 맵이 필요합니다.');
  const light=recipes.filter(r=>r.lighting),source=project.tilesets.beodeul_ground??=createBeodeulGroundTileset();
  ensureBeodeulGroundReferences(source);
  const translated=translateTiles(source,target,light.flatMap(r=>r.rows.flat()));
  const grafts=new Map(target.tileGrafts?.map(g=>[g.targetTile,g]));
  const sourceRecipe=new Map(light.flatMap(r=>r.rows.flat().filter(n=>n>=0).map(n=>[n,r] as const)));
  const own=(n:number)=>{const g=grafts.get(n);return g?.sourceChipset==='tex_beodeul_ground'?sourceRecipe.get(g.sourceTile):undefined;};
  const base=(n:number)=>{const g=grafts.get(n);return own(n)?.baseTile??(g?.sourceChipset==='tex_beodeul_city'?g.sourceTile:n);};
  const wanted={shadows:options.shadows!==false,roads:options.roads!==false,meadow:options.meadow!==false};
  // A repeated complete application is a no-op, including its tileset metadata.
  const already=Array.from({length:map.width*map.height},(_,i)=>own(layerTileAt(map,2,i))?.anchor).some(Boolean);
  if(already&&wanted.shadows&&wanted.roads&&wanted.meadow)return{summary:'이 맵에는 공용 일광·접지 보정이 이미 있습니다.',data:{mapId,alreadyApplied:true,changes:0}};
  const native=(n:number)=>{const g=grafts.get(n);return g?.sourceChipset==='tex_beodeul_city'?g.sourceTile:g?.sourceChipset==='tex_beodeul_door'?(g.sourceTile<8?5743:2333):n;};
  const kitIds=new Set([...architecture.buildings.flatMap(b=>[b.id,b.sourceKit]),'bd-tree-03a8f7','bd-tree-3e8732','bd-tree-1a786c']);
  const anchors:Anchor[]=[];
  for(const kit of target.structureKits??[]){
    if(!kitIds.has(kit.id))continue;
    const first=kit.rows.flatMap((r,y)=>(r.upperTiles ?? []).map((n,x)=>({n,x,y}))).find(p=>p.n>=0);if(!first)continue;
    for(let i=0;i<map.width*map.height;i++){
      if(native(layerTileAt(map,3,i))!==first.n)continue;
      const x=i%map.width-first.x,y=Math.floor(i/map.width)-first.y;
      if(x<0||y<0||x+kit.width>map.width||y+kit.height>map.height)continue;
      if(kit.rows.every((r,dy)=>(r.upperTiles ?? []).every((n,dx)=>n<0||native(layerTileAt(map,3,(y+dy)*map.width+x+dx))===n)))anchors.push({kit,x,y});
    }
  }
  const unique=anchors.filter((a,ai)=>!anchors.some((b,bi)=>bi!==ai&&b.x<=a.x&&b.y<=a.y&&b.x+b.kit.width>=a.x+a.kit.width&&b.y+b.kit.height>=a.y+a.kit.height&&(b.kit.width*b.kit.height>a.kit.width*a.kit.height||b.kit.width*b.kit.height===a.kit.width*a.kit.height&&bi<ai)));
  const placements:Array<{recipe:string;x:number;y:number;cells:number}>=[];let roadCells=0,shadowCells=0,meadowCells=0;
  const stamp=(r:LightingRecipe,x:number,y:number,grassOnly=false)=>{
    let cells=0;
    for(let dy=0;dy<r.height;dy++)for(let dx=0;dx<r.width;dx++){
      const n=r.rows[dy]?.[dx]??-1,tx=x+dx,ty=y+dy,i=ty*map.width+tx;if(n<0||tx<0||ty<0||tx>=map.width||ty>=map.height||map.relief?.levels[i])continue;
      // Preserve authored leaves, soil, root shadows and all other existing layer-2 art.
      if(layerTileAt(map,2,i)>=0||grassOnly&&base(layerTileAt(map,1,i))!==737)continue;
      setLayerTileAt(map,2,i,translated.map.get(n)!);cells++;
    }
    if(cells)placements.push({recipe:r.id,x,y,cells});return cells;
  };
  if(wanted.shadows)for(const a of unique){
    const id=a.kit.id.startsWith('bd-tree-')?a.kit.id:architecture.buildings.find(b=>b.id===a.kit.id||b.sourceKit===a.kit.id)?.id;
    const r=light.find(r=>r.anchor===id);if(r)shadowCells+=stamp(r,a.x+(r.dx??0),a.y+(r.dy??0));
  }
  if(wanted.roads){
    const newRoads:number[]=[];
    for(let i=0;i<map.width*map.height;i++){
      if(map.relief?.levels[i])continue;
      const n=base(layerTileAt(map,1,i)),r=light.find(r=>r.baseTile===n&&r.variant===((i%map.width+Math.floor(i/map.width)*3)%2));
      if(!r)continue;
      const tile=translated.map.get(r.rows[0]![0]!)!;
      if(layerTileAt(map,1,i)!==tile){setLayerTileAt(map,1,i,tile);roadCells++;}
      newRoads.push(tile);
    }
    const group=target.autotileGroups?.find(g=>g.id==='beodeul_road_autotile');
    if(group)group.connectTileIds=[...new Set([...(group.connectTileIds??[]),...newRoads])];
  }
  if(wanted.meadow){
    const occupiedCenters:Array<{x:number;y:number}>=[];
    // Larger subtle patches follow existing houses/trees; do not scatter extra props or move objects.
    for(const [ai,a] of unique.entries())for(const [dx,dy] of [[-3,a.kit.height-1],[a.kit.width-1,a.kit.height]] as const){
      const x=a.x+dx,y=a.y+dy;
      if(occupiedCenters.some(p=>Math.abs(p.x-x)<4&&Math.abs(p.y-y)<3))continue;
      const r=light.find(r=>r.id===`bdg-light-meadow-${ai%3}`)!;
      const cells=stamp(r,x,y,true);meadowCells+=cells;if(cells)occupiedCenters.push({x,y});
    }
  }
  return{summary:`원본 집·나무를 보존하며 공용 일광 그림자 ${unique.length}곳, 길 경계 ${roadCells}칸, 은은한 잔디 변화 ${meadowCells}칸을 보정했습니다.`,data:{mapId,sun:'upper-left',shadowCells,roadCells,meadowCells,anchors:unique.map(a=>({kit:a.kit.id,x:a.x,y:a.y})),placements,originalUpperPreserved:true,originalObjectsAndEventsPreserved:true}};
}

export const BEODEUL_LIGHT_TOOLS:readonly ToolDefinition[]=[{
  name:'harmonize_beodeul_daylight',mode:'write',domains:['tile','map'],preservesAuthoredRaster:true,
  description:'버들항 기존 맵의 집·지붕·나무·소품·길 연결·출입을 유지하고 같은 방향(왼쪽 위)의 짧은 땅 그림자·짙은 접촉 그림자를 적용한다. 원본 포석의 밝은 연석만 낮추고 집/나무 곁에 낮은 대비의 큰 잔디/흙 변화를 더한다. 새 맵 생성·물체 이동·전역 어둡게 하기 없음. 공용 자료 beodeul-ground-dressing의 일광 보정 문서와 이미지를 먼저 읽는다. 기존 2층 그림/높이는 보존하며 반복 호출은 중복하지 않는다.',
  parameters:{type:'object',properties:{mapId:{type:'string'}},required:['mapId'],additionalProperties:false},
  run:(project,args)=>harmonizeBeodeulDaylight(project,String(args.mapId)),
}];
