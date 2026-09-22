// Whole, purposeful yard assemblies. No random scatter or distant fallback.
export const HOUSEHOLD_KITS = [
 {id:'home',name:'주거 마당',items:[['꽃 화단',0,0],['빨랫줄',0,3],['항아리',3,3]]},
 {id:'garden',name:'텃밭 마당',items:[['허수아비',0,0],['채소밭',0,2],['씨앗 자루',3,3]]},
 {id:'work',name:'작업 마당',items:[['나무 상자',0,0],['나무통',2,0],['장작',4,0],['가로 탁자',0,2]]},
 {id:'herbs',name:'약초 마당',items:[['꽃 화단',0,0],['약초 화분',0,3],['항아리',3,3]]},
];
export function placeHouseholdProps({map,houses,parts,roads,access,cliffCells,reachable,stamp}) {
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
 for(const [n,h] of houses.entries()) {
   const kit=HOUSEHOLD_KITS[n%HOUSEHOLD_KITS.length];
   // Compact alternatives keep the same purpose; a garden always retains its bed.
   const variants=[kit.items,kit.items.slice(0,2)];
   let result;
   for(const items of variants) {
     const w=Math.max(...items.map(([name,x])=>x+parts.find(p=>p.name===name).width));
     const height=Math.max(...items.map(([name,,y])=>y+parts.find(p=>p.name===name).height));
     const origins=[];
     for(let y=h.y+h.h-height;y>=h.y+1;y--) for(const [side,x] of [['right',h.x+h.w+1],['left',h.x-w-1]]) origins.push({x,y,side});
     for(const origin of origins) {
       const group=items.map(([name,dx,dy])=>{const p=parts.find(p=>p.name===name);return{name,x:origin.x+dx,y:origin.y+dy,w:p.width,h:p.height,upper:p.targetUpper.flat(),ownerId:h.id,kit:kit.id,side:origin.side};});
       if(!group.every(o=>free(o.x,o.y,o.w,o.h))||!accessible(group))continue;
       result=group;yards.push({ownerId:h.id,kit:kit.id,name:kit.name,...origin,w,h:height});break;
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
  if(o.name==='허수아비') {
    const bed=props.find(q=>q.ownerId===o.ownerId&&q.name==='채소밭');
    if(!bed||!bed.upper.every((t,i)=>map.upperTiles[(bed.y+Math.floor(i/bed.w))*map.width+bed.x+i%bed.w]===t))errors.push({code:'scarecrow-without-garden',x:o.x,y:o.y});
  }
 }
 return errors;
}
