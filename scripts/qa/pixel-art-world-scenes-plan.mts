// Build transfer observations from the actual assistant output.
import fs from 'node:fs';import {isPassableLanding,canMove} from '../../src/project/collision.ts';
const [input,out]=process.argv.slice(2);if(!input||!out)throw Error('Usage: <AI result-project.json> <transfer-plan.json>');
const p=JSON.parse(fs.readFileSync(input,'utf8')),links=[];
for(const m of Object.values(p.maps)as any[])for(const e of m.events){
 const pg=e.pages?.[0]??e,t=pg.commands.find(c=>c.kind==='transfer');if(!t)continue;
 const candidates=[[0,1,'up'],[0,-1,'down'],[1,0,'left'],[-1,0,'right']];
 const found=candidates.find(([dx,dy])=>isPassableLanding(p,m,e.x+dx,e.y+dy)&&(pg.trigger.kind==='action'||canMove(p,m,e.x+dx,e.y+dy,e.x,e.y)));
 if(!found)throw Error('No approach '+e.id);
 links.push({from:m.id,event:e.id,at:{x:e.x,y:e.y},approach:{x:e.x+found[0],y:e.y+found[1]},facing:found[2],trigger:pg.trigger.kind,to:t.mapId,spawn:{x:t.x,y:t.y}});
}
fs.writeFileSync(out,JSON.stringify(links));console.log({links:links.length});
