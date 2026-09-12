import assert from "node:assert/strict";
import fs from "node:fs";
import { buildHouse30BatchB } from "./lib/house30BatchB.mts";
import { inspectHouse30 } from "./lib/house30Authoring.mts";
import type { House30Entry } from "./lib/house30Contract.mts";

const ROOF = new Set([354,355,356,357,374,376,377,384,385,386,387,404,405,406,407,467]);

/** Observe the actual facade bands; never infer their preservation from volume specs. */
function upperFacades(entry: House30Entry) {
  const found: { x:number; y:number; width:number }[] = [];
  const tile = (x:number,y:number) => entry.kit.rows[y]?.tiles[x] ?? -1;
  for(let y=0; y<entry.kit.height-2; y++) for(let x=0; x<entry.kit.width; x++) {
    if(tile(x,y)!==15)continue;
    let right=x+1;
    while(tile(right,y)===16)right++;
    if(tile(right,y)!==17 || right-x<3)continue;
    // The exposed upper facade ends in a middle band. A ground facade has a base band.
    let intact=true;
    for(let dy=1;dy<=2;dy++)for(let dx=x;dx<=right;dx++) {
      const expected=dx===x?45:dx===right?47:46;
      if(tile(dx,y+dy)!==expected)intact=false;
    }
    if(intact)found.push({x,y,width:right-x+1});
  }
  return found;
}

export function reviewHouse30B(entries: readonly House30Entry[]) {
  assert.deepEqual(entries.map(entry=>entry.number),Array.from({length:10},(_,i)=>i+11));
  const checks=inspectHouse30(entries);
  return entries.map((entry,index)=>{
    const facades=upperFacades(entry);
    assert.equal(facades.length,entry.number===12?2:1,`${entry.kit.id}: exposed upper facade lost`);
    const isRoof=(x:number,y:number)=>ROOF.has(entry.kit.rows[y]?.tiles[x] ?? -1)
      || ROOF.has(entry.kit.rows[y]?.upperTiles?.[x] ?? -1);
    for (const row of entry.kit.rows) for (let x=0;x<entry.kit.width;x++) {
      if([354,355,356,357].includes(row.upperTiles?.[x] ?? -1)) {
        assert.equal(row.tiles[x],-1,`${entry.kit.id}: ridge corner silhouette filled in`);
      }
    }
    for(const facade of facades) {
      for(let y=facade.y;y<facade.y+3;y++) for(const distance of [1,2]) {
        assert.ok(isRoof(facade.x-distance,y),`${entry.kit.id}: left slope below two cells at row ${y}`);
        assert.ok(isRoof(facade.x+facade.width-1+distance,y),`${entry.kit.id}: right slope below two cells at row ${y}`);
      }
      for(let x=facade.x;x<facade.x+facade.width;x++) {
        assert.ok([405,467].includes(entry.kit.rows[facade.y-1]!.tiles[x]!),`${entry.kit.id}: upper eave broken`);
      }
    }
    return {...checks[index],exposedUpperFacades:facades,twoCellSideSlopes:true,upperEavesIntact:true,ridgeCornersIntact:true};
  });
}

const entries=buildHouse30BatchB(),checks=reviewHouse30B(entries);
let rejectedControls=0;
for(const entry of entries) {
  for(const defect of ["covered-facade","missing-side-slope"] as const) {
    const changed=structuredClone(entries),target=changed.find(item=>item.number===entry.number)!;
    const facade=upperFacades(target)[0]!;
    const x=defect==="covered-facade"?facade.x:facade.x-1;
    target.kit.rows[facade.y+1]!.tiles[x]=defect==="covered-facade"?404:240;
    target.kit.rows[facade.y+1]!.upperTiles![x]=-1;
    assert.throws(()=>reviewHouse30B(changed),defect==="covered-facade"?/exposed upper facade lost/:/left slope below two cells/);
    rejectedControls++;
  }
  const changed=structuredClone(entries),target=changed.find(item=>item.number===entry.number)!;
  const row=target.kit.rows.find(row=>row.upperTiles?.some(tile=>[354,355,356,357].includes(tile)))!;
  const x=row.upperTiles!.findIndex(tile=>[354,355,356,357].includes(tile));
  row.tiles[x]=404;
  assert.throws(()=>reviewHouse30B(changed),/ridge corner silhouette filled in/);
  rejectedControls++;
}
const out="output/evidence/house-30/b";
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(`${out}/facade-review.json`,JSON.stringify({houses:10,checks,rejectedControls},null,2));
console.log(JSON.stringify({houses:10,visibleUpperFacades:11,twoCellSideSlopes:true,rejectedControls}));
