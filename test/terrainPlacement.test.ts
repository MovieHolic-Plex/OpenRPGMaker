import { describe, expect, it } from "vitest";
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { cloneExtraLayers, cropExtraLayers } from "@/project/mapLayers";
import { normalizeDoodadGroups } from "@/project/doodadGroups";
import { normalizeRelief } from "@/project/relief/edit";
import { rampCode, reliefSlopes } from "@/project/relief/walk";
import type { GameMap } from "@/project/types";

function hill(): GameMap {
  const map:GameMap={id:"hill",name:"hill",width:40,height:30,tileSize:16,tilesetId:"ground",lowerTiles:new Array(1200).fill(0),upperTiles:new Array(1200).fill(-1),events:[]};
  map.relief={width:40,height:30,levels:new Array(1200).fill(0)};
  for(let y=10;y<=17;y++)for(let x=12;x<=23;x++)map.relief.levels[y*40+x]=2;
  return map;
}
describe("terrain placement contracts",()=>{
  for(const [dir,x,y] of [["n",17,17],["s",17,10],["e",12,14],["w",23,14]] as const)for(const width of [2,4,6]){
    it(`joins ${dir} with width ${width}, preserving authored heights`,()=>{
      const map=hill(),before=map.relief!.levels.slice();
      const plan=planReliefRamp(map,{x,y,face:"top"},width,false);
      expect(plan.ok).toBe(true);plan.apply!(map);
      expect(map.relief!.levels).toEqual(before);
      expect(map.relief!.ramps!.filter(v=>v===rampCode(dir)).length).toBe(width*3);
      expect(reliefSlopes(map.relief!)).toEqual([expect.objectContaining({dir,lo:0,hi:2})]);
    });
  }
  it("does not overwrite props in the ramp footprint",()=>{
    const map=hill();for(let y=18;y<=20;y++)for(let x=12;x<=23;x++)map.upperTiles[y*40+x]=10;
    const before=JSON.stringify(map);
    expect(planReliefRamp(map,{x:17,y:17,face:"wall"},4,false).ok).toBe(false);
    expect(JSON.stringify(map)).toBe(before);
  });
  it("preserves ground-level bridge markers through normalization and cropping",()=>{
    const r={width:4,height:3,levels:new Array(12).fill(0),ramps:[0,9,9,0,0,0,0,0,0,0,0,0]};
    expect(normalizeRelief(r,4,3)?.ramps).toEqual(r.ramps);
    const map={relief:r};cropExtraLayers(map,4,3,0,0,4,3);expect(map.relief?.ramps).toEqual(r.ramps);
  });
  it("clones group restoration data and remaps it with all map layers",()=>{
    const map=hill();map.doodadGroups=[{id:"forest",label:"forest",kitId:"tree",cells:[{index:41,tile:8,before:-1},{index:42,tile:9,before:4}]}];
    const clone=cloneExtraLayers(map);clone.doodadGroups![0]!.cells[0]!.before=99;
    expect(map.doodadGroups[0]!.cells[0]!.before).toBe(-1);
    cropExtraLayers(map,40,30,1,1,3,2);
    expect(map.doodadGroups[0]!.cells).toEqual([{index:0,tile:8,before:-1},{index:1,tile:9,before:4}]);
  });
  it("loads old maps without groups and rejects invalid and duplicate group cells",()=>{
    expect(normalizeDoodadGroups(undefined,12)).toBeUndefined();
    const groups=normalizeDoodadGroups([{id:"a",label:"a",kitId:"tree",cells:[{index:2,tile:8,before:-1},{index:2,tile:9,before:0},{index:13,tile:4,before:-1}]}],12);
    expect(groups?.[0]?.cells).toEqual([{index:2,tile:8,before:-1}]);
  });
});
