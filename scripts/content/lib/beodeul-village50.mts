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
import warmCatalog from '../../../src/assets/beodeulWarmTreesCatalog.json';
import {createBeodeulWarmTreesTileset} from '../../../src/project/defaults/beodeulWarmTrees.ts';

const buildings=[
 ['village-cream',3,6,'서쪽 주거'],['village-ochre',13,6,'서쪽 주거'],['h141_0',19,6,'서쪽 주거'],
 ['village-brick',2,18,'서쪽 주거'],['village-stone',12,20,'서쪽 주거'],['village-ochre',17,20,'서쪽 주거'],
 ['village-church',2,31,'교회 골목'],['village-sage',14,30,'교회 골목'],['village-cream',15,41,'교회 골목'],
 ['manor',27,5,'회관'],['village-stone',42,7,'북쪽 주거'],
 ['cafe',28,20,'장터'],['village-brick',39,19,'장터'],
 ['village-ochre',28,29,'공방 골목'],['village-stone',36,30,'공방 골목'],['smithy_town',42,30,'공방'],
 ['village-sage',28,39,'남쪽 주거'],['village-cream',39,40,'남쪽 주거'],
] as const;

/** Preserve the town's objects while joining the lower paved road through its actual free lane. */
export function repairBeodeulVillage50Roads(p:Project,mapId:string,plan:{soilCells:number[];stoneCells:number[];bridges:{x:number;y:number}[]}){
 const m=p.maps[mapId]!;assert(m.width===50&&m.height===50);
 const soil=new Set(plan.soilCells),stone=new Set(plan.stoneCells),deck=new Set<number>();
 for(const b of plan.bridges)for(let y=b.y+1;y<=b.y+2;y++)for(let x=b.x;x<b.x+4;x++)deck.add(y*50+x);
 const roads=new Set([...soil,...stone,...deck]);
 const occupied=new Set<number>(),kits=new Map(p.tilesets[m.tilesetId]!.structureKits!.map(k=>[k.id,k]));
 for(const [short,x,y] of buildings){const k=kits.get('bd-house-'+short)!;
  for(let dy=0;dy<k.height;dy++)for(let dx=0;dx<k.width;dx++)occupied.add((y+dy)*50+x+dx);
 }
 const from=44*50+9,to=37*50+22,q=[from],seen=new Set(q),prev=new Map<number,number>();
 for(let h=0;h<q.length;h++){
  const i=q[h]!;if(i===to)break;
  const x=i%50,y=Math.floor(i/50);
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const nx=x+dx!,ny=y+dy!,n=ny*50+nx;
   if(nx<0||nx>=50||ny<37||ny>=50||seen.has(n)||occupied.has(n)||!canMove(p,m,x,y,nx,ny))continue;
   seen.add(n);prev.set(n,i);q.push(n);
  }
 }
 assert(seen.has(to),'The church-to-bridge paved lane must fit the existing buildings.');
 const promoted:number[]=[];
 for(let i=to;;i=prev.get(i)!){
  if(!stone.has(i)&&!deck.has(i)){soil.delete(i);stone.add(i);roads.add(i);promoted.push(i);}
  if(i===from)break;
 }
 // A material change is still a road junction: only the outer edge meets grass.
 const source=p.tilesets.beodeul_ground!,target=p.tilesets[m.tilesetId]!;
 const translated=translateTiles(source,target,catalog.recipes.filter(r=>/^bdg-hamlet-(soil|stone)-\d+$/.test(r.id)).flatMap(r=>r.rows.flat()));
 const recipes=new Map(catalog.recipes.map(r=>[r.id,r]));
 let changed=0;
 for(const [cells,kind] of [[soil,'soil'],[stone,'stone']] as const)for(const i of cells){
  if(deck.has(i))continue;
  const x=i%50,y=Math.floor(i/50);let mask=0;
  for(const [dx,dy,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]]){
   const nx=x+dx!,ny=y+dy!;if(nx>=0&&nx<50&&ny>=0&&ny<50&&roads.has(ny*50+nx))mask|=bit!;
  }
  const recipe=recipes.get(`bdg-hamlet-${kind}-${mask}`)!,n=translated.map.get(recipe.rows[0]![0]!)!;
  if(layerTileAt(m,1,i)!==n){setLayerTileAt(m,1,i,n);changed++;}
 }
 const paved=new Set([...stone,...deck]),pavedQ=[from],pavedSeen=new Set(pavedQ);
 for(let h=0;h<pavedQ.length;h++){
  const i=pavedQ[h]!,x=i%50,y=Math.floor(i/50);
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const nx=x+dx!,ny=y+dy!,n=ny*50+nx;
   if(nx<0||nx>=50||ny<37||ny>=50||pavedSeen.has(n)||!paved.has(n)||!canMove(p,m,x,y,nx,ny))continue;
   pavedSeen.add(n);pavedQ.push(n);
  }
 }
 assert(pavedSeen.has(to),'The lower road must connect using paved tiles, without a dirt detour.');
 return{soilCells:[...soil],stoneCells:[...stone],roadRepair:{changed,promoted:promoted.map(i=>({x:i%50,y:Math.floor(i/50)})),churchToSouthBridgePaved:true,mixedRoadEdgesJoined:true}};
}

/** A authored reference settlement: native buildings, two bridge crossings and a street hierarchy. */
export function buildBeodeulVillage50(p:Project,id='map_beodeul_village50'){
 assert(!p.maps[id],'Create a new map; existing authored maps are protected.');installBeodeulArchitecture(p);
 const W=50,H=50,ts=p.tilesets.beodeul_city!;
 MAP_TOOLS.find(t=>t.name==='create_map')!.run(p,{id,name:'버들 황록 마을 · 50×50',width:W,height:H,tilesetId:ts.id,border:'none'});
 const m=p.maps[id]!,kits=new Map(ts.structureKits!.map(k=>[k.id,k]));m.lowerTiles=Array(W*H).fill(737);
 const source=p.tilesets.beodeul_ground!,translation=translateTiles(source,ts,catalog.recipes.flatMap(r=>r.rows.flat()));
 const recipes=new Map(catalog.recipes.map(r=>[r.id,r]));
 const index=(x:number,y:number)=>y*W+x,inside=(x:number,y:number)=>x>=0&&y>=0&&x<W&&y<H;
 const water=new Set<number>(),soil=new Set<number>(),stone=new Set<number>(),occupied=new Set<number>(),bridgeDeck=new Set<number>();
 const bridges=[{x:23,y:15},{x:23,y:36}];
 const put=(s:Set<number>,x:number,y:number)=>{if(inside(x,y))s.add(index(x,y));};
 function line(s:Set<number>,points:number[][],width=1){for(let j=1;j<points.length;j++){
  const [ax,ay]=points[j-1]!,[bx,by]=points[j]!,n=Math.max(Math.abs(bx!-ax!),Math.abs(by!-ay!));let py=ay!;
  for(let t=0;t<=n;t++){const x=Math.round(ax!+(bx!-ax!)*t/(n||1)),y=Math.round(ay!+(by!-ay!)*t/(n||1));
   for(let dy=0;dy<width;dy++)for(let dx=0;dx<width;dx++){put(s,x+dx,y+dy);put(s,x+dx,py+dy);}py=y;}
 }}
 function oval(s:Set<number>,cx:number,cy:number,rx:number,ry:number){for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)put(s,x,y);}
 // Reserve the exact river before buildings; its native four-cell bridge spans are fixed.
 line(water,[[23,0],[23,H-1]],4);
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
 // Two connected crossings, small shared courts and unequal lanes.
 line(stone,[[0,16],[32,16],[38,18],[49,18]],2);line(stone,[[40,0],[40,18]],2);
 line(stone,[[0,44],[12,44],[22,38],[23,37],[49,37]],2);
 line(soil,[[0,13],[22,13]],2);line(soil,[[0,27],[22,27]],2);
 line(soil,[[0,16],[0,44],[22,44]],2);line(soil,[[22,16],[22,49]]);
 line(soil,[[34,16],[34,37],[36,47],[49,47]],2);
 line(soil,[[27,28],[49,28]],2);line(soil,[[48,16],[48,49]],2);
 oval(stone,32,17,5,2.5);oval(soil,34,26,5,2);oval(soil,9,44,6,2);
 for(const s of [soil,stone])for(const i of [...s])if(occupied.has(i)||water.has(i)&&!bridgeDeck.has(i))s.delete(i);
 // Join each actual entrance to a street through free land, keeping all roof/body rectangles out of lanes.
 const street=new Set([...soil,...stone,...bridgeDeck]);
 // Buildings can cut a sketched diagonal street into separate pieces. Join the pieces
 // through free land before attaching entrances, so nearest-lane routing cannot hide a gap.
 const neighbours=(i:number)=>{const x=i%W,y=Math.floor(i/W);return [[x,y-1],[x+1,y],[x,y+1],[x-1,y]]
  .filter(([nx,ny])=>inside(nx!,ny!)).map(([nx,ny])=>index(nx!,ny!));};
 function connectedStreet(){const q=[index(32,16)],seen=new Set(q);for(let h=0;h<q.length;h++)for(const n of neighbours(q[h]!))
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

 // Props belong to actual shared courts or their nearby shop fronts.
 for(const [kit,x,y] of [['bd-prop-well_roofed',31,17],['bd-prop-bench_wood',35,18],['bd-prop-flower_cart',29,17],
  ['bd-prop-laundry_rack',10,23],['bd-out-woodpile',46,35],['bd-prop-bread_rack',29,26],['bd-prop-table_mugs',32,26],
  ['bd-prop-flowerbox_long',6,44],['bd-prop-bench_wood',11,44],['bd-prop-goods_pile',44,36]] as const){const k=kits.get(kit)!;
  if(x+k.width<=W&&y+k.height<=H&&k.rows.every((row,dy)=>row.upperTiles.every((n,dx)=>n<0||layerTileAt(m,3,index(x+dx,y+dy))<0&&!water.has(index(x+dx,y+dy))&&!fronts.some(f=>Math.abs(f.x-x-dx)+Math.abs(f.y-y-dy)<=1))))stampKit(kit,x,y);
 }
 const warm=p.tilesets.beodeul_warm_trees??=createBeodeulWarmTreesTileset();
 const warmTranslation=translateTiles(warm,ts,warmCatalog.recipes.flatMap(r=>r.rows.flat()));
 const warmRecipes=new Map(warmCatalog.recipes.map(r=>[r.id,r]));
 function stampWarm(key:string,x:number,y:number){
  const r=warmRecipes.get(key)!;assert(r,key);
  for(let dy=0;dy<r.height;dy++)for(let dx=0;dx<r.width;dx++){const n=r.rows[dy]![dx]!;
   if(n>=0)setLayerTileAt(m,r.layer as 2|3,index(x+dx,y+dy),warmTranslation.map.get(n)!);
  }placements.push({kit:key,x,y,kind:r.layer===3?'warm-tree':'tree-shadow'});
 }
 const trees:[string,number,number][]=[
  ['grove-north',1,0],['grove-north-open',11,0],['grove-north',27,0],['grove-north-open',41,0],
  ['grove-north',1,45],['grove-north-open',40,45],
  ['grove-north-open',1,12],['grove-north',1,26],
  ['tree-1a786c',0,7],['tree-03a8f7',0,12],['tree-3e8732',9,6],['tree-1a786c',9,19],
  ['tree-1a786c',0,25],['tree-03a8f7',18,26],['tree-1a786c',19,34],
  ['tree-1a786c',46,6],['tree-3e8732',46,10],['tree-1a786c',46,20],
  ['tree-1a786c',34,23],['tree-03a8f7',35,34],['tree-3e8732',36,40],['tree-1a786c',27,45],
  ['tree-03a8f7',9,16],['tree-1a786c',9,26],['tree-1a786c',35,18],['tree-03a8f7',35,23],['tree-3e8732',10,45],
 ];
 for(const [key,x,y] of trees){const r=warmRecipes.get('bdw-'+key)!;
  if(x+r.width>W||y+r.height>H)continue;
  if(!r.rows.every((row,dy)=>row.every((n,dx)=>n<0||!water.has(index(x+dx,y+dy))&&layerTileAt(m,3,index(x+dx,y+dy))<0)))continue;
  if(r.blockingCells.some(([dx,dy])=>street.has(index(x+dx!,y+dy!))||fronts.some(f=>Math.abs(f.x-x-dx!)+Math.abs(f.y-y-dy!)<=1)))continue;
  stampWarm(r.id+'-shadow',x,y);stampWarm(r.id,x,y);
 }
 // Shade/foundations are shared recipes; visible grass decoration occurs in small groups near actual edges.
 const support=dressBeodeulGround(p,id,'natural',1004);const light=harmonizeBeodeulDaylight(p,id,{roads:false,meadow:true});
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
 const roadFix=repairBeodeulVillage50Roads(p,id,{soilCells:[...soil],stoneCells:[...stone],bridges});
 const start={x:32,y:16};assert(isPassable(p,m,start.x,start.y));
 // Use exact canMove landings, not adjacency, for every entrance and both bridge banks.
 const q=[start],seen=new Set([`${start.x},${start.y}`]);
 for(let h=0;h<q.length;h++){const a=q[h]!;for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){const b={x:a.x+dx!,y:a.y+dy!},k=`${b.x},${b.y}`;
  if(!seen.has(k)&&canMove(p,m,a.x,a.y,b.x,b.y)){seen.add(k);q.push(b);}}}
 for(const f of fronts)assert(seen.has(`${f.x},${f.y}`),`Unreachable entrance: ${f.kit} ${f.x},${f.y}`);
 for(const b of bridges)for(const x of [b.x-1,b.x+4])assert(seen.has(`${x},${b.y+1}`),'Bridge bank disconnected');
 return{mapId:id,width:W,height:H,start,fronts,bridges,placements,waterCells:[...water],...roadFix,support:support.data,lighting:light.data,allDoorsAndBridgeBanksReachable:true};
}
