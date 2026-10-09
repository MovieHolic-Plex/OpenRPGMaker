import fs from 'node:fs';
import assert from 'node:assert/strict';
import {canMove} from '../../src/project/collision';
const out='output/evidence/emerald-wide-v2';
const p=JSON.parse(fs.readFileSync(`${out}/${process.argv.includes('--preview')?'preview':'reloaded'}-project.json`,'utf8'));
const id='map_field_emerald_basin_20260914';
function route(id:string,from:number[],to:number[]){const map=p.maps[id],queue=[from],seen=new Map<string,number[]|null>([[from.join(','),null]]);for(let i=0;i<queue.length&&!seen.has(to.join(','));i++){const a=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const b=[a[0]+dx,a[1]+dy];if(!seen.has(b.join(','))&&canMove(p,map,a[0],a[1],b[0],b[1])){seen.set(b.join(','),a);queue.push(b);}}}assert.ok(seen.has(to.join(',')));const path=[to];while(path.at(-1)!.join(',')!==from.join(','))path.push(seen.get(path.at(-1)!.join(','))!);path.reverse();return path.slice(1).map((b,i)=>({kind:'move',dir:b[0]>path[i][0]?'right':b[0]<path[i][0]?'left':b[1]>path[i][1]?'down':'up'}));}
p.startMapId=id;p.startPos={x:3,y:55};
fs.writeFileSync(`${out}/runtime-project.json`,JSON.stringify(p));
const targets=[['west-exit',0,55],['southwest-stair-foot',14,57],['southwest-stair-top',14,54],['west-bevel',2,38],['west-stair-foot',18,40],['west-stair-top',18,36],['west-lookout',13,33],['reference-bridge',17,16],['north-trail',36,23],['middle-bridge',30,29],['east-bridge',55,24],['east-stair-foot',73,29],['east-stair-top',73,25],['upper-stair-foot',70,23],['upper-stair-top',70,20],['upper-lookout',70,18],['east-exit',79,49],['forest-loop',74,56],['forest-south',70,58],['forest-return',60,53],['south-bridge',40,47],['south-exit',22,63]];
let from=[3,55];const walks=targets.map(([name,x,y])=>{const to=[Number(x),Number(y)],moves=route(id,from,to);const w={id:name,mapId:id,from,to,moves};from=to;return w;});
fs.writeFileSync(`${out}/walks.json`,JSON.stringify(walks));console.log(walks.map(w=>({id:w.id,steps:w.moves.length})));
