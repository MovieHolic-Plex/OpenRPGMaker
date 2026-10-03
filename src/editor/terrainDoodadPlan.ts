import { editorState } from "./editorState";
import { planReliefDoodad, type ReliefDoodad, type ReliefDoodadPlan } from "./reliefDoodads";
import { planTerrainCluster, planMoveDoodadGroup } from "./terrainClusters";
import { RELIEF_ROUGH_RADII } from "@/project/relief/roughBrush";
import type { GameMap, TilesetDef } from "@/project/types";

export function planEditorTerrainDoodad(map:GameMap,tileset:TilesetDef,doodad:ReliefDoodad,pick:{x:number;y:number;face:"top"|"wall"}):ReliefDoodadPlan {
  const s=editorState.get();
  if(doodad.kind==="prop" && s.reliefClusterEnabled)return planTerrainCluster(map,tileset,doodad,pick.x,pick.y,RELIEF_ROUGH_RADII[s.reliefRoughSize],s.reliefClusterDensity);
  return planReliefDoodad(map,doodad,pick,{width:s.reliefRampWidth,bridgeStart:s.reliefBridgeStart?.mapId===map.id?s.reliefBridgeStart:null});
}
export function planEditorGroupMove(map:GameMap,tileset:TilesetDef,x:number,y:number):ReliefDoodadPlan {
  const selection=editorState.get().terrainSelectedGroup;
  return planMoveDoodadGroup(map,tileset,selection?.mapId===map.id?selection.id:"",x-(selection?.x??0),y-(selection?.y??0));
}
