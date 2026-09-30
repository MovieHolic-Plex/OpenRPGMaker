import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { paintMarketDeck, placeMarketDeckProps } from "@/editor/tools/village/plaza";
import { marketAisleCells, placeMarketDisplays, planMarketDisplays } from "@/editor/tools/village/market";
import { protectedHouseCells } from "@/editor/tools/houseProtection";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import { canMove } from "@/project/collision";
import type { GameMap, Project, Rect } from "@/project/types";

function fixture(width=24,height=20) {
  const project=createEmptyToolProject("Market placement contract");
  const map=createBlankMap("Market fixture",width,height,COMBINED_TOWN_TILESET_ID,16);
  project.maps[map.id]=map;
  return {project,map};
}
function reachable(project:Project,map:GameMap,x:number,y:number,area:Rect={x:0,y:0,w:map.width,h:map.height}) {
  const seen=new Set<number>(), queue=[{x,y}];
  while(queue.length) {
    const point=queue.pop()!,at=point.y*map.width+point.x;
    if(seen.has(at))continue;
    seen.add(at);
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx=point.x+dx!,ny=point.y+dy!;
      if(nx<area.x || ny<area.y || nx>=area.x+area.w || ny>=area.y+area.h)continue;
      if(canMove(project,map,point.x,point.y,nx,ny))queue.push({x:nx,y:ny});
    }
  }
  return seen;
}
function completePieces(map:GameMap) {
  map.upperTiles.forEach((tile,at)=>{
    if(tile===202)expect(map.upperTiles[at+1]).toBe(203);
    if(tile===203)expect(map.upperTiles[at-1]).toBe(202);
    if(tile===234)expect(map.upperTiles.slice(at,at+3)).toEqual([234,235,236]);
    if(tile===235)expect(map.upperTiles.slice(at-1,at+2)).toEqual([234,235,236]);
    if(tile===236)expect(map.upperTiles.slice(at-2,at+1)).toEqual([234,235,236]);
    if(tile===236)expect(map.upperTiles[at+1]).not.toBe(234);
    expect([196,197,226,227,256,257,320,327,328]).not.toContain(tile);
  });
}

describe("market goods and customer access",()=>{
  it.each([{w:16,h:12},{w:10,h:8},{w:8,h:6},{w:6,h:5},{w:6,h:6}])(
    "builds three goods displays with an exterior route on a $w by $h deck",({w,h})=>{
      const {project,map}=fixture();
      const deck={x:3,y:3,w,h}, inner={x:4,y:4,w:w-2,h:h-2};
      paintMarketDeck(map,deck);
      const centerX=deck.x+Math.floor(w/2), centerY=deck.y+Math.floor(h/2);
      for(const [x,y,nx,ny] of [[centerX,deck.y-1,centerX,deck.y],[centerX,deck.y+h,centerX,deck.y+h-1],
        [deck.x-1,centerY,deck.x,centerY],[deck.x+w,centerY,deck.x+w-1,centerY]]) {
        expect(canMove(project,map,x!,y!,nx!,ny!)).toBe(true);
      }
      const before=structuredClone(map),plan=planMarketDisplays(map,inner);
      expect(map).toEqual(before);
      expect(new Set(plan.displays.map(display=>display.goods))).toEqual(new Set(["produce","pottery","provisions"]));
      expect(placeMarketDeckProps(map,inner)).toBe(plan.placed);
      expect(plan.placed).toBeGreaterThanOrEqual(4);
      const walk=reachable(project,map,deck.x+Math.floor(deck.w/2),deck.y+deck.h);
      for(const display of plan.displays) for(const point of display.frontage)expect(walk.has(point.y*map.width+point.x)).toBe(true);
      for(const point of marketAisleCells(inner)) {
        expect(map.upperTiles[point.y*map.width+point.x]).toBe(TILE.EMPTY);
        expect(walk.has(point.y*map.width+point.x)).toBe(true);
      }
      expect(map.lowerTiles).toEqual(before.lowerTiles);
      completePieces(map);
    });

  it("uses full goods-and-counter stalls when the plaza has room",()=>{
    const {map}=fixture();
    const result=placeMarketDisplays(map,{x:3,y:3,w:12,h:8});
    expect(result.displays.slice(0,3).map(display=>display.cells.length)).toEqual([6,6,6]);
    expect(map.upperTiles).toEqual(expect.arrayContaining([202,203,352,177,207,234,235,236]));
    completePieces(map);
  });

  it("preserves empty house geometry, door approaches, events, roads and legacy stacks",()=>{
    const {map}=fixture();
    map.layoutPlan={version:1,kind:"existing",regions:[{id:"kept",role:"house",label:"Owned",x:4,y:3,w:3,h:3,doorAt:{x:5,y:5}}]};
    map.events=[{id:"customer",name:"Customer",x:11,y:6,pages:[]}];
    map.lowerTileStacks={[9*map.width+4]:[]};
    map.upperTileStacks={[9*map.width+5]:[199]};
    map.upperTiles[4*map.width+12]=237;
    map.lowerTiles[10*map.width+4]=SAND_TILE.BODY;
    const before=structuredClone(map);
    const protectedIndices=new Set(protectedHouseCells(map).map(point=>point.y*map.width+point.x));
    for(const point of [{x:4,y:6},{x:5,y:6},{x:6,y:6},{x:11,y:6},{x:10,y:6},{x:12,y:6},{x:11,y:5},{x:11,y:7},
      {x:4,y:9},{x:5,y:9},{x:12,y:4},{x:4,y:10}])protectedIndices.add(point.y*map.width+point.x);
    const result=placeMarketDisplays(map,{x:2,y:2,w:14,h:12});
    expect(result.placed).toBeGreaterThan(0);
    for(const at of protectedIndices)expect(map.upperTiles[at]).toBe(before.upperTiles[at]);
    expect({...map,upperTiles:before.upperTiles}).toEqual(before);
    completePieces(map);
  });

  it("does not isolate a customer pocket behind an existing obstacle",()=>{
    const {project,map}=fixture();
    const area={x:3,y:3,w:12,h:9};
    for(let y=3;y<11;y++)map.upperTiles[y*map.width+8]=237;
    const before=reachable(project,map,3,3,area);
    const result=placeMarketDisplays(map,area);
    const after=reachable(project,map,3,3,area);
    const occupied=new Set(result.displays.flatMap(display=>display.cells.map(point=>point.y*map.width+point.x)));
    expect(result.placed).toBeGreaterThan(0);
    // Seed may itself be a display: use a preserved central aisle cell instead.
    const seed=result.aisle.find(point=>map.upperTiles[point.y*map.width+point.x]===TILE.EMPTY)!;
    const connected=reachable(project,map,seed.x,seed.y,area);
    for(const at of before)if(!occupied.has(at))expect(connected.has(at)).toBe(true);
    expect(after.size).toBeGreaterThan(1);
  });

  it.each([{x:-2,y:-1,w:7,h:6},{x:5,y:5,w:8,h:8},{x:0,y:0,w:2,h:2},{x:0,y:0,w:1,h:1}])(
    "keeps whole multi-part props inside clipped or tiny areas: %j",area=>{
      const {map}=fixture(8,8),before=structuredClone(map);
      placeMarketDeckProps(map,area);
      expect(map.lowerTiles).toEqual(before.lowerTiles);
      expect(map.upperTiles).toHaveLength(64);
      map.upperTiles.forEach((tile,at)=>{
        if(tile===TILE.EMPTY)return;
        expect(at%map.width).toBeGreaterThanOrEqual(area.x);
        expect(at%map.width).toBeLessThan(area.x+area.w);
        expect(Math.floor(at/map.width)).toBeGreaterThanOrEqual(area.y);
        expect(Math.floor(at/map.width)).toBeLessThan(area.y+area.h);
      });
      completePieces(map);
    });

  it("never writes a clipped deck outside the map or through a protected house",()=>{
    const {map}=fixture(8,8);
    map.layoutPlan={version:1,kind:"existing",regions:[{id:"kept",role:"house",label:"Owned",x:0,y:0,w:2,h:2}]};
    const protectedIndices=protectedHouseCells(map).map(point=>point.y*map.width+point.x);
    paintMarketDeck(map,{x:-3,y:-3,w:8,h:8});
    expect(map.lowerTiles).toHaveLength(64);
    expect(Object.keys(map.lowerTiles)).toHaveLength(64);
    for(const at of protectedIndices)expect(map.lowerTiles[at]).toBe(TILE.GRASS);
  });

  it("leaves fully obstructed, watery, and invalid areas untouched",()=>{
    const {map}=fixture(8,8);
    map.lowerTiles.fill(TILE.WATER);
    const before=structuredClone(map);
    expect(placeMarketDeckProps(map,{x:0,y:0,w:8,h:8})).toBe(0);
    expect(placeMarketDeckProps(map,{x:0.5,y:0,w:8,h:8})).toBe(0);
    paintMarketDeck(map,{x:0.5,y:0,w:8,h:8});
    expect(map).toEqual(before);
  });
});
