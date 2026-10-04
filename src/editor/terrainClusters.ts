import { compactMapLayers, layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { cellLift, reliefLiftField } from "@/project/relief/screen";
import type { DoodadGroup } from "@/project/doodadGroups";
import type { GameMap, TilesetDef } from "@/project/types";
import type { ReliefDoodad, ReliefDoodadPlan } from "./reliefDoodads";
import { terrainIsReserved } from "./terrainMaterials";
import { genId } from "@/util/id";
import { terrainLocked } from "@/project/terrainDesign";

export function groupAt(map:GameMap,x:number,y:number):DoodadGroup|undefined {
  const index=y*map.width+x;
  return map.doodadGroups?.find(g=>g.cells.some(c=>c.index===index && layerTileAt(map,3,index)===c.tile));
}
function rectsFor(map:GameMap,cells:readonly {index:number}[]) {
  const lift=map.relief?reliefLiftField(map.relief):null;
  return cells.map(c=>{const x=c.index%map.width,y=Math.floor(c.index/map.width);return{x,y:y-(lift?cellLift(lift,x,y):0),w:1,h:1};});
}
function restore(map:GameMap,group:DoodadGroup):void {
  for (const c of group.cells) if(layerTileAt(map,3,c.index)===c.tile) setLayerTileAt(map,3,c.index,c.before);
  map.doodadGroups=map.doodadGroups?.filter(g=>g.id!==group.id);
  if (!map.doodadGroups?.length) delete map.doodadGroups;
  compactMapLayers(map);
}
export function deleteDoodadGroup(map:GameMap,id:string):void {
  const group=map.doodadGroups?.find(g=>g.id===id);if(group && !group.cells.some(c=>terrainLocked(map.terrainDesign,c.index)))restore(map,group);
}

/** Deterministic density sampling: hover and click produce the identical cluster. */
export function planTerrainCluster(map:GameMap,tileset:TilesetDef,doodad:Extract<ReliefDoodad,{kind:"prop"}>,x:number,y:number,radius:number,density:number):ReliefDoodadPlan {
  const kit=doodad.kit, cells:DoodadGroup["cells"]=[], used=new Set<number>();let objects=0;
  const candidates:{x:number;y:number;score:number}[]=[];
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++) {
    if(dx*dx+dy*dy>radius*radius)continue;
    const X=x+dx,Y=y+dy;
    let h=Math.imul(X+17,73856093)^Math.imul(Y+29,19349663);
    h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);
    const hash=((h^(h>>>16))>>>0)/4294967296;
    if(hash<=density/100 || (!dx&&!dy))candidates.push({x:X,y:Y,score:hash});
  }
  candidates.sort((a,b)=>a.score-b.score);
  for(const p of candidates) {
    const stamp:DoodadGroup["cells"]=[],base=map.relief?.levels[p.y*map.width+p.x]??0;
    let blocked=false;
    for(let dy=0;dy<kit.height;dy++)for(let dx=0;dx<kit.width;dx++) {
      const X=p.x-Math.floor((kit.width-1)/2)+dx,Y=p.y-kit.height+1+dy;
      if(X<0||Y<0||X>=map.width||Y>=map.height){blocked=true;continue;}
      const index=Y*map.width+X,tile=kit.rows[dy]?.upperTiles?.[dx]??-1;
      if(used.has(index)||terrainIsReserved(map,tileset,index)||(map.relief?.levels[index]??0)!==base || map.events.some(e=>e.x===X&&e.y===Y))blocked=true;
      if(tile>=0)stamp.push({index,tile,before:layerTileAt(map,3,index)});
    }
    if(blocked||!stamp.length)continue;
    objects++;for(const c of stamp){used.add(c.index);cells.push(c);}
  }
  return {ok:cells.length>0,reason:cells.length?`${objects}개 군집 · 길·물·통로·물체를 피한다`:"빈 같은 높이의 땅이 필요하다",rects:rectsFor(map,cells),
    cells:cells.map(c=>({x:c.index%map.width,y:Math.floor(c.index/map.width),layer:"upper" as const})),
    apply:draft=>{const group:DoodadGroup={id:genId("doodad"),label:doodad.label,kitId:kit.id,cells:cells.map(c=>({...c}))};
      for(const c of cells)setLayerTileAt(draft,3,c.index,c.tile);
      draft.doodadGroups=[...(draft.doodadGroups??[]),group];}};
}

export function planMoveDoodadGroup(map:GameMap,tileset:TilesetDef,id:string,dx:number,dy:number):ReliefDoodadPlan {
  const g=map.doodadGroups?.find(g=>g.id===id);
  if(!g)return {ok:false,reason:"군집을 먼저 고른다",rects:[]};
  if(g.cells.some(c=>terrainLocked(map.terrainDesign,c.index)))return {ok:false,reason:"군집 영역의 잠금을 먼저 해제하세요",rects:[]};
  const own=new Set(g.cells.map(c=>c.index)),cells:DoodadGroup["cells"]=[];
  let reason="";const base=map.relief?.levels[g.cells[0]!.index]??0;
  for(const c of g.cells) {
    const x=c.index%map.width+dx,y=Math.floor(c.index/map.width)+dy,index=y*map.width+x;
    if(x<0||y<0||x>=map.width||y>=map.height){reason="맵 밖으로 나간다";continue;}
    if(layerTileAt(map,3,c.index)!==c.tile)reason="군집 일부가 다른 붓으로 바뀌었다 — 지우고 다시 놓으라";
    const prev=own.has(index)?g.cells.find(c=>c.index===index)!.before:layerTileAt(map,3,index);
    // Same-group overlap is allowed. All other terrain reservations remain protected.
    const meta=tileset.tileMeta?.[layerTileAt(map,1,index)];
    if((!own.has(index)&&terrainIsReserved(map,tileset,index)) || prev>=0 || layerTileAt(map,4,index)>=0 || (map.relief?.ramps?.[index]??0)>0
      || /road|path|water|river|lake|길|포석|물|호수/i.test(`${meta?.label} ${meta?.tags?.join(" ")}`)
      || (map.relief?.levels[index]??0)!==base || map.events.some(e=>e.x===x&&e.y===y))reason="길·물·물체·다른 높이에 걸친다";
    cells.push({index,tile:c.tile,before:prev});
  }
  return {ok:!reason,reason:reason||"클릭하면 군집 전체를 옮긴다",rects:rectsFor(map,cells),
    cells:[...g.cells,...cells].map(c=>({x:c.index%map.width,y:Math.floor(c.index/map.width),layer:"upper" as const})),apply:draft=>{
    const current=draft.doodadGroups?.find(v=>v.id===id);if(!current)return;
    restore(draft,current);for(const c of cells)setLayerTileAt(draft,3,c.index,c.tile);
    draft.doodadGroups=[...(draft.doodadGroups??[]),{...g,cells}];}};
}
