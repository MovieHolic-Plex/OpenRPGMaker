// 50x50 authored source-coordinate blueprint. Contains no source pixels.
import {readFile,writeFile} from 'node:fs/promises';
import {withTsModule} from '../ontology-ts-loader.mjs';
const kits=JSON.parse(await readFile(process.argv[2]??'tiledata/pixel-art-world/city-kits.json','utf8'));
const sources=Object.fromEntries(kits.sources.map(s=>[s.filename,{...s,id:s.filename}]));
const sourceNames=Object.fromEntries(kits.sources.map(s=>[s.id,s.filename]));
const conveni=JSON.parse(await readFile('src/assets/pixelArtWorldUrbanCatalog.json','utf8'))[0];
sources[conveni.filename]={id:conveni.filename,filename:conveni.filename,url:conveni.downloadUrl,sha256:conveni.sha256,width:conveni.width,height:conveni.height,format:'tileset',tileSize:32,tilesPerRow:8};
const xp=await withTsModule('src/project/pixelArtWorldAutotiles.ts','paw-city-xp.mjs',api=>({masks:api.XP_AUTOTILE_MASKS,normalize:api.normalizeXpAutotileMask}));
const layout=JSON.parse(await readFile('tiledata/pixel-art-world/city-layout.json','utf8'));
const {width,height}=layout,tiles=[],lookup=new Map(),placements=[],entrances=[];
if(width!==50||height!==50)throw Error('City layout must remain 50×50');
function token(source,tile,layer,passage){
 const key=[source,tile,layer,passage].join(':');if(lookup.has(key))return lookup.get(key);
 if(!sources[source])throw Error('Unknown source '+source);
 const definition=sources[source],tileCount=definition.format==='xp-autotile'?definition.variantMasks.length:definition.width*definition.height/(32*32);
 if(!Number.isInteger(tile)||tile<0||tile>=tileCount)throw Error('Invalid source tile '+source+':'+tile);
 const id=tiles.length;tiles.push({source,tile,layer,passage});lookup.set(key,id);return id;
}
const pavement=token(conveni.filename,4,'lower','passable'),asphalt=token(conveni.filename,11,'lower','passable');
const grass=token('ST-Park-E01.png',0,'lower','passable'),soil=token('ST-Park-E01.png',2,'lower','passable');
const lowerTiles=Array(width*height).fill(grass),upperTiles=Array(width*height).fill(-1);
const authoredWalkCells=new Set(),buildingOwner=new Map();
const at=(x,y)=>{if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)throw Error(`Out of map ${x},${y}`);return y*width+x;};
function eachRect(box,visit){
 if(!Number.isInteger(box.width)||!Number.isInteger(box.height)||box.width<1||box.height<1)throw Error('Invalid rectangle');
 for(let dy=0;dy<box.height;dy++)for(let dx=0;dx<box.width;dx++)visit(at(box.x+dx,box.y+dy),box.x+dx,box.y+dy);
}
for(const zone of layout.zones)eachRect(zone.bbox,()=>{});
for(const site of layout.sites){
 const zone=layout.zones.find(z=>z.id===site.zoneId),b=site.bbox;
 if(!zone||b.x<zone.bbox.x||b.y<zone.bbox.y||b.x+b.width>zone.bbox.x+zone.bbox.width||b.y+b.height>zone.bbox.y+zone.bbox.height)throw Error('Building outside its purpose zone '+site.id);
 if(['conveni-front','diner-front'].includes(site.kitId)&&(b.height!==7||b.width<4))throw Error('Invalid shop bbox '+site.id);
 eachRect(site.bbox,i=>{if(buildingOwner.has(i))throw Error(`Building bbox overlap: ${site.id} / ${buildingOwner.get(i)}`);buildingOwner.set(i,site.id);});
 const kit=kits.kits.find(k=>k.id===site.kitId);
 if(kit&&(kit.width!==site.bbox.width||kit.height!==site.bbox.height))throw Error('Kit bbox mismatch '+site.id);
}
if(layout.sites.length!==layout.constraints.buildingCount)throw Error('Wrong building count');
const surfaces={pavement,soil};
for(const area of layout.surfaceAreas){
 if(!(area.surface in surfaces))throw Error('Unknown walk surface '+area.surface);
 eachRect(area.bbox,i=>{if(buildingOwner.has(i))throw Error(`Walkway overlaps building: ${area.id}`);lowerTiles[i]=surfaces[area.surface];authoredWalkCells.add(i);});
}
for(const road of layout.roads)eachRect(road.bbox,i=>{
 if(buildingOwner.has(i))throw Error('Road overlaps building '+road.id);
 lowerTiles[i]=asphalt;authoredWalkCells.delete(i);
});
for(const crossing of layout.crossings)eachRect(crossing.bbox,i=>{
 if(lowerTiles[i]!==asphalt)throw Error('Crossing outside asphalt '+crossing.id);
 upperTiles[i]=token(conveni.filename,crossing.tile,'upper','passable');authoredWalkCells.add(i);
});
for(const marking of layout.laneMarkings??[])for(const cell of marking.cells){
 const i=at(cell.x,cell.y);if(lowerTiles[i]!==asphalt||upperTiles[i]!==-1)throw Error('Lane marking outside clear road '+marking.id);
 upperTiles[i]=token(marking.source,marking.tile,'upper','passable');
}
function placeKit(id,x,y,label,room){
 const kit=kits.kits.find(k=>k.id===id);if(!kit)throw Error('Missing kit '+id);
 if(kit.kind==='building'){
  for(let dy=0;dy<kit.height;dy++)for(let dx=0;dx<kit.width;dx++){
   if(!kit.lowerTiles[dy*kit.width+dx]&&!kit.upperTiles[dy*kit.width+dx])continue;
   const i=at(x+dx,y+dy),t=tiles[lowerTiles[i]];
   lowerTiles[i]=token(t.source,t.tile,'lower','solid');
  }
 }
 for(const layer of ['lowerTiles','upperTiles'])kit[layer].forEach((cell,i)=>{
  if(!cell)return;const target=at(x+i%kit.width,y+Math.floor(i/kit.width));
  if(kit.kind==='prop'&&buildingOwner.has(target))throw Error('Prop overlaps building '+id);
  if(layer==='upperTiles'&&upperTiles[target]!==-1)throw Error(`Upper overlap ${id}`);
  const role=layer==='lowerTiles'?'lower':'upper';
  const value=token(sourceNames[cell.source],cell.tile,role,kit.kind==='ground'?'passable':'solid');
  (layer==='lowerTiles'?lowerTiles:upperTiles)[target]=value;
 });
 const placement={kitId:id,name:label??kit.name,x,y,width:kit.width,height:kit.height,kind:kit.kind};placements.push(placement);
 if(kit.entrance){const entrance={x:x+kit.entrance.x,y:y+kit.entrance.y},approach={x:x+kit.approach.x,y:y+kit.approach.y};entrances.push({...placement,entrance,approach,room,entranceWidth:['school-main','clinic-small'].includes(id)?2:1});}
}
function stamp(x,y,sx,sy,w,h,filename=conveni.filename,passage='solid'){
 for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++){
  const i=at(x+dx,y+dy);if(buildingOwner.has(i))throw Error(`Prop overlaps building ${x+dx},${y+dy}`);if(upperTiles[i]!==-1)throw Error(`Prop overlap ${x+dx},${y+dy}`);
  upperTiles[i]=token(filename,(sy+dy)*8+sx+dx,'upper',passage);
 }
}
function shop(x,y,w,diner=false){
 const h=7;
 for(let dy=0;dy<3;dy++)for(let dx=0;dx<w;dx++){
  let mask=0;for(const [ax,ay,bit]of[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(dx+ax>=0&&dx+ax<w&&dy+ay>=0&&dy+ay<3)mask|=bit;
  lowerTiles[at(x+dx,y+dy)]=token('SA-Roof01.png',xp.masks.indexOf(xp.normalize(mask)),'lower','solid');
 }
 for(let dy=3;dy<h;dy++)for(let dx=0;dx<w;dx++)lowerTiles[at(x+dx,y+dy)]=token(conveni.filename,289,'lower','solid');
 for(let dx=1;dx<w-1;dx++)for(let dy=0;dy<3;dy++)upperTiles[at(x+dx,y+4+dy)]=token(conveni.filename,(44+dy)*8+dx%2,'upper','solid');
 const door=Math.floor(w/2)-1;
 for(let dy=0;dy<3;dy++)for(let dx=0;dx<2;dx++)upperTiles[at(x+door+dx,y+4+dy)]=token(conveni.filename,(47+dy)*8+4+dx,'upper','solid');
 if(!diner)for(let dx=0;dx<w;dx++)upperTiles[at(x+dx,y+3)]=token(conveni.filename,344+(dx===2?2:0),'upper','solid');
 else for(let dy=0;dy<2;dy++)for(let dx=0;dx<w;dx++)upperTiles[at(x+dx,y+3+dy)]=token('ST-Town-E01.png',(30+dy)*8+(dx===0?0:dx===w-1?2:1),'upper','solid');
 const item={kitId:diner?'diner-front':'conveni-front',name:diner?'모퉁이 식당':'초록 편의점',x,y,width:w,height:h,kind:'building'};
 placements.push(item);entrances.push({...item,entrance:{x:x+door,y:y+h-1},approach:{x:x+door,y:y+h},room:diner?'fastfood-compact-diner':'conveni-compact-shop',entranceWidth:2});
}
// Geometry comes from purpose-based zones and routes, before any source tiles are placed.
for(const site of layout.sites){
 const {x,y,width:w}=site.bbox;
 if(site.kitId==='conveni-front'||site.kitId==='diner-front')shop(x,y,w,site.kitId==='diner-front');
 else placeKit(site.kitId,x,y,site.name,site.room);
 Object.assign(placements.at(-1),{siteId:site.id,zoneId:site.zoneId,name:site.name});
 Object.assign(entrances.at(-1),{siteId:site.id,zoneId:site.zoneId,name:site.name,room:site.room});
}
for(const prop of layout.props){
 if(prop.kitId)placeKit(prop.kitId,prop.x,prop.y);
 else if(prop.assembly==='hedge'){
  if(prop.width<3)throw Error('Hedge needs both end caps');
  for(let dx=0;dx<prop.width;dx++){const col=dx===0?0:dx===prop.width-1?2:1;stamp(prop.x+dx,prop.y,col,19,1,2,'ST-Park-E01.png');}
 }else if(prop.assembly==='front-signal'){
  // Pole 192/200/208/216, arm201, lamps202. No white board or reverse head.
  stamp(prop.x,prop.y,0,24,1,4);stamp(prop.x+1,prop.y+1,1,25,2,1);
 }else{const r=prop.sourceRect;stamp(prop.x,prop.y,r.x,r.y,r.width,r.height,prop.source);}
}
const walk=i=>tiles[lowerTiles[i]].passage==='passable'&&(upperTiles[i]<0||tiles[upperTiles[i]].passage==='passable');
const authoredWalk=i=>authoredWalkCells.has(i)&&walk(i);
function flood(start,allowed){
 const first=at(start.x,start.y);if(!allowed(first))throw Error(`Blocked route start ${start.x},${start.y}`);
 const queue=[first],parents=new Map([[first,-1]]);
 for(let q=0;q<queue.length;q++){
  const x=queue[q]%width,y=Math.floor(queue[q]/width);
  for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
   if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const i=at(nx,ny);if(!parents.has(i)&&allowed(i)){parents.set(i,queue[q]);queue.push(i);}
  }
 }
 return parents;
}
const start=layout.start,runtimeReach=flood(start,walk),pedestrianReach=flood(start,authoredWalk);
const entranceChecks=[];
for(const e of entrances)for(let dx=0;dx<e.entranceWidth;dx++){
 const i=at(e.approach.x+dx,e.approach.y);
 if(!pedestrianReach.has(i))throw Error('Entrance lacks authored pedestrian route: '+e.name+' leaf '+dx);
 entranceChecks.push({siteId:e.siteId,x:e.approach.x+dx,y:e.approach.y});
}
const nodes=[...layout.graph.hubs,...entrances.map(e=>({id:e.siteId,...e.approach,kind:'facility',zoneId:e.zoneId}))];
const nodeById=new Map(nodes.map(n=>[n.id,n]));
if(nodeById.size!==nodes.length)throw Error('Duplicate graph node');
for(const n of nodes)if(!pedestrianReach.has(at(n.x,n.y)))throw Error('Disconnected graph node '+n.id);
const graphEdges=layout.graph.edges.map(edge=>{
 const a=nodeById.get(edge.from),b=nodeById.get(edge.to);
 if(!a||!b)throw Error('Unknown graph endpoint');
 const parents=flood(a,authoredWalk),end=at(b.x,b.y);
 if(!parents.has(end))throw Error(`Missing pedestrian graph edge ${edge.from} -> ${edge.to}`);
 const cells=[];for(let i=end;i!==-1;i=parents.get(i))cells.push(i);cells.reverse();
 return {...edge,distance:cells.length-1,cells};
});
const design={...layout,graph:{nodes,edges:graphEdges},generationChecks:{buildingBboxes:layout.sites.length,entranceLeaves:entranceChecks,authoredWalkReachableCells:pedestrianReach.size,graphEdges:graphEdges.length}};
const plan={id:'paw-city-50',name:'햇살동 · 도시 50×50',width,height,tileSize:32,sources:Object.values(sources),tiles,lowerTiles,upperTiles,placements,entrances,start,reachableCells:runtimeReach.size,design,notes:'사용자가 받은 원본 SHA 확인 후 합성한다. 설계 구역→건물 bbox/보행 geometry→타일 순서. 동서 생활도로와 남쪽 접속로, 학교 마당/상가 중심/주거 골목/공원. design.graph의 cells는 실제 보행 지면과 지정 횡단보도로 계산한 연결이며 잔디·무표시 도로 지름길을 허용하지 않는다. 각 tile의 layer/passage 별도. 전체 lower→upper 순서. 시설 내부와 이동 이벤트는 blueprint 입구를 따라 별도 생성한다.'};
await writeFile('tiledata/pixel-art-world/city-50.json',JSON.stringify(plan,null,2)+'\n');
await writeFile('src/assets/pixelArtWorldCity.json',JSON.stringify(plan)+'\n');
console.log({width,height,tiles:tiles.length,buildings:entrances.length,reachable:runtimeReach.size,authoredWalkReachable:pedestrianReach.size,graphEdges:graphEdges.length});
