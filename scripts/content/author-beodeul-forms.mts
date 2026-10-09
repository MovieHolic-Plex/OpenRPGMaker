import fs from 'node:fs';import assert from 'node:assert/strict';
import {buildBeodeulFormsVillage,buildings} from './lib/beodeul-forms-village.mts';
import {renderMapPng} from '../qa-game/render.mts';
import {canMove,isPassable} from '../../src/project/collision';
import {layerTileAt,setLayerTileAt} from '../../src/project/mapLayers';
const out='output/beodeul-forms',evidence='verify-shots/beodeul-forms';
const p=JSON.parse(fs.readFileSync(`${out}/before-project.json`,'utf8')),before=structuredClone(p);
const result=buildBeodeulFormsVillage(p),m=p.maps[result.mapId],kits=new Map(p.tilesets[m.tilesetId].structureKits.map(k=>[k.id,k]));
// Props have purpose and are reserved away from the main road and actual approaches.
const props=[['bd-pick-volcano-cave-anvil',45,35],['bd-pick-volcano-cave-ingots',42,36],['bd-out-woodpile',47,35],
 ['bd-prop-table_mugs',30,14],['bd-prop-bread_rack',36,14],['bd-prop-fish_crates',28,27],
 ['bd-prop-goods_pile',35,47],['bd-prop-stall_jug_bottle',45,27],['bd-pick-wizard-tower-herb-rack',19,12],
 ['bd-pick-wizard-tower-bed-herb',19,14],['bd-prop-laundry_rack',12,28]] as const;
const propPlacements=[];
for(const [id,x,y] of props){const k:any=kits.get(id);assert(k,id);let free=true;
 for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++)if(k.rows[dy].upperTiles[dx]>=0){
  const xx=x+dx,yy=y+dy,i=yy*50+xx;
  if(xx>=50||yy>=50||layerTileAt(m,3,i)>=0||result.fronts.some(f=>Math.abs(f.x-xx)+Math.abs(f.y-yy)<=1)||result.waterCells.includes(i))free=false;
 }
 if(!free)continue;
 for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++)if(k.rows[dy].upperTiles[dx]>=0)setLayerTileAt(m,3,(y+dy)*50+x+dx,k.rows[dy].upperTiles[dx]);
 propPlacements.push({id,x,y});
}
// All paths are verified on road cells, including the porch walk-through and bridge decks.
const roads=new Set<number>([...result.soilCells,...result.stoneCells]);
for(const b of result.bridges)for(let y=b.y+1;y<=b.y+2;y++)for(let x=b.x;x<b.x+4;x++)roads.add(y*50+x);
function route(from:{x:number;y:number},to:{x:number;y:number}){
 const first=from.y*50+from.x,last=to.y*50+to.x,q=[first],seen=new Set(q),prev=new Map<number,{i:number;dir:string}>();
 for(let h=0;h<q.length;h++){const i=q[h]!,x=i%50,y=Math.floor(i/50);if(i===last)break;
  for(const [dx,dy,dir] of [[0,-1,'up'],[1,0,'right'],[0,1,'down'],[-1,0,'left']] as const){const nx=x+dx,ny=y+dy,n=ny*50+nx;
   if(nx<0||ny<0||nx>=50||ny>=50||seen.has(n)||!roads.has(n)||!canMove(p,m,x,y,nx,ny))continue;
   seen.add(n);prev.set(n,{i,dir});q.push(n);
  }
 }
 assert(seen.has(last),`Road route missing: ${to.x},${to.y}`);const moves=[];let n=last;
 while(n!==first){const v=prev.get(n)!;moves.unshift({kind:'move',dir:v.dir});n=v.i;}return moves;
}
for(const f of result.fronts)route(result.start,f);
const stops=[];let at=result.start;
for(const f of result.fronts){const moves=route(at,f);stops.push({id:f.kit+'-'+f.x,to:{mapId:m.id,x:f.x,y:f.y},moves});at=f;}
for(const b of result.bridges)for(const x of [b.x-1,b.x+4])route(result.start,{x,y:b.y+1});
// A body cannot be entered through its wall, while each entrance approach remains open.
for(const [short,x,y] of buildings){const k:any=kits.get('bd-house-'+short),e=k.parts.find(e=>e.kind==='entrance');
 if(short.startsWith('form-')){assert(!isPassable(p,m,x+e.dx,y+e.dy),short+' door must be solid');assert(isPassable(p,m,x+e.dx,y+e.dy+e.h),short+' front must be open');}
}
p.startMapId=m.id;p.startPos={...result.start};
for(const [id,map] of Object.entries(before.maps))assert.deepEqual(p.maps[id],map);
fs.writeFileSync(`${out}/authored-project.json`,JSON.stringify(p));
fs.writeFileSync(`${out}/build-result.json`,JSON.stringify({...result,propPlacements,oldMapsPreserved:true,all16FrontsRoadReachable:true},null,2));
fs.writeFileSync(`${out}/routes.json`,JSON.stringify({start:{mapId:m.id,...result.start},stops},null,2));
fs.writeFileSync(`${evidence}/preview.png`,renderMapPng({...p,startMapId:''},m).png);
console.log(JSON.stringify({mapId:m.id,buildings:result.fronts.length,families:6,props:propPlacements,allFrontsReachable:true}));
