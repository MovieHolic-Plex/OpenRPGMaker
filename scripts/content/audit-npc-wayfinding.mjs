// Focused audit of actual authored map geometry, not a replacement engine gate.
import fs from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [beforePath,preparedDir]=process.argv.slice(2);
const before=JSON.parse(await fs.readFile(beforePath,'utf8'));
const after=JSON.parse(await fs.readFile(join(preparedDir,'prepared-canonical.json'),'utf8'));
const report={standing:[],routes:[],overlaps:[]};
await withTsModule(resolve('src/project/collision.ts'),'npc-geometry-audit.mjs',m=>{
 const dirs={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
 for(const map of Object.values(after.maps)){
  const old=before.maps[map.id];
  for(const e of map.events){
   if(!e.pages.some(p=>/^oprn_emerald_field_cast_/.test(p.graphic?.sprite?.id??'')))continue;
   if(m.isPassableLanding(before,old,e.x,e.y)&&!m.isPassableLanding(after,map,e.x,e.y))report.standing.push({map:map.id,id:e.id,x:e.x,y:e.y});
   for(const p of e.pages){let x=e.x,y=e.y;for(const move of p.movement?.route?.moves??[]){if(move.kind!=='move')continue;const [dx,dy]=dirs[move.dir],nx=x+dx,ny=y+dy;
    if(m.canMove(before,old,x,y,nx,ny)&&!m.canMove(after,map,x,y,nx,ny))report.routes.push({map:map.id,id:e.id,from:[x,y],to:[nx,ny]});x=nx;y=ny;}}
  }
  const solid=map.events.filter(e=>e.pages.some(p=>p.priority==='same'&&p.graphic?.transparent!==true));
  for(const e of solid)for(const b of solid)if(e.id<b.id&&e.x===b.x&&e.y===b.y&&!old.events.some(o=>o.id===e.id&&o.x===b.x&&o.y===b.y&&old.events.some(k=>k.id===b.id&&k.x===b.x&&k.y===b.y)))report.overlaps.push({map:map.id,a:e.id,b:b.id,x:e.x,y:e.y});
 }
});
await fs.writeFile(join(preparedDir,'geometry-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
if(report.standing.length||report.routes.length||report.overlaps.length)process.exitCode=1;
