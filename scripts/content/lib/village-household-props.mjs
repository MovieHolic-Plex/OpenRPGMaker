// Whole, purposeful yard assemblies. No random scatter or distant fallback.
import fs from 'node:fs';
export const PROP_PROGRAMS=JSON.parse(fs.readFileSync(new URL('../../../tiledata/forest-villages/diverse/prop-programs.json',import.meta.url)));
export const HOUSEHOLD_KITS=PROP_PROGRAMS.activities;
const distance=(a,b)=>Math.max(0,a.x-b.x-b.w+1,b.x-a.x-a.w+1)+Math.max(0,a.y-b.y-b.h+1,b.y-a.y-a.h+1);
const present=(map,o)=>o.upper.every((t,i)=>map.upperTiles[(o.y+Math.floor(i/o.w))*map.width+o.x+i%o.w]===t);
export function purposeAnchor(o,group,owner,sites){
 if(o.anchor==='house')return owner;
 if(o.anchor==='dock'||o.anchor==='farm')return sites[o.anchor];
 return group.find(q=>q.ownerId===o.ownerId&&q.name===o.anchor);
}
export function placeHouseholdProps({map,houses,parts,roads,access,cliffCells,reachable,stamp,sites={}}) {
 const W=map.width, placed=[], yards=[];
 const at=(x,y)=>y*W+x;
 const nearRoad=(x,y)=>[[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>roads.has(at(x+dx,y+dy)));
 const free=(x,y,w,h)=>x>=1&&y>=1&&x+w<map.width&&y+h<map.height&&Array.from({length:w*h},(_,n)=>[x+n%w,y+Math.floor(n/w)]).every(([cx,cy])=>{
   const i=at(cx,cy);
   return map.lowerTiles[i]===240&&map.upperTiles[i]===-1&&!nearRoad(cx,cy)
     &&!houses.some(h=>cx>=h.x&&cx<h.x+h.w&&cy>=h.y&&cy<h.y+h.h)
     &&!access.some(a=>Math.abs(a.x-cx)+Math.abs(a.y-cy)<=1)
     &&![[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy])=>cliffCells.has(at(cx+dx,cy+dy)));
 });
 const accessible=items=>items.every(o=>Array.from({length:o.w*o.h},(_,n)=>[o.x+n%o.w,o.y+Math.floor(n/o.w)]).some(([x,y])=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>reachable.has((x+dx)+','+(y+dy))&&!items.some(q=>x+dx>=q.x&&x+dx<q.x+q.w&&y+dy>=q.y&&y+dy<q.y+q.h))));
 for(const h of houses) {
   const kit=HOUSEHOLD_KITS[h.activity];
   if(!kit)throw Error("House activity must be authored: "+h.id);
   // Compact alternatives keep the same purpose; a garden always retains its bed.
   const variants=[kit.items,kit.compact.map(i=>kit.items[i])];
   let result;
   for(const items of variants) {
     const w=Math.max(...items.map(([name,x])=>x+parts.find(p=>p.name===name).width));
     const height=Math.max(...items.map(([name,,y])=>y+parts.find(p=>p.name===name).height));
     const origins=[];
     for(let y=h.y+h.h-height;y>=h.y+1;y--) for(const [side,x] of [['right',h.x+h.w+1],['left',h.x-w-1]]) origins.push({x,y,side});
     for(const origin of origins) {
       const group=items.map(([name,dx,dy,purpose,anchor])=>{const p=parts.find(p=>p.name===name);return{name,x:origin.x+dx,y:origin.y+dy,w:p.width,h:p.height,upper:p.targetUpper.flat(),ownerId:h.id,kit:h.activity,purpose,anchor,side:origin.side};});
       if(!group.every(o=>{const a=purposeAnchor(o,group,h,sites);return a&&distance(o,a)<=(o.anchor==='dock'?12:o.anchor==='house'?6:3)&&free(o.x,o.y,o.w,o.h);})||!accessible(group))continue;
       result=group;yards.push({ownerId:h.id,kit:h.activity,name:kit.name,reason:h.reason,...origin,w,h:height});break;
     }
     if(result)break;
   }
   for(const o of result??[]) {stamp(o.name,o.x,o.y,o.w,o.h,null,o.upper,'prop');placed.push(o);}
 }
 return {placed,yards};
}
export function inspectHouseholdProps(map,plan) {
 const errors=[],props=plan.placements.filter(o=>o.kind==='prop'),allowed=new Set(),ids=new Set(props.flatMap(o=>o.upper).filter(n=>n>=0));
 for(const o of [...plan.placements,...plan.houses]) for(let y=o.y;y<o.y+o.h;y++)for(let x=o.x;x<o.x+o.w;x++)allowed.add(y*map.width+x);
 for(let i=0;i<map.upperTiles.length;i++)if(ids.has(map.upperTiles[i])&&!allowed.has(i))errors.push({code:'unowned-prop',x:i%map.width,y:Math.floor(i/map.width)});
 for(const o of props) {
  const owner=plan.houses.find(h=>h.id===o.ownerId);
  if(!owner){errors.push({code:'prop-owner-missing',x:o.x,y:o.y});continue;}
  if(o.y<owner.y||o.y+o.h>owner.y+owner.h||!(o.x+o.w<=owner.x&&owner.x-o.x<=6||o.x>=owner.x+owner.w&&o.x+o.w-owner.x-owner.w<=6))errors.push({code:'prop-outside-yard',x:o.x,y:o.y});
  const rule=HOUSEHOLD_KITS[owner.activity]?.items.find(([name])=>name===o.name);
  if(!rule||o.kit!==owner.activity||o.purpose!==rule[3]||o.anchor!==rule[4]) {errors.push({code:'prop-purpose-mismatch',x:o.x,y:o.y});continue;}
  const anchor=purposeAnchor(o,props,owner,plan.activitySites??{});
  const exists=anchor&&(o.anchor==='house'||o.anchor==='dock'&&Array.from({length:anchor.w*anchor.h},(_,i)=>map.upperTiles[(anchor.y+Math.floor(i/anchor.w))*map.width+anchor.x+i%anchor.w]).every(t=>t===199)||o.anchor==='farm'&&Array.from({length:anchor.w*anchor.h},(_,i)=>map.lowerTiles[(anchor.y+Math.floor(i/anchor.w))*map.width+anchor.x+i%anchor.w]).every(t=>t===188)||!['house','dock','farm'].includes(o.anchor)&&present(map,anchor));
  if(!exists||distance(o,anchor)>(o.anchor==='dock'?12:o.anchor==='house'?6:3))errors.push({code:o.name==='허수아비'?'scarecrow-without-garden':'prop-purpose-anchor-missing',x:o.x,y:o.y});

 }
 return errors;
}
