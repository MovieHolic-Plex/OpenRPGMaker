import { describe, expect, it } from "vitest";
import { planTerrainFeature } from "@/editor/terrainFeatures";
import { planTerrainFinish } from "@/editor/terrainFinish";
import { cloneExtraLayers, setLayerTileAt } from "@/project/mapLayers";
import { createBlankProject } from "@/project/defaults/blankProject";
import { emptyRelief } from "@/project/relief/edit";
import { terrainLineOfSight, terrainVisionRange, terrainBlocksProjectile } from "@/project/terrainGameplay";
import { DEFAULT_TERRAIN_GAMEPLAY, normalizeTerrainDesign, remapTerrainDesign, type TerrainFeatureOptions } from "@/project/terrainDesign";
import { inspectTerrainRoute } from "@/project/terrainRoute";
import { reliefAllowsStep, reliefSlopes } from "@/project/relief/walk";
import { connectTerrainRoad } from "@/editor/terrainRoadRamps";
import { parseTerrainLibrary } from "@/editor/terrainStampLibrary";
import type { GameMap } from "@/project/types";
const options: TerrainFeatureOptions = { symmetry:"none",areaShape:"rect",width:3,delta:3,seed:1,weights:[70,25,5],waterLevel:0,maxDepth:3,shallowWidth:1,flattenRoad:false,unlock:false,density:35 };
function fixture(){const project=createBlankProject(),map:GameMap={id:"terrain",name:"terrain",width:16,height:16,tileSize:16,tilesetId:project.maps[project.startMapId].tilesetId,lowerTiles:new Array(256).fill(0),upperTiles:new Array(256).fill(-1),events:[]};project.maps={terrain:map};project.startMapId=map.id;project.startPos={x:1,y:1};return {project,map,tileset:project.tilesets[map.tilesetId]};}
function clone(map:GameMap):GameMap{return {...map,lowerTiles:map.lowerTiles.slice(),upperTiles:map.upperTiles.slice(),...cloneExtraLayers(map)};}
describe("editable terrain and gameplay contracts",()=>{
 it("replaces geometry and height without accumulation, restores a shortened area, rejects overlapping edits",()=>{
  const {map,tileset}=fixture(),initial=planTerrainFeature(map,tileset,"contour",[{x:4,y:4},{x:10,y:10}],options,null);expect(initial.ok).toBe(true);initial.apply!(map);
  const id=map.terrainDesign!.features![0].id,changed=planTerrainFeature(map,tileset,"contour",[{x:5,y:5},{x:8,y:8}],{...options,delta:5},id);expect(changed.ok).toBe(true);changed.apply!(map);
  expect(map.relief!.levels[4*16+4]).toBe(0);expect(map.relief!.levels[6*16+6]).toBe(5);expect(map.terrainDesign!.features).toHaveLength(1);
  setLayerTileAt(map,4,6*16+6,7);const before=JSON.stringify(map);expect(planTerrainFeature(map,tileset,"contour",[{x:5,y:5},{x:8,y:8}],options,id).ok).toBe(false);expect(JSON.stringify(map)).toBe(before);
 });
 it("roundtrips authoring metadata, deep clones it, and retires geometry when remapping",()=>{
  const {map,tileset}=fixture();planTerrainFeature(map,tileset,"contour",[{x:4,y:4},{x:10,y:10}],options,null).apply!(map);map.terrainDesign!.gameplay={...DEFAULT_TERRAIN_GAMEPLAY,visionBlocking:true};
  const restored=normalizeTerrainDesign(JSON.parse(JSON.stringify(map.terrainDesign)),256);expect(restored).toEqual(map.terrainDesign);const copy=clone(map);copy.terrainDesign!.features![0].points[0].x=7;expect(map.terrainDesign!.features![0].points[0].x).toBe(4);
  expect(remapTerrainDesign(map.terrainDesign,256,i=>i)?.features).toBeUndefined();expect(remapTerrainDesign(map.terrainDesign,256,i=>i)?.gameplay?.visionBlocking).toBe(true);
 });
 it("connects narrow successive heights and separates ramps with different low banks",()=>{
  const {map}=fixture();map.relief=emptyRelief(16,16);for(let y=4;y<=10;y++)for(let x=5;x<=7;x++)map.relief.levels[y*16+x]=2;for(let y=4;y<=10;y++)for(let x=11;x<=13;x++)map.relief.levels[y*16+x]=5;
  const road=Array.from({length:14},(_,x)=>({x:x+1,y:7})),touched=new Set(road.map(p=>p.y*16+p.x));const result=connectTerrainRoad(map,road,1,touched);expect(result.blocked).toBe(0);for(let n=1;n<road.length;n++)expect(reliefAllowsStep(map.relief,road[n-1].x,7,road[n].x,7)).toBe(true);
  expect(reliefSlopes(map.relief).length).toBeGreaterThan(1);
 });
 it("keeps locked terrain, water and ramps intact during finishing",()=>{
  const {map}=fixture();map.relief=emptyRelief(16,16);map.relief.levels.fill(4);map.relief.levels[7*16+7]=12;map.terrainDesign={lockedCells:[7*16+7],waterDepth:new Array(256).fill(0)};map.terrainDesign.waterDepth![7*16+8]=2;
  const before=clone(map),plan=planTerrainFinish(map,[{x:3,y:3},{x:12,y:3},{x:12,y:12},{x:3,y:12}],"smooth",2);if(plan.ok)plan.apply!(map);expect(map.relief.levels[7*16+7]).toBe(12);expect(map.terrainDesign.waterDepth![7*16+8]).toBe(before.terrainDesign!.waterDepth![7*16+8]);
 });
 it("toggles the same cliff ray and projectile height, and increases vision continuously",()=>{
  const {map}=fixture();map.relief=emptyRelief(16,16);for(let y=3;y<=12;y++)for(let x=6;x<=9;x++)map.relief.levels[y*16+x]=4;map.terrainDesign={gameplay:{...DEFAULT_TERRAIN_GAMEPLAY,visionBlocking:true,highGroundVision:true,projectileHeight:true}};
  expect(terrainLineOfSight(map,{x:2,y:7},{x:13,y:7})).toBe(false);expect(terrainBlocksProjectile(map,7,7,1)).toBe(true);expect(terrainVisionRange(map,{x:7,y:7},8)).toBe(12);
  map.terrainDesign.gameplay!.visionBlocking=false;map.terrainDesign.gameplay!.projectileHeight=false;expect(terrainLineOfSight(map,{x:2,y:7},{x:13,y:7})).toBe(true);expect(terrainBlocksProjectile(map,7,7,1)).toBe(false);
 });
 it("honors selected door state and resolved switch pages without changing authored start state",()=>{
  const {project,map,tileset}=fixture();tileset.passability=[{up:true,down:true,left:true,right:true},{up:false,down:false,left:false,right:false}];tileset.priority=["lower","upper"];
  for(let y=0;y<16;y++)if(y!==7)map.upperTiles[y*16+8]=1;map.events.push({id:"gate",name:"gate",x:8,y:7,trigger:{kind:"action"},commands:[],pages:[{id:"closed",conditions:[],graphic:{},priority:"same",overlapForbidden:true,trigger:{kind:"action"},commands:[]},{id:"open",conditions:[{kind:"switch",switchId:"open",value:true}],graphic:{},priority:"below",overlapForbidden:false,trigger:{kind:"action"},commands:[]}]});
  const state={bodyWidth:1,bodyHeight:1,passRows:1,events:true,doors:"authored" as const,doorId:"gate",switches:{open:false}};expect(inspectTerrainRoute(project,map,{x:5,y:7},{x:11,y:7},1,state).reachable).toBe(false);expect(inspectTerrainRoute(project,map,{x:5,y:7},{x:11,y:7},1,{...state,switches:{open:true}}).reachable).toBe(true);expect(project.session.switches.open).toBeUndefined();
 });
 it("rejects partially corrupted stamp imports atomically",()=>{expect(()=>parseTerrainLibrary(JSON.stringify({format:"oprn-terrain-stamps",version:1,stamps:[{id:"broken"}]}))).toThrow();expect(parseTerrainLibrary('{"format":"oprn-terrain-stamps","version":1,"stamps":[]}')).toEqual([]);});
});
