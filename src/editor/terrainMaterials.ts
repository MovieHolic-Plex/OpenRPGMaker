import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { layerTileAt } from "@/project/mapLayers";
import type { TilesetDef, GameMap } from "@/project/types";
import { reliefTopGrassTile } from "./reliefActions";
import { topTileInStack } from "@/project/mapOverlayTiles";
import { terrainLocked } from "@/project/terrainDesign";

export type TerrainMaterial = "grass" | "dirt" | "stone" | "water";
const MATCH:Record<TerrainMaterial,RegExp>={grass:/grass|잔디|풀밭|초원/i,dirt:/dirt|sand|흙길|흙 바닥|모랫길|road/i,stone:/rock.?ground|stone|cobble|돌바닥|돌 바닥|포석|암반/i,water:/water|river|lake|물|강물|호수/i};
export const MATERIAL_LABEL:Record<TerrainMaterial,string>={grass:"풀",dirt:"흙·모래",stone:"돌",water:"강"};

/** Semantic definitions, never sheet coordinates. Autotile bodies keep shore/edge shaping. */
export function terrainMaterialTile(tileset:TilesetDef|undefined, material:TerrainMaterial):number|undefined {
  if (!tileset) return undefined;
  if (material==="grass") {const tile=reliefTopGrassTile(tileset);if(tile!==undefined)return tile;}
  const group=autotileGroupsForTileset(tileset).find(g=>(g.layer??"lower")==="lower" && MATCH[material].test(`${g.id} ${g.name}`)
    && (material!=="dirt" || !/stone|cobble|포석|돌/.test(`${g.id} ${g.name}`)));
  if (group) return group.variantMap[group.neighborhood===8?"255":"15"]??group.memberTileIds[0];
  const tile = tileset.tileMeta?.findIndex(m=>m?.defaultLayer!=="upper" && /ground|terrain|floor|water|바닥|지면|물|풀밭/i.test(`${m?.role} ${m?.label} ${m?.tags?.join(" ")}`)
    && MATCH[material].test(`${m?.label} ${m?.tags?.join(" ")}`)) ?? -1;
  return tile>=0?tile:undefined;
}

export function terrainIsReserved(map:GameMap,tileset:TilesetDef,index:number):boolean {
  if (terrainLocked(map.terrainDesign, index) || (map.terrainDesign?.waterDepth?.[index] ?? 0) > 0) return true;
  if ((map.relief?.ramps?.[index]??0)>0 || layerTileAt(map,3,index)>=0 || layerTileAt(map,4,index)>=0) return true;
  if ((topTileInStack(map,"upper",index)??-1)>=0) return true;
  const tile=layerTileAt(map,1,index), meta=tileset.tileMeta?.[tile];
  if (/road|path|water|river|lake|길|포석|물|호수/i.test(`${meta?.label} ${meta?.tags?.join(" ")}`)) return true;
  return autotileGroupsForTileset(tileset).some(g=>/road|path|water|river|lake|길|포석|물|호수/i.test(`${g.id} ${g.name}`) && g.memberTileIds.includes(tile));
}

/** Road authoring uses the map's road material, including Beodeul cobbles, rather than assuming dirt. */
export function terrainRoadTile(tileset: TilesetDef): number | undefined {
  const group = autotileGroupsForTileset(tileset).find(g => (g.layer ?? "lower") === "lower" && /road|path|길|도로/i.test(`${g.id} ${g.name}`) && !/water|river|lake|물|강물/i.test(`${g.id} ${g.name}`));
  return group ? group.variantMap[group.neighborhood === 8 ? "255" : "15"] ?? group.memberTileIds[0] : terrainMaterialTile(tileset, "dirt");
}
