import assert from 'node:assert/strict';
import type {Project} from '../../../src/project/types';
import {layerTileAt,setLayerTileAt,compactMapLayers} from '../../../src/project/mapLayers';
import {canMove} from '../../../src/project/collision';
import {ensureBeodeulFacilityKits} from '../../../src/project/defaults/beodeulFacilities';

export function dressBeodeulVillageFacilities(p:Project,mapId='map_beodeul_village50'){
 const m=p.maps[mapId]!,ts=p.tilesets[m.tilesetId]!;assert(m.width===50&&m.height===50);
 ensureBeodeulFacilityKits(ts);const kits=new Map(ts.structureKits!.map(k=>[k.id,k]));
 const old=structuredClone(m),placements:{kit:string;x:number;y:number;role:string}[]=[];
 function stamp(id:string,x:number,y:number,role:string,lower=false){
  const k=kits.get(id)!;assert(k,id);assert(x>=0&&y>=0&&x+k.width<=50&&y+k.height<=50);
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){
   const n=k.rows[dy]!.upperTiles[dx]!;if(n>=0){assert(layerTileAt(m,3,(y+dy)*50+x+dx)<0,`Overlap ${id} at ${x+dx},${y+dy}`);setLayerTileAt(m,3,(y+dy)*50+x+dx,n);}
   const g=k.rows[dy]!.tiles[dx]!;if(lower&&g>=0)setLayerTileAt(m,1,(y+dy)*50+x+dx,g);
  }placements.push({kit:id,x,y,role});
 }
 // Preserve all five existing building bodies. Only their workspaces gain new objects.
 const roles=[
  {id:'apothecary',label:'약초사 집',body:'bd-house-village-cream',x:3,y:6},
  {id:'inventor',label:'발명가 집',body:'bd-house-village-stone',x:42,y:7},
  {id:'tavern',label:'강바람 술집',body:'bd-house-cafe',x:28,y:20},
  {id:'warehouse',label:'항구 창고',body:'bd-house-village-sage',x:14,y:30},
  {id:'ferry-office',label:'나루터 사무소',body:'bd-house-village-sage',x:28,y:39},
 ];
 stamp('bd-pick-wizard-tower-herb-rack',2,10,'apothecary');
 stamp('bd-pick-wizard-tower-bed-herb',7,13,'apothecary');
 stamp('bd-pick-wizard-tower-bed-herb',9,13,'apothecary');
 stamp('bd-pick-wizard-tower-armillary',42,14,'inventor');
 stamp('bd-pick-wizard-tower-orrery',46,15,'inventor');
 stamp('bd-prop-stall_jug_bottle',35,25,'tavern');
 stamp('bd-prop-sandwich_board',28,26,'tavern');
 stamp('bd-prop-goods_pile',14,27,'warehouse');
 stamp('bd-prop-fish_crates',15,29,'warehouse');
 stamp('bd-pick-swamp-stilt-ground-deck',25,46,'ferry-office',true);
 stamp('bd-prop-mooring_bollard',25,46,'ferry-office');
 stamp('bd-pick-swamp-stilt-rowboat',23,48,'ferry-office');
 stamp('bd-prop-sandwich_board',30,48,'ferry-office');
 stamp('bd-pick-volcano-cave-anvil',42,36,'smithy');
 stamp('bd-pick-volcano-cave-ingots',46,38,'smithy');
 compactMapLayers(m);
 // Existing building/tree/prop pixels, all overlays/shadows and events are untouched.
 for(let i=0;i<2500;i++)if(layerTileAt(old,3,i)>=0)assert.equal(layerTileAt(m,3,i),layerTileAt(old,3,i));
 for(const l of [2,4] as const)for(let i=0;i<2500;i++)assert.equal(layerTileAt(m,l,i),layerTileAt(old,l,i));
 assert.deepEqual(m.events,old.events);
 for(let i=0;i<2500;i++)if(layerTileAt(m,1,i)!==layerTileAt(old,1,i))assert(i%50>=25&&i%50<=27&&Math.floor(i/50)>=46&&Math.floor(i/50)<=48);
 assert(canMove(p,m,28,47,27,47),'The dock must connect to land');
 assert(canMove(p,m,27,47,26,47));
 const fronts=roles.map(role=>{const k=kits.get(role.body)!,e=k.parts!.find(a=>a.kind==='entrance')!;return{...role,front:{x:role.x+e.dx,y:role.y+e.dy+e.h}};});
 return{mapId,roles:fronts,placements,dock:{x:26,y:47},buildingsTreesShadowsAndEventsPreserved:true};
}
