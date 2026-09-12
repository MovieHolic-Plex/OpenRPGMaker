import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createBlankMap } from "../../src/project/defaults/defaultMaps";
import { DEFAULT_TILESET_ID } from "../../src/project/defaults/constants";
import { runTool } from "../../src/editor/tools/toolRunner";
import { houseObjectForGraphic } from "./houseSpatialCatalog.mts";
import { HOUSE30_EXCLUDED_TILES, HOUSE30_TAG, type House30Entry } from "./house30Contract.mts";
import type { Project } from "../../src/project/types";

const roofTiles = new Set([354,355,356,357,374,376,377,384,385,386,387,404,405,406,407,467]);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const key = (x: number, y: number) => `${x},${y}`;
function flood(cells: Set<string>, start: string) {
  const visited = new Set<string>(), queue = [start];
  while (queue.length) {
    const current = queue.pop()!;
    if (visited.has(current) || !cells.has(current)) continue;
    visited.add(current);
    const [x, y] = current.split(",").map(Number) as [number, number];
    queue.push(key(x-1,y),key(x+1,y),key(x,y-1),key(x,y+1));
  }
  return visited;
}
function materialClass(tile: number): string {
  if (tile < 0) return ".";
  if (roofTiles.has(tile)) return "roof";
  if ([116,146].includes(tile)) return "door";
  if ([85,87].includes(tile)) return "window";
  if ([12,13,14,42,43,44,72,73,74,15,16,17,45,46,47,75,76,77,102,103,104,132,133,134,162,163,164].includes(tile)) return "wall";
  return String(tile);
}

/** Check the baked raster, not just the author's volume specification. */
export function inspectHouse30(entries: readonly House30Entry[]) {
  assert.equal(new Set(entries.map(e => e.number)).size, entries.length, "Repeated review number");
  assert.equal(new Set(entries.map(e => e.kit.id)).size, entries.length, "Repeated kit id");
  const seen = new Map<string, number>();
  return entries.map(entry => {
    const { kit } = entry;
    assert.ok(entry.number >= 1 && entry.number <= 30 && Number.isInteger(entry.number));
    assert.ok(kit.id.startsWith(`house-30-${String(entry.number).padStart(2,"0")}-`));
    assert.equal(kit.kind, "section");
    assert.ok(kit.width > 0 && kit.height > 0 && kit.width <= 48 && kit.height <= 48);
    assert.equal(kit.rows.length, kit.height);
    const occupied = new Set<string>(), roof = new Set<string>();
    const geometry: string[][] = [];
    for (const [y,row] of kit.rows.entries()) {
      assert.equal(row.tiles.length, kit.width);
      if (row.upperTiles) assert.equal(row.upperTiles.length, kit.width);
      const classes: string[] = [];
      for (let x=0; x<kit.width; x++) {
        const tiles = [row.tiles[x]!, row.upperTiles?.[x] ?? -1];
        for (const tile of tiles) {
          assert.ok(Number.isInteger(tile) && tile >= -1, `${kit.id}: invalid tile`);
          assert.ok(!HOUSE30_EXCLUDED_TILES.includes(tile as never), `${kit.id}: forbidden tile ${tile}`);
        }
        if (tiles.some(tile => tile >= 0)) occupied.add(key(x,y));
        if (tiles.some(tile => roofTiles.has(tile))) roof.add(key(x,y));
        classes.push(tiles.map(materialClass).join("/"));
      }
      geometry.push(classes);
    }
    assert.ok(roof.size, `${kit.id}: missing roof`);
    assert.equal(flood(roof, roof.values().next().value!).size, roof.size, `${kit.id}: disconnected roofs`);
    assert.equal(flood(occupied, occupied.values().next().value!).size, occupied.size, `${kit.id}: disconnected building`);
    const empty = new Set<string>();
    for (let y=-1;y<=kit.height;y++) for(let x=-1;x<=kit.width;x++) if(!occupied.has(key(x,y))) empty.add(key(x,y));
    const outside = flood(empty, key(-1,-1));
    assert.ok(entry.doors.length, `${kit.id}: no door`);
    for (const door of entry.doors) {
      assert.equal(kit.rows[door.y]?.tiles[door.x],146,`${kit.id}: door bottom`);
      assert.equal(kit.rows[door.y-1]?.tiles[door.x],116,`${kit.id}: door top`);
      assert.equal(kit.rows[door.y]?.upperTiles?.[door.x] ?? -1,-1,`${kit.id}: door covered`);
      assert.equal(kit.rows[door.y-1]?.upperTiles?.[door.x] ?? -1,-1,`${kit.id}: door top covered`);
      assert.ok(outside.has(key(door.x,door.y+1)),`${kit.id}: door approach cannot reach outside`);
    }
    const geometrySHA256 = hash(geometry);
    assert.ok(!seen.has(geometrySHA256), `${kit.id}: only material/color differs from ${seen.get(geometrySHA256)}`);
    seen.set(geometrySHA256, entry.number);
    return { number: entry.number, id: kit.id, width: kit.width, height: kit.height,
      roofCells: roof.size, connectedRoof: true, exteriorDoorApproaches: entry.doors.length,
      geometrySHA256, silhouetteSHA256: hash(geometry.map((row,y) => row.map((_,x) => occupied.has(key(x,y))))), kitSHA256: hash(kit) };
  });
}

export function authorHouse30(input: Project, entries: readonly House30Entry[]) {
  const checks = inspectHouse30(entries);
  assert.ok(input.spatialAuthoring, "Canonical authoring is required");
  const context = { project: structuredClone(input) };
  const tileset = context.project.tilesets[DEFAULT_TILESET_ID]!;
  const placements: { number:number; name:string; description:string; family:string; floors:number; id:string; objectId:string; mapId:string; x:number; y:number; width:number; height:number }[] = [];
  for (const entry of entries) {
    const oldKit = tileset.structureKits?.find(kit => kit.id === entry.kit.id);
    // Only this numbered study is owned by this command. Other objects/kit metadata stay intact.
    if (oldKit && !isDeepStrictEqual(oldKit, entry.kit)) {
      assert.ok(oldKit.ai?.tags?.includes(HOUSE30_TAG), `Refusing unrelated kit replacement ${oldKit.id}`);
    }
    const kit = { ...entry.kit, name: entry.name, ai: { ...entry.kit.ai,
      description: entry.description, tags: [HOUSE30_TAG,"집","건물 외형",entry.family,`${entry.floors}층 외형`],
      role:"structure" as const, repeatability:"fixed" as const, layerHome:"perCell" as const } };
    tileset.structureKits = [...(tileset.structureKits ?? []).filter(value => value.id !== kit.id),kit];
  }
  // One 5-by-2 gallery per author's batch; every card has a clear apron under its door.
  for (const [index,batch] of ["a","b","c"].entries()) {
    const group = entries.filter(entry => Math.floor((entry.number-1)/10) === index);
    if (!group.length) continue;
    assert.equal(group.length,10,`Batch ${batch} needs exactly ten houses`);
    const cellWidth = Math.max(...group.map(e=>e.kit.width))+6;
    const cellHeight = Math.max(...group.map(e=>e.kit.height))+7;
    const mapId = `map_house_30_${batch}_20260912`;
    const map = createBlankMap(`집 형태 ${index*10+1}–${index*10+10} · ${["소형·단층","2층 주택","큰집·다층"][index]}`,
      cellWidth*5,cellHeight*2,tileset.id,tileset.tileSize);
    map.id = mapId;
    for(const [i,entry] of group.entries()) {
      const kit=entry.kit, x=(i%5)*cellWidth+Math.floor((cellWidth-kit.width)/2),
        y=Math.floor(i/5)*cellHeight+cellHeight-kit.height-4;
      kit.rows.forEach((row,dy)=>row.tiles.forEach((tile,dx)=>{
        const at=(y+dy)*map.width+x+dx;
        if(tile>=0)map.lowerTiles[at]=tile;
        if((row.upperTiles?.[dx] ?? -1)>=0)map.upperTiles[at]=row.upperTiles![dx]!;
      }));
      placements.push({number:entry.number,name:entry.name,description:entry.description,family:entry.family,floors:entry.floors,
        id:kit.id,objectId:houseObjectForGraphic(context.project,tileset.id,kit.id)?.id ?? `house30:object:${entry.number}`,mapId,x,y,width:kit.width,height:kit.height});
    }
    context.project.maps[mapId]=map;
    if(!context.project.mapTree.children.some(node=>node.mapId===mapId)) context.project.mapTree.children.push({mapId,children:[]});
  }
  // Finish raw raster authoring before starting the sealed tool proposal.
  // Once a write tool seals the draft, subsequent changes use only that runner.
  for (const entry of entries) {
    const kit = entry.kit;
    const old = houseObjectForGraphic(context.project,tileset.id,kit.id);
    const objectId = old?.id ?? `house30:object:${entry.number}`;
    const next = { id:objectId, name:`${String(entry.number).padStart(2,"0")} · ${entry.name}`, revision:old?.revision ?? 1,
      tags:[HOUSE30_TAG,"건물 외형",entry.family,`${entry.floors}층 외형`],
      provenance:{origin:"ai",sourceId:"house30-astra-xhigh"}, graphic:{tilesetId:tileset.id,kitId:kit.id}, chips:[],
      anchors:entry.doors.map((door,i)=>({id:`door-${i+1}`,name:"현관 앞",x:door.x,y:door.y+1})) };
    if (!isDeepStrictEqual(old,next)) {
      const result = runTool(context,"upsert_spatial_design", { kind:"object",expectedRevision:old?.revision ?? 0,
        object:{...next,revision:(old?.revision ?? 0)+1} });
      assert.ok(result.ok, JSON.stringify(result));
    }
    const get = runTool(context,"get_spatial_design",{kind:"object",id:objectId});
    assert.ok(get.ok,JSON.stringify(get));
  }
  return { project:context.project, placements, checks };
}
