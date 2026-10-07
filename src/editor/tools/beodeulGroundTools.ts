import architectureCatalog from '@/assets/beodeulArchitectureCatalog.json';
import { BEODEUL_GROUND_ID, BEODEUL_GROUND_TEXTURE, BEODEUL_GROUND_RECIPES, createBeodeulGroundTileset } from '@/project/defaults/beodeulGround';
import { translateTiles } from '@/project/objectStamp';
import { compactMapLayers, layerTileAt, setLayerTileAt, type TileLayerNo } from '@/project/mapLayers';
import { canMove, isPassable } from '@/project/collision';
import type { Project, GameMap, StructureKitDef } from '@/project/types';
import { ToolError, type ToolDefinition } from './types';

type Point={x:number;y:number};
type Anchor=Point&{kit:StructureKitDef;w:number;h:number};

function transferLandings(value:unknown,mapId:string,out:Point[]):void {
  if(!value||typeof value!=='object') return;
  if(Array.isArray(value)){for(const child of value) transferLandings(child,mapId,out);return;}
  const obj=value as Record<string,unknown>;
  if(obj.kind==='transfer'&&obj.mapId===mapId&&Number.isInteger(obj.x)&&Number.isInteger(obj.y))
    out.push({x:Number(obj.x),y:Number(obj.y)});
  for(const child of Object.values(obj)) if(child&&typeof child==='object') transferLandings(child,mapId,out);
}

function reachable(project:Project,map:GameMap,start:Point):Set<number> {
  const seen=new Set<number>();
  if(!isPassable(project,map,start.x,start.y)) return seen;
  const queue=[start];seen.add(start.y*map.width+start.x);
  for(let at=0;at<queue.length;at++){
    const p=queue[at]!;
    for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
      const x=p.x+dx!,y=p.y+dy!,i=y*map.width+x;
      if(x<0||y<0||x>=map.width||y>=map.height||seen.has(i)||!canMove(project,map,p.x,p.y,x,y)) continue;
      seen.add(i);queue.push({x,y});
    }
  }
  return seen;
}

/** Remove only this pack's overlays before an explicitly requested complete town rebuild. */
export function clearBeodeulGroundDressing(project:Project,mapId:string):void {
  const map=project.maps[mapId],target=map&&project.tilesets[map.tilesetId];
  if(!map||target?.image.id!=='tex_beodeul_city') return;
  const own=new Set((target.tileGrafts??[]).filter(g=>g.sourceChipset===BEODEUL_GROUND_TEXTURE).map(g=>g.targetTile));
  for(let i=0;i<map.width*map.height;i++) for(const layer of [2,4] as const)
    if(own.has(layerTileAt(map,layer,i))) setLayerTileAt(map,layer,i,-1);
  compactMapLayers(map);
}

export function dressBeodeulGround(project:Project,mapId:string,style:'natural'|'living'='living',seed=1004){
  const map=project.maps[mapId],target=map&&project.tilesets[map.tilesetId];
  if(!map||!target) throw new ToolError('맵 또는 타일셋이 없습니다.');
  if(target.image.type!=='bundled'||target.image.id!=='tex_beodeul_city'||target.tileSize!==16)
    throw new ToolError('버들항 16px 맵만 지원합니다. 현재 칩셋을 바꾸지 않습니다.');
  const grafts=new Map((target.tileGrafts??[]).map(g=>[g.targetTile,g]));
  const own=(n:number)=>grafts.get(n)?.sourceChipset===BEODEUL_GROUND_TEXTURE;
  const hasExisting=Array.from({length:map.width*map.height},(_,i)=>own(layerTileAt(map,2,i))||own(layerTileAt(map,4,i))).some(Boolean);
  const native=(n:number)=>{const g=grafts.get(n);return g?g.sourceChipset==='tex_beodeul_city'?g.sourceTile:g.sourceChipset==='tex_beodeul_architecture'?n:-1:n;};
  const indices=new Map<number,number[]>();
  for(let i=0;i<map.width*map.height;i++){
    const n=native(layerTileAt(map,3,i));if(n<0) continue;
    const list=indices.get(n)??[];list.push(i);indices.set(n,list);
  }
  const anchors:Anchor[]=[];
  const kits=(target.structureKits??[]).filter(k=>k.kind==='section'&&(k.id.startsWith('bd-house-')
    ||['bd-tree-03a8f7','bd-tree-3e8732','bd-tree-1a786c'].includes(k.id)));
  for(const kit of kits){
    if(kit.kind!=='section') continue;
    const first=kit.rows.flatMap((r,y)=>(r.upperTiles ?? []).map((n,x)=>({n,x,y}))).find(p=>p.n>=0);
    if(!first) continue;
    for(const i of indices.get(first.n)??[]){
      const x=i%map.width-first.x,y=Math.floor(i/map.width)-first.y;
      if(x<0||y<0||x+kit.width>map.width||y+kit.height>map.height) continue;
      const match=kit.rows.every((r,dy)=>(r.upperTiles ?? []).every((n,dx)=>{
        if(n<0) return true;
        const actual=layerTileAt(map,3,(y+dy)*map.width+x+dx);
        const g=grafts.get(actual);
        return native(actual)===n || g?.sourceChipset==='tex_beodeul_door'
          &&(n===5743&&g.sourceTile>=0&&g.sourceTile<8||n===2333&&g.sourceTile>=8&&g.sourceTile<16);
      }));
      if(match) anchors.push({x,y,w:kit.width,h:kit.height,kit});
    }
  }
  const points:Point[]=map.events.map(e=>({x:e.x,y:e.y}));
  transferLandings(Object.values(project.maps).map(m=>m.events),map.id,points);
  if(project.startMapId===map.id) points.push(project.startPos);
  for(const a of anchors) for(const p of a.kit.parts??[]) if(p.kind==='entrance')
    points.push({x:a.x+p.dx,y:a.y+p.dy+p.h});
  const protectedCells=new Set<number>();
  const criticalCells=new Set(points.map(p=>p.y*map.width+p.x));
  for(const p of points) for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
    if(Math.abs(dx)+Math.abs(dy)>1) continue;
    const x=p.x+dx,y=p.y+dy;
    if(x>=0&&y>=0&&x<map.width&&y<map.height) protectedCells.add(y*map.width+x);
  }
  const grass=(i:number)=>native(layerTileAt(map,1,i))===737&&!map.relief?.levels[i]&&!(map.terrainDesign?.waterDepth?.[i]??0);
  const free=(x:number,y:number)=>{
    if(x<0||y<0||x>=map.width||y>=map.height) return false;
    const i=y*map.width+x;
    return grass(i)&&!protectedCells.has(i)&&[2,3,4].every(l=>layerTileAt(map,l as TileLayerNo,i)<0);
  };
  const start=points.find(p=>isPassable(project,map,p.x,p.y))??{x:0,y:0};
  const before=reachable(project,map,start);
  const source=project.tilesets[BEODEUL_GROUND_ID]??createBeodeulGroundTileset();
  project.tilesets[BEODEUL_GROUND_ID]??=source;
  const translated=translateTiles(source,target,BEODEUL_GROUND_RECIPES.flatMap(r=>r.rows.flat()));
  const placements:Array<{recipe:string;x:number;y:number;layer:number;width:number;height:number}>=[];
  const stamp=(id:string,x:number,y:number,support=false)=>{
    const r=BEODEUL_GROUND_RECIPES.find(r=>r.id===id)!;
    for(let dy=0;dy<r.height;dy++) for(let dx=0;dx<r.width;dx++){
      if(r.rows[dy]?.[dx]===-1) continue;
      const tx=x+dx,ty=y+dy,i=ty*map.width+tx;
      if(tx<0||ty<0||tx>=map.width||ty>=map.height||!grass(i)||map.relief?.levels[i]) return false;
      if(support){
        if(layerTileAt(map,r.layer as TileLayerNo,i)>=0||criticalCells.has(i)) return false;
        // Only the foundation's wall row may sit over an existing layer-3 object.
        if(r.layer===4&&(layerTileAt(map,2,i)>=0 || layerTileAt(map,3,i)>=0&&!(id.startsWith('bdg-foundation')||id==='bdg-tree-neck'))) return false;
      }
      else if(!free(tx,ty)) return false;
    }
    const changed:number[]=[];
    for(let dy=0;dy<r.height;dy++) for(let dx=0;dx<r.width;dx++){
      const n=r.rows[dy]?.[dx];if(n===undefined||n<0) continue;
      const i=(y+dy)*map.width+x+dx;
      setLayerTileAt(map,r.layer as TileLayerNo,i,translated.map.get(n)!);changed.push(i);
    }
    // Physical props may not cut off previously reachable entrances/landings.
    if(r.blocked){
      const after=reachable(project,map,start);
      if(points.some(p=>before.has(p.y*map.width+p.x)&&!after.has(p.y*map.width+p.x))){
        for(const i of changed) setLayerTileAt(map,r.layer as TileLayerNo,i,-1);
        return false;
      }
    }
    placements.push({recipe:id,x,y,layer:r.layer,width:r.width,height:r.height});return true;
  };
  const trees=anchors.filter(a=>a.kit.id.startsWith('bd-tree-'));
  const allHouses=anchors.filter(a=>a.kit.id.startsWith('bd-house-'));
  const houses=allHouses.filter((a,ai)=>!allHouses.some((b,bi)=>b!==a&&(b.w*b.h>a.w*a.h||b.w*b.h===a.w*a.h&&bi<ai)
    &&b.x<=a.x&&b.y<=a.y&&b.x+b.w>=a.x+a.w&&b.y+b.h>=a.y+a.h));
  const foundations=()=>{
    for(const a of houses){
      const source=architectureCatalog.buildings.find(b=>b.id===a.kit.id)?.sourceKit??a.kit.id;
      const key=source.slice('bd-house-'.length);
      const id=key==='h101_0'?'bdg-foundation':`bdg-foundation-${key}`;
      const r=BEODEUL_GROUND_RECIPES.find(r=>r.id===id);
      if(!r)continue;
      const y=a.y+a.h-r.height+1;let added=0;
      for(let dy=0;dy<r.height;dy++)for(let dx=0;dx<r.width;dx++){
        const n=r.rows[dy]?.[dx];if(n===undefined||n<0)continue;
        const x=a.x+dx,ty=y+dy,i=ty*map.width+x;
        if(x<0||ty<0||x>=map.width||ty>=map.height||map.relief?.levels[i]||criticalCells.has(i)
          ||layerTileAt(map,2,i)>=0||layerTileAt(map,4,i)>=0)continue;
        const houseRow=ty-a.y;
        const ownWall=houseRow>=0&&houseRow<a.h&&((a.kit.rows[houseRow]?.upperTiles ?? [])[dx]??-1)>=0;
        if(layerTileAt(map,3,i)>=0&&!ownWall)continue;
        // A foundation follows the wall and may touch its paved front yard; one busy grass tuft does not cancel the whole strip.
        if(!grass(i)&&!isPassable(project,map,x,ty))continue;
        setLayerTileAt(map,4,i,translated.map.get(n)!);added++;
      }
      if(added)placements.push({recipe:id,x:a.x,y,layer:4,width:r.width,height:r.height});
    }
  };
  if(hasExisting){
    foundations();
    for(const a of trees) if(a.h===3){stamp('bdg-roots',a.x,a.y+a.h,true);stamp('bdg-tree-neck',a.x,a.y+a.h-1,true);}
    return {summary:placements.length?`기초·수관·밑동 ${placements.length}곳 보강. 기존 꾸밈을 보존했습니다.`:'이 맵에는 공용 접지·잔디 꾸밈이 이미 있습니다. 중복 배치하지 않았습니다.',
      data:{mapId,alreadyApplied:placements.length===0,placements,detectedHouses:anchors.filter(a=>a.kit.id.startsWith('bd-house-')).length,detectedTrees:trees.length}};
  }
  foundations();
  for(const a of trees){
    if(a.h===3){stamp('bdg-tree-neck',a.x,a.y+a.h-1,true);stamp('bdg-roots',a.x,a.y+a.h,true);}
    else stamp('bdg-root-shadow',a.x,a.y+a.h-1,true);
    for(const [x,y] of [[a.x-2,a.y+a.h],[a.x+a.w,a.y+a.h]]){
      if(stamp('bdg-litter',x!,y!)) break;
    }
  }
  if(style==='living') for(const a of houses){
    const spots=[{x:a.x-1,y:a.y+a.h+1},{x:a.x+a.w,y:a.y+a.h}];
    for(const p of spots) if(stamp('bdg-flowerbed',p.x,p.y)) break;
    for(const [id,dx,dy] of [['bdg-barrel',a.w,0],['bdg-firewood',a.w,2],['bdg-worn-soil',a.w+1,1]] as const)
      stamp(id,a.x+dx,a.y+a.h+dy);
  }
  let state=seed>>>0;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const candidates:Point[]=[];
  for(let y=1;y<map.height-1;y++) for(let x=1;x<map.width-2;x++) if(free(x,y)&&free(x+1,y)) candidates.push({x,y});
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[candidates[i],candidates[j]]=[candidates[j]!,candidates[i]!];}
  const grassCount=map.lowerTiles.filter((_,i)=>grass(i)).length;
  const limit=Math.min(120,Math.max(3,Math.floor(grassCount*.035)));
  const centers:Point[]=[];
  const kinds=['bdg-grass-0','bdg-grass-1','bdg-grass-2','bdg-flowers-pink','bdg-grass-1','bdg-stones','bdg-grass-2','bdg-flowers-white','bdg-grass-0','bdg-flowers-blue'];
  for(const p of candidates){
    if(centers.length>=limit) break;
    if(centers.some(c=>Math.abs(c.x-p.x)<3&&Math.abs(c.y-p.y)<2)) continue;
    if(stamp(kinds[centers.length%kinds.length]!,p.x,p.y)) centers.push(p);
  }
  return {summary:`공용 버들항 접지·잔디 꾸밈 ${placements.length}곳: ${style} · 밝은 잔디/원본 집·문·길 보존`,
    data:{mapId,style,seed,placements,detectedHouses:houses.length,detectedTrees:trees.length,houseKits:houses.map(a=>a.kit.id),
      protectedCells:[...protectedCells],slotsAdded:translated.slotsAdded,groundPreserved:true,originalUpperPreserved:true}};
}

export const BEODEUL_GROUND_TOOLS:readonly ToolDefinition[]=[{
  name:'dress_beodeul_ground',mode:'write',domains:['tile','map'],preservesAuthoredRaster:true,
  description:'버들항의 밝은 잔디를 유지하면서 얇은 기초·밑동·풀/꽃 군락·잔돌·낙엽과 집 곁 화단·통·장작을 공용 덧그림으로 꾸민다. 집·나무·길·출입을 만든 뒤 한 번 호출. source 737 잔디만 사용, 이벤트·문 앞·길·전이 착지 보호, 기존 네 층/물체/높이 보존, 소품은 통행 검사 후 놓는다. natural=풀·꽃 중심, living=살림집 소품도. 기존 맵을 새로 만들거나 칩셋·잔디색을 바꾸지 않는다. 반복 적용은 중복하지 않는다. 참고문서 beodeul-ground-dressing에 정확한 사전과 보강 범위가 있다.',
  parameters:{type:'object',properties:{mapId:{type:'string'},style:{type:'string',enum:['natural','living']},seed:{type:'integer'}},required:['mapId'],additionalProperties:false},
  run:(project,args)=>dressBeodeulGround(project,String(args.mapId),args.style==='natural'?'natural':'living',Number(args.seed??1004)),
}];
