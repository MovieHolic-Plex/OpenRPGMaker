import { store } from "@/project/store";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { autotileEditTriggersGroup, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { terrainMaterialTile, type TerrainMaterial } from "./terrainMaterials";
import type { GameMap } from "@/project/types";

export function terrainBrushPoints(map:GameMap,x:number,y:number,width:number,river=false):{x:number;y:number}[] {
  const points:{x:number;y:number}[]=[], radius=(width-1)/2;
  for(let dy=-Math.ceil(radius);dy<=Math.ceil(radius);dy++)for(let dx=-Math.ceil(radius);dx<=Math.ceil(radius);dx++) {
    const X=x+dx,Y=y+dy;
    if(dx*dx+dy*dy>(radius+0.4)**2 || X<0 || Y<0 || X>=map.width || Y>=map.height)continue;
    const i=Y*map.width+X;
    if((map.relief?.ramps?.[i]??0)>0)continue;
    if(river && (layerTileAt(map,3,i)>=0 || layerTileAt(map,4,i)>=0 || map.events.some(e=>e.x===X&&e.y===Y)))continue;
    points.push({x:X,y:Y});
  }
  return points;
}

/** Surface leaves all heights intact. River carves a level bed and shapes water/shore in one edit. */
export function paintTerrainBrush(mapId:string,x:number,y:number,material:TerrainMaterial,width:number,bedLevel:number):void {
  const p=store.getCurrent(),map=p.maps[mapId];if(!map)return;
  const tileset=p.tilesets[map.tilesetId],tile=terrainMaterialTile(tileset,material);
  if(tile===undefined || tile<0)return;
  const points=terrainBrushPoints(map,x,y,width,material==="water");
  const previous=points.map(c=>layerTileAt(map,1,c.y*map.width+c.x));
  if(!points.some(c=>layerTileAt(map,1,c.y*map.width+c.x)!==tile || layerTileAt(map,2,c.y*map.width+c.x)>=0 || (material==="water" && map.relief && map.relief.levels[c.y*map.width+c.x]!==bedLevel)))return;
  const dirty=new Map<number,{x:number;y:number;layer:"lower"}>();
  for(const c of points)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const X=c.x+dx,Y=c.y+dy;if(X>=0&&Y>=0&&X<map.width&&Y<map.height)dirty.set(Y*map.width+X,{x:X,y:Y,layer:"lower"});
  }
  store.updateMapTiles(mapId,draft=>{
    for(const c of points){const i=c.y*draft.width+c.x;clearTileStack(draft,"lower",i);setLayerTileAt(draft,1,i,tile);setLayerTileAt(draft,2,i,-1);}
    for(const group of autotileGroupsForTileset(tileset)) if((group.layer??"lower")==="lower" && previous.some(v=>autotileEditTriggersGroup(group,v,tile)))shapeAutotileGroupAround(draft,group,points);
    if(material==="water" && draft.relief){
      const levels=draft.relief.levels.slice();for(const c of points)levels[c.y*draft.width+c.x]=bedLevel;
      draft.relief={...draft.relief,levels};
    }
  },{label:material==="water"?"강 붓 · 물·물가·강바닥":"표면 붓",cells:[...dirty.values()],...(material==="water"?{relief:true as const}:{})});
}
