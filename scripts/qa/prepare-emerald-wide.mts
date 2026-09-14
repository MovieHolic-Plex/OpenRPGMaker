import fs from 'node:fs';
import assert from 'node:assert/strict';
import {canMove} from '../../src/project/collision';
const out='output/evidence/emerald-wide';
const p=JSON.parse(fs.readFileSync(`${out}/reloaded-project.json`,'utf8'));
const id='map_field_emerald_basin_20260914';
function route(id:string,from:number[],to:number[]){const map=p.maps[id],queue=[from],seen=new Map<string,number[]|null>([[from.join(','),null]]);for(let i=0;i<queue.length&&!seen.has(to.join(','));i++){const a=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const b=[a[0]+dx,a[1]+dy];if(!seen.has(b.join(','))&&canMove(p,map,a[0],a[1],b[0],b[1])){seen.set(b.join(','),a);queue.push(b);}}}assert.ok(seen.has(to.join(',')));const path=[to];while(path.at(-1)!.join(',')!==from.join(','))path.push(seen.get(path.at(-1)!.join(','))!);path.reverse();return path.slice(1).map((b,i)=>({kind:'move',dir:b[0]>path[i][0]?'right':b[0]<path[i][0]?'left':b[1]>path[i][1]?'down':'up'}));}
p.startMapId=id;p.startPos={x:3,y:55};
fs.writeFileSync(`${out}/runtime-project.json`,JSON.stringify(p));
const targets=[['old-stones',21,45],['stairs-foot',8,21],['highland-lookout',16,3],['stairs-return',8,21],['west-bridge',26,27],['north-lakeshore',41,24],['east-bridge',60,29],['east-woods',72,36],['south-bridge',46,51],['return-entry',3,55]];
let from=[3,55];const walks=targets.map(([name,x,y])=>{const to=[Number(x),Number(y)],moves=route(id,from,to);const w={id:name,mapId:id,from,to,moves};from=to;return w;});
fs.writeFileSync(`${out}/walks.json`,JSON.stringify(walks));console.log(walks.map(w=>({id:w.id,steps:w.moves.length})));
