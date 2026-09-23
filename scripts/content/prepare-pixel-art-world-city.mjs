// 50x50 authored source-coordinate blueprint. Contains no source pixels.
import {readFile,writeFile} from 'node:fs/promises';
import {withTsModule} from '../ontology-ts-loader.mjs';
const kits=JSON.parse(await readFile(process.argv[2]??'tiledata/pixel-art-world/city-kits.json','utf8'));
const sources=Object.fromEntries(kits.sources.map(s=>[s.filename,{...s,id:s.filename}]));
const sourceNames=Object.fromEntries(kits.sources.map(s=>[s.id,s.filename]));
const conveni=JSON.parse(await readFile('src/assets/pixelArtWorldUrbanCatalog.json','utf8'))[0];
sources[conveni.filename]={id:conveni.filename,filename:conveni.filename,url:conveni.downloadUrl,sha256:conveni.sha256,width:conveni.width,height:conveni.height,format:'tileset',tileSize:32,tilesPerRow:8};
const xp=await withTsModule('src/project/pixelArtWorldAutotiles.ts','paw-city-xp.mjs',api=>({masks:api.XP_AUTOTILE_MASKS,normalize:api.normalizeXpAutotileMask}));
const width=50,height=50,tiles=[],lookup=new Map(),placements=[],entrances=[];
function token(source,tile,layer,passage){
 const key=[source,tile,layer,passage].join(':');if(lookup.has(key))return lookup.get(key);
 if(!sources[source])throw Error('Unknown source '+source);
 const id=tiles.length;tiles.push({source,tile,layer,passage});lookup.set(key,id);return id;
}
const pavement=token(conveni.filename,4,'lower','passable'),asphalt=token(conveni.filename,11,'lower','passable');
const grass=token('ST-Park-E01.png',0,'lower','passable'),soil=token('ST-Park-E01.png',2,'lower','passable');
const lowerTiles=Array(width*height).fill(pavement),upperTiles=Array(width*height).fill(-1);
const at=(x,y)=>{if(x<0||y<0||x>=width||y>=height)throw Error(`Out of map ${x},${y}`);return y*width+x;};
function fill(x,y,w,h,t){for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)lowerTiles[at(x+dx,y+dy)]=t;}
for(const x of [16,33])fill(x,0,4,50,asphalt);
for(const y of [17,35])fill(0,y,50,4,asphalt);
// Small lawns belong to individual parcels, not to the road/sidewalk network.
fill(1,1,14,13,grass);fill(21,1,11,12,grass);fill(38,1,11,13,grass);
fill(1,23,14,11,grass);fill(1,40,14,9,grass);fill(21,40,11,9,grass);
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
  const i=at(x+dx,y+dy);if(upperTiles[i]!==-1)throw Error(`Prop overlap ${x+dx},${y+dy}`);
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
placeKit('school-main',2,2,'햇살 학교','school-classroom-north');
placeKit('clinic-small',22,3,'동네 의원','clinic-waiting-exam');
placeKit('apartment-dark-roof',38,3,'동네 도서관','library-compact');
shop(22,24,10);shop(39,24,9,true);
placeKit('home-red-gable',3,40,'붉은 지붕집','home-compact');
placeKit('home-red-gable',24,40,'작은 주택','home-compact');
placeKit('apartment-dark-roof',38,40,'골목 사무실','office-compact');
// Crosswalks use actual road marking cells from the source; they stay passable.
for(const y of [17,35])for(const x of [13,14,21,22,30,31,38,39])for(let dy=0;dy<4;dy++)upperTiles[at(x,y+dy)]=token(conveni.filename,6,'upper','passable');
for(const x of [16,33])for(const y of [14,15,22,23,32,33,40,41])for(let dx=0;dx<4;dx++)upperTiles[at(x+dx,y)]=token(conveni.filename,14,'upper','passable');
// Small park, a path, playground and benches.
fill(6,23,2,11,soil);fill(1,29,14,2,soil);
placeKit('park-swings',1,24);placeKit('park-slide',9,24);
placeKit('park-bench-front',2,31);placeKit('park-bench-front',10,31);
placeKit('park-tree-planter',10,40);placeKit('park-tree-planter',28,10);
// Front benches and bicycles make usable forecourts rather than vacant lawns.
stamp(2,14,4,21,3,1);stamp(10,14,4,21,3,1);stamp(24,13,4,21,3,1);stamp(40,14,4,21,3,1);
stamp(30,31,0,29,2,3);stamp(46,31,0,29,2,3);
stamp(3,12,0,22,3,1,'ST-Town-E01.png');stamp(21,46,0,22,3,1,'ST-Town-E01.png');
for(const [x,y]of[[13,12],[13,30]]){
 stamp(x,y,0,24,3,4);
}
const walk=i=>tiles[lowerTiles[i]].passage==='passable'&&(upperTiles[i]<0||tiles[upperTiles[i]].passage==='passable');
const start={x:20,y:22},queue=[at(start.x,start.y)],seen=new Set(queue);
for(let q=0;q<queue.length;q++){const x=queue[q]%width,y=Math.floor(queue[q]/width);for(const[nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||ny<0||nx>=width||ny>=height)continue;const i=at(nx,ny);if(!seen.has(i)&&walk(i)){seen.add(i);queue.push(i);}}}
for(const e of entrances)for(let dx=0;dx<e.entranceWidth;dx++)if(!seen.has(at(e.approach.x+dx,e.approach.y)))throw Error('Unreachable entrance: '+e.name+' leaf '+dx);
const plan={id:'paw-city-50',name:'햇살동 · 도시 50×50',width,height,tileSize:32,sources:Object.values(sources),tiles,lowerTiles,upperTiles,placements,entrances,start,reachableCells:seen.size,notes:'원본 파일 SHA 확인 후 tiles 사전의 각32px 조각을 같은번호 atlas에 합성한다. XP source의 tile은variantMasks 인덱스다. 각 tile은layer/passage별로 분리되어 투명도와 통행을 혼동하지 않는다. 전체 lower→upper 순서. 모든 시설 approach는 시작점에서 연결된다. 시설 내부와 이동 이벤트는 사용자 원본을 가져온 뒤 별도로 생성한다.'};
await writeFile('tiledata/pixel-art-world/city-50.json',JSON.stringify(plan,null,2)+'\n');
await writeFile('src/assets/pixelArtWorldCity.json',JSON.stringify(plan)+'\n');
console.log({width,height,tiles:tiles.length,buildings:entrances.length,reachable:seen.size});
