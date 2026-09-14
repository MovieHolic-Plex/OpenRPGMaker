import fs from 'node:fs';
import assert from 'node:assert/strict';
import { canMove } from '../../src/project/collision';
const out='output/evidence/emerald-fields';
const p=JSON.parse(fs.readFileSync(`${out}/reloaded-project.json`,'utf8'));
const ids=['map_field_twinfalls_20260913','map_field_fernwood_20260913','map_field_riverbend_20260913'];
function route(id:string,from:number[],to:number[]){const map=p.maps[id],queue=[from],seen=new Map<string,number[]|null>([[from.join(','),null]]);for(let i=0;i<queue.length&&!seen.has(to.join(','));i++){const a=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const b=[a[0]+dx,a[1]+dy];if(!seen.has(b.join(','))&&canMove(p,map,a[0],a[1],b[0],b[1])){seen.set(b.join(','),a);queue.push(b);}}}assert.ok(seen.has(to.join(',')));const path=[to];while(path.at(-1)!.join(',')!==from.join(','))path.push(seen.get(path.at(-1)!.join(','))!);path.reverse();return path.slice(1).map((b,i)=>({kind:'move',dir:b[0]>path[i][0]?'right':b[0]<path[i][0]?'left':b[1]>path[i][1]?'down':'up'}));}
p.startMapId=ids[1];p.startPos={x:2,y:27};
// QA entry only; all map/event/tileset bytes remain the canonical saved readback.
fs.writeFileSync(`${out}/runtime-project.json`,JSON.stringify(p));
const faithful=p.maps[ids[0]].width===25;
const walks=[{id:'forest-to-falls',mapId:ids[1],from:[2,27],to:[42,27],destination:ids[0],arrival:faithful?[2,18]:[2,27]}, {id:'falls-to-ruins',mapId:ids[0],from:faithful?[2,18]:[2,27],to:faithful?[23,15]:[42,27],destination:ids[2],arrival:[2,27]}].map(w=>({...w,moves:route(w.mapId,w.from,w.to)}));
fs.writeFileSync(`${out}/walks.json`,JSON.stringify(walks,null,2));
if(faithful)fs.writeFileSync(`${out}/return-walk.json`,JSON.stringify({mapId:ids[0],from:[23,15],to:[1,18],moves:route(ids[0],[23,15],[1,18]),destination:ids[1],arrival:[41,27]},null,2));
console.log(walks.map(w=>({id:w.id,steps:w.moves.length})));
