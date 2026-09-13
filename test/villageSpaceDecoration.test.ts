import { expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { decorateVillageSpaces } from "@/editor/tools/village/spaceDecoration";
import { registerVillageDecorationCatalog } from "../scripts/lib/villageDecorationCatalog.mts";
import { emptySpatialDocument } from "./support/spatialSchemaFixture";
import { serialize, deserialize } from "@/project/io";
import { computeReachableCells } from "@/project/lint/reachability";
import { villageDesignIssue } from "@/project/villageDesign";
import { smallVillageDefinition } from "../scripts/lib/smallVillageDefinition.mts";
import { runTool } from "@/editor/tools/toolRunner";
function fixture() {
  const project=createBlankProject();project.spatialAuthoring=emptySpatialDocument();
  const rules=registerVillageDecorationCatalog(project);
  const map=createBlankMap("Dressing",24,24,DEFAULT_TILESET_ID,16);project.maps[map.id]=map;
  map.layoutPlan={version:1,kind:"village",regions:[{id:"commons",role:"plaza",x:6,y:6,w:12,h:12}]};
  project.startMapId=map.id;project.startPos={x:12,y:12};
  return {project,map,rules};
}
it("roundtrips reusable spaces and bounds repetition without losing existing walkable cells",()=>{
  const {project,map,rules}=fixture();
  const selected=rules.filter(r=>r.zone==="commons");
  const before=computeReachableCells(project,map,12,12);
  const result=decorateVillageSpaces(project,map,{x:0,y:0,w:24,h:24},selected,{x:12,y:12},7);
  expect(result).toHaveLength(3);
  const occupied=new Set(result.flatMap(r=>r.cells.map(c=>`${c.x+r.x},${c.y+r.y}`)));
  const after=computeReachableCells(project,map,12,12);
  expect([...before].filter(k=>!occupied.has(k)).every(k=>after.has(k))).toBe(true);
  for(const r of result)expect(r.space.ports.every(p=>after.has(`${p.x+r.x},${p.y+r.y}`))).toBe(true);
  const preset=smallVillageDefinition(["example-house"]);preset.design!.objectVillage!.decorations=rules;project.villagePresets=[preset];
  const reloaded=deserialize(serialize(project));
  expect(reloaded.villagePresets![0]!.design!.objectVillage!.decorations).toEqual(rules);
  expect(reloaded.spatialAuthoring!.library.spaces).toEqual(project.spatialAuthoring!.library.spaces);
});
it("does not fragment a narrow walkway or overwrite a protected house, without partial placement",()=>{
  const {project,map,rules}=fixture();
  map.lowerTiles.fill(342);map.upperTiles.fill(TILE.EMPTY);
  for(let x=0;x<24;x++)map.lowerTiles[12*24+x]=TILE.GRASS;
  map.layoutPlan!.regions.push({id:"sealed",role:"house",x:8,y:12,w:1,h:1});
  const original=structuredClone(map);
  const selected=rules.filter(r=>r.zone==="commons");
  const result=decorateVillageSpaces(project,map,{x:0,y:0,w:24,h:24},selected,{x:12,y:12},7);
  expect(result).toEqual([]);expect(map).toEqual(original);
});
it("rejects missing definitions before painting any part of the map",()=>{
  const {project,map,rules}=fixture();const original=structuredClone(map);
  expect(()=>decorateVillageSpaces(project,map,{x:0,y:0,w:24,h:24},[rules[0]!,{spaceId:"missing",zone:"commons",maxCount:1}],{x:12,y:12},7)).toThrow();
  expect(map).toEqual(original);
  const preset=smallVillageDefinition(["example"]);preset.design!.objectVillage!.decorations=[{spaceId:"x",zone:"road",maxCount:0}];
  expect(villageDesignIssue(preset.design)).toContain("반복");
});
it("connects every dock cell to land and freezes a deterministic reusable definition",()=>{
  const {project,map,rules}=fixture();
  for(let y=14;y<22;y++)for(let x=8;x<20;x++)map.lowerTiles[y*24+x]=150;
  const other=structuredClone(project), otherMap=other.maps[map.id]!;
  const selected=rules.filter(r=>r.spaceId.endsWith("fishing-dock"));
  const result=decorateVillageSpaces(project,map,{x:0,y:0,w:24,h:24},selected,{x:12,y:12},7);
  expect(result).toHaveLength(1);
  const after=computeReachableCells(project,map,12,12);
  expect(result[0]!.cells.every(p=>after.has(`${p.x+result[0]!.x},${p.y+result[0]!.y}`))).toBe(true);
  expect(decorateVillageSpaces(other,otherMap,{x:0,y:0,w:24,h:24},selected,{x:12,y:12},7)).toEqual(result);
  expect(otherMap).toEqual(map);
  const library=structuredClone(project.spatialAuthoring!.library);
  registerVillageDecorationCatalog(project);
  expect(project.spatialAuthoring!.library).toEqual(library);
});
it("can preview every attachment as an ordinary standalone outdoor space",()=>{
  const {project,rules}=fixture(),context={project};
  for(const [i,rule] of rules.entries()) {
    const result=runTool(context,"preview_spatial_build",{kind:"space",id:rule.spaceId,occurrenceId:`decor-preview-${i}`,seed:7});
    expect(result.ok,`${rule.spaceId}: ${result.summary}`).toBe(true);
    expect(context.project).toBe(project);
  }
},90_000);
