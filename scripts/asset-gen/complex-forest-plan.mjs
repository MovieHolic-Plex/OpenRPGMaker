import fs from 'node:fs';

export const nodes=[
 {id:'cabin',x:40,y:34,rx:9,ry:8,anchor:[40,38]},
 {id:'northwest',x:18,y:15,rx:7,ry:6,anchor:[18,17]},
 {id:'northeast',x:62,y:15,rx:7,ry:6,anchor:[62,17]},
 {id:'west',x:15,y:43,rx:7,ry:7,anchor:[15,45]},
 {id:'south',x:35,y:58,rx:8,ry:6,anchor:[35,60]},
 {id:'southeast',x:64,y:51,rx:7,ry:7,anchor:[64,53]},
];
export const links=[
 ['northwest','cabin',[[18,15],[23,24],[32,24],[40,34]]],
 ['northeast','cabin',[[62,15],[53,19],[52,28],[40,34]]],
 ['west','cabin',[[15,43],[23,42],[29,34],[40,34]]],
 ['south','cabin',[[35,58],[42,53],[45,44],[40,34]]],
 ['southeast','cabin',[[64,51],[57,44],[53,38],[40,34]]],
 ['northwest','west',[[18,15],[12,24],[11,34],[15,43]]],
 ['northeast','southeast',[[62,15],[69,25],[66,34],[70,43],[64,51]]],
];
function spline(points){const out=[];for(let i=0;i<points.length-1;i++)for(let j=0;j<12;j++){
 const t=j/12,p0=points[Math.max(i-1,0)],p1=points[i],p2=points[i+1],p3=points[Math.min(i+2,points.length-1)];
 out.push([0,1].map(k=>.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)));
}out.push(points.at(-1));return out;}
function segmentDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/len)):0;return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
export function components(mask,w,h){const visited=new Set(),parts=[];for(let i=0;i<mask.length;i++)if(mask[i]&&!visited.has(i)){
 const queue=[i];visited.add(i);for(let k=0;k<queue.length;k++){const v=queue[k],x=v%w,y=Math.floor(v/w);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=ny*w+nx;if(nx>=0&&nx<w&&ny>=0&&ny<h&&mask[n]&&!visited.has(n)){visited.add(n);queue.push(n);}}}parts.push(queue);
}return parts.sort((a,b)=>b.length-a.length);}
export function trunkPlan(forest,w,h,source){
 const at=(x,y)=>source.lowerTiles[y*source.width+x];
 const left=[6,7,8].map(y=>[13,14,15].map(x=>at(x,y))),right=[6,7,8].map(y=>[24,25,26].map(x=>at(x,y)));
 const pair=[6,7,8].map(y=>[at(16,y),at(17,y)]),leftCap=[6,7,8].map(y=>[13,14,15,16].map(x=>at(x,y))),rightCap=[6,7,8].map(y=>[23,24,25,26].map(x=>at(x,y)));
 if(JSON.stringify(pair)!==JSON.stringify([[1425,1350],[1429,1428],[1433,1432]]))throw Error('User reference changed');
 const f=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&forest[y*w+x];
 const runs=[];for(let y=0;y<h-1;y++){let start=-1;for(let x=0;x<=w;x++){const e=x<w&&f(x,y)&&!f(x,y+1);if(e&&start<0)start=x;if(!e&&start>=0){runs.push({x:start,y,width:x-start});start=-1;}}}
 const edits=new Map(),placements=[];
 for(const run of runs){
  let candidates=[];
  if(run.width<=4)candidates=[{x:run.x,rows:leftCap},{x:run.x+run.width-4,rows:rightCap}];
  else {const width=Math.max(8,run.width),rows=left.map((r,dy)=>[...r,...Array.from({length:width-6},(_,i)=>pair[dy][i%2]),...right[dy]]);candidates=[{x:run.x,rows},{x:run.x+run.width-width,rows}];}
  const candidatesOk=candidates.filter(c=>c.rows.every((row,dy)=>row.every((tile,dx)=>{
   const x=c.x+dx,y=run.y+dy,key=y*w+x;
   return y<h&&f(x,run.y)&&((x>=run.x&&x<run.x+run.width)||f(x,y))&&(!edits.has(key)||edits.get(key).tile===tile);
  })));
  if(!candidatesOk.length)return {ok:false,reason:'unsupported end cap',run};
  // Orient short caps toward THIS clearing's interior, not the whole map center.
  let openLeft=run.x,openRight=run.x+run.width;
  while(openLeft>0&&!f(openLeft-1,run.y+1))openLeft--;
  while(openRight<w&&!f(openRight,run.y+1))openRight++;
  const preferRight=run.x+run.width/2<(openLeft+openRight)/2;
  const c=candidatesOk.find(c=>c.rows===(preferRight?rightCap:leftCap))||candidatesOk[0];
  c.rows.forEach((row,dy)=>row.forEach((tile,dx)=>{const x=c.x+dx,y=run.y+dy;edits.set(y*w+x,{layer:'lower',x,y,tile});}));
  placements.push({...run,start:c.x,rows:c.rows});
 }
 return {ok:true,edits:[...edits.values()],placements,exposedCells:runs.reduce((a,r)=>a+r.width,0)};
}
export function makePlan(source,seed){
 const w=80,h=72,curves=links.map(([, ,points])=>spline(points));
 const corridorRadius=3.8+(seed%5)*.12;
 const field=(x,y)=>{
  let d=Infinity;for(const n of nodes)d=Math.min(d,(Math.hypot((x-n.x)/n.rx,(y-n.y)/n.ry)-1)*Math.min(n.rx,n.ry));
  for(const line of curves)for(let i=1;i<line.length;i++)d=Math.min(d,segmentDistance(x,y,line[i-1],line[i])-corridorRadius);
  const organic=.7*Math.sin(x*.23+seed*.7)*Math.cos(y*.18+seed*.3)+.35*Math.sin(x*.43+y*.26+seed);
  return d+organic;
 };
 const forest=Array.from({length:w*h},(_,i)=>field(Math.floor((i%w)/2)*2+1,Math.floor(Math.floor(i/w)/3)*3+1.5)>0);
 // Project narrow terminal protrusions onto shapes with a complete legal cap.
 // Change the forest mask, never crop a trunk asset to force it to fit.
 let trunks,repairs=0;
 for(;repairs<24;repairs++){
  trunks=trunkPlan(forest,w,h,source);if(trunks.ok)break;
  const r=trunks.run;if(!r)return {ok:false,seed,...trunks};
  const start=r.width===6?(seed%2?r.x:r.x+r.width-2):r.x;
  const width=r.width===6?2:r.width;
  for(let y=r.y-2;y<=r.y;y++)for(let x=start;x<start+width;x++)forest[y*w+x]=false;
 }
 if(!trunks.ok)return {ok:false,seed,...trunks};
 const walk=forest.map(v=>!v);for(const c of trunks.edits)walk[c.y*w+c.x]=false;
 // House 5×7, including roof corners, occupies the central clearing's north half.
 const house={x:38,y:30,width:5,height:7};
 for(let y=house.y;y<house.y+house.height;y++)for(let x=house.x;x<house.x+house.width;x++){
  if(!walk[y*w+x])return {ok:false,seed,reason:'house clearance'};walk[y*w+x]=false;
 }
 const parts=components(walk,w,h),largest=new Set(parts[0]);
 if(nodes.some(n=>!largest.has(n.anchor[1]*w+n.anchor[0])))return {ok:false,seed,reason:'disconnected node'};
 const core=walk.map((v,i)=>{if(!v)return false;const x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h||!walk[(y+dy)*w+x+dx])return false;return true;});
 const cores=components(core,w,h);const connectedCore=cores.find(part=>{const set=new Set(part);return nodes.every(n=>{for(let y=n.anchor[1]-3;y<=n.anchor[1]+3;y++)for(let x=n.anchor[0]-3;x<=n.anchor[0]+3;x++)if(set.has(y*w+x))return true;return false;});});
 if(!connectedCore)return {ok:false,seed,reason:'narrow passage'};
 const fparts=components(forest,w,h),forestCells=forest.filter(Boolean).length,ratio=forestCells/(w*h),coverage=parts[0].length/walk.filter(Boolean).length;
 if(fparts.length!==3)return {ok:false,seed,reason:'loop topology',forestComponents:fparts.length};
 if(fparts.slice(1).some(p=>p.length<42))return {ok:false,seed,reason:'tiny grove'};
 if(coverage<.99||ratio<.60||ratio>.80)return {ok:false,seed,reason:'coverage',ratio,coverage};
 let perimeter=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!forest[i])for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(forest[(y+dy)*w+x+dx])perimeter++;}
 const metrics={forestCells,forestRatio:ratio,walkableComponents:parts.length,reachableFraction:coverage,forestComponents:fparts.map(p=>p.length),coreConnected:true,coreCells:connectedCore.length,perimeter,graphNodes:nodes.length,graphEdges:links.length,graphCycles:links.length-nodes.length+1,exposedCells:trunks.exposedCells,trunkRuns:trunks.placements.length,capShapeRepairs:repairs};
 return {ok:true,seed,width:w,height:h,forest,walk,core,trunks,house,nodes,links,metrics,score:perimeter-250*Math.abs(ratio-.70)+connectedCore.length*.025};
}
if(process.argv[1]?.endsWith('complex-forest-plan.mjs')){
 const out='output/evidence/forest-complex';const p=JSON.parse(fs.readFileSync(out+'/local-reference.json'));const source=p.maps.map_forest_cabin_autotile;
 const attempts=Array.from({length:48},(_,seed)=>makePlan(source,seed));
 fs.writeFileSync(out+'/search.json',JSON.stringify(attempts.map(({forest,walk,core,trunks,...p})=>p),null,2));
 const valid=attempts.filter(p=>p.ok).sort((a,b)=>b.score-a.score);if(!valid.length){console.log(attempts.map(p=>({seed:p.seed,reason:p.reason,run:p.run,ratio:p.ratio,coverage:p.coverage})));throw Error('No feasible layout');}
 const best=valid[0];fs.writeFileSync(out+'/plan.json',JSON.stringify(best));
 console.log(JSON.stringify({valid:valid.length,seed:best.seed,metrics:best.metrics}));
 for(let y=0;y<best.height;y+=3)console.log(Array.from({length:best.width/2},(_,x)=>best.forest[y*best.width+x*2]?'##':'  ').join(''));
}
