// Authored public places and gardens: whole source parts, explicit purposes, real anchors.
import fs from 'node:fs';
import assert from 'node:assert/strict';
export const CIVIC_PROGRAMS=JSON.parse(fs.readFileSync(new URL('../../../tiledata/forest-villages/diverse/civic-programs.json',import.meta.url)));
const cells=o=>Array.from({length:o.w*o.h},(_,i)=>({x:o.x+i%o.w,y:o.y+Math.floor(i/o.w)}));
const distance=(a,b)=>Math.max(0,a.x-b.x-b.w+1,b.x-a.x-a.w+1)+Math.max(0,a.y-b.y-b.h+1,b.y-a.y-a.h+1);
const wallTiles=new Set([42,43,44,45,46,47]);
const fullPart=(map,o)=>cells(o).every(({x,y},i)=>map.upperTiles[y*map.width+x]===o.upper[i]);
function site(zone,plan,map) {
 const a=zone.anchor;
 if(a.type==='house')return plan.houses.find(h=>h.id===a.id);
 if(a.type==='farm')return plan.placements.find(o=>o.kind==='farm'&&o.x===a.x&&o.y===a.y);
 if(a.type==='dock')return plan.activitySites.dock;
 if(a.type==='road'&&plan.roadCells.includes(a.y*map.width+a.x))return {...a,w:1,h:1};
}
export function placeCivicProps({map,plan,parts,project,reach}) {
 const zones=structuredClone(CIVIC_PROGRAMS[map.id]??[]),added=[],bad=[];
 for(const z of zones) {
  const anchor=site(z,plan,map);
  if(!anchor)throw Error('Civic site missing: '+z.id);
  z.site={x:anchor.x,y:anchor.y,w:anchor.w,h:anchor.h,layer:z.anchor.type==='dock'?'upper':'lower'};
  z.site.tiles=cells(anchor).map(c=>map[z.site.layer+'Tiles'][c.y*map.width+c.x]);
  const group=z.items.map(item=>{
   const p=parts.find(p=>p.name===item.name);assert(p,'Missing civic part '+item.name);
   return {...item,w:p.width,h:p.height,kind:'civic-prop',placeId:z.id,lower:'KEEP',upper:p.targetUpper.flat()};
  });
  for(const o of group) {
   const wall=o.name==='벽걸이 등불';
   if(distance(o,anchor)>z.anchor.maxDistance)bad.push([z.id,o.id,'site-too-far',distance(o,anchor)]);
   if(o.near&&!group.some(q=>q.name===o.near&&distance(o,q)<=4))bad.push([o.id,'related-part-too-far']);
   for(const {x,y} of cells(o)) {
    const i=y*map.width+x;
    if(x<1||y<1||x>=map.width-1||y>=map.height-1||map.upperTiles[i]!==-1||(!wall&&map.lowerTiles[i]!==240))bad.push([o.id,x,y,'occupied',map.lowerTiles[i],map.upperTiles[i]]);
    if(wall&&(!wallTiles.has(map.lowerTiles[i])||Math.abs(x-anchor.doorAt?.x)<2))bad.push([o.id,x,y,'not-blank-wall']);
    if(!wall&&plan.houses.some(h=>x>=h.x&&x<h.x+h.w&&y>=h.y&&y<h.y+h.h))bad.push([o.id,x,y,'house-footprint']);
    if(plan.access.some(a=>a.x===x&&a.y===y))bad.push([o.id,x,y,'reserved-access']);
    if(added.some(q=>cells(q).some(c=>c.x===x&&c.y===y)))bad.push([o.id,x,y,'civic-overlap']);
   }
   added.push(o);
  }
 }
 assert.equal(bad.length,0,JSON.stringify(bad));
 for(const o of added)for(const [i,{x,y}]of cells(o).entries())map.upperTiles[y*map.width+x]=o.upper[i];
 const seen=reach.computeReachableCells(project,map,plan.entrance.x,plan.entrance.y);
 for(const o of added) {
  if(o.name==='벽걸이 등불')continue;
  const candidates=cells(o).flatMap(({x,y})=>[{x,y:y+1},{x:x-1,y},{x:x+1,y},{x,y:y-1}]);
  o.useAt=candidates.find(c=>seen.has(c.x+','+c.y));
  assert(o.useAt,'Civic prop inaccessible: '+o.id);
  plan.access.push({role:'civic-use',...o.useAt,placeId:o.placeId,propId:o.id});
 }
 // Every pre-existing door, road entry, stair and household activity stays usable.
 for(const a of plan.access)assert(seen.has(a.x+','+a.y),'Civic blocked access '+JSON.stringify(a));
 for(const o of plan.placements.filter(o=>o.kind==='prop'))assert(cells(o).some(c=>reach.isAdjacentOrOn(seen,c.x,c.y)),'Civic blocked existing prop '+o.name);
 plan.placements.push(...added);plan.civicPlaces=zones;
 return {zones,added};
}
export function inspectCivicProps(map,plan) {
 const errors=[],props=plan.placements.filter(o=>o.kind==='civic-prop');
 for(const o of props) {
  const z=plan.civicPlaces?.find(z=>z.id===o.placeId),a=z&&site(z,plan,map);
  if(!fullPart(map,o))errors.push({code:'civic-part-missing',x:o.x,y:o.y});
  if(!z?.items.some(i=>i.id===o.id&&i.name===o.name&&i.purpose===o.purpose&&i.x===o.x&&i.y===o.y))errors.push({code:'civic-purpose-mismatch',x:o.x,y:o.y});
  const anchored=a&&z.site&&distance(o,a)<=z.anchor.maxDistance&&cells(z.site).every((c,i)=>map[z.site.layer+'Tiles'][c.y*map.width+c.x]===z.site.tiles[i]);
  if(!anchored||o.near&&!props.some(q=>q.placeId===o.placeId&&q.name===o.near&&distance(o,q)<=4&&fullPart(map,q)))errors.push({code:'civic-anchor-missing',x:o.x,y:o.y});
  if(o.name==='벽걸이 등불'&&(!wallTiles.has(map.lowerTiles[o.y*map.width+o.x])||Math.abs(o.x-a?.doorAt?.x)<2))errors.push({code:'wall-light-backing',x:o.x,y:o.y});
 }
 return errors;
}
