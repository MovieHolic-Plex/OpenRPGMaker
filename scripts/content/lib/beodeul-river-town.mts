import assert from 'node:assert/strict';
import type {Project,GameMap} from '../../../src/project/types.ts';
import {MAP_TOOLS} from '../../../src/editor/tools/mapTools.ts';
import {CONSTRUCTION_TOOLS_V3} from '../../../src/editor/tools/v3/constructionTools.ts';
import {installBeodeulArchitecture} from '../../../src/project/defaults/beodeulArchitecture.ts';
import {translateTiles} from '../../../src/project/objectStamp.ts';
import {layerTileAt,setLayerTileAt,compactMapLayers} from '../../../src/project/mapLayers.ts';
import {canMove,isPassable} from '../../../src/project/collision.ts';
import {dressBeodeulGround} from '../../../src/editor/tools/beodeulGroundTools.ts';
import {harmonizeBeodeulDaylight} from '../../../src/editor/tools/beodeulLightTools.ts';
import catalog from '../../../src/assets/beodeulGroundCatalog.json';

const buildings=[
 ['village-cream',2,4,'서쪽 주거'],['village-sage',12,4,'서쪽 주거'],['village-brick',2,15,'서쪽 주거'],['village-stone',12,16,'서쪽 주거'],
 ['village-ochre',1,28,'다리 골목'],['village-cream',9,28,'다리 골목'],['village-sage',2,35,'교회 골목'],
 ['village-sage',32,3,'북쪽 주거'],['village-brick',52,3,'북쪽 주거'],['village-cream',61,4,'북쪽 주거'],
 ['manor',32,13,'회관'],['village-stone',51,15,'동쪽 주거'],['village-ochre',57,15,'동쪽 주거'],['village-sage',65,15,'동쪽 주거'],
 ['village-stone',32,30,'우물 골목'],['cafe',39,31,'주막'],['village-brick',47,31,'우물 골목'],['village-ochre',65,29,'공방 골목'],['smithy_town',67,36,'공방'],
 ['village-stone',24,35,'물가 주거'],['village-cream',30,39,'물가 주거'],
 ['village-church',2,45,'교회'],['village-brick',20,54,'남쪽 주거'],['village-stone',29,54,'남쪽 주거'],
 ['village-sage',43,43,'동남 주거'],['village-stone',62,43,'동남 주거'],['village-cream',68,43,'동남 주거'],
 ['village-ochre',44,55,'동남 주거'],['village-cream',53,54,'동남 주거'],['village-brick',62,55,'동남 주거'],
 ['h101_2',9,5,'서쪽 주거'],['h101_2',17,15,'서쪽 주거'],['h117_1',42,3,'북쪽 주거'],
 ['h123_0',68,4,'북쪽 주거'],['h141_0',29,15,'회관 골목'],['h127_0',36,30,'우물 골목'],
 ['h123_0',62,28,'공방 골목'],['h101_2',40,42,'동남 주거'],['h141_0',50,56,'동남 주거'],
 ['h117_1',70,55,'동남 주거'],['h113_1',15,51,'교회 골목'],
] as const;

/** A authored reference settlement: native buildings, three bridge crossings and a street hierarchy. */
export function buildBeodeulRiverTown(p:Project,id='map_beodeul_river_town'){
 assert(!p.maps[id],'Create a new map; existing authored maps are protected.');installBeodeulArchitecture(p);
 const W=76,H=70,ts=p.tilesets.beodeul_city!;
 MAP_TOOLS.find(t=>t.name==='create_map')!.run(p,{id,name:'버들 물굽이 마을',width:W,height:H,tilesetId:ts.id,border:'none'});
 const m=p.maps[id]!,kits=new Map(ts.structureKits!.map(k=>[k.id,k]));m.lowerTiles=Array(W*H).fill(737);
 const source=p.tilesets.beodeul_ground!,translation=translateTiles(source,ts,catalog.recipes.flatMap(r=>r.rows.flat()));
 const recipes=new Map(catalog.recipes.map(r=>[r.id,r]));
 const index=(x:number,y:number)=>y*W+x,inside=(x:number,y:number)=>x>=0&&y>=0&&x<W&&y<H;
 const water=new Set<number>(),soil=new Set<number>(),stone=new Set<number>(),occupied=new Set<number>(),bridgeDeck=new Set<number>();
 const bridges=[{x:24,y:11},{x:25,y:24},{x:37,y:56}];
 const put=(s:Set<number>,x:number,y:number)=>{if(inside(x,y))s.add(index(x,y));};
 function line(s:Set<number>,points:number[][],width=1){for(let j=1;j<points.length;j++){
  const [ax,ay]=points[j-1]!,[bx,by]=points[j]!,n=Math.max(Math.abs(bx!-ax!),Math.abs(by!-ay!));let py=ay!;
  for(let t=0;t<=n;t++){const x=Math.round(ax!+(bx!-ax!)*t/(n||1)),y=Math.round(ay!+(by!-ay!)*t/(n||1));
   for(let dy=0;dy<width;dy++)for(let dx=0;dx<width;dx++){put(s,x+dx,y+dy);put(s,x+dx,py+dy);}py=y;}
 }}
 function oval(s:Set<number>,cx:number,cy:number,rx:number,ry:number){for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)put(s,x,y);}
 // Reserve the exact river before buildings; its native four-cell bridge spans are fixed.
 line(water,[[24,0],[24,17],[25,22],[25,28],[17,34],[14,40],[18,46],[34,46],[37,52],[37,H-1]],4);
 for(const b of bridges)for(let y=b.y+1;y<=b.y+2;y++)for(let x=b.x;x<b.x+4;x++)bridgeDeck.add(index(x,y));
 const placements:Array<{kit:string;x:number;y:number;kind:string}>=[];
 const fronts:Array<{kit:string;x:number;y:number;district:string}>=[];
 function stampKit(kitId:string,x:number,y:number,kind='prop',lower=false){const k=kits.get(kitId)!;assert(k,kitId);
  assert(x>=0&&y>=0&&x+k.width<=W&&y+k.height<=H,`Outside map: ${kitId}`);
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){const row=k.rows[dy]!;const u=row.upperTiles[dx]!;
   if(u>=0){assert(layerTileAt(m,3,index(x+dx,y+dy))<0,`Object overlap: ${kitId} ${x+dx},${y+dy}`);setLayerTileAt(m,3,index(x+dx,y+dy),u);}
   if(lower&&row.tiles[dx]!>=0)setLayerTileAt(m,1,index(x+dx,y+dy),row.tiles[dx]!);
  }placements.push({kit:kitId,x,y,kind});}
 for(const [short,x,y,district] of buildings){const kitId='bd-house-'+short,k=kits.get(kitId)!;assert(k,kitId);
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++){const i=index(x+dx,y+dy);assert(!water.has(i),`House in reserved river: ${kitId} ${x+dx},${y+dy}`);assert(!occupied.has(i),`House rectangles overlap: ${kitId}`);occupied.add(i);}
  stampKit(kitId,x,y,'building');const e=k.parts!.find(e=>e.kind==='entrance')!;assert(e,kitId);fronts.push({kit:kitId,x:x+e.dx,y:y+e.dy+e.h,district});
 }
 // Main Y junction, northern cross-street and a lower street loop: deliberately unequal street widths.
 line(stone,[[0,25],[29,25],[41,25],[52,29],[58,35],[58,48],[51,53],[43,57],[30,57],[16,60],[0,60]],2);
 line(stone,[[47,0],[47,23],[41,25]],3);line(stone,[[75,28],[58,28],[52,29]],2);
 line(soil,[[2,12],[47,12],[74,12],[74,25],[58,28]],2);
 line(soil,[[20,12],[20,24],[16,25]],2);line(soil,[[9,25],[0,35],[0,42],[1,59],[16,60]],2);
 line(soil,[[43,38],[61,38],[74,39]],2);line(soil,[[44,51],[75,51]],2);line(soil,[[44,64],[75,64]]);
 oval(stone,40,26,6.5,3.5);oval(stone,9,59,5,2);oval(soil,12,37,4,2);oval(soil,59,24,5,2);
 for(const s of [soil,stone])for(const i of [...s])if(occupied.has(i)||water.has(i)&&!bridgeDeck.has(i))s.delete(i);
 // Join each actual entrance to a street through free land, keeping all roof/body rectangles out of lanes.
 const street=new Set([...soil,...stone,...bridgeDeck]);
 // Buildings can cut a sketched diagonal street into separate pieces. Join the pieces
 // through free land before attaching entrances, so nearest-lane routing cannot hide a gap.
 const neighbours=(i:number)=>{const x=i%W,y=Math.floor(i/W);return [[x,y-1],[x+1,y],[x,y+1],[x-1,y]]
  .filter(([nx,ny])=>inside(nx!,ny!)).map(([nx,ny])=>index(nx!,ny!));};
 function connectedStreet(){const q=[index(42,25)],seen=new Set(q);for(let h=0;h<q.length;h++)for(const n of neighbours(q[h]!))
  if(street.has(n)&&!seen.has(n)){seen.add(n);q.push(n);}return seen;}
 for(;;){const connected=connectedStreet(),first=[...street].find(i=>!connected.has(i));if(first===undefined)break;
  const q=[first],seen=new Set(q),prev=new Map<number,number>();let goal=-1;
  for(let h=0;h<q.length;h++){const i=q[h]!;if(connected.has(i)){goal=i;break;}
   for(const n of neighbours(i))if(!seen.has(n)&&!occupied.has(n)&&(!water.has(n)||bridgeDeck.has(n))){seen.add(n);prev.set(n,i);q.push(n);}}
  assert(goal>=0,'A street island cannot connect to the main road');
  let i=goal;while(i!==first){if(!water.has(i)&&!stone.has(i))soil.add(i);street.add(i);i=prev.get(i)!;}
 }
 for(const f of fronts){const first=index(f.x,f.y),q=[first],prev=new Map<number,number>(),seen=new Set([first]);let goal=-1;
  for(let h=0;h<q.length;h++){const i=q[h]!;if(street.has(i)){goal=i;break;}const x=i%W,y=Math.floor(i/W);
   for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){const nx=x+dx!,ny=y+dy!,n=index(nx,ny);
    if(!inside(nx,ny)||seen.has(n)||occupied.has(n)&&n!==first||water.has(n)&&!bridgeDeck.has(n))continue;
    seen.add(n);prev.set(n,i);q.push(n);}}
  assert(goal>=0,`No private approach: ${f.kit}`);let i=goal;while(i!==first){soil.add(i);street.add(i);i=prev.get(i)!;}soil.add(first);street.add(first);
 }
 function paintGround(s:Set<number>,kind:'soil'|'stone'|'meadow'){for(const i of s){const x=i%W,y=Math.floor(i/W);let mask=0;
  for(const [dx,dy,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])if(s.has(index(x+dx!,y+dy!))&&inside(x+dx!,y+dy!))mask|=bit!;
  const r=recipes.get(`bdg-hamlet-${kind}-${mask}`)!;setLayerTileAt(m,1,i,translation.map.get(r.rows[0]![0]!)!);}}
 // Neighbouring homes share worn plots; their combined edge is irregular, not a pad per house.
 const yards=new Set<number>();
 for(const [short,x,y] of buildings){const k=kits.get('bd-house-'+short)!;
  oval(yards,x+k.width/2,y+k.height-.5,k.width*.85,2.8);}
 for(const i of yards)if(!water.has(i)&&!occupied.has(i)&&!stone.has(i))soil.add(i);
 for(const i of stone)soil.delete(i);paintGround(soil,'soil');paintGround(stone,'stone');
 // Water uses the actual named animated autotile and is painted after roads to avoid gap healing on banks.
 const fill=CONSTRUCTION_TOOLS_V3.find(t=>t.name==='fill_region')!;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(water.has(index(x,y))){const start=x;while(x+1<W&&water.has(index(x+1,y)))x++;
  fill.run(p,{mapId:id,rect:{x:start,y,w:x-start+1,h:1},material:'버들항 강·운하 물',clearUpper:false});}
 for(const b of bridges)stampKit('bd-bridge-arch',b.x,b.y,'bridge',true);
 function stampRecipe(recipe:string,x:number,y:number){const r=recipes.get(recipe)!;assert(r,recipe);
  for(let dy=0;dy<r.height;dy++)for(let dx=0;dx<r.width;dx++){const n=r.rows[dy]![dx]!;if(n>=0)setLayerTileAt(m,r.layer as 1|2|3|4,index(x+dx,y+dy),translation.map.get(n)!);}
  placements.push({kit:recipe,x,y,kind:r.layer===3?'grove':'ground'});}

 // Purposeful small courts and props; the main plaza remains a passage, not a giant vacant rectangle.
 for(const [kit,x,y] of [['bd-prop-well_roofed',39,26],['bd-prop-bench_wood',43,27],['bd-prop-flower_cart',36,27],
  ['bd-prop-laundry_rack',16,19],['bd-out-woodpile',64,37],['bd-prop-bread_rack',45,35],['bd-prop-table_mugs',40,38],
  ['bd-prop-flowerbox_long',11,59],['bd-prop-bench_wood',13,58],['bd-prop-goods_pile',70,40],['bd-prop-laundry_rack',58,61],
  ['bd-prop-flowerbox_long',51,24],['bd-prop-bench_wood',56,24]] as const){const k=kits.get(kit)!;
   if(x+k.width<=W&&y+k.height<=H&&k.rows.every((row,dy)=>row.upperTiles.every((n,dx)=>n<0||layerTileAt(m,3,index(x+dx,y+dy))<0&&!water.has(index(x+dx,y+dy))&&!fronts.some(f=>Math.abs(f.x-x-dx)+Math.abs(f.y-y-dy)<=1))))stampKit(kit,x,y);}
 for(const [j,[x,y]] of [[0,0],[8,0],[30,0],[50,0],[68,0],[0,65],[8,65],[16,64],[24,65],[42,65],[50,65],[58,65],[67,65],
  [67,52],[17,46],[50,40],[20,50],[47,39],[16,4],[15,38],[28,4],[4,23],[54,15],[2,61],[23,49],[57,52]].entries()){
  const r=recipes.get(`bdg-woodland-${j%2?'north-open':'north'}`)!;
  if(x!<0||y!<0||x!+r.width>W||y!+r.height>H||!r.rows.every((row,dy)=>row.every((n,dx)=>n<0||!water.has(index(x!+dx,y!+dy))&&!street.has(index(x!+dx,y!+dy))&&layerTileAt(m,3,index(x!+dx,y!+dy))<0)))continue;
  stampRecipe(r.id+'-shadow',x!,y!);stampRecipe(r.id,x!,y!);for(let dy=0;dy<r.height;dy++)for(let dx=0;dx<r.width;dx++)occupied.add(index(x!+dx,y!+dy));
  const fringe=recipes.get(`bdg-woodland-fringe-${j%2}`)!;if(x!+fringe.width<W&&y!+3+fringe.height<H)stampRecipe(fringe.id,x!+1,y!+3);
 }
 // Full native trunks fill narrower forest-edge gaps, with varying setbacks.
 for(const [x,y] of [...Array.from({length:25},(_,j)=>[j*3,j%4===0?1:0]),
  [72,7],[72,32],[73,50],[0,7],[0,16],[0,43],[0,53],[21,4],[29,8],[54,40],[59,42],[16,40],[27,31],[21,49],[33,60],[64,52],[55,15]]){
  const k=kits.get('bd-tree-1a786c')!;if(x!<0||y!<0||x!+k.width>W||y!+k.height>H)continue;
  if(k.rows.every((row,dy)=>row.upperTiles.every((n,dx)=>n<0||!water.has(index(x!+dx,y!+dy))&&!street.has(index(x!+dx,y!+dy))&&layerTileAt(m,3,index(x!+dx,y!+dy))<0)))stampKit(k.id,x!,y!,'tree');
 }
 // Shade/foundations are shared recipes; visible grass decoration occurs in small groups near actual edges.
 const support=dressBeodeulGround(p,id,'natural',1004);const light=harmonizeBeodeulDaylight(p,id,{roads:false,meadow:false});
 // Other native silhouettes reuse the same short ground-shadow caps, keeping the light direction shared.
 for(const [short,x,y] of buildings){if(short.startsWith('village-'))continue;const k=kits.get('bd-house-'+short)!;
  const shape=k.width>9?'church':k.width>5?'ochre':'stone',r=recipes.get(`bdg-light-house-${shape}`)!;
  
  for(let dy=0;dy<r.height;dy++){for(let dx=0;dx<=k.width;dx++){
   const sx=dx===k.width?r.width-1:Math.min(r.width-2,Math.floor(dx*(r.width-1)/k.width));const n=r.rows[dy]![sx]!,tx=x+dx,ty=y+k.height-1+dy,i=index(tx,ty);
   if(n>=0&&inside(tx,ty)&&!water.has(i)&&layerTileAt(m,2,i)<0)setLayerTileAt(m,2,i,translation.map.get(n)!);
  }}
  placements.push({kit:r.id,x,y:y+k.height-1,kind:'native-building-shadow'});
 }
 for(const i of water)for(const l of [2,4] as const)setLayerTileAt(m,l,i,-1);
 compactMapLayers(m);
 const start={x:42,y:25};assert(isPassable(p,m,start.x,start.y));
 // Use exact canMove landings, not adjacency, for every entrance and both bridge banks.
 const q=[start],seen=new Set([`${start.x},${start.y}`]);
 for(let h=0;h<q.length;h++){const a=q[h]!;for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){const b={x:a.x+dx!,y:a.y+dy!},k=`${b.x},${b.y}`;
  if(!seen.has(k)&&canMove(p,m,a.x,a.y,b.x,b.y)){seen.add(k);q.push(b);}}}
 for(const f of fronts)assert(seen.has(`${f.x},${f.y}`),`Unreachable entrance: ${f.kit} ${f.x},${f.y}`);
 for(const b of bridges)for(const x of [b.x-1,b.x+4])assert(seen.has(`${x},${b.y+1}`),'Bridge bank disconnected');
 return{mapId:id,width:W,height:H,start,fronts,bridges,placements,waterCells:[...water],soilCells:[...soil],stoneCells:[...stone],support:support.data,lighting:light.data,allDoorsAndBridgeBanksReachable:true};
}
